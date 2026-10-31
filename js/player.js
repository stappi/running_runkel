// Spielfigur: Steuerung, Physik-Parameter und Wahl der Rig-Pose.
window.RR = window.RR || {};

RR.Player = (function () {
  const MAX_RUN = 300;
  const MAX_DUCK = 110;
  const ACCEL = 1900;
  const AIR_ACCEL = 1400;
  const DECEL = 2300;
  const GRAVITY = 1900;
  const JUMP = 800;
  const MAX_FALL = 1000;
  const COYOTE = 0.09;
  const BUFFER = 0.12;
  const STAND_H = 68;
  const DUCK_H = 42;
  // Von der Lauf- in die Ruhehaltung: beim Anhalten gemaechlich, beim Loslaufen schnell.
  const CALM_DELAY = 0.2;
  const CALM_IN = 0.3;
  const CALM_OUT = 0.1;
  // Sprung- und Duckhaltung gleiten rasch ein, die Mimik wechselt noch etwas schneller.
  const POSE_BLEND = 0.08;
  const FACE_BLEND = 0.12;
  const STUN = 0.5;

  class Player {
    constructor(x, y) {
      this.w = 34;
      this.h = STAND_H;
      this.reset(x, y);
      this.hearts = 3;
    }

    reset(x, y) {
      this.x = x; this.y = y;
      this.prevY = y;
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.duck = false;
      this.coyote = 0;
      this.buffer = 0;
      this.stun = 0;
      this.invuln = 0;
      this.hurtFace = false;
      this.phase = 0;
      this.t = 0;
      this.squash = 0;
      this.still = 1;
      this.calm = 1;
      this.airK = 0;
      this.duckK = 0;
      this.expr = 'happy';
      this.exprFrom = 'happy';
      this.exprK = 1;
      this.rideVx = 0;
      this.lastGroundY = y;
      this.dropThrough = false;
      this.h = STAND_H;
    }

    // Waere beim Aufstehen eine Decke im Weg?
    headBlocked(lvl) {
      const row = Math.floor((this.y - STAND_H) / RR.TILE);
      const c0 = Math.floor((this.x - this.w / 2 + 1) / RR.TILE);
      const c1 = Math.floor((this.x + this.w / 2 - 1) / RR.TILE);
      for (let c = c0; c <= c1; c++) if (lvl.solid(c, row)) return true;
      return false;
    }

    update(world, input, dt) {
      this.t += dt;
      this.prevY = this.y;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 5);

      const lvl = world.level;
      let move = 0;
      const free = this.stun <= 0 && world.state === 'play';
      if (this.stun > 0) this.stun -= dt;
      if (free) {
        move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (input.jumpPressed) this.buffer = BUFFER;
      }

      // Ducken nur am Boden; aufstehen nur, wenn darueber Platz ist.
      const wantDuck = free && input.down && this.onGround;
      if (wantDuck) {
        this.duck = true;
      } else if (this.duck && !this.headBlocked(lvl)) {
        this.duck = false;
      }
      this.h = this.duck ? DUCK_H : STAND_H;

      const max = this.duck ? MAX_DUCK : MAX_RUN;
      if (move) {
        const a = this.onGround ? ACCEL : AIR_ACCEL;
        this.vx += move * a * dt;
        if (Math.abs(this.vx) > max) this.vx = Math.sign(this.vx) * Math.max(max, Math.abs(this.vx) - DECEL * dt);
        this.facing = move;
      } else if (free || this.onGround) {
        const d = (this.onGround ? DECEL : DECEL * 0.25) * dt;
        this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
      }

      if (this.onGround) { this.coyote = COYOTE; this.lastGroundY = this.y; } else if (this.coyote > 0) this.coyote -= dt;
      if (this.buffer > 0) this.buffer -= dt;

      if (this.buffer > 0 && this.coyote > 0 && free && !(this.duck && this.headBlocked(lvl))) {
        this.vy = -JUMP;
        this.buffer = 0;
        this.coyote = 0;
        this.onGround = false;
        this.duck = false;
        this.h = STAND_H;
        world.dust(this.x, this.y, 5);
        RR.Audio.play('jump');
      }

      // Variable Sprunghoehe: wer frueh loslaesst, faellt schneller
      let g = GRAVITY;
      if (this.vy < -220 && !input.jumpHeld) g *= 2.4;
      this.vy = Math.min(MAX_FALL, this.vy + g * dt);

      const before = this.onGround;
      const fallSpeed = this.vy;
      if (this.rideVx) { this.x += this.rideVx * dt; this.rideVx = 0; }
      RR.Physics.moveX(this, lvl, dt);
      RR.Physics.moveY(this, lvl, dt);
      if (this.onGround && !before && fallSpeed > 500) {
        this.squash = 1;
        world.dust(this.x, this.y, 6);
        RR.Audio.play('land');
      }
      if (this.x < this.w / 2) { this.x = this.w / 2; this.vx = 0; }

      this.phase += Math.abs(this.vx) * dt * 0.045;
      this.still = (Math.abs(this.vx) < 8 && (this.onGround || before)) ? this.still + dt : 0;
      const calmDown = world.state === 'won' || (this.still > CALM_DELAY && !this.duck);
      this.calm = calmDown ? Math.min(1, this.calm + dt / CALM_IN) : Math.max(0, this.calm - dt / CALM_OUT);

      const step = dt / POSE_BLEND;
      this.airK = this.onGround ? Math.max(0, this.airK - step) : Math.min(1, this.airK + step);
      this.duckK = this.duck ? Math.min(1, this.duckK + step) : Math.max(0, this.duckK - step);

      const expr = this.expression(world);
      if (expr !== this.expr) {
        this.exprFrom = this.expr;
        this.expr = expr;
        this.exprK = 0;
      }
      this.exprK = Math.min(1, this.exprK + dt / FACE_BLEND);
    }

    // Stehen: freundlich, Rennen: aengstlich, nach einem Treffer: kraenklich.
    expression(world) {
      if (world.state === 'won') return 'joy';
      if (this.invuln > 0 && this.hurtFace) return 'sick';
      if (this.duck) return 'duck';
      if (!this.onGround) return this.vy < 80 ? 'jump' : 'fall';
      return Math.abs(this.vx) > MAX_RUN * 0.25 ? 'scared' : 'happy';
    }

    pose(world) {
      if (world.state === 'dead' || this.stun > 0) {
        return { fig: 'inv', t: this.t, facing: this.facing, hit: STUN - Math.max(0, this.stun), airK: this.airK };
      }
      return {
        fig: 'man', t: this.t, phase: this.phase, facing: world.state === 'won' ? 1 : this.facing,
        calm: this.calm, cheer: world.state === 'won', wave: Math.sin(this.t * 0.7) > 0.55,
        sn: Math.min(1, Math.abs(this.vx) / MAX_RUN),
        vy: this.vy, onGround: this.onGround, duck: this.duck, squash: this.squash,
        airK: this.airK, duckK: this.duckK, sick: this.expr === 'sick',
        expr: this.expr, exprFrom: this.exprFrom, exprK: this.exprK
      };
    }

    draw(ctx, world) {
      if (this.invuln > 0 && this.stun <= 0 && world.state === 'play' && Math.floor(this.t * 14) % 2) return;
      RR.Rig.draw(ctx, this.x, this.y + 1, this.pose(world));
    }
  }

  return Player;
})();
