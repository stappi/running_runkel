// Zeichnet die Hintergrundebenen als muensterlaendische Parklandschaft im Stil von Runkel Royal:
// flaches Land, Wallhecken, Kopfweiden, Backsteinhoefe mit Deelentor und Kirchtuerme am Horizont.
// Jede Ebene ist 1920 x 540 gross, wiederholt sich nahtlos und wird pro Toenung einmal vorberechnet.
window.RR = window.RR || {};

RR.Scenery = (function () {
  const W = 1920, H = 540;
  const QUALITY = 1.25;
  const OUTLINE = '#3a2a1c';
  const cache = {};

  function seeded(seed) {
    let v = seed % 2147483647;
    if (v <= 0) v += 2147483646;
    return () => { v = v * 16807 % 2147483647; return (v - 1) / 2147483646; };
  }

  function blob(g, fill, pts) {
    g.beginPath();
    pts.forEach(p => { g.moveTo(p[0] + p[2], p[1]); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); });
    g.fillStyle = fill;
    g.fill();
  }

  // Baumkrone aus Kugeln, darueber hellere Lichter wie in Runkel Royal
  const LEAF = {
    light: ['#5f9a42', '#7cb754'], dark: ['#4f7d3a', '#65994a'], oak: ['#4a7a34', '#6a9e45'],
    far: ['#86a982', '#9dbd94'], farDark: ['#7a9c7c', '#8fb08c'], willow: ['#8aa57a', '#a9c299']
  };

  function crown(g, x, y, w, h, n, seed, tone) {
    const rnd = seeded(seed);
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push([x + (rnd() - 0.5) * w, y - rnd() * h, Math.min(w, h) * (0.22 + rnd() * 0.16)]);
    }
    blob(g, tone[0], pts);
    blob(g, tone[1], pts.map(p => [p[0] - p[2] * 0.2, p[1] - p[2] * 0.25, p[2] * 0.6]));
  }

  function tree(g, x, y, size, seed, tone) {
    g.fillStyle = '#6a4a2c';
    g.fillRect(x - size * 0.07, y - size * 0.55, size * 0.14, size * 0.55);
    crown(g, x, y - size * 0.5, size * 0.95, size * 0.6, 9, seed, tone || LEAF.light);
  }

  // Breite Eiche mit kurzem, kraeftigem Stamm und zwei Aesten
  function oak(g, x, y, size, seed) {
    g.strokeStyle = '#5a3d24';
    g.lineCap = 'round';
    g.lineWidth = size * 0.13;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - size * 0.45);
    g.moveTo(x, y - size * 0.35);
    g.lineTo(x - size * 0.28, y - size * 0.62);
    g.moveTo(x, y - size * 0.4);
    g.lineTo(x + size * 0.3, y - size * 0.66);
    g.stroke();
    crown(g, x, y - size * 0.55, size * 1.35, size * 0.6, 13, seed, LEAF.oak);
  }

  function poplar(g, x, y, h, seed, tone) {
    g.fillStyle = '#6a4a2c';
    g.fillRect(x - 3, y - h * 0.2, 6, h * 0.2);
    const rnd = seeded(seed);
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push([x + (rnd() - 0.5) * h * 0.12, y - h * 0.18 - i * h * 0.1, h * (0.09 + rnd() * 0.04)]);
    blob(g, (tone || LEAF.dark)[0], pts);
    blob(g, (tone || LEAF.dark)[1], pts.map(p => [p[0] - p[2] * 0.25, p[1] - p[2] * 0.2, p[2] * 0.55]));
  }

  // Kopfweide: knorriger Stamm, dicker Kopf, daraus duenne Ruten mit silbrigem Laub
  function willow(g, x, y, s, seed) {
    const rnd = seeded(seed);
    g.fillStyle = '#6b5236';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - s * 0.14, y);
    g.quadraticCurveTo(x - s * 0.08, y - s * 0.3, x - s * 0.16, y - s * 0.52);
    g.quadraticCurveTo(x, y - s * 0.62, x + s * 0.16, y - s * 0.52);
    g.quadraticCurveTo(x + s * 0.08, y - s * 0.3, x + s * 0.14, y);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#7d6a3e';
    g.lineWidth = 1.6;
    const tips = [];
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.5;
      const l = s * (0.45 + rnd() * 0.35);
      const bx = x + (rnd() - 0.5) * s * 0.22, by = y - s * 0.55;
      const tx = bx + Math.cos(a) * l, ty = by + Math.sin(a) * l;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(a) * l * 0.4, by + Math.sin(a) * l * 0.6, tx, ty);
      g.stroke();
      tips.push([tx, ty, s * (0.08 + rnd() * 0.06)], [(bx + tx) / 2, (by + ty) / 2, s * 0.07]);
    }
    blob(g, LEAF.willow[0], tips);
    blob(g, LEAF.willow[1], tips.map(p => [p[0] - 2, p[1] - 2, p[2] * 0.55]));
  }

  // Wallhecke: bewachsener Erdwall mit dichtem Gebuesch und einzelnen Ueberhaeltern
  function hedge(g, x0, x1, y, h, seed, far) {
    const rnd = seeded(seed);
    g.fillStyle = far ? '#8aa77c' : '#6e8f45';
    g.beginPath();
    g.moveTo(x0 - 20, y);
    g.quadraticCurveTo(x0, y - h * 0.3, x0 + 30, y - h * 0.32);
    g.lineTo(x1 - 30, y - h * 0.32);
    g.quadraticCurveTo(x1, y - h * 0.3, x1 + 20, y);
    g.closePath();
    g.fill();
    const pts = [];
    for (let x = x0; x < x1; x += h * 0.35) pts.push([x + rnd() * h * 0.2, y - h * (0.4 + rnd() * 0.3), h * (0.28 + rnd() * 0.16)]);
    const tone = far ? LEAF.farDark : LEAF.dark;
    blob(g, tone[0], pts);
    blob(g, tone[1], pts.map(p => [p[0] - p[2] * 0.2, p[1] - p[2] * 0.3, p[2] * 0.55]));
    for (let x = x0 + 40 + rnd() * 80; x < x1 - 20; x += 140 + rnd() * 160) {
      if (far) tree(g, x, y - h * 0.3, h * 2.1, seed + x, LEAF.far);
      else oak(g, x, y - h * 0.3, h * 1.7, seed + x);
    }
  }

  function brickWall(g, x, y, w, h, rnd, bw, bh, tones) {
    for (let row = 0, yy = y; yy < y + h; yy += bh, row++) {
      for (let xx = x - (row % 2 ? bw / 2 : 0); xx < x + w; xx += bw) {
        g.fillStyle = tones[Math.floor(rnd() * tones.length)];
        g.fillRect(xx + 0.6, yy + 0.6, bw - 1.2, bh - 1.2);
      }
    }
  }
  const BRICK = ['#a8452e', '#b5502f', '#9a3d2a', '#ad4a34', '#8f3827'];
  const BRICK_FAR = ['#b97a66', '#c08571', '#b07263'];

  function whiteWindow(g, x, y, w, h) {
    g.fillStyle = '#f4efe2';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#34495a';
    const pw = (w - 9) / 2, ph = (h - 12) / 3;
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < 3; r++) g.fillRect(x + 3 + c * (pw + 3), y + 3 + r * (ph + 3), pw, ph);
    }
    g.fillStyle = '#d9cdb0';
    g.fillRect(x - 3, y + h, w + 6, 5);
    g.strokeRect(x - 3, y + h, w + 6, 5);
  }

  // Fenster auf der schraeg nach hinten laufenden Traufseite: oben und unten folgen der Flucht.
  function sideWindow(g, x, w, top0, top1, h0, h1) {
    g.beginPath();
    g.moveTo(x, top0); g.lineTo(x - w, top1); g.lineTo(x - w, top1 + h1); g.lineTo(x, top0 + h0);
    g.closePath();
    g.fillStyle = '#f4efe2';
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#34495a';
    const inset = 3;
    for (let r = 0; r < 3; r++) {
      const a0 = inset + r * (h0 - inset) / 3, a1 = inset + r * (h1 - inset) / 3;
      const b0 = (h0 - inset) / 3 - inset, b1 = (h1 - inset) / 3 - inset;
      g.beginPath();
      g.moveTo(x - inset, top0 + a0); g.lineTo(x - w + inset, top1 + a1);
      g.lineTo(x - w + inset, top1 + a1 + b1); g.lineTo(x - inset, top0 + a0 + b0);
      g.closePath();
      g.fill();
    }
  }

  // Muensterlaender Hallenhaus nach Runkel Royal: Backsteingiebel mit Rundbogen-Deelentor vorn rechts,
  // dahinter die lange Traufseite, die nach links hinten in die Tiefe laeuft.
  // Gezeichnet in Royal-Koordinaten (Sockel bei y 450); len ist die sichtbare Hauslaenge.
  function farmhouse(g, len) {
    const L = len || 300;
    const left = 20, right = 250, eaves = 285, base = 450, mid = (left + right) / 2;
    const peakY = 112;
    const rnd = seeded(1871);
    // Fluchten: hinten liegt die Traufe etwas hoeher, der First und der Sockel etwas tiefer
    const back = left - L, eaveRise = L * 0.06, baseRise = L * 0.025;

    // Traufseite im Schatten
    g.save();
    g.beginPath();
    g.moveTo(left, base); g.lineTo(left, eaves); g.lineTo(back, eaves - eaveRise); g.lineTo(back, base - baseRise);
    g.closePath();
    g.fillStyle = '#7d3425';
    g.fill();
    g.clip();
    brickWall(g, back, eaves - eaveRise, L, base - eaves + eaveRise, rnd, 20, 8, ['#8d3826', '#97402b', '#833322', '#8f3b29', '#7d3425']);
    g.fillStyle = '#a89c80';
    g.beginPath();
    g.moveTo(left, base); g.lineTo(left, base - 18); g.lineTo(back, base - baseRise - 16); g.lineTo(back, base - baseRise);
    g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(left, eaves); g.lineTo(left, base); g.lineTo(back, base - baseRise); g.lineTo(back, eaves - eaveRise);
    g.stroke();
    // Fenster und gruene Stalltuer mit Oberlicht entlang der Laengswand
    const along = u => [left - L * u, eaves - eaveRise * u, base - baseRise * u];
    [0.12, 0.34, 0.8].forEach(u => {
      const a = along(u), b = along(u + 0.09);
      sideWindow(g, a[0], L * 0.09, a[1] + 48, b[1] + 50, 46, 43);
    });
    const d0 = along(0.5), d1 = along(0.62);
    g.beginPath();
    g.moveTo(d0[0], d0[2] - 18); g.lineTo(d0[0], d0[1] + 52); g.lineTo(d1[0], d1[1] + 54); g.lineTo(d1[0], d1[2] - 17);
    g.closePath();
    g.fillStyle = '#2f5a3f';
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.5;
    g.stroke();
    g.beginPath();
    g.moveTo((d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2 + 53); g.lineTo((d0[0] + d1[0]) / 2, (d0[2] + d1[2]) / 2 - 17);
    g.moveTo(d0[0], d0[1] + 70); g.lineTo(d1[0], d1[1] + 72);
    g.stroke();

    g.save();
    g.beginPath();
    g.moveTo(left, base); g.lineTo(left, eaves); g.lineTo(mid, peakY); g.lineTo(right, eaves); g.lineTo(right, base);
    g.closePath();
    g.fillStyle = '#a8452e';
    g.fill();
    g.clip();
    brickWall(g, left, peakY, right - left, base - peakY, rnd, 20, 8, BRICK);
    g.fillStyle = '#c9bd9f';
    g.fillRect(left, base - 18, right - left, 18);
    g.restore();
    g.beginPath();
    g.moveTo(left, base); g.lineTo(left, eaves); g.lineTo(mid, peakY); g.lineTo(right, eaves); g.lineTo(right, base);
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3;
    g.stroke();

    // Rundbogen-Deelentor mit Sandsteinbogen, Faecherfenster und Schlussstein
    const gx = mid, gw = 52, gTop = 340, gBase = 450;
    g.beginPath();
    g.moveTo(gx - gw - 11, gBase); g.lineTo(gx - gw - 11, gTop); g.arc(gx, gTop, gw + 11, Math.PI, 0); g.lineTo(gx + gw + 11, gBase);
    g.closePath();
    g.fillStyle = '#d9cdb0';
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(gx - gw, gBase); g.lineTo(gx - gw, gTop); g.arc(gx, gTop, gw, Math.PI, 0); g.lineTo(gx + gw, gBase);
    g.closePath();
    g.fillStyle = '#2f5a3f';
    g.fill();
    g.stroke();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(15,35,22,0.65)';
    g.lineWidth = 2;
    for (let bx = gx - gw + 15; bx < gx + gw; bx += 15) {
      g.beginPath(); g.moveTo(bx, gTop - gw); g.lineTo(bx, gBase); g.stroke();
    }
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(gx, gTop); g.lineTo(gx, gBase); g.stroke();
    g.fillStyle = '#f4efe2';
    g.fillRect(gx - gw, gTop - 3, gw * 2, 6);
    g.fillStyle = '#34495a';
    for (let fan = 0; fan < 4; fan++) {
      g.beginPath();
      g.moveTo(gx, gTop - 5);
      g.arc(gx, gTop - 5, gw - 9, Math.PI + 0.1 + fan * 0.77, Math.PI + 0.77 + fan * 0.77);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.fillStyle = '#c9bd9f';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(gx - 9, gTop - gw - 14); g.lineTo(gx + 9, gTop - gw - 14); g.lineTo(gx + 6, gTop - gw + 3); g.lineTo(gx - 6, gTop - gw + 3);
    g.closePath(); g.fill(); g.stroke();

    whiteWindow(g, left + 8, 330, 30, 48);
    whiteWindow(g, right - 38, 330, 30, 48);
    whiteWindow(g, mid - 18, 205, 36, 50);
    g.fillStyle = '#d9cdb0';
    g.beginPath(); g.arc(mid, 166, 13, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#2a2018';
    g.beginPath(); g.arc(mid, 166, 7.5, 0, Math.PI * 2); g.fill();

    // Tonpfannendach
    const eaveFront = [left - 14, eaves + 12], ridgeFront = [mid, peakY - 6];
    const ridgeBack = [mid - L - 10, peakY - 6 + L * 0.05], eaveBack = [back - 22, eaves + 12 - eaveRise];
    const roofPoint = (u, v) => {
      const fx = eaveFront[0] + (ridgeFront[0] - eaveFront[0]) * v, fy = eaveFront[1] + (ridgeFront[1] - eaveFront[1]) * v;
      const bx = eaveBack[0] + (ridgeBack[0] - eaveBack[0]) * v, by = eaveBack[1] + (ridgeBack[1] - eaveBack[1]) * v;
      return [fx + (bx - fx) * u, fy + (by - fy) * u];
    };
    g.save();
    g.beginPath();
    g.moveTo(eaveFront[0], eaveFront[1]); g.lineTo(ridgeFront[0], ridgeFront[1]); g.lineTo(ridgeBack[0], ridgeBack[1]); g.lineTo(eaveBack[0], eaveBack[1]);
    g.closePath();
    g.fillStyle = '#7c3324';
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 4;
    g.stroke();
    g.clip();
    const roofTones = ['#a5492f', '#99422b', '#ad5234', '#8f3c28', '#a04630'];
    const rows = 11, cols = Math.round(L / 24) + 2;
    for (let ry = rows - 1; ry >= 0; ry--) {
      const v0 = ry / rows, v1 = (ry + 1.15) / rows;
      for (let cx = -1; cx < cols; cx++) {
        const u0 = (cx + (ry % 2 ? 0.5 : 0)) / cols, u1 = u0 + 1 / cols;
        const pa = roofPoint(u0, v1), pb = roofPoint(u1, v1), pc = roofPoint(u1, v0), pd = roofPoint(u0, v0);
        g.fillStyle = roofTones[Math.floor(rnd() * roofTones.length)];
        g.beginPath();
        g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.lineTo(pc[0], pc[1]);
        g.quadraticCurveTo((pc[0] + pd[0]) / 2, (pc[1] + pd[1]) / 2 + (pd[1] - pa[1]) * 0.28, pd[0], pd[1]);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(55,20,12,0.5)';
        g.lineWidth = 1;
        g.stroke();
      }
    }
    const roofLight = g.createLinearGradient(0, peakY, 0, eaves);
    roofLight.addColorStop(0, 'rgba(255,220,170,0.16)');
    roofLight.addColorStop(1, 'rgba(40,10,5,0.26)');
    g.fillStyle = roofLight;
    g.fillRect(back - 60, peakY - 20, L + 320, eaves - peakY + 60);
    g.restore();

    // Hintere Ortgangkante: dunkles Brett, die abgewandte Giebelseite ist nicht zu sehen
    g.lineCap = 'round';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(eaveBack[0], eaveBack[1]); g.lineTo(ridgeBack[0], ridgeBack[1]); g.stroke();
    g.strokeStyle = '#5a2a1c';
    g.lineWidth = 4;
    g.stroke();

    g.lineCap = 'round';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 11;
    g.beginPath(); g.moveTo(ridgeFront[0], ridgeFront[1]); g.lineTo(ridgeBack[0], ridgeBack[1]); g.stroke();
    g.strokeStyle = '#6e2c20';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(ridgeFront[0], ridgeFront[1]); g.lineTo(ridgeBack[0], ridgeBack[1]); g.stroke();

    // Backsteinschornstein auf der sichtbaren Dachflaeche, daher vor dem First gezeichnet
    const chim = roofPoint(0.42, 0.8);
    g.fillStyle = '#9a3d2a';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3;
    g.fillRect(chim[0] - 13, chim[1] - 52, 26, 58);
    g.strokeRect(chim[0] - 13, chim[1] - 52, 26, 58);
    g.fillStyle = '#d9cdb0';
    g.fillRect(chim[0] - 17, chim[1] - 60, 34, 9);
    g.strokeRect(chim[0] - 17, chim[1] - 60, 34, 9);

    const eaveRight = [right + 14, eaves + 12];
    g.fillStyle = '#7c3324';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(ridgeFront[0], ridgeFront[1] - 2); g.lineTo(eaveRight[0] + 4, eaveRight[1] - 6);
    g.lineTo(eaveRight[0], eaveRight[1] + 4); g.lineTo(ridgeFront[0], ridgeFront[1] + 8);
    g.closePath(); g.fill(); g.stroke();
    // Weisse Windbretter mit gekreuzten Pferdekoepfen am First
    [[eaveFront, ridgeFront], [eaveRight, ridgeFront]].forEach(b => {
      g.strokeStyle = OUTLINE;
      g.lineWidth = 14;
      g.beginPath(); g.moveTo(b[0][0], b[0][1]); g.lineTo(b[1][0], b[1][1] + 5); g.stroke();
      g.strokeStyle = '#f4efe2';
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(b[0][0], b[0][1]); g.lineTo(b[1][0], b[1][1] + 5); g.stroke();
    });
    g.strokeStyle = OUTLINE;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(mid - 4, peakY + 2); g.quadraticCurveTo(mid + 20, peakY - 24, mid + 30, peakY - 18);
    g.moveTo(mid + 4, peakY + 2); g.quadraticCurveTo(mid - 20, peakY - 24, mid - 30, peakY - 18);
    g.stroke();
    g.strokeStyle = '#f4efe2';
    g.lineWidth = 3;
    g.stroke();
    g.lineCap = 'butt';
  }

  // Zeichnet etwas in Royal-Koordinaten so, dass dessen Sockel bei (x, base) steht.
  function placed(g, x, base, s, fn, flip) {
    g.save();
    g.translate(x, base - 450 * s);
    g.scale(flip ? -s : s, s);
    fn(g);
    g.restore();
  }

  // Fachwerk: weisse Gefache zwischen dunklen Balken unter rotem Satteldach (Spieker oder Kotten)
  function halfTimbered(g, x, base, w, h, roofH, seed) {
    const rnd = seeded(seed);
    g.fillStyle = '#f2ead6';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.fillRect(x, base - h, w, h);
    g.strokeStyle = '#4a3020';
    g.lineWidth = 4;
    g.strokeRect(x, base - h, w, h);
    const cols = Math.max(2, Math.round(w / 22));
    for (let i = 1; i < cols; i++) {
      const xx = x + w * i / cols;
      g.beginPath(); g.moveTo(xx, base - h); g.lineTo(xx, base); g.stroke();
    }
    g.beginPath(); g.moveTo(x, base - h * 0.5); g.lineTo(x + w, base - h * 0.5); g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < cols; i++) {
      if (rnd() < 0.45) {
        const x0 = x + w * i / cols, x1 = x + w * (i + 1) / cols;
        g.beginPath(); g.moveTo(x0, base - h * 0.5); g.lineTo(x1, base - h); g.stroke();
      }
    }
    whiteWindow(g, x + w * 0.5 - 9, base - h * 0.45, 18, 26);
    g.fillStyle = '#7c3324';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x - 10, base - h + 4); g.lineTo(x + w / 2, base - h - roofH); g.lineTo(x + w + 10, base - h + 4);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(55,20,12,0.45)';
    g.lineWidth = 1;
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      g.beginPath();
      g.moveTo(x - 10 + (w / 2 + 10) * t, base - h + 4 - (roofH + 4) * t);
      g.lineTo(x + w + 10 - (w / 2 + 10) * t, base - h + 4 - (roofH + 4) * t);
      g.stroke();
    }
  }

  // Backsteinkirchturm mit gruener Kupferspitze, wie in jedem Muensterlaender Dorf
  function churchTower(g, x, base, h, far) {
    const w = h * 0.2;
    const rnd = seeded(Math.round(x));
    g.save();
    g.beginPath();
    g.rect(x - w / 2, base - h * 0.62, w, h * 0.62);
    g.fillStyle = far ? '#b98472' : '#a8452e';
    g.fill();
    g.clip();
    brickWall(g, x - w / 2, base - h * 0.62, w, h * 0.62, rnd, w / 4, w / 10, far ? BRICK_FAR : BRICK);
    g.restore();
    g.strokeStyle = far ? 'rgba(58,42,28,.5)' : OUTLINE;
    g.lineWidth = far ? 1.5 : 2.5;
    g.strokeRect(x - w / 2, base - h * 0.62, w, h * 0.62);
    g.fillStyle = far ? '#c9bfae' : '#d9cdb0';
    g.fillRect(x - w / 2, base - h * 0.62, w, h * 0.04);
    g.fillStyle = far ? '#6b6560' : '#2a2018';
    g.beginPath();
    g.moveTo(x - w * 0.18, base - h * 0.47); g.lineTo(x - w * 0.18, base - h * 0.54);
    g.arc(x, base - h * 0.54, w * 0.18, Math.PI, 0); g.lineTo(x + w * 0.18, base - h * 0.47);
    g.closePath(); g.fill();
    g.fillStyle = far ? '#e6dfcf' : '#f4efe2';
    g.beginPath(); g.arc(x, base - h * 0.38, w * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = far ? '#7fa596' : '#5f9c8a';
    g.beginPath();
    g.moveTo(x - w * 0.62, base - h * 0.62); g.lineTo(x, base - h); g.lineTo(x + w * 0.62, base - h * 0.62);
    g.closePath(); g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(x, base - h); g.lineTo(x, base - h - h * 0.07);
    g.moveTo(x - h * 0.025, base - h - h * 0.045); g.lineTo(x + h * 0.025, base - h - h * 0.045);
    g.stroke();
  }

  // Backstein-Wallhollaender mit weissen Jalousiefluegeln
  function windmill(g, x, base, h, far) {
    const rnd = seeded(77);
    const top = base - h, wb = h * 0.42, wt = h * 0.22;
    g.save();
    g.beginPath();
    g.moveTo(x - wb / 2, base); g.lineTo(x - wt / 2, top); g.lineTo(x + wt / 2, top); g.lineTo(x + wb / 2, base);
    g.closePath();
    g.fillStyle = far ? '#b98472' : '#a8452e';
    g.fill();
    g.clip();
    brickWall(g, x - wb / 2, top, wb, h, rnd, h * 0.06, h * 0.025, far ? BRICK_FAR : BRICK);
    g.restore();
    g.strokeStyle = far ? 'rgba(58,42,28,.5)' : OUTLINE;
    g.lineWidth = far ? 1.5 : 2.5;
    g.beginPath();
    g.moveTo(x - wb / 2, base); g.lineTo(x - wt / 2, top); g.lineTo(x + wt / 2, top); g.lineTo(x + wb / 2, base);
    g.stroke();
    if (!far) {
      // Galerie und Tuer
      g.fillStyle = '#5a3d24';
      g.fillRect(x - wb * 0.45, base - h * 0.42, wb * 0.9, h * 0.035);
      g.strokeRect(x - wb * 0.45, base - h * 0.42, wb * 0.9, h * 0.035);
      g.fillStyle = '#2f5a3f';
      g.fillRect(x - h * 0.04, base - h * 0.16, h * 0.08, h * 0.16);
      g.strokeRect(x - h * 0.04, base - h * 0.16, h * 0.08, h * 0.16);
      whiteWindow(g, x - h * 0.03, base - h * 0.68, h * 0.06, h * 0.09);
    }
    g.fillStyle = far ? '#8a8378' : '#6d5a44';
    g.beginPath();
    g.ellipse(x, top, wt * 0.75, h * 0.09, 0, Math.PI, 0);
    g.closePath(); g.fill(); g.stroke();
    const hub = [x + wt * 0.15, top - h * 0.03];
    for (let i = 0; i < 4; i++) {
      const a = 0.35 + i * Math.PI / 2;
      const c = Math.cos(a), s = Math.sin(a);
      const len = h * 0.62, wid = h * 0.09;
      g.save();
      g.translate(hub[0], hub[1]);
      g.rotate(a);
      g.fillStyle = far ? 'rgba(240,235,222,.85)' : '#f4efe2';
      g.fillRect(len * 0.18, 0, len * 0.82, wid);
      g.strokeRect(len * 0.18, 0, len * 0.82, wid);
      g.lineWidth = 1;
      for (let k = 1; k < 7; k++) {
        g.beginPath(); g.moveTo(len * (0.18 + k * 0.117), 0); g.lineTo(len * (0.18 + k * 0.117), wid); g.stroke();
      }
      g.lineWidth = far ? 2 : 3.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
      g.restore();
      void c; void s;
    }
    g.fillStyle = OUTLINE;
    g.beginPath(); g.arc(hub[0], hub[1], h * 0.022, 0, Math.PI * 2); g.fill();
  }

  // Schwarzbuntes Rind, nach rechts schauend
  function cow(g, x, y, s, flip, seed) {
    const rnd = seeded(seed);
    g.save();
    g.translate(x, y);
    g.scale(flip ? -s : s, s);
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.5;
    g.fillStyle = '#3a2f2a';
    [[-26, 4], [-16, 6], [18, 6], [26, 4]].forEach(l => { g.fillRect(l[0] - 3, -8, 6, 26 + l[1] - 6); });
    g.beginPath();
    g.moveTo(-34, -30); g.quadraticCurveTo(-36, -4, -26, 0); g.lineTo(26, 0); g.quadraticCurveTo(36, -6, 32, -30);
    g.quadraticCurveTo(0, -38, -34, -30);
    g.closePath();
    g.fillStyle = '#fbfaf5';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#2b2522';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(-26 + rnd() * 52, -30 + rnd() * 28, 8 + rnd() * 9, 6 + rnd() * 7, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.stroke();
    g.fillStyle = '#f2b8b0';
    g.beginPath(); g.ellipse(6, 1, 7, 4, 0, 0, Math.PI * 2); g.fill();
    // Kopf mit weisser Blesse
    g.fillStyle = '#2b2522';
    g.beginPath();
    g.moveTo(30, -30); g.quadraticCurveTo(46, -36, 52, -22); g.quadraticCurveTo(54, -12, 46, -10);
    g.quadraticCurveTo(36, -12, 30, -20);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fbfaf5';
    g.beginPath(); g.ellipse(46, -21, 3.5, 8, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9b7a8';
    g.beginPath(); g.ellipse(50, -13, 5, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d9cdb0';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(38, -32); g.lineTo(36, -38); g.moveTo(44, -33); g.lineTo(47, -38); g.stroke();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-34, -26); g.quadraticCurveTo(-42, -14, -38, 2); g.stroke();
    g.restore();
  }

  function fence(g, y, x0, x1, step, h, tone) {
    g.strokeStyle = OUTLINE;
    g.lineWidth = 1.6;
    g.fillStyle = tone;
    [0.35, 0.72].forEach(u => {
      g.fillRect(x0, y - h * u, x1 - x0, h * 0.1);
      g.strokeRect(x0, y - h * u, x1 - x0, h * 0.1);
    });
    for (let x = x0; x <= x1; x += step) {
      g.fillRect(x - h * 0.07, y - h, h * 0.14, h);
      g.strokeRect(x - h * 0.07, y - h, h * 0.14, h);
    }
  }

  function hay(g, x, y, r) {
    g.fillStyle = '#e3bb4c';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#b98f2a';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const a = i * 0.9, l = r * (0.3 + (i % 5) * 0.12);
      g.beginPath();
      g.moveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5);
      g.lineTo(x + Math.cos(a + 0.5) * l, y + Math.sin(a + 0.5) * l);
      g.stroke();
    }
  }

  // Wegekreuz aus Sandstein unter kleinem Dach
  function wayCross(g, x, base) {
    g.fillStyle = '#c9bd9f';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.fillRect(x - 9, base - 22, 18, 22);
    g.strokeRect(x - 9, base - 22, 18, 22);
    g.fillRect(x - 3, base - 78, 6, 58);
    g.strokeRect(x - 3, base - 78, 6, 58);
    g.fillRect(x - 15, base - 64, 30, 6);
    g.strokeRect(x - 15, base - 64, 30, 6);
    g.fillStyle = '#5a3d24';
    g.beginPath(); g.moveTo(x - 18, base - 76); g.lineTo(x, base - 90); g.lineTo(x + 18, base - 76); g.closePath();
    g.fill(); g.stroke();
  }

  function grassTufts(g, rnd, n, y0, y1, x0, x1) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      const k = 0.6 + (y - y0) / Math.max(1, y1 - y0) * 0.8;
      g.strokeStyle = rnd() < 0.5 ? '#4f8a30' : '#7fb346';
      g.lineWidth = 1.6 * k;
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.moveTo(x + j * 3 * k, y);
        g.quadraticCurveTo(x + j * 3 * k, y - 7 * k, x + (j * 5 - 6) * k, y - 13 * k);
        g.stroke();
      }
    }
  }

  // Sanft gewellte Bodenlinie, die sich alle 1920 Einheiten wiederholt
  function groundLine(g, y, amp, seed, fill) {
    const k = Math.PI * 2 / W;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      g.lineTo(x, y + Math.sin(x * k * 2 + seed) * amp + Math.sin(x * k * 5 + seed * 2) * amp * 0.35);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  // --- Ebenen -----------------------------------------------------------------

  // Horizont: Feldflickwerk, Baumreihen, Hoefe zwischen Baeumen, Kirchtuerme und eine Muehle
  function far(g) {
    groundLine(g, 398, 3, 0.4, '#a9c98a');
    const rnd = seeded(902);
    const patches = ['#c9d38e', '#b4cf86', '#d8cf8a', '#a3c37c', '#c4b98a'];
    for (let x = 0, i = 0; x < W; i++) {
      const w = 120 + rnd() * 160;
      g.fillStyle = patches[i % patches.length];
      g.beginPath();
      g.moveTo(x, 412); g.lineTo(x + w, 410); g.lineTo(x + w + 30, 440); g.lineTo(x - 20, 442);
      g.closePath(); g.fill();
      x += w;
    }
    for (let x = 0; x < W; x += 240) hedge(g, x + 20, x + 200, 412, 16, 40 + x, true);
    churchTower(g, 560, 404, 120, true);
    churchTower(g, 1530, 404, 90, true);
    windmill(g, 1180, 404, 62, true);
    for (let t = 0; t < 46; t++) {
      const x = rnd() * W;
      tree(g, x, 404 + rnd() * 4, 30 + rnd() * 34, 500 + t, rnd() < 0.5 ? LEAF.far : LEAF.farDark);
    }
    [[260, 0.18], [940, 0.16], [1720, 0.17]].forEach(f => placed(g, f[0], 406, f[1], farmhouse));
    tree(g, 225, 406, 52, 811, LEAF.far);
    tree(g, 990, 406, 44, 812, LEAF.farDark);
    // Dunst ueber der Ferne
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(205, 226, 236, .32)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  function midAcker(g) {
    const rnd = seeded(31);
    groundLine(g, 430, 2, 1.1, '#9fc364');
    // Ruebenacker mit Reihen
    g.fillStyle = '#8a6a3e';
    g.beginPath(); g.moveTo(1090, 436); g.lineTo(1920, 432); g.lineTo(1920, 540); g.lineTo(1020, 540); g.closePath(); g.fill();
    for (let r = 0; r < 4; r++) {
      const y = 440 + r * 9;
      for (let x = 1090 + (r % 2) * 9; x < 1910; x += 18) blob(g, r % 2 ? '#6f9a34' : '#86b23e', [[x, y, 4 + r * 0.6]]);
    }
    hedge(g, 640, 1050, 430, 46, 7);
    oak(g, 210, 432, 120, 3);
    placed(g, 420, 434, 0.55, farmhouse);
    tree(g, 330, 432, 110, 9, LEAF.dark);
    oak(g, 640, 432, 135, 11);
    wayCross(g, 1110, 434);
    windmill(g, 1380, 434, 190, false);
    for (let i = 0; i < 5; i++) poplar(g, 1640 + i * 46, 434, 150 + rnd() * 25, 60 + i);
    tree(g, 1880, 434, 95, 13, LEAF.light);
  }

  function midWeide(g) {
    const rnd = seeded(32);
    groundLine(g, 430, 2, 2.3, '#86b94e');
    hedge(g, -40, 640, 422, 50, 21);
    hedge(g, 1260, 1960, 422, 50, 22);
    // Graben mit Kopfweiden
    g.fillStyle = '#7ab0c8';
    g.fillRect(700, 446, 520, 8);
    g.strokeStyle = 'rgba(58,42,28,.6)';
    g.lineWidth = 1.5;
    g.strokeRect(700, 446, 520, 8);
    for (let i = 0; i < 6; i++) willow(g, 730 + i * 92, 446, 72 + rnd() * 14, 70 + i);
    halfTimbered(g, 1440, 434, 120, 62, 46, 5);
    oak(g, 1600, 434, 120, 23);
    // Kleiner als die Spielkuehe und hinter dem Zaun, damit niemand sie fuer Plattformen haelt
    cow(g, 170, 436, 0.62, false, 1);
    cow(g, 420, 438, 0.66, true, 2);
    cow(g, 1270, 437, 0.6, false, 3);
    cow(g, 1760, 438, 0.66, true, 4);
    fence(g, 456, 0, W, 96, 30, '#8a6440');
    grassTufts(g, rnd, 60, 440, 470, 0, W);
  }

  function midHof(g) {
    const rnd = seeded(33);
    groundLine(g, 430, 1.5, 3.1, '#b9a46a');
    // Hofpflaster
    g.fillStyle = '#c9b78a';
    g.fillRect(0, 436, W, 104);
    g.strokeStyle = 'rgba(90,70,40,.25)';
    g.lineWidth = 1;
    for (let y = 440; y < 470; y += 6) {
      for (let x = (y / 6 % 2) * 7; x < W; x += 14) g.strokeRect(x, y, 14, 6);
    }
    oak(g, 120, 436, 150, 41);
    placed(g, 430, 438, 0.64, farmhouse);
    // Hofbaum: grosse Linde
    tree(g, 760, 436, 190, 43, LEAF.light);
    halfTimbered(g, 880, 436, 84, 70, 44, 6);
    // Schwengelpumpe und Milchkannen
    g.fillStyle = '#4b5b52';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    g.fillRect(1030, 396, 10, 40);
    g.strokeRect(1030, 396, 10, 40);
    g.beginPath(); g.moveTo(1035, 400); g.lineTo(1062, 388); g.stroke();
    g.beginPath(); g.moveTo(1030, 410); g.lineTo(1016, 414); g.stroke();
    [[1080, 0], [1100, 1], [1120, 0]].forEach(m => {
      g.fillStyle = '#c8ccd0';
      g.fillRect(m[0] - 8, 410 + m[1] * 2, 16, 26 - m[1] * 2);
      g.strokeRect(m[0] - 8, 410 + m[1] * 2, 16, 26 - m[1] * 2);
      g.fillRect(m[0] - 5, 404 + m[1] * 2, 10, 6);
      g.strokeRect(m[0] - 5, 404 + m[1] * 2, 10, 6);
    });
    tree(g, 1200, 436, 100, 44, LEAF.dark);
    // Zweite Scheune, gespiegelt: ihr Dach laeuft nach rechts hinten
    placed(g, 1360, 438, 0.5, h => farmhouse(h, 200), true);
    hay(g, 1430, 414, 22);
    hay(g, 1478, 416, 21);
    hay(g, 1455, 380, 20);
    hay(g, 1526, 418, 20);
    oak(g, 1700, 436, 140, 45);
    fence(g, 456, 1560, W + 40, 90, 32, '#8a6440');
    fence(g, 456, -40, 280, 90, 32, '#8a6440');
    grassTufts(g, rnd, 30, 436, 450, 1560, W);
  }

  // Vordergrund: Hecke mit Weissdorn und Mohn
  function near(g) {
    const rnd = seeded(51);
    [[0, 320], [600, 940], [1300, 1620]].forEach((s, i) => {
      const pts = [];
      for (let x = s[0]; x < s[1]; x += 34) pts.push([x + rnd() * 20, 488 + rnd() * 10, 26 + rnd() * 18]);
      blob(g, '#4f7d3a', pts);
      blob(g, '#6a9e45', pts.map(p => [p[0] - p[2] * 0.2, p[1] - p[2] * 0.3, p[2] * 0.55]));
      for (let k = 0; k < 14; k++) {
        const p = pts[Math.floor(rnd() * pts.length)];
        g.fillStyle = k % 3 ? '#f4efe2' : '#d8483a';
        g.beginPath(); g.arc(p[0] + (rnd() - 0.5) * p[2], p[1] - rnd() * p[2], 3, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#4f7d3a';
      g.fillRect(s[0], 500, s[1] - s[0] + 30, 40);
      void i;
    });
    grassTufts(g, rnd, 50, 492, 540, 0, W);
  }

  const LAYERS = { far, near, mid_acker: midAcker, mid_weide: midWeide, mid_hof: midHof };

  // Liefert eine fertige Ebene; der Hintergrund wiederholt sich, daher wird alles dreifach versetzt gezeichnet.
  function layer(name, tint) {
    const key = name + '|' + (tint || '');
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * QUALITY);
    c.height = Math.ceil(H * QUALITY);
    const g = c.getContext('2d');
    g.scale(QUALITY, QUALITY);
    g.lineJoin = 'round';
    [-W, 0, W].forEach(dx => {
      g.save();
      g.translate(dx, 0);
      LAYERS[name](g);
      g.restore();
    });
    if (tint) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint;
      g.fillRect(0, 0, c.width, c.height);
    }
    return (cache[key] = c);
  }

  return { layer, blob, seeded, W, H };
})();
