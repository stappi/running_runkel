// Cut-out-Rig der Runkel: Koerper und Gipsteile stammen aus den Vorlagen,
// Blaetter, Gesicht, Arme und Beine werden in deren Stil gezeichnet und frei bewegt.
// Alle Masse sind Vorlagen-Einheiten (Ansicht 1414x2000). Vorne ist +x.
window.RR = window.RR || {};

RR.Rig = (function () {
  const LIMB = 10;
  const INK = '#000';
  const LEAF_GREEN = '#a8bd2e';
  const SCALE = { man: 0.072, inv: 0.066 };
  const OX = 720, OY = 1760, GROUND = 1738;
  const PELVIS = [730, 1385];
  const HIP_L = [660, 1385], HIP_R = [800, 1378];
  const SHOULDER_L = [484, 1085], SHOULDER_R = [956, 1062];
  const LEG = 370;
  const ARM = 380;

  const mix = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Mischt zwei gleich aufgebaute Haltungen oder Gesichter Wert fuer Wert.
  function blend(a, b, k) {
    if (typeof a === 'number') return mix(a, b, k);
    if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], k));
    const out = {};
    Object.keys(a).forEach(key => { out[key] = blend(a[key], b[key], k); });
    return out;
  }

  function part(ctx, name) {
    const p = RR.SPRITE_PARTS[name];
    ctx.drawImage(RR.Assets.get(name), p[0], p[1], p[2], p[3]);
  }

  function limb(ctx, x0, y0, x1, y1, bend, width) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx - dy / len * bend, my + dx / len * bend, x1, y1);
    ctx.lineWidth = width || LIMB;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  function foot(ctx, x, y, ang, k) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 50 * (k || 1), 22 * (k || 1), 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
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
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  // --- Blaetter ---------------------------------------------------------------
  // Jedes Blatt ist ein aus der Vorlage nachgezeichneter Umriss. Beim Zeichnen wird jeder
  // Punkt um den Blattansatz gedreht, je weiter aussen desto staerker: So biegt es sich wie Haar.

  // Glaettet einen Punktzug (x, y, x, y, ...) zu dicht liegenden Punkten (Catmull-Rom).
  function sample(raw, closed) {
    const n = raw.length / 2;
    const at = i => {
      const j = closed ? (i + n) % n : clamp(i, 0, n - 1);
      return [raw[j * 2], raw[j * 2 + 1]];
    };
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < 6; k++) {
        const u = k / 6, u2 = u * u, u3 = u2 * u;
        out.push(
          0.5 * (2 * p1[0] + (p2[0] - p0[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (p2[1] - p0[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * u3)
        );
      }
    }
    if (!closed) out.push(raw[raw.length - 2], raw[raw.length - 1]);
    return out;
  }

  function makeLeaves(base, list) {
    return { base, list: list.map(l => {
      let len = 1;
      for (let i = 0; i < l.out.length; i += 2) len = Math.max(len, Math.hypot(l.out[i] - base[0], l.out[i + 1] - base[1]));
      let tip = 0, far = 0;
      for (let i = 0; i < l.out.length; i += 2) {
        const d = Math.hypot(l.out[i] - base[0], l.out[i + 1] - base[1]);
        if (d > far) { far = d; tip = l.out[i] - base[0]; }
      }
      return {
        out: sample(l.out, true), hi: l.hi ? sample(l.hi, true) : null, vein: l.vein ? sample(l.vein, false) : null,
        len, side: Math.sign(tip) || 1, ph: l.ph
      };
    }) };
  }

  const MAN_LEAVES = makeLeaves([665, 790], [
    { ph: 0.6, // oben rechts
      out: [668, 770, 640, 660, 625, 540, 640, 430, 690, 335, 750, 262, 800, 232, 870, 218, 905, 225, 870, 258, 800, 325, 745, 420, 705, 530, 682, 640, 676, 720],
      hi: [860, 240, 790, 295, 745, 350, 700, 470, 672, 600, 660, 700, 680, 540, 720, 410, 790, 310] },
    { ph: 2.4, // oben links, gross
      out: [660, 775, 625, 650, 570, 490, 510, 375, 440, 285, 385, 245, 350, 238, 350, 265, 400, 340, 480, 450, 560, 560, 620, 690],
      hi: [365, 250, 420, 270, 470, 320, 500, 360, 440, 300] },
    { ph: 4.1, // schmal
      out: [662, 775, 615, 705, 530, 580, 450, 470, 380, 395, 342, 350, 352, 342, 390, 365, 480, 450, 545, 530, 590, 600, 630, 680] },
    { ph: 1.3, // links oben, breit
      out: [665, 785, 590, 720, 500, 655, 440, 560, 385, 455, 300, 385, 215, 330, 165, 318, 150, 335, 158, 375, 200, 475, 265, 565, 340, 620, 430, 648, 520, 665],
      vein: [322, 455, 370, 535, 430, 605, 490, 652],
      hi: [175, 385, 220, 480, 285, 548, 350, 600, 425, 638, 340, 615, 265, 560, 205, 475] },
    { ph: 3.2, // links unten, gegabelt
      out: [665, 788, 620, 720, 545, 670, 430, 652, 300, 672, 195, 730, 130, 810, 112, 845, 135, 852, 170, 835, 245, 795, 320, 763, 322, 772, 255, 825, 210, 885, 195, 922, 215, 918, 290, 860, 375, 780, 450, 730, 520, 715, 600, 745],
      hi: null },
    { ph: 5.0, // rechts, gegabelt
      out: [672, 780, 690, 680, 730, 570, 810, 480, 900, 432, 1000, 410, 1085, 430, 1118, 475, 1100, 505, 1040, 510, 930, 495, 840, 515, 775, 545, 768, 562, 805, 555, 880, 542, 960, 555, 1020, 585, 1050, 625, 1030, 655, 985, 652, 900, 620, 800, 600, 735, 615, 695, 670, 682, 720],
      hi: null }
  ]);

  const INV_LEAVES = makeLeaves([800, 785], [
    { ph: 1.1, // schmal, dahinter
      out: [805, 780, 860, 640, 930, 500, 1000, 370, 1060, 278, 1075, 285, 1050, 360, 980, 470, 900, 610, 825, 770] },
    { ph: 3.3, // das angefressene Blatt
      out: [790, 780, 782, 690, 815, 670, 830, 630, 798, 590, 825, 545, 825, 505, 860, 480, 850, 425, 870, 380, 905, 345, 900, 295, 940, 280, 930, 235, 975, 180, 1035, 160, 1058, 180, 1035, 245, 985, 335, 930, 430, 870, 550, 825, 660, 805, 770],
      vein: [855, 570, 900, 480, 940, 410] },
    { ph: 5.2, // rechts, heil
      out: [800, 785, 860, 700, 930, 560, 1030, 460, 1160, 410, 1250, 405, 1320, 435, 1382, 485, 1290, 478, 1170, 505, 1060, 560, 950, 640, 850, 725, 815, 780],
      hi: [970, 520, 1060, 470, 1205, 420, 1100, 470] }
  ]);

  function trace(ctx, pts, leaf, base, env, closed) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - base[0], dy = pts[i + 1] - base[1];
      const d = Math.min(1.1, Math.hypot(dx, dy) / leaf.len);
      const ang = env.leaf + d * (env.drag + leaf.side * env.droop) +
        d * d * (env.slow * Math.sin(env.t * 1.9 + leaf.ph - d * 1.5) + env.fast * Math.sin(env.t * 15 + leaf.ph * 1.7 - d * 3.2));
      const c = Math.cos(ang), s = Math.sin(ang);
      ctx.lineTo(base[0] + dx * c - dy * s, base[1] + dx * s + dy * c);
    }
    if (closed) ctx.closePath();
  }

  function drawLeaves(ctx, set, env) {
    set.list.forEach(leaf => {
      trace(ctx, leaf.out, leaf, set.base, env, true);
      ctx.fillStyle = LEAF_GREEN;
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (leaf.hi) {
        trace(ctx, leaf.hi, leaf, set.base, env, true);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      if (leaf.vein && leaf.vein.length) {
        trace(ctx, leaf.vein, leaf, set.base, env, false);
        ctx.lineWidth = 11;
        ctx.stroke();
      }
    });
  }

  // --- Mimik ------------------------------------------------------------------
  // Augen: Mitte, Radien, Drehung, Pupille (Versatz, Radius), Lid (0 offen, 1 zu).
  // Mund: Ober- und Unterlippe von vorne nach hinten, dazwischen weiss oder dunkel gefuellt.
  function eye(x, y, rx, ry, rot, px, py, pr, lid) { return { x, y, rx, ry, rot, px, py, pr, lid }; }

  const LINE_MOUTH = [[890, 1068], [810, 1120], [710, 1095], [640, 1040], [605, 955]];
  const BROW_A = [[736, 898], [693, 927], [637, 932]], BROW_B = [[774, 896], [792, 933], [855, 952]];

  const FACES = {
    happy: {
      eyes: [eye(712, 940, 60, 68, -0.15, 12, 6, 17, 0), eye(807, 992, 46, 56, 0.35, 5, 0, 16, 0)],
      up: LINE_MOUTH, lo: LINE_MOUTH, teeth: 0, dark: 0, smile: 1, wavy: 0,
      browA: BROW_A, browB: BROW_B, brow: 0, worry: 0
    },
    // Das Angstgesicht des Renners: Glubschaugen mit Blick zurueck, gefletschte Zaehne.
    scared: {
      eyes: [eye(720, 1000, 68, 72, 0.1, -16, 16, 18, 0), eye(799, 1017, 52, 60, -0.3, -12, 17, 16, 0)],
      up: [[871, 1109], [811, 1119], [717, 1109], [652, 1082], [594, 1053]],
      lo: [[872, 1250], [795, 1202], [702, 1177], [620, 1171], [546, 1181]],
      teeth: 1, dark: 0, smile: 0, wavy: 0,
      browA: BROW_A, browB: BROW_B, brow: 1, worry: 1
    },
    // Mit dem Sprung: Staunen, Mund rund
    jump: {
      eyes: [eye(712, 945, 66, 76, -0.1, 8, -16, 17, 0), eye(807, 995, 50, 62, 0.3, 6, -16, 15, 0)],
      up: [[800, 1100], [770, 1078], [730, 1072], [690, 1078], [660, 1100]],
      lo: [[800, 1100], [772, 1150], [730, 1168], [688, 1150], [660, 1100]],
      teeth: 0, dark: 1, smile: 0, wavy: 0,
      browA: [[755, 860], [705, 838], [650, 862]], browB: [[780, 905], [815, 892], [855, 915]], brow: 0.8, worry: 0
    },
    fall: {
      eyes: [eye(716, 960, 70, 80, 0, -4, 22, 13, 0), eye(805, 1000, 54, 66, 0.25, -2, 24, 12, 0)],
      up: [[850, 1120], [800, 1095], [725, 1090], [660, 1095], [610, 1120]],
      lo: [[850, 1120], [805, 1190], [725, 1215], [655, 1190], [610, 1120]],
      teeth: 0, dark: 1, smile: 0, wavy: 0,
      browA: BROW_A, browB: BROW_B, brow: 1, worry: 1
    },
    // Beim Ducken: Augen zusammengekniffen, Zaehne zusammengebissen
    duck: {
      eyes: [eye(716, 985, 62, 62, 0, 2, -14, 15, 0.42), eye(803, 1010, 48, 52, 0, 2, -14, 13, 0.46)],
      up: [[860, 1112], [790, 1118], [720, 1112], [660, 1102], [605, 1085]],
      lo: [[860, 1170], [790, 1176], [720, 1170], [660, 1158], [605, 1138]],
      teeth: 1, dark: 0, smile: 0, wavy: 0,
      browA: [[650, 900], [700, 915], [765, 945]], browB: [[770, 945], [810, 925], [855, 915]], brow: 1, worry: 0
    },
    // Noch angeschlagen: muede Lider, Blick nach oben, Wellenmund
    sick: {
      eyes: [eye(712, 960, 60, 72, -0.1, 12, -18, 15, 0.42), eye(805, 1000, 46, 60, 0.2, 6, -16, 14, 0.58)],
      up: [[880, 1130], [800, 1130], [720, 1130], [650, 1130], [570, 1130]],
      lo: [[880, 1130], [800, 1130], [720, 1130], [650, 1130], [570, 1130]],
      teeth: 0, dark: 0, smile: 0, wavy: 1,
      browA: [[745, 868], [695, 860], [650, 895]], browB: [[775, 915], [815, 905], [850, 945]], brow: 0.8, worry: 0
    },
    joy: {
      eyes: [eye(712, 940, 62, 70, -0.15, 8, -4, 18, 0), eye(807, 992, 48, 58, 0.35, 4, -6, 17, 0)],
      up: [[890, 1068], [810, 1092], [725, 1085], [650, 1040], [605, 955]],
      lo: [[890, 1068], [825, 1175], [720, 1190], [640, 1115], [605, 955]],
      teeth: 0, dark: 1, smile: 0.4, wavy: 0,
      browA: BROW_A, browB: BROW_B, brow: 0, worry: 0
    }
  };

  function smoothLine(ctx, pts, reverse) {
    const list = reverse ? pts.slice().reverse() : pts;
    for (let i = 1; i < list.length - 1; i++) {
      const mx = (list[i][0] + list[i + 1][0]) / 2, my = (list[i][1] + list[i + 1][1]) / 2;
      ctx.quadraticCurveTo(list[i][0], list[i][1], i === list.length - 2 ? list[i + 1][0] : mx, i === list.length - 2 ? list[i + 1][1] : my);
    }
  }

  function drawEye(ctx, e, lidColor) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.rotate(-e.rot);
    ctx.beginPath();
    ctx.arc(e.px, e.py, e.pr, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.rotate(e.rot);
    if (e.lid > 0.01) {
      const edge = -e.ry + e.lid * e.ry * 2;
      ctx.fillStyle = lidColor;
      ctx.fillRect(-e.rx - 4, -e.ry - 4, e.rx * 2 + 8, edge + e.ry + 4);
      ctx.fillStyle = INK;
      ctx.fillRect(-e.rx - 4, edge - 5, e.rx * 2 + 8, 10);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 13;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  function drawMouth(ctx, f, t) {
    const wave = (pts, ph) => pts.map((p, i) => [p[0], p[1] + f.wavy * Math.sin(i * 2.4 + t * 5 + ph) * 34]);
    const up = f.wavy > 0 ? wave(f.up, 0) : f.up;
    const lo = f.wavy > 0 ? wave(f.lo, 0) : f.lo;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(up[0][0], up[0][1]);
    smoothLine(ctx, up, false);
    ctx.lineTo(lo[lo.length - 1][0], lo[lo.length - 1][1]);
    smoothLine(ctx, lo, true);
    ctx.closePath();
    ctx.fillStyle = f.dark > 0.5 ? '#4a1408' : '#fff';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.stroke();
    if (f.teeth > 0.3) {
      ctx.globalAlpha = f.teeth;
      ctx.lineWidth = 8;
      [0.75, 1.5, 2.25, 3.1].forEach(u => {
        const i = Math.floor(u), k = u - i;
        ctx.beginPath();
        ctx.moveTo(mix(up[i][0], up[i + 1][0], k), mix(up[i][1], up[i + 1][1], k) + 4);
        ctx.lineTo(mix(lo[i][0], lo[i + 1][0], k) + 6, mix(lo[i][1], lo[i + 1][1], k) - 4);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    if (f.smile > 0.05) {
      // Laecheln: Unterlippe und Grubchen an den Mundwinkeln wie im Runkelman
      ctx.globalAlpha = Math.min(1, f.smile);
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(737, 1134);
      ctx.quadraticCurveTo(695, 1128, 660, 1092);
      ctx.moveTo(915, 1096);
      ctx.lineTo(892, 1068);
      ctx.moveTo(608, 952);
      ctx.lineTo(590, 962);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawFace(ctx, f, t, blink) {
    const lidColor = '#e6d40c';
    f.eyes.forEach(e => drawEye(ctx, blink && e.lid < 0.9 ? Object.assign({}, e, { lid: 0.93 }) : e, lidColor));
    if (f.brow > 0.05) {
      ctx.lineWidth = 13 * Math.min(1, f.brow);
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      [f.browA, f.browB].forEach(b => {
        ctx.beginPath();
        ctx.moveTo(b[0][0], b[0][1]);
        ctx.quadraticCurveTo(b[1][0], b[1][1], b[2][0], b[2][1]);
        ctx.stroke();
      });
    }
    if (f.worry > 0.05) {
      // Sorgenfalten neben den Augen wie beim Renner
      ctx.globalAlpha = f.worry;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(f.eyes[0].x, f.eyes[0].y, f.eyes[0].ry + 24, 2.5, 3.4);
      ctx.moveTo(f.eyes[1].x + (f.eyes[1].ry + 22) * Math.cos(-0.5), f.eyes[1].y + (f.eyes[1].ry + 22) * Math.sin(-0.5));
      ctx.arc(f.eyes[1].x, f.eyes[1].y, f.eyes[1].ry + 22, -0.5, 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawMouth(ctx, f, t);
  }

  function faceFor(s) {
    const to = FACES[s.expr] || (s.cheer ? FACES.joy : FACES.happy);
    if (s.exprFrom && FACES[s.exprFrom] && s.exprK < 1) return blend(FACES[s.exprFrom], to, s.exprK);
    return to;
  }

  // Angstschweiss, der nach hinten vom Kopf fliegt
  function sweat(ctx, t, amount) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#9fd8f5';
    for (let i = 0; i < 3; i++) {
      const q = (t * 2.3 + i / 3) % 1;
      ctx.globalAlpha = amount * (1 - q);
      const x = 500 - q * 240 - i * 25, y = 860 + i * 45 - 120 * q + 170 * q * q;
      ctx.beginPath();
      ctx.moveTo(x + 26, y);
      ctx.quadraticCurveTo(x, y - 18, x - 14, y);
      ctx.quadraticCurveTo(x, y + 18, x + 26, y);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function speedLines(ctx, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = INK;
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

  // --- Haltungen --------------------------------------------------------------
  // Fuesse [x, y, Winkel] liegen im Bodenrahmen, Haende [x, y] im Koerperrahmen.
  // Der Koerper (bx, by, lean, sx, sy) dreht und staucht sich um das Becken, die Beine folgen.
  function pose(feet, hands, o) {
    return Object.assign({
      feet, hands, bend: [-14, -14], knee: 1, bx: 0, by: 0, lean: 0, sx: 1, sy: 1,
      leaf: 0, drag: 0, droop: 0, slow: 0.06, fast: 0, sweat: 0
    }, o);
  }

  const armBack = a => [SHOULDER_L[0] - Math.sin(a) * ARM, SHOULDER_L[1] + Math.cos(a) * ARM];
  const armFront = a => [SHOULDER_R[0] + Math.sin(a) * ARM, SHOULDER_R[1] + Math.cos(a) * ARM];

  function groundPose(s) {
    const sn = s.sn || 0, p = s.phase || 0, sq = s.squash || 0;
    const amp = 0.3 + 0.7 * sn;
    // Schwung nach vorne mit angehobenem Fuss, dann Standphase zurueck ueber den Boden
    const feet = [HIP_L, HIP_R].map((hip, i) => {
      const a = p + i * Math.PI;
      const lift = Math.max(0, Math.cos(a));
      return [hip[0] + 30 * sn + Math.sin(a) * 190 * amp, GROUND - lift * 175 * amp, -0.12 - lift * Math.sin(a) * 0.9 * amp];
    });
    const swing = Math.sin(p);
    const flutter = Math.sin(p * 2) * 0.12 * sn;
    return pose(feet, [
      armBack(1.9 + swing * 0.7 * amp + flutter),
      armFront(1.1 - swing * 0.8 * amp - flutter)
    ], {
      by: (50 - Math.abs(swing) * 38) * amp + 80 * sq,
      lean: 0.3 * sn + swing * 0.03 * amp,
      sx: 1 + 0.16 * sq,
      sy: 1 - 0.18 * sq,
      leaf: -0.1 * sn + Math.sin(p * 2) * 0.03 * amp,
      drag: -0.45 * sn,
      slow: 0.05,
      fast: 0.2 * sn,
      sweat: clamp((sn - 0.5) * 2, 0, 1)
    });
  }

  function airPose(s) {
    const sn = s.sn || 0;
    const rise = clamp((s.vy || 0) / 700, -1, 1);       // -1 steigt, +1 faellt
    const k = (rise + 1) / 2;
    const w = Math.sin(s.t * 26) * 26 * k;
    return pose([
      [HIP_L[0] - mix(120, 80, k), GROUND - mix(170, 25, k), mix(0.5, -0.35, k)],
      [HIP_R[0] + mix(150, 90, k), GROUND - mix(230, 40, k), mix(-0.4, 0.1, k)]
    ], [
      [SHOULDER_L[0] - mix(210, 250, k), SHOULDER_L[1] - mix(240, 180, k) + w],
      [SHOULDER_R[0] + mix(210, 240, k), SHOULDER_R[1] - mix(300, 240, k) - w]
    ], {
      lean: 0.12 * sn + 0.06 * k,
      sx: mix(0.95, 1.02, k),
      sy: mix(1.07, 0.98, k),
      leaf: -0.1 * sn,
      drag: -0.4 * sn,
      droop: -rise * 0.45,
      slow: 0.05,
      fast: 0.08 + 0.1 * k
    });
  }

  function duckPose(s) {
    const sn = s.sn || 0, p = s.phase || 0;
    const amp = Math.min(1, sn * 3);
    const feet = [[HIP_L[0] - 70, 0], [HIP_R[0] + 60, Math.PI]].map(f => {
      const lift = Math.max(0, Math.cos(p + f[1]));
      return [f[0] + Math.sin(p + f[1]) * 60 * amp, GROUND - lift * 55 * amp, -0.15];
    });
    // Das Becken sinkt so weit, dass die Figur unter die Ducken-Hitbox passt; die Haende schuetzen den Kopf.
    return pose(feet, [[505, 700], [945, 690]], {
      by: 165 + Math.abs(Math.sin(p)) * 10 * amp,
      lean: 0.12,
      sx: 1.16,
      sy: 0.62,
      leaf: -0.75,
      drag: -0.5,
      droop: 0.15,
      slow: 0.04,
      fast: 0.06 * amp
    });
  }

  function runPose(s) {
    const air = s.airK === undefined ? (s.onGround ? 0 : 1) : s.airK;
    const duck = s.duckK === undefined ? (s.duck ? 1 : 0) : s.duckK;
    let p = groundPose(s);
    if (air > 0) p = blend(p, airPose(s), air);
    if (duck > 0) p = blend(p, duckPose(s), duck);
    return p;
  }

  function idlePose(s) {
    const t = s.t;
    if (s.cheer) {
      const w = Math.sin(t * 12) * 50;
      const hop = -Math.abs(Math.sin(t * 6)) * 240;
      const up = Math.abs(Math.sin(t * 6)) * 70;
      return pose([[595, 1740 - up + hop, -0.22], [790, 1740 - up + hop, -0.3]], [[190, 720 + w], [1270, 700 - w]], {
        by: hop,
        bend: [26, -26],
        knee: 0,
        fast: 0.06,
        droop: 0.1 * Math.sin(t * 12)
      });
    }
    const wave = s.wave ? Math.sin(t * 9) * 0.32 : Math.sin(t * 1.6) * 0.04;
    const a = Math.atan2(850 - SHOULDER_R[1], 1320 - SHOULDER_R[0]) + wave;
    const breathe = Math.sin(t * 2.2) * 0.014;
    return pose(
      [[595, 1740, -0.22], [790, 1740, -0.3]],
      [[106, 1300 + Math.sin(t * 1.6) * 10], [SHOULDER_R[0] + Math.cos(a) * 415, SHOULDER_R[1] + Math.sin(a) * 415]],
      { bend: [26, -26], knee: 0, sx: 1 - breathe, sy: 1 + breathe }
    );
  }

  function bodyPoint(p, x, y) {
    const dx = (x - PELVIS[0]) * p.sx, dy = (y - PELVIS[1]) * p.sy;
    const c = Math.cos(p.lean), s = Math.sin(p.lean);
    return [PELVIS[0] + p.bx + c * dx - s * dy, PELVIS[1] + p.by + s * dx + c * dy];
  }

  // calm: 0 = in Bewegung, 1 = ruhig; dazwischen gleiten die Gliedmassen ineinander.
  function drawMan(ctx, s) {
    const calm = s.calm === undefined ? 1 : s.calm;
    let p;
    if (calm <= 0) p = runPose(s);
    else if (calm >= 1) p = idlePose(s);
    else p = blend(runPose(s), idlePose(s), calm);
    if (s.sick) {
      // Angeschlagen: Die Blaetter haengen und schwingen kaum noch.
      p.droop += 0.4;
      p.fast *= 0.5;
      p.sweat = 0;
    }

    ctx.translate(-OX, -OY);

    [HIP_L, HIP_R].forEach((hip, i) => {
      const h = bodyPoint(p, hip[0], hip[1]);
      const f = p.feet[i];
      const chord = Math.hypot(f[0] + 15 - h[0], f[1] - 15 - h[1]);
      const knee = Math.sqrt(Math.max(0, LEG * LEG - chord * chord)) * 0.55 * p.knee;
      limb(ctx, h[0], h[1], f[0] + 15, f[1] - 15, p.bend[i] - knee);
      foot(ctx, f[0], f[1], f[2]);
    });
    [SHOULDER_L, SHOULDER_R].forEach((sh, i) => {
      const a = bodyPoint(p, sh[0], sh[1]), b = bodyPoint(p, p.hands[i][0], p.hands[i][1]);
      arm(ctx, a[0], a[1], b[0], b[1], i ? 34 : 30);
    });

    ctx.save();
    ctx.translate(PELVIS[0] + p.bx, PELVIS[1] + p.by);
    ctx.rotate(p.lean);
    ctx.scale(p.sx, p.sy);
    ctx.translate(-PELVIS[0], -PELVIS[1]);
    drawLeaves(ctx, MAN_LEAVES, { t: s.t, leaf: p.leaf, drag: p.drag, droop: p.droop, slow: p.slow, fast: p.fast });
    part(ctx, 'man_body');
    drawFace(ctx, faceFor(s), s.t, s.t % 3.7 < 0.13);
    if (p.sweat > 0.02) sweat(ctx, s.t, p.sweat);
    ctx.restore();

    const sn = s.sn || 0;
    if (calm <= 0 && sn > 0.85 && s.onGround && !s.duck) speedLines(ctx, s.t, (sn - 0.85) / 0.15 * 0.85);
  }

  // --- Verletzte Runkel -------------------------------------------------------
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
    ctx.strokeStyle = INK;
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

  // Das kranke Gesicht aus der Vorlage: verdrehte Augen, Veilchen rechts, Wellenmund.
  function drawSickFace(ctx, t) {
    const rollX = Math.cos(t * 2.6) * 11, rollY = Math.sin(t * 2.6) * 11;
    const sag = 0.5 + Math.sin(t * 1.3) * 0.06;

    ctx.save();
    ctx.translate(703, 1000);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 92, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fffef2';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.arc(30 + rollX, -30 + rollY, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#6e96cc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(32 + rollX, -30 + rollY, 21, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(24 + rollX, -38 + rollY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.rotate(0.3);
    ctx.fillStyle = '#f6e96b';
    ctx.fillRect(-70, -100, 140, 55);
    ctx.fillStyle = INK;
    ctx.fillRect(-70, -48, 140, 8);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 92, 0, 0, Math.PI * 2);
    ctx.lineWidth = 11;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(833, 1008);
    ctx.rotate(-0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 84, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(-14 + rollX * 0.6, -22 + rollY * 0.6, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#4f76bd';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-14 + rollX * 0.6, -22 + rollY * 0.6, 20, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    const lid = -84 + 84 * sag * 0.95;
    ctx.fillStyle = '#8660bd';
    ctx.fillRect(-64, -90, 128, lid + 90);
    ctx.fillStyle = INK;
    ctx.fillRect(-64, lid - 4, 128, 8);
    ctx.fillStyle = '#3b2460';
    ctx.fillRect(-64, 36, 128, 60);
    ctx.fillStyle = INK;
    ctx.fillRect(-64, 32, 128, 7);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 84, 0, 0, Math.PI * 2);
    ctx.lineWidth = 11;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();

    // Augenbrauen
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6e1c0c';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(686, 904);
    ctx.quadraticCurveTo(708, 866, 750, 864);
    ctx.moveTo(808, 901);
    ctx.quadraticCurveTo(830, 918, 862, 924);
    ctx.stroke();

    // Wellenmund
    ctx.strokeStyle = '#b8641c';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(592, 1192);
    ctx.lineTo(598, 1160);
    ctx.quadraticCurveTo(612, 1148, 625, 1172);
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      ctx.lineTo(625 + u * 290, 1195 + Math.sin(u * Math.PI * 4 + t * 4) * 15);
    }
    ctx.quadraticCurveTo(928, 1148, 940, 1150);
    ctx.lineTo(942, 1190);
    ctx.moveTo(940, 1150);
    ctx.lineTo(925, 1160);
    ctx.stroke();
  }

  function drawInvalid(ctx, s) {
    const INV_X = 760, INV_Y = 1845;
    const IP = [770, 1420];
    const t = s.t;
    const air = s.airK || 0;
    const hit = s.hit === undefined ? 9 : s.hit;
    // Der Treffer wirft die Figur nach hinten, danach humpelt sie auf der Stelle.
    const recoil = -0.5 * Math.exp(-hit * 5);
    const wob = Math.sin(t * 3.4) * 0.055;
    const lean = wob + recoil - air * 0.12;
    const dip = Math.abs(Math.sin(t * 3.4)) * 30 * (1 - air);
    const c = Math.cos(lean), sn = Math.sin(lean);
    const bp = (x, y) => [IP[0] + c * (x - IP[0]) - sn * (y - IP[1]), IP[1] + dip + sn * (x - IP[0]) + c * (y - IP[1])];

    ctx.translate(-INV_X, -INV_Y);

    // Das gesunde Bein traegt am Boden und zappelt in der Luft.
    const hip = bp(702, 1405);
    const fx = mix(575, 590 + Math.sin(t * 22) * 40, air), fy = mix(1790, 1700 + Math.cos(t * 22) * 25, air);
    limb(ctx, hip[0], hip[1], fx + 45, fy - 15, -45 - air * 40, 13);
    foot(ctx, fx, fy, -0.12, 1.35);

    // Gipsbein und Gipsarm pendeln an Huefte und Schulter.
    const inBody = fn => {
      ctx.save();
      ctx.translate(IP[0], IP[1] + dip);
      ctx.rotate(lean);
      ctx.translate(-IP[0], -IP[1]);
      fn();
      ctx.restore();
    };
    const pivot = (name, px, py, ang) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.translate(-px, -py);
      part(ctx, name);
      ctx.restore();
    };
    inBody(() => {
      pivot('inv_leg', 842, 1420, Math.sin(t * 3.4 + 0.8) * 0.13 + air * (-0.35 + Math.sin(t * 19) * 0.22));
      pivot('inv_arm', 505, 1100, Math.sin(t * 3.4) * 0.09 + air * (0.45 + Math.sin(t * 21) * 0.18) - recoil * 0.5);
    });

    // Der Stock steht auf dem Boden; in der Luft reisst ihn der Arm mit nach oben.
    const TIP = [1222, 1845], GRIP = [1300, 1215];
    const caneAng = wob * 0.5 + air * 0.4 + Math.sin(t * 17) * 0.12 * air;
    const tipY = TIP[1] - air * 130;
    ctx.save();
    ctx.translate(TIP[0], tipY);
    ctx.rotate(caneAng);
    ctx.translate(-TIP[0], -TIP[1]);
    part(ctx, 'inv_cane');
    ctx.restore();
    const gx = GRIP[0] - TIP[0], gy = GRIP[1] - TIP[1];
    const cc = Math.cos(caneAng), cs = Math.sin(caneAng);
    const shoulder = bp(1030, 1082);
    limb(ctx, shoulder[0], shoulder[1], TIP[0] + gx * cc - gy * cs, tipY + gx * cs + gy * cc, -105, 13);

    inBody(() => {
      const cx = 850, cy = 640;
      ring(ctx, cx, cy, false);
      orbitStars(ctx, t, cx, cy, false);
      drawLeaves(ctx, INV_LEAVES, {
        t, leaf: Math.sin(t * 3.4) * 0.03, drag: 0, droop: 0.12 + air * -0.3, slow: 0.06, fast: 0.04 + air * 0.12
      });
      part(ctx, 'inv_body');
      drawSickFace(ctx, t);
      ring(ctx, cx, cy, true);
      orbitStars(ctx, t, cx, cy, true);
    });
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
