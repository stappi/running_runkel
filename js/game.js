// Die Spielwelt eines Levels: Simulation, Kollisionen, Knueppel-Regie und Zeichnen.
// Enthaelt kein DOM, damit tools/playtest.js sie auch ohne Browser laufen lassen kann.
window.RR = window.RR || {};

RR.World = (function () {
  const T = RR.TILE;
  const overlap = RR.Physics.overlap;
  const CLUB_HEIGHTS = { low: 24, mid: 46, high: 66 };
  const WARN_TIME = 0.75;

  class World {
    constructor(index, viewW) {
      this.index = index;
      this.def = RR.LEVELS[index];
      this.level = new RR.Level(this.def);
      this.viewW = viewW || 960;
      this.viewH = 540;
      this.state = 'play';
      this.stateTime = 0;
      this.time = 0;
      this.score = 0;
      this.seeds = 0;
      this.gold = 0;
      this.goldTotal = 0;
      this.particles = [];
      this.clubs = [];
      this.warnings = [];
      this.entities = [];
      this.shake = 0;
      this.hint = null;
      this.hintsLeft = (this.def.hints || []).slice();
      this.banner = 3;
      this.events = {};

      let start = { x: 2 * T, y: 480 };
      this.level.spawns.forEach(s => {
        if (s.type === 'S') { start = s; return; }
        const e = RR.Entities.fromSpawn(s);
        if (e) {
          this.entities.push(e);
          if (e.kind === 'gold') this.goldTotal++;
          if (e.kind === 'goal') this.goalX = e.x;
        }
      });
      if (!this.goalX) this.goalX = this.level.width - T;
      this.respawnPoint = { x: start.x, y: start.y };
      this.player = new RR.Player(start.x, start.y);
      this.cam = { x: 0, y: 36 };
      this.snapCamera();

      this.maxX = start.x;
      this.idle = 0;
      this.clubTimer = this.def.clubs.first;
      this.grace = 0;
    }

    addScore(n) { this.score += n; }

    // --- Effekte -------------------------------------------------------------
    burst(x, y, n, color, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.6);
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, size: 3 + Math.random() * 4, color, g: 700 });
      }
    }

    dust(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.particles.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 50, life: 0.32, max: 0.32, size: 3 + Math.random() * 4, color: this.def.theme.dust, g: 120 });
      }
    }

    // --- Simulation ------------------------------------------------------------
    step(input, dt) {
      this.time += dt;
      this.stateTime += dt;
      if (this.banner > 0) this.banner -= dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);

      this.player.update(this, input, dt);
      this.entities.forEach(e => e.update(this, dt));
      this.clubs.forEach(c => c.update(this, dt));
      if (this.state === 'play') {
        this.collide();
        this.checkFall();
        this.direct(dt);
        this.updateHints();
      } else if (this.state === 'won' && this.stateTime > 2.6 && !this.reported) {
        this.reported = true;
        if (this.events.win) this.events.win();
      } else if (this.state === 'dead' && this.stateTime > 1.8 && !this.reported) {
        this.reported = true;
        if (this.events.gameover) this.events.gameover();
      }

      this.clubs = this.clubs.filter(c => !c.dead);
      this.entities = this.entities.filter(e => !e.dead);
      this.particles.forEach(p => {
        p.life -= dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
      this.particles = this.particles.filter(p => p.life > 0);
      this.updateCamera(dt);
    }

    collide() {
      const p = this.player;
      const px = p.x - p.w / 2, py = p.y - p.h;

      for (const e of this.entities) {
        if (e.boxes) {
          for (const b of e.boxes()) {
            if (!overlap(p.x - p.w / 2, p.y - p.h, p.w, p.h, b.x, b.y, b.w, b.h)) continue;
            const fromAbove = p.vy >= 0 && p.prevY <= b.y + 14;
            if (b.safeTop && fromAbove) {
              if (p.vy > 500) p.squash = 1;
              p.y = b.y;
              p.vy = 0;
              p.onGround = true;
              p.rideVx = e.vx || 0;
            } else if (b.stomp && fromAbove) {
              e.onStomp(this);
            } else {
              this.hurt(e.x);
            }
            break;
          }
        } else if (e.kind === 'seed' || e.kind === 'gold') {
          if (overlap(px, py, p.w, p.h, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
            e.dead = true;
            if (e.gold) {
              this.gold++;
              this.addScore(200);
              this.burst(e.x, e.y, 14, '#ffd21f', 240);
              RR.Audio.play('gold');
            } else {
              this.seeds++;
              this.addScore(10);
              this.burst(e.x, e.y, 3, '#f2a71b', 120);
              RR.Audio.play('seed');
            }
          }
        } else if (e.kind === 'checkpoint') {
          if (!e.on && p.x > e.x - 10) {
            e.on = true;
            this.respawnPoint = { x: e.x, y: e.y };
            p.hearts = Math.min(3, p.hearts + 1);
            RR.Audio.play('checkpoint');
          }
        } else if (e.kind === 'goal') {
          if (p.x >= e.x - 10) this.win();
        }
        if (this.state !== 'play') return;
      }

      for (const c of this.clubs) {
        const s = c.size;
        if (overlap(p.x - p.w / 2, p.y - p.h, p.w, p.h, c.x - s / 2, c.y - s / 2, s, s)) {
          c.dead = true;
          this.burst(c.x, c.y, 7, '#8c4f22', 180);
          if (p.invuln <= 0) this.hurt(c.x);
          if (this.state !== 'play') return;
        }
      }
    }

    hurt(fromX) {
      const p = this.player;
      if (p.invuln > 0 || p.stun > 0) return;
      p.hearts--;
      p.stun = 0.5;
      p.invuln = 1.9;
      p.vx = (p.x < fromX ? -1 : 1) * 230;
      p.vy = -420;
      p.onGround = false;
      p.duck = false;
      this.shake = 1;
      RR.Audio.play('hit');
      if (p.hearts <= 0) this.gameOver();
    }

    checkFall() {
      const p = this.player;
      const lvl = this.level;
      const inWater = lvl.water(Math.floor(p.x / T), Math.floor((p.y - 14) / T));
      if (inWater || p.y > lvl.height + 90) {
        if (inWater) {
          this.burst(p.x, p.y - 10, 16, '#7cc6ec', 300);
          RR.Audio.play('splash');
        }
        p.hearts--;
        this.shake = 0.7;
        if (p.hearts <= 0) {
          RR.Audio.play('hit');
          if (!inWater) p.y = lvl.height - 10;
          p.vy = 0;
          this.gameOver();
          return;
        }
        RR.Audio.play('hit');
        this.respawn();
      }
    }

    respawn() {
      const p = this.player;
      const hearts = p.hearts;
      p.reset(this.respawnPoint.x, this.respawnPoint.y);
      p.hearts = hearts;
      p.invuln = 1.8;
      this.clubs = [];
      this.warnings = [];
      this.grace = 2.5;
      this.idle = 0;
      this.maxX = p.x;
      this.snapCamera();
    }

    gameOver() {
      this.state = 'dead';
      this.stateTime = 0;
      this.reported = false;
      this.warnings = [];
      RR.Audio.play('gameover');
    }

    win() {
      this.state = 'won';
      this.stateTime = 0;
      this.reported = false;
      this.warnings = [];
      this.clubs.forEach(c => { c.dead = true; this.burst(c.x, c.y, 5, '#8c4f22', 140); });
      this.addScore(this.player.hearts * 100);
      RR.Audio.play('win');
    }

    // Knueppel-Regie: Wer troedelt, bekommt mehr davon.
    direct(dt) {
      const p = this.player;
      const cfg = this.def.clubs;
      if (p.x > this.maxX + 3) { this.maxX = p.x; this.idle = 0; } else this.idle += dt;

      if (this.grace > 0) this.grace -= dt;
      const near = this.goalX - p.x < 500;
      const pressure = this.idle > 6 ? 3 : this.idle > 2.5 ? 1.8 : 1;
      this.clubTimer -= dt * pressure;
      if (this.clubTimer <= 0 && this.grace <= 0 && !near) {
        this.clubTimer = cfg.interval * (0.8 + Math.random() * 0.4);
        const kinds = cfg.heights;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        this.warnings.push({ y: p.lastGroundY - CLUB_HEIGHTS[kind], t: WARN_TIME });
      }
      this.warnings.forEach(w => {
        w.t -= dt;
        if (w.t <= 0) {
          this.clubs.push(new RR.Entities.Club(this.cam.x - 50, w.y, cfg.speed));
          RR.Audio.play('whoosh');
        }
      });
      this.warnings = this.warnings.filter(w => w.t > 0);
    }

    updateHints() {
      const h = this.hintsLeft[0];
      if (h && this.player.x > h.col * T) {
        this.hintsLeft.shift();
        this.hint = { h, t: 4.5 };
      }
      if (this.hint) {
        this.hint.t -= 1 / 60;
        if (this.hint.t <= 0) this.hint = null;
      }
    }

    camTarget() {
      const p = this.player;
      const x = Math.max(0, Math.min(this.level.width - this.viewW, p.x - this.viewW * 0.34));
      const y = Math.min(36, Math.max(-60, p.y - 330));
      return { x, y };
    }

    snapCamera() {
      const t = this.camTarget();
      this.cam.x = t.x;
      this.cam.y = t.y;
    }

    updateCamera(dt) {
      const t = this.camTarget();
      const k = 1 - Math.pow(0.0005, dt);
      this.cam.x += (t.x - this.cam.x) * k * 1.6;
      this.cam.y += (t.y - this.cam.y) * k;
    }

    // --- Zeichnen --------------------------------------------------------------
    draw(ctx, opts) {
      const cam = this.cam;
      const sx = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
      const sy = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
      RR.Level.drawBackground(ctx, this.level, cam, this.viewW, this.viewH, this.time);

      ctx.save();
      ctx.translate(Math.round(-cam.x + sx), Math.round(-cam.y + sy));
      const minX = cam.x - 260, maxX = cam.x + this.viewW + 260;
      const visible = e => e.x > minX && e.x < maxX;
      this.entities.forEach(e => {
        if (e.kind === 'decor' && visible(e)) e.draw(ctx, this);
      });
      this.entities.forEach(e => {
        if ((e.kind === 'checkpoint' || e.kind === 'goal') && visible(e)) e.draw(ctx, this);
      });
      ctx.fillStyle = '#000';
      RR.Level.drawTiles(ctx, this.level, cam, this.viewW, this.viewH, this.time);
      this.entities.forEach(e => {
        if (e.kind !== 'decor' && e.kind !== 'checkpoint' && e.kind !== 'goal' && visible(e)) e.draw(ctx, this);
      });
      if (opts && opts.hidePlayer) { /* Titelbild */ } else this.player.draw(ctx, this);
      this.clubs.forEach(c => c.draw(ctx));
      this.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      });
      ctx.globalAlpha = 1;
      if (opts && opts.debug) this.drawDebug(ctx);
      ctx.restore();
    }

    drawDebug(ctx) {
      const p = this.player;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0ff';
      ctx.strokeRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      ctx.strokeStyle = '#f0f';
      this.entities.forEach(e => {
        if (e.boxes) e.boxes().forEach(b => ctx.strokeRect(b.x, b.y, b.w, b.h));
      });
      this.clubs.forEach(c => ctx.strokeRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size));
    }
  }

  return World;
})();
