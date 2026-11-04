// Laedt Sprites und SVGs und rendert die SVGs einmalig in Offscreen-Canvas vor.
window.RR = window.RR || {};

RR.Assets = (function () {
  const SPRITES = ['man_body', 'inv_body', 'inv_arm', 'inv_leg', 'inv_cane'];
  // Name -> [Breite, Hoehe] in Spieleinheiten
  const SVGS = {
    boar: [120, 80], cow: [160, 110], tractor: [220, 170], wheel_big: [84, 84], wheel_small: [52, 52],
    log: [120, 56], log_round: [60, 60], club: [70, 28], scarecrow: [80, 124], goal: [130, 190],
    seed: [22, 22], gold_runkel: [40, 56], heart: [30, 28], fence: [96, 52], beet_plant: [44, 40], hay: [48, 48],
    barrel: [48, 48]
  };
  const QUALITY = 2;

  const store = {};

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild fehlt: ' + src));
      img.src = src;
    });
  }

  function bake(img, w, h, q) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * q);
    c.height = Math.ceil(h * q);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function load() {
    const jobs = [];
    SPRITES.forEach(n => jobs.push(loadImage('assets/sprites/' + n + '.png').then(i => { store[n] = i; })));
    Object.keys(SVGS).forEach(n => jobs.push(loadImage('assets/svg/' + n + '.svg').then(i => {
      store[n] = bake(i, SVGS[n][0], SVGS[n][1], QUALITY);
    })));
    return Promise.all(jobs);
  }

  function get(name) { return store[name]; }

  function size(name) { return SVGS[name]; }

  // Zeichnet ein SVG-Asset; (x, y) ist die linke obere Ecke.
  function draw(ctx, name, x, y, flip) {
    const s = SVGS[name];
    if (flip) {
      ctx.save();
      ctx.translate(x + s[0], y);
      ctx.scale(-1, 1);
      ctx.drawImage(store[name], 0, 0, s[0], s[1]);
      ctx.restore();
    } else {
      ctx.drawImage(store[name], x, y, s[0], s[1]);
    }
  }


  return { load, get, size, draw };
})();
