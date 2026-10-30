// Bewegung gegen die Tilemap. Ein Koerper hat x (Mitte), y (Fuesse), w, h, vx, vy.
window.RR = window.RR || {};

RR.TILE = 48;

RR.Physics = (function () {
  const T = RR.TILE;

  function moveX(b, level, dt) {
    if (!b.vx) return;
    const nx = b.x + b.vx * dt;
    const edge = nx + Math.sign(b.vx) * b.w / 2;
    const col = Math.floor(edge / T);
    const r0 = Math.floor((b.y - b.h + 1) / T);
    const r1 = Math.floor((b.y - 1) / T);
    for (let r = r0; r <= r1; r++) {
      if (level.solid(col, r)) {
        b.x = b.vx > 0 ? col * T - b.w / 2 - 0.01 : (col + 1) * T + b.w / 2 + 0.01;
        b.vx = 0;
        return;
      }
    }
    b.x = nx;
  }

  function moveY(b, level, dt) {
    const ny = b.y + b.vy * dt;
    const c0 = Math.floor((b.x - b.w / 2 + 1) / T);
    const c1 = Math.floor((b.x + b.w / 2 - 1) / T);
    b.onGround = false;
    if (b.vy >= 0) {
      const row = Math.floor(ny / T);
      const top = row * T;
      for (let c = c0; c <= c1; c++) {
        const hit = level.solid(c, row) || (level.oneWay(c, row) && b.y <= top + 0.5 && !b.dropThrough);
        if (hit && ny >= top) {
          b.y = top;
          b.vy = 0;
          b.onGround = true;
          return;
        }
      }
    } else {
      const row = Math.floor((ny - b.h) / T);
      for (let c = c0; c <= c1; c++) {
        if (level.solid(c, row)) {
          b.y = (row + 1) * T + b.h + 0.01;
          b.vy = 0;
          return;
        }
      }
    }
    b.y = ny;
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  return { moveX, moveY, overlap };
})();
