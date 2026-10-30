// Anzeige im Canvas: Herzen, Samen, goldene Runkeln, Warnungen, Hinweise.
window.RR = window.RR || {};

RR.Hud = (function () {
  const isTouch = () => document.body.classList.contains('touch');

  function label(ctx, text, x, y, size, align) {
    ctx.font = '800 ' + size + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 4);
    ctx.strokeStyle = '#1b120a';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#fff6d8';
    ctx.fillText(text, x, y);
  }

  function draw(ctx, world) {
    const A = RR.Assets;
    const p = world.player;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < p.hearts ? 1 : 0.25;
      A.draw(ctx, 'heart', 16 + i * 34, 12);
    }
    ctx.globalAlpha = 1;

    A.draw(ctx, 'seed', 124, 15);
    label(ctx, String(world.seeds), 152, 27, 22);

    const gx = 210;
    for (let i = 0; i < world.goldTotal; i++) {
      ctx.globalAlpha = i < world.gold ? 1 : 0.28;
      ctx.drawImage(A.get('gold_runkel'), gx + i * 26, 8, 24, 34);
    }
    ctx.globalAlpha = 1;

    label(ctx, 'Punkte ' + world.score, world.viewW / 2, 27, 20, 'center');

    // Warnung am linken Rand: gleich kommt ein Knueppel auf dieser Hoehe
    world.warnings.forEach(w => {
      const y = w.y - world.cam.y;
      const pulse = 1 + Math.sin(world.time * 26) * 0.14;
      ctx.save();
      ctx.translate(24, y);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(-15, -15);
      ctx.lineTo(19, 0);
      ctx.lineTo(-15, 15);
      ctx.closePath();
      ctx.fillStyle = '#e23b2e';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 19px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', -3, 1);
      ctx.restore();
    });

    if (world.banner > 0) {
      ctx.globalAlpha = Math.min(1, world.banner);
      label(ctx, 'Level ' + (world.index + 1), world.viewW / 2, 170, 26, 'center');
      label(ctx, world.def.name, world.viewW / 2, 208, 44, 'center');
      ctx.globalAlpha = 1;
    }

    if (world.hint) {
      const text = isTouch() ? world.hint.h.touch : world.hint.h.keys;
      ctx.globalAlpha = Math.min(1, world.hint.t * 2);
      label(ctx, text, world.viewW / 2, 96, 24, 'center');
      ctx.globalAlpha = 1;
    }
  }

  return { draw };
})();
