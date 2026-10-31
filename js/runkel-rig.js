// Cut-out-Rig der Runkel: Koerper und Blaetter stammen aus den Vorlagen,
// Arme und Beine werden in deren Stil neu gezeichnet und frei bewegt.
// Alle Masse sind Vorlagen-Einheiten (Ansicht 1414x2000). Vorne ist +x.
window.RR = window.RR || {};

RR.Rig = (function () {
  const LIMB = 10;
  const SCALE = { man: 0.072, inv: 0.066 };
  const OX = 720, OY = 1760;
  const HIP_L = [660, 1385], HIP_R = [800, 1378];
  const SHOULDER_L = [484, 1085], SHOULDER_R = [956, 1062];
  const LEG = 350;
  const ARM = 380;

  function part(ctx, name) {
    const p = RR.SPRITE_PARTS[name];
    ctx.drawImage(RR.Assets.get(name), p[0], p[1], p[2], p[3]);
  }

  function limb(ctx, x0, y0, x1, y1, bend) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx - dy / len * bend, my + dx / len * bend, x1, y1);
    ctx.lineWidth = LIMB;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  function foot(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  // Die Hand ist wie in den Vorlagen ein hohles Oval, das am Armende ansetzt.
  function arm(ctx, x0, y0, x1, y1, bend) {
    limb(ctx, x0, y0, x1, y1, bend);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const cx = (x0 + x1) / 2 - dy / len * bend, cy = (y0 + y1) / 2 + dx / len * bend;
    const ang = Math.atan2(y1 - cy, x1 - cx);
    ctx.save();
    ctx.translate(x1 + Math.cos(ang) * 32, y1 + Math.sin(ang) * 32);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 18, 0, 0, Math.PI * 2);
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();
  }

  function leaves(ctx, name, px, py, rot) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.translate(-px, -py);
    part(ctx, name);
    ctx.restore();
  }

  function speedLines(ctx, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    const jitter = Math.sin(t * 40) * 14;
    [[440, 1100, -30, 1110], [375, 1145, -100, 1155], [395, 1185, -80, 1195]].forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l[0] + jitter, l[1]);
      ctx.quadraticCurveTo((l[0] + l[2]) / 2, l[1] + 44, l[2] + jitter, l[3]);
      ctx.stroke();
    });
    [[255, 1115, 260, 1225], [190, 1085, 175, 1250]].forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l[0] + jitter, l[1]);
      ctx.quadraticCurveTo(l[0] - 26 + jitter, (l[1] + l[3]) / 2, l[2] + jitter, l[3]);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Eine Haltung: Fuesse [x, y, Winkel], Haende [x, y], Beinkruemmung und Koerperlage.
  function pose(feet, hands, o) {
    return Object.assign({ feet, hands, bend: [-26, -26], hop: 0, tilt: 0, lean: 0, leaf: 0, sx: 1, sy: 1 }, o);
  }

  function runPose(s) {
    const sn = s.sn || 0;
    const wind = Math.sin(s.t * 13) * 0.05 * (0.35 + sn);
    if (s.duck) {
      return pose(
        [[HIP_L[0] - 80, HIP_L[1] + LEG, -0.2], [HIP_R[0] + 70, HIP_R[1] + LEG, -0.2]],
        [[SHOULDER_L[0] - 170, SHOULDER_L[1] + 150], [SHOULDER_R[0] + 170, SHOULDER_R[1] + 170]],
        { leaf: -0.55 + wind, sx: 1.14, sy: 0.66 }
      );
    }
    if (!s.onGround) {
      const lift = Math.max(-0.35, Math.min(0.35, (s.vy || 0) / 1800));
      const leaf = wind - 0.2 * sn + lift;
      if (s.vy < 80) {
        return pose(
          [[HIP_L[0] - 140, HIP_L[1] + 210, -0.5], [HIP_R[0] + 150, HIP_R[1] + 200, 0.3]],
          [[SHOULDER_L[0] - 210, SHOULDER_L[1] - 230], [SHOULDER_R[0] + 210, SHOULDER_R[1] - 290]],
          { leaf, lean: 0.08 * sn }
        );
      }
      const w = Math.sin(s.t * 26) * 26;
      return pose(
        [[HIP_L[0] - 80, HIP_L[1] + 325, -0.35], [HIP_R[0] + 90, HIP_R[1] + 305, 0.1]],
        [[SHOULDER_L[0] - 250, SHOULDER_L[1] - 180 + w], [SHOULDER_R[0] + 240, SHOULDER_R[1] - 240 - w]],
        { leaf, lean: 0.08 * sn }
      );
    }
    const p = s.phase || 0;
    const amp = 0.3 + 0.7 * sn;
    const feet = [HIP_L, HIP_R].map((hip, i) => {
      const a = p + i * Math.PI;
      const th = Math.sin(a) * 0.9 * amp;
      const up = Math.max(0, Math.cos(a)) * 95 * amp;
      return [hip[0] + Math.sin(th) * LEG, hip[1] + Math.cos(th) * LEG - up, th * 0.55 - 0.15];
    });
    const swing = Math.sin(p) * 0.75 * amp;
    return pose(feet, [
      [SHOULDER_L[0] - Math.sin(0.95 - swing) * ARM, SHOULDER_L[1] + Math.cos(0.95 - swing) * ARM],
      [SHOULDER_R[0] + Math.sin(0.65 + swing) * ARM, SHOULDER_R[1] - Math.cos(0.65 + swing) * ARM]
    ], {
      hop: -Math.abs(Math.sin(p)) * 34 * amp,
      tilt: Math.sin(p) * 0.035 * amp,
      lean: 0.2 * sn,
      leaf: wind - 0.2 * sn,
      sx: 1 + 0.16 * (s.squash || 0),
      sy: 1 - 0.18 * (s.squash || 0)
    });
  }

  function idlePose(s) {
    const t = s.t;
    const leaf = Math.sin(t * 1.7) * 0.045;
    if (s.cheer) {
      const w = Math.sin(t * 12) * 50;
      const up = Math.abs(Math.sin(t * 6)) * 70;
      return pose([[595, 1740 - up, -0.22], [790, 1740 - up, -0.3]], [[190, 720 + w], [1270, 700 - w]], {
        hop: -Math.abs(Math.sin(t * 6)) * 240,
        bend: [26, -26],
        leaf: leaf + Math.sin(t * 12) * 0.05
      });
    }
    const wave = s.wave ? Math.sin(t * 9) * 0.32 : Math.sin(t * 1.6) * 0.04;
    const a = Math.atan2(850 - SHOULDER_R[1], 1320 - SHOULDER_R[0]) + wave;
    const breathe = Math.sin(t * 2.2) * 0.014;
    return pose(
      [[595, 1740, -0.22], [790, 1740, -0.3]],
      [[106, 1300 + Math.sin(t * 1.6) * 10], [SHOULDER_R[0] + Math.cos(a) * 415, SHOULDER_R[1] + Math.sin(a) * 415]],
      { bend: [26, -26], leaf, sx: 1 - breathe, sy: 1 + breathe }
    );
  }

  const mix = (a, b, k) => a + (b - a) * k;

  function blendPose(a, b, k) {
    const out = {};
    Object.keys(a).forEach(key => {
      if (typeof a[key] === 'number') out[key] = mix(a[key], b[key], k);
    });
    out.feet = a.feet.map((f, i) => f.map((v, j) => mix(v, b.feet[i][j], k)));
    out.hands = a.hands.map((h, i) => h.map((v, j) => mix(v, b.hands[i][j], k)));
    out.bend = a.bend.map((v, i) => mix(v, b.bend[i], k));
    return out;
  }

  // calm: 0 = in Bewegung, 1 = ruhig; dazwischen gleiten die Gliedmassen ineinander.
  function drawMan(ctx, s) {
    const calm = s.calm === undefined ? 1 : s.calm;
    let p;
    if (calm <= 0) p = runPose(s);
    else if (calm >= 1) p = idlePose(s);
    else p = blendPose(runPose(s), idlePose(s), calm);

    ctx.translate(-OX, -OY);
    ctx.translate(OX, OY);
    ctx.rotate(p.lean);
    ctx.scale(p.sx, p.sy);
    ctx.translate(-OX, -OY);
    ctx.translate(0, p.hop);
    ctx.translate(OX, 1120);
    ctx.rotate(p.tilt);
    ctx.translate(-OX, -1120);

    [HIP_L, HIP_R].forEach((hip, i) => {
      const f = p.feet[i];
      limb(ctx, hip[0], hip[1], f[0] + 15, f[1] - p.hop - 15, p.bend[i]);
      foot(ctx, f[0], f[1] - p.hop, f[2]);
    });
    arm(ctx, SHOULDER_L[0], SHOULDER_L[1], p.hands[0][0], p.hands[0][1], 30);
    arm(ctx, SHOULDER_R[0], SHOULDER_R[1], p.hands[1][0], p.hands[1][1], 34);

    leaves(ctx, 'man_leaves', 665, 790, p.leaf);
    part(ctx, 'man_body');
    const sn = s.sn || 0;
    if (calm <= 0 && sn > 0.85 && !s.duck) speedLines(ctx, s.t, (sn - 0.85) / 0.15 * 0.85);
  }

  function star(ctx, x, y, r, rot, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 - Math.PI / 2;
      const d = i % 2 ? r * 0.42 : r;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();
  }

  const STAR_COLS = ['#cf5420', '#df9c52', '#e79a2c', '#e0914b', '#df9c52'];

  function ring(ctx, cx, cy, front) {
    ctx.save();
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(214, 220, 90, .85)';
    ctx.beginPath();
    if (front) ctx.ellipse(cx, cy, 460, 70, 0, 0, Math.PI);
    else ctx.ellipse(cx, cy, 460, 70, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function orbitStars(ctx, t, cx, cy, front) {
    for (let i = 0; i < 5; i++) {
      const a = t * 2.6 + i * Math.PI * 2 / 5;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      star(ctx, cx + Math.cos(a) * 460, cy + Math.sin(a) * 70, 56, a * 1.3, STAR_COLS[i]);
    }
  }

  function drawInvalid(ctx, s) {
    const INV_X = 760, INV_Y = 1845;
    const t = s.t;
    const wob = Math.sin(t * 3.4) * 0.055;
    const dip = Math.abs(Math.sin(t * 3.4)) * 30;
    ctx.translate(-INV_X, -INV_Y);
    ctx.translate(INV_X, INV_Y);
    ctx.rotate(wob);
    ctx.translate(-INV_X, -INV_Y + dip);
    const cx = 850, cy = 640;
    ring(ctx, cx, cy, false);
    orbitStars(ctx, t, cx, cy, false);
    leaves(ctx, 'inv_leaves', 795, 790, Math.sin(t * 3.4) * 0.05);
    part(ctx, 'inv_rest');
    ring(ctx, cx, cy, true);
    orbitStars(ctx, t, cx, cy, true);
  }

  // Zeichnet die Figur mit den Fuessen auf (x, y).
  function draw(ctx, x, y, s, sizeFactor) {
    const k = SCALE[s.fig] * (sizeFactor || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((s.facing || 1) * k, k);
    if (s.fig === 'man') drawMan(ctx, s);
    else drawInvalid(ctx, s);
    ctx.restore();
  }

  return { draw };
})();
