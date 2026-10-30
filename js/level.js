// Tilemap, Levelaufbau aus Textraster, Tiles und Parallax-Hintergrund.
window.RR = window.RR || {};

RR.ROWS = 12;

RR.Level = (function () {
  const T = RR.TILE;
  const ENTITY_CHARS = 'SLRBKToGCEfrP';

  class Level {
    constructor(def) {
      this.def = def;
      this.grid = [];
      this.spawns = [];
      for (let r = 0; r < RR.ROWS; r++) this.grid.push([]);
      let offset = 0;
      def.chunks.forEach((chunk, idx) => {
        const width = Math.max(...chunk.map(s => s.length));
        chunk.forEach(s => {
          if (s.length !== width && typeof console !== 'undefined') console.warn('Level ' + def.name + ': Chunk ' + idx + ' ungleich breit');
        });
        const top = RR.ROWS - chunk.length;
        for (let r = 0; r < RR.ROWS; r++) {
          const line = r >= top ? chunk[r - top] : '';
          for (let c = 0; c < width; c++) {
            let ch = c < line.length ? line[c] : '.';
            if (ENTITY_CHARS.indexOf(ch) >= 0) {
              this.spawns.push({ type: ch, col: offset + c, row: r });
              ch = '.';
            }
            this.grid[r][offset + c] = ch;
          }
        }
        offset += width;
      });
      this.cols = offset;
      this.width = offset * T;
      this.height = RR.ROWS * T;
      this.spawns.forEach(s => {
        s.x = (s.col + 0.5) * T;
        s.y = this.floorBelow(s.col, s.row);
        s.cy = (s.row + 0.5) * T;
      });
    }

    // Oberkante des ersten festen Tiles unter (col, row)
    floorBelow(col, row) {
      for (let r = row + 1; r < RR.ROWS; r++) {
        if (this.solid(col, r) || this.oneWay(col, r)) return r * T;
      }
      return (row + 1) * T;
    }

    tile(c, r) {
      if (r < 0 || r >= RR.ROWS) return '.';
      if (c < 0 || c >= this.cols) return '#';
      return this.grid[r][c] || '.';
    }

    solid(c, r) {
      const t = this.tile(c, r);
      return t === '#' || t === 'H' || t === 'X';
    }

    oneWay(c, r) { return this.tile(c, r) === '='; }

    ground(c, r) { return this.solid(c, r) || this.oneWay(c, r); }

    water(c, r) { return this.tile(c, r) === '~'; }
  }

  // --- Zeichnen -------------------------------------------------------------

  const tileCache = {};

  function makeTile(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = T * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    draw(g);
    return c;
  }

  function themeTiles(theme) {
    if (tileCache[theme.id]) return tileCache[theme.id];
    const specks = (g, col) => {
      g.fillStyle = col;
      [[8, 12], [30, 8], [20, 28], [40, 34], [6, 38], [28, 42]].forEach(p => g.fillRect(p[0], p[1], 4, 3));
    };
    const set = {
      dirt: makeTile(g => {
        g.fillStyle = theme.dirt;
        g.fillRect(0, 0, T, T);
        specks(g, theme.dirtDark);
      }),
      top: makeTile(g => {
        g.fillStyle = theme.dirt;
        g.fillRect(0, 0, T, T);
        specks(g, theme.dirtDark);
        g.fillStyle = theme.dirtDark;
        if (theme.furrows) { g.fillRect(0, 26, T, 3); g.fillRect(0, 38, T, 3); }
        // Grasnarbe mit welliger Kante wie in der Vorlage
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(T, 0);
        g.lineTo(T, 12);
        g.quadraticCurveTo(T * 0.875, 20, T * 0.75, 12);
        g.quadraticCurveTo(T * 0.625, 20, T * 0.5, 12);
        g.quadraticCurveTo(T * 0.375, 20, T * 0.25, 12);
        g.quadraticCurveTo(T * 0.125, 20, 0, 12);
        g.closePath();
        g.fillStyle = theme.grass;
        g.fill();
        g.beginPath();
        g.moveTo(T, 12);
        g.quadraticCurveTo(T * 0.875, 20, T * 0.75, 12);
        g.quadraticCurveTo(T * 0.625, 20, T * 0.5, 12);
        g.quadraticCurveTo(T * 0.375, 20, T * 0.25, 12);
        g.quadraticCurveTo(T * 0.125, 20, 0, 12);
        g.lineWidth = 3;
        g.strokeStyle = '#000';
        g.stroke();
        g.fillStyle = '#000';
        g.fillRect(0, 0, T, 3);
        g.fillStyle = theme.grassLight;
        g.fillRect(6, 5, 12, 3);
        g.fillRect(28, 5, 9, 3);
      }),
      plank: makeTile(g => {
        g.fillStyle = '#b07a3e';
        g.fillRect(0, 2, T, 16);
        g.fillStyle = '#8a5a2b';
        g.fillRect(0, 12, T, 2);
        g.fillRect(14, 2, 2, 10);
        g.fillRect(38, 6, 2, 6);
        g.fillStyle = '#000';
        g.fillRect(0, 0, T, 3);
        g.fillRect(0, 17, T, 3);
      }),
      crate: makeTile(g => {
        g.fillStyle = '#a56a33';
        g.fillRect(2, 2, T - 4, T - 4);
        g.lineWidth = 4;
        g.strokeStyle = '#000';
        g.strokeRect(2, 2, T - 4, T - 4);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(4, 4); g.lineTo(T - 4, T - 4);
        g.moveTo(T - 4, 4); g.lineTo(4, T - 4);
        g.stroke();
      })
    };
    tileCache[theme.id] = set;
    return set;
  }

  function drawTiles(ctx, level, cam, viewW, viewH, time) {
    const set = themeTiles(level.def.theme);
    const c0 = Math.max(0, Math.floor(cam.x / T));
    const c1 = Math.min(level.cols - 1, Math.floor((cam.x + viewW) / T));
    const r0 = Math.max(0, Math.floor(cam.y / T));
    const r1 = Math.min(RR.ROWS - 1, Math.floor((cam.y + viewH) / T));
    const hay = RR.Assets.get('hay');
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = level.grid[r][c];
        const x = c * T, y = r * T;
        if (t === '#') {
          ctx.drawImage(level.tile(c, r - 1) === '#' ? set.dirt : set.top, x, y, T, T);
          ctx.fillStyle = '#000';
          if (!level.solid(c - 1, r)) ctx.fillRect(x - 1, y, 4, T);
          if (!level.solid(c + 1, r)) ctx.fillRect(x + T - 3, y, 4, T);
        } else if (t === '=') {
          ctx.drawImage(set.plank, x, y, T, T);
        } else if (t === 'H') {
          ctx.drawImage(hay, x, y, T, T);
        } else if (t === 'X') {
          ctx.drawImage(set.crate, x, y, T, T);
        } else if (t === '~') {
          ctx.fillStyle = 'rgba(60, 150, 210, .9)';
          ctx.fillRect(x, y + 12, T, T - 12);
          ctx.fillStyle = 'rgba(255, 255, 255, .7)';
          const w = Math.sin(time * 3 + c) * 4;
          ctx.fillRect(x + 6 + w, y + 15, 18, 3);
          ctx.fillRect(x + 26 - w, y + 24, 14, 3);
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y + 10, T, 3);
        }
      }
    }
  }

  const clouds = [[120, 70, 1.1], [520, 40, 0.8], [840, 96, 1.3], [1260, 54, 0.9], [1640, 86, 1.15]];

  function drawCloud(ctx, x, y, k) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.moveTo(-60, 20);
    ctx.bezierCurveTo(-90, 18, -82, -14, -50, -8);
    ctx.bezierCurveTo(-44, -34, -6, -36, 4, -14);
    ctx.bezierCurveTo(22, -28, 56, -18, 52, -2);
    ctx.bezierCurveTo(84, -4, 84, 20, 56, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground(ctx, level, cam, viewW, viewH, time) {
    const th = level.def.theme;
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    th.sky.forEach((c, i) => sky.addColorStop(i / (th.sky.length - 1), c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    // Sonne
    ctx.fillStyle = th.sun;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(viewW * th.sunX - cam.x * 0.02, th.sunY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wolken ziehen langsam vorbei
    ctx.fillStyle = th.cloud;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 3;
    const span = 1920;
    clouds.forEach(cl => {
      let x = (cl[0] - cam.x * 0.08 - time * 6) % span;
      if (x < -140) x += span;
      drawCloud(ctx, x, cl[1], cl[2]);
    });

    const yShift = (36 - cam.y);
    [['bg_hills', 0.18, th.tintFar, 0.15], ['bg_mid_' + th.id, 0.42, th.tintMid, 0.35], ['bg_near', 0.7, th.tintNear, 0.6]].forEach(l => {
      const img = RR.Assets.layer(l[0], l[2]);
      const w = 1920;
      let x = -((cam.x * l[1]) % w);
      const y = yShift * l[3];
      while (x < viewW) {
        ctx.drawImage(img, x, y, w, viewH);
        x += w;
      }
    });
    // Falls die Kamera hochfaehrt, bleibt unten kein Himmel sichtbar.
  }

  Level.drawTiles = drawTiles;
  Level.drawBackground = drawBackground;
  return Level;
})();
