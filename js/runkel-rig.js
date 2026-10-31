// Cut-out-Rig der Runkel: Koerper und Blaetter stammen aus den Vorlagen,
// Arme und Beine werden in deren Stil neu gezeichnet und frei bewegt.
// Alle Masse sind Vorlagen-Einheiten (Ansicht 1414x2000).
window.RR = window.RR || {};

RR.Rig = (function () {
  const LIMB = 10;
  const SCALE = { runner: 0.08, man: 0.072, inv: 0.066 };

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
    [[850, 1100, 1320, 1110], [915, 1145, 1390, 1155], [895, 1185, 1370, 1195]].forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l[0] + jitter, l[1]);
      ctx.quadraticCurveTo((l[0] + l[2]) / 2, l[1] + 44, l[2] + jitter, l[3]);
      ctx.stroke();
    });
    [[1035, 1115, 1030, 1225], [1098, 1085, 1115, 1250]].forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l[0] + jitter, l[1]);
      ctx.quadraticCurveTo(l[0] + 26 + jitter, (l[1] + l[3]) / 2, l[2] + jitter, l[3]);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Quelle laeuft nach links: vorne ist -x.
  function drawRunner(ctx, s) {
    const OX = 640, OY = 1640;
    const hipA = [620, 1325], hipB = [745, 1280];
    const armA = [408, 1160], armB = [788, 985];
    const L = 300, sn = s.sn || 0;
    const air = !s.onGround;
    const amp = 0.3 + 0.7 * sn;
    const p = s.phase || 0;

    let bob = 0, tilt = 0;
    const feet = [];
    const hands = [];

    if (s.duck) {
      feet.push([hipA[0] - 80, hipA[1] + L, 0], [hipB[0] + 50, hipB[1] + L + 40, 0]);
      hands.push([armA[0] - 170, armA[1] + 150], [armB[0] + 180, armB[1] + 240]);
    } else if (air) {
      const rising = s.vy < 80;
      if (rising) {
        feet.push([hipA[0] - 150, hipA[1] + 190, -0.5], [hipB[0] + 110, hipB[1] + 170, 0.5]);
        hands.push([armA[0] - 200, armA[1] - 210], [armB[0] + 150, armB[1] - 300]);
      } else {
        const w = Math.sin(s.t * 26) * 26;
        feet.push([hipA[0] - 70, hipA[1] + 285, -0.25], [hipB[0] + 95, hipB[1] + 265, 0.25]);
        hands.push([armA[0] - 230, armA[1] - 170 + w], [armB[0] + 190, armB[1] - 250 - w]);
      }
    } else {
      bob = -Math.abs(Math.sin(p)) * 34 * amp;
      tilt = Math.sin(p) * 0.035 * amp;
      for (let i = 0; i < 2; i++) {
        const a = p + i * Math.PI;
        const th = Math.sin(a) * 0.95 * amp;
        const hip = i ? hipB : hipA;
        const lift = Math.max(0, Math.cos(a)) * 95 * amp;
        feet.push([hip[0] - Math.sin(th) * L, hip[1] + Math.cos(th) * L - lift, -th * 0.55]);
      }
      const swing = Math.sin(p) * 0.75 * amp;
      hands.push(
        [armA[0] - Math.sin(0.95 - swing) * 285, armA[1] + Math.cos(0.95 - swing) * 285],
        [armB[0] + Math.sin(0.5 + swing) * 300, armB[1] - Math.cos(0.5 + swing) * 300]
      );
    }

    ctx.translate(-OX, -OY);
    if (s.duck) {
      ctx.translate(OX, OY);
      ctx.scale(1.14, 0.66);
      ctx.translate(-OX, -OY);
    } else if (s.squash) {
      ctx.translate(OX, OY);
      ctx.scale(1 + 0.16 * s.squash, 1 - 0.18 * s.squash);
      ctx.translate(-OX, -OY);
    }
    ctx.translate(0, bob);
    ctx.translate(590, 1090);
    ctx.rotate(tilt);
    ctx.translate(-590, -1090);

    arm(ctx, armB[0], armB[1], hands[1][0], hands[1][1], 46);
    limb(ctx, hipB[0], hipB[1], feet[1][0], feet[1][1] - bob, -30);
    foot(ctx, feet[1][0], feet[1][1] - bob, feet[1][2]);
    limb(ctx, hipA[0], hipA[1], feet[0][0], feet[0][1] - bob, -30);
    foot(ctx, feet[0][0], feet[0][1] - bob, feet[0][2]);
    arm(ctx, armA[0], armA[1], hands[0][0], hands[0][1], -46);

    const wind = Math.sin(s.t * 13) * 0.05 * (0.35 + sn);
    const lift = air ? Math.max(-0.35, Math.min(0.35, (s.vy || 0) / 1800)) : 0;
    const lean = s.duck ? 0.55 : 0.2 * sn;
    leaves(ctx, 'runner_leaves', 490, 838, wind + lean - lift);
    part(ctx, 'runner_body');
    if (sn > 0.85 && !s.duck) speedLines(ctx, s.t, (sn - 0.85) / 0.15 * 0.85);
  }

  function drawMan(ctx, s) {
    // OX so gewaehlt, dass der Koerper beim Ueberblenden ueber dem des Renners liegt.
    const OX = 664, OY = 1760;
    const t = s.t;
    const hop = s.cheer ? -Math.abs(Math.sin(t * 6)) * 240 : 0;
    const breathe = s.cheer ? 0 : Math.sin(t * 2.2) * 0.014;
    const shL = [484, 1085], shR = [956, 1062];
    let hL, hR;
    if (s.cheer) {
      const w = Math.sin(t * 12) * 50;
      hL = [190, 720 + w];
      hR = [1270, 700 - w];
    } else {
      const wave = s.wave ? Math.sin(t * 9) * 0.32 : Math.sin(t * 1.6) * 0.04;
      const a = Math.atan2(850 - shR[1], 1320 - shR[0]) + wave;
      hR = [shR[0] + Math.cos(a) * 415, shR[1] + Math.sin(a) * 415];
      hL = [106, 1300 + Math.sin(t * 1.6) * 10];
    }
    const lift = s.cheer ? Math.abs(Math.sin(t * 6)) * 70 : 0;

    ctx.translate(-OX, -OY);
    ctx.translate(OX, OY);
    ctx.scale(1 - breathe, 1 + breathe);
    ctx.translate(-OX, -OY + hop);

    limb(ctx, 660, 1385, 610, 1725 - lift, 26);
    foot(ctx, 595, 1740 - lift, -0.22);
    limb(ctx, 800, 1378, 815, 1720 - lift, -26);
    foot(ctx, 790, 1740 - lift, -0.3);
    arm(ctx, shL[0], shL[1], hL[0], hL[1], 30);
    arm(ctx, shR[0], shR[1], hR[0], hR[1], 34);
    leaves(ctx, 'man_leaves', 665, 790, Math.sin(t * 1.7) * 0.045 + (s.cheer ? Math.sin(t * 12) * 0.05 : 0));
    part(ctx, 'man_body');
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
    const OX = 760, OY = 1845;
    const t = s.t;
    const wob = Math.sin(t * 3.4) * 0.055;
    const dip = Math.abs(Math.sin(t * 3.4)) * 30;
    ctx.translate(-OX, -OY);
    ctx.translate(OX, OY);
    ctx.rotate(wob);
    ctx.translate(-OX, -OY + dip);
    const cx = 850, cy = 640;
    ring(ctx, cx, cy, false);
    orbitStars(ctx, t, cx, cy, false);
    leaves(ctx, 'inv_leaves', 795, 790, Math.sin(t * 3.4) * 0.05);
    part(ctx, 'inv_rest');
    ring(ctx, cx, cy, true);
    orbitStars(ctx, t, cx, cy, true);
  }

  // Zeichnet die Figur mit den Fuessen auf (x, y).
  function draw(ctx, x, y, pose, sizeFactor) {
    const fig = pose.fig || 'runner';
    const k = SCALE[fig] * (sizeFactor || 1);
    const facing = pose.facing || 1;
    ctx.save();
    ctx.translate(x, y);
    // Der Renner schaut in der Vorlage nach links, die anderen nach rechts.
    ctx.scale((fig === 'runner' ? -facing : facing) * k, k);
    if (fig === 'runner') drawRunner(ctx, pose);
    else if (fig === 'man') drawMan(ctx, pose);
    else drawInvalid(ctx, pose);
    ctx.restore();
  }

  // Ueberblendet zwei Figuren. Beide werden erst einzeln flach gerendert, damit
  // Arme und Beine nicht durch den halbtransparenten Koerper scheinen.
  const BLEND_W = 300, BLEND_H = 240, BLEND_X = 150, BLEND_Y = 220;
  const buffers = [];

  function buffer(i, w, h) {
    if (!buffers[i]) buffers[i] = document.createElement('canvas');
    const c = buffers[i];
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  function blend(ctx, x, y, from, to, k) {
    const q = Math.abs(ctx.getTransform().a) || 1;
    const w = Math.ceil(BLEND_W * q), h = Math.ceil(BLEND_H * q);
    const layers = [from, to].map((pose, i) => {
      const c = buffer(i, w, h);
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.setTransform(q, 0, 0, q, 0, 0);
      draw(g, BLEND_X, BLEND_Y, pose);
      return c;
    });
    const mix = buffer(2, w, h);
    const m = mix.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.globalAlpha = 1;
    m.clearRect(0, 0, w, h);
    m.globalCompositeOperation = 'lighter';
    m.globalAlpha = 1 - k;
    m.drawImage(layers[0], 0, 0);
    m.globalAlpha = k;
    m.drawImage(layers[1], 0, 0);
    ctx.drawImage(mix, x - BLEND_X, y - BLEND_Y, BLEND_W, BLEND_H);
  }

  return { draw, blend };
})();
