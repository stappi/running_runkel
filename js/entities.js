// Knueppel, Hindernisse, Sammelobjekte und Dekoration.
// Jedes Objekt hat update(world, dt) und draw(ctx, world); Gefahren zusaetzlich boxes().
window.RR = window.RR || {};

RR.Entities = (function () {
  const T = RR.TILE;
  const A = () => RR.Assets;

  // Horizontal laufen, an Waenden und Kanten umdrehen. Liefert false beim Umdrehen.
  function walk(e, world, dt) {
    const lvl = world.level;
    const nx = e.x + e.vx * dt;
    const front = nx + Math.sign(e.vx) * e.w / 2;
    const col = Math.floor(front / T);
    const blocked = lvl.solid(col, Math.floor((e.y - 8) / T));
    const hasFloor = lvl.ground(col, Math.floor((e.y + 4) / T));
    if (blocked || !hasFloor || nx < 0 || nx > lvl.width) {
      e.vx = -e.vx;
      return false;
    }
    e.x = nx;
    return true;
  }

  function legs(ctx, list, y, len, t, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    list.forEach((lx, i) => {
      const s = Math.sin(t + i * Math.PI + (i > 1 ? Math.PI / 2 : 0)) * 5;
      ctx.beginPath();
      ctx.moveTo(lx, y - len);
      ctx.lineTo(lx + s, y - 2);
      ctx.stroke();
    });
  }

  function dizzyStars(ctx, x, y, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      const sx = x + Math.cos(a) * 24, sy = y + Math.sin(a) * 7;
      ctx.fillStyle = '#f2c31b';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const b = j * Math.PI / 5 + a;
        const d = j % 2 ? 2.8 : 7;
        ctx.lineTo(sx + Math.cos(b) * d, sy + Math.sin(b) * d);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // --- Knueppel ------------------------------------------------------------
  class Club {
    constructor(x, y, speed) {
      this.kind = 'club';
      this.x = x; this.y = y;
      this.vx = speed;
      this.rot = Math.random() * 6;
      this.size = 24;
      this.dead = false;
    }
    update(world, dt) {
      this.x += this.vx * dt;
      this.rot += dt * 11;
      const lvl = world.level;
      if (lvl.solid(Math.floor((this.x + 14) / T), Math.floor(this.y / T))) {
        this.dead = true;
        world.burst(this.x, this.y, 7, '#8c4f22', 160);
        RR.Audio.play('crack');
      }
      if (this.x > world.cam.x + world.viewW + 200) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      A().draw(ctx, 'club', -35, -14);
      ctx.restore();
    }
  }

  // --- Baumstamm: oben sicher, von der Seite gefaehrlich --------------------
  class Log {
    constructor(s) {
      this.kind = 'log';
      this.x = s.x; this.y = s.y;
      this.w = 104; this.h = 50;
      this.vx = 0;
    }
    boxes() { return [{ x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h, safeTop: true }]; }
    update() {}
    draw(ctx) { A().draw(ctx, 'log', this.x - 60, this.y - 56); }
  }

  // --- Rollender Stamm -------------------------------------------------------
  class RollingLog {
    constructor(s) {
      this.kind = 'rolling';
      this.x = s.x; this.y = s.y;
      this.w = 50; this.h = 50;
      this.vx = -190; this.vy = 0;
      this.rot = 0;
      this.active = false;
      this.dead = false;
    }
    boxes() { return [{ x: this.x - 23, y: this.y - 46, w: 46, h: 46, stomp: true }]; }
    onStomp(world) { world.player.vy = -620; RR.Audio.play('stomp'); }
    update(world, dt) {
      if (!this.active) {
        if (this.x < world.cam.x + world.viewW + 180) this.active = true;
        return;
      }
      this.rot += this.vx * dt / 28;
      this.vy += 1900 * dt;
      RR.Physics.moveX(this, world.level, dt);
      RR.Physics.moveY(this, world.level, dt);
      if (this.vx === 0) { this.dead = true; world.burst(this.x, this.y - 25, 12, '#8a5a2b', 220); RR.Audio.play('crack'); }
      if (this.y > world.level.height + 60 || this.x < world.cam.x - 300) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y - 28);
      ctx.rotate(this.rot);
      A().draw(ctx, 'log_round', -30, -30);
      ctx.restore();
    }
  }

  // --- Wildschwein -----------------------------------------------------------
  class Boar {
    constructor(s) {
      this.kind = 'boar';
      this.x = s.x; this.y = s.y;
      this.w = 86; this.h = 64;
      this.vx = -55;
      this.t = Math.random() * 6;
      this.stun = 0;
      this.charging = false;
      this.alert = 0;
    }
    boxes() {
      if (this.stun > 0) return [];
      return [{ x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h, stomp: true }];
    }
    onStomp(world) {
      this.stun = 2.6;
      this.charging = false;
      world.player.vy = -640;
      world.addScore(50);
      world.burst(this.x, this.y - 50, 8, '#f2c31b', 180);
      RR.Audio.play('stomp');
    }
    update(world, dt) {
      if (this.stun > 0) {
        this.stun -= dt;
        this.t += dt;
        return;
      }
      const p = world.player;
      const dx = p.x - this.x;
      const near = Math.abs(dx) < 340 && Math.abs(p.y - this.y) < 90;
      if (!this.charging && near && this.alert <= 0) {
        this.alert = 0.45;
        this.vx = Math.sign(dx) * 55;
        RR.Audio.play('grunt');
      }
      if (this.alert > 0) {
        this.alert -= dt;
        if (this.alert <= 0) this.charging = true;
        this.t += dt * 22;
        return;
      }
      if (this.charging) {
        this.vx = Math.sign(this.vx || -1) * 285;
        if (!near) { this.charging = false; this.vx = Math.sign(this.vx) * 55; }
      }
      this.t += Math.abs(this.vx) * dt * 0.09;
      if (!walk(this, world, dt)) this.charging = false;
    }
    draw(ctx) {
      const flip = this.vx > 0;
      const y = this.y;
      ctx.save();
      ctx.translate(this.x, y);
      if (flip) ctx.scale(-1, 1);
      if (this.stun > 0) {
        ctx.rotate(Math.sin(this.t * 14) * 0.05);
      }
      legs(ctx, [-34, -18, 20, 36], 0, 18, this.t, '#000', 8);
      const hop = this.alert > 0 ? Math.abs(Math.sin(this.t)) * -4 : Math.sin(this.t * 2) * 1.5;
      A().draw(ctx, 'boar', -60, -84 + hop);
      ctx.restore();
      if (this.stun > 0) dizzyStars(ctx, this.x, this.y - 66, this.t);
    }
  }

  // --- Kuh -------------------------------------------------------------------
  class Cow {
    constructor(s) {
      this.kind = 'cow';
      this.x = s.x; this.y = s.y;
      this.w = 126; this.h = 88;
      this.vx = -28;
      this.pause = Math.random() * 3;
      this.home = s.x;
      this.t = Math.random() * 6;
      this.mooed = false;
    }
    boxes() { return [{ x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h, safeTop: true }]; }
    update(world, dt) {
      const near = Math.abs(world.player.x - this.x) < 500;
      if (near && !this.mooed) { this.mooed = true; RR.Audio.play('moo'); }
      if (this.pause > 0) {
        this.pause -= dt;
        return;
      }
      this.t += dt * 3.2;
      const moved = walk(this, world, dt);
      if (!moved || Math.abs(this.x - this.home) > 90) {
        if (moved) this.vx = -Math.sign(this.x - this.home) * Math.abs(this.vx);
        this.pause = 1 + Math.random() * 2.5;
        this.x += this.vx * dt;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.vx > 0) ctx.scale(-1, 1);
      legs(ctx, [-34, -12, 40, 60], 0, 26, this.t, '#000', 10);
      A().draw(ctx, 'cow', -78, -112);
      ctx.restore();
    }
  }

  // --- Traktor ---------------------------------------------------------------
  class Tractor {
    constructor(s) {
      this.kind = 'tractor';
      this.x = s.x; this.y = s.y;
      this.w = 200; this.h = 150;
      this.vx = -105;
      this.active = false;
      this.rot = 0;
      this.smoke = 0;
    }
    boxes() {
      const front = this.vx < 0 ? -1 : 1;
      const hoodW = 96, cabW = 104;
      // Motorhaube vorne niedrig, Kabine hinten hoch; beide von oben begehbar.
      const hoodX = front < 0 ? this.x - 100 : this.x + 100 - hoodW;
      const cabX = front < 0 ? this.x - 100 + hoodW : this.x - 100;
      return [
        { x: hoodX, y: this.y - 104, w: hoodW, h: 104, safeTop: true },
        { x: cabX, y: this.y - 158, w: cabW, h: 158, safeTop: true }
      ];
    }
    update(world, dt) {
      if (!this.active) {
        if (this.x - this.w / 2 < world.cam.x + world.viewW + 60) this.active = true;
        return;
      }
      if (!walk(this, world, dt)) this.vx = Math.sign(this.vx) * 105;
      this.rot += this.vx * dt / 40;
      this.smoke -= dt;
      if (this.smoke <= 0) {
        this.smoke = 0.22;
        const dir = this.vx < 0 ? 1 : -1;
        world.particles.push({ x: this.x - dir * 48, y: this.y - 172, vx: dir * 30, vy: -55, life: 0.9, max: 0.9, size: 8, color: 'rgba(70,70,70,.55)', g: 0 });
      }
      if (this.x < world.cam.x - 500) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.vx > 0) ctx.scale(-1, 1);
      const shake = Math.sin(this.rot * 7) * 1.2;
      A().draw(ctx, 'tractor', -110, -172 + shake);
      const wheel = (name, wx, r) => {
        ctx.save();
        ctx.translate(wx, -r);
        ctx.rotate(this.rot * 40 / r);
        A().draw(ctx, name, -r, -r);
        ctx.restore();
      };
      wheel('wheel_small', -62, 26);
      wheel('wheel_big', 54, 42);
      ctx.restore();
    }
  }

  // --- Sammeln ---------------------------------------------------------------
  class Pickup {
    constructor(s, gold) {
      this.kind = gold ? 'gold' : 'seed';
      this.gold = gold;
      this.x = s.x; this.y = s.cy;
      this.t = Math.random() * 6;
      this.dead = false;
      this.w = gold ? 36 : 26;
      this.h = gold ? 50 : 26;
    }
    update(world, dt) { this.t += dt * 3; }
    draw(ctx) {
      const b = Math.sin(this.t) * (this.gold ? 5 : 3);
      if (this.gold) {
        A().draw(ctx, 'gold_runkel', this.x - 20, this.y - 28 + b);
      } else {
        A().draw(ctx, 'seed', this.x - 11, this.y - 11 + b);
      }
    }
  }

  class Checkpoint {
    constructor(s) {
      this.kind = 'checkpoint';
      this.x = s.x; this.y = s.y;
      this.on = false;
      this.t = 0;
    }
    update(world, dt) { this.t += dt; }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.on) ctx.rotate(Math.sin(this.t * 8) * 0.04);
      A().draw(ctx, 'scarecrow', -40, -124);
      if (this.on) {
        // Runkelfahne: der Ruecksetzpunkt ist aktiv
        ctx.fillStyle = '#ff8a00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, -112);
        ctx.lineTo(62 + Math.sin(this.t * 7) * 3, -102);
        ctx.lineTo(30, -90);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class Goal {
    constructor(s) {
      this.kind = 'goal';
      this.x = s.x; this.y = s.y;
    }
    update() {}
    draw(ctx) { A().draw(ctx, 'goal', this.x - 65, this.y - 190); }
  }

  class Decor {
    constructor(s, name) {
      this.kind = 'decor';
      this.name = name;
      this.x = s.x; this.y = s.y;
    }
    update() {}
    draw(ctx) {
      const size = A().size(this.name);
      A().draw(ctx, this.name, this.x - size[0] / 2, this.y - size[1]);
    }
  }

  function fromSpawn(s) {
    switch (s.type) {
      case 'L': return new Log(s);
      case 'R': return new RollingLog(s);
      case 'B': return new Boar(s);
      case 'K': return new Cow(s);
      case 'T': return new Tractor(s);
      case 'o': return new Pickup(s, false);
      case 'G': return new Pickup(s, true);
      case 'C': return new Checkpoint(s);
      case 'E': return new Goal(s);
      case 'f': return new Decor(s, 'fence');
      case 'r': return new Decor(s, 'beet_plant');
      case 'P': return new Decor(s, 'barrel');
      default: return null;
    }
  }

  return { Club, fromSpawn };
})();
