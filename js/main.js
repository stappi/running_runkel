// Spielschleife, Bildschirmgroesse und Menues.
(function () {
  const STEP = 1 / 60;
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug');
  const $ = id => document.getElementById(id);

  const stage = $('stage');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  const app = {
    screen: 'loading', // loading, title, play, pause, gameover, level, credits, rig
    world: null,
    backdrop: null,
    index: 0,
    totalScore: 0,
    viewW: 960,
    scale: 1,
    rotatePaused: false,
    t: 0,
    fps: 60
  };
  window.RR.app = app;

  // --- Groesse -------------------------------------------------------------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h > w;
    const touch = document.body.classList.contains('touch');
    $('rotate').classList.toggle('hidden', !(portrait && touch));
    if (portrait && touch && app.screen === 'play') pause();

    const aspect = Math.max(4 / 3, Math.min(2.4, w / h));
    let cssH = h, cssW = h * aspect;
    if (cssW > w) { cssW = w; cssH = w / aspect; }
    app.viewW = Math.round(540 * aspect);
    app.scale = cssH / 540;
    stage.style.width = Math.round(cssW) + 'px';
    stage.style.height = Math.round(cssH) + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    app.px = canvas.height / 540;
    [app.world, app.backdrop].forEach(wd => { if (wd) wd.viewW = app.viewW; });
  }

  // --- Bildschirme ----------------------------------------------------------
  const SCREENS = ['title', 'pause', 'gameover', 'level', 'credits', 'loading'];

  function show(name) {
    app.screen = name;
    SCREENS.forEach(s => $('screen-' + s).classList.toggle('hidden', s !== name));
    const inGame = name === 'play';
    // Die Leiste bleibt fuer die Vollbild-Taste sichtbar, Ton und Pause gibt es nur im Spiel.
    $('topbar').classList.toggle('hidden', name === 'loading');
    document.querySelectorAll('#topbar .ingame').forEach(b => b.classList.toggle('hidden', !inGame));
    $('touch').classList.toggle('hidden', !inGame || !document.body.classList.contains('touch'));
    RR.Input.releaseAll();
  }

  function unlocked() {
    return Math.max(1, Math.min(RR.LEVELS.length, RR.Store.get('unlocked', 1)));
  }

  function renderLevelSelect() {
    const el = $('level-select');
    el.innerHTML = '';
    const best = RR.Store.get('best', {});
    RR.LEVELS.forEach((l, i) => {
      const b = document.createElement('button');
      const score = best[i] ? ' · ' + best[i].score + ' P' : '';
      b.textContent = (i + 1) + ' ' + l.name + score;
      b.disabled = i >= unlocked();
      b.addEventListener('click', () => startLevel(i, true));
      el.appendChild(b);
    });
  }

  function toTitle() {
    RR.Audio.stopMusic();
    app.world = null;
    app.backdrop = new RR.World(0, app.viewW);
    app.backdrop.entities = app.backdrop.entities.filter(e => e.kind === 'decor');
    renderLevelSelect();
    show('title');
  }

  function startLevel(i, fresh) {
    RR.Audio.unlock();
    RR.Audio.startMusic();
    if (fresh) app.totalScore = 0;
    app.index = i;
    app.world = new RR.World(i, app.viewW);
    app.world.events.win = onWin;
    app.world.events.gameover = () => show('gameover');
    show('play');
  }

  function saveResult(w) {
    const best = RR.Store.get('best', {});
    const prev = best[w.index];
    if (!prev || w.score > prev.score) best[w.index] = { score: w.score, gold: w.gold };
    RR.Store.set('best', best);
    RR.Store.set('unlocked', Math.max(unlocked(), w.index + 2));
    const total = Object.keys(best).reduce((s, k) => s + best[k].score, 0);
    return { best: best[w.index], total };
  }

  function onWin() {
    const w = app.world;
    const r = saveResult(w);
    app.totalScore += w.score;
    if (w.index + 1 >= RR.LEVELS.length) {
      $('credits-stats').textContent = 'Punkte in diesem Lauf: ' + app.totalScore + ' · Beste Gesamtwertung: ' + r.total;
      show('credits');
      return;
    }
    $('level-title').textContent = w.def.name + ' geschafft!';
    $('level-stats').textContent = 'Samen: ' + w.seeds + ' · Goldene Runkeln: ' + w.gold + ' von ' + w.goldTotal + ' · Punkte: ' + w.score + ' (Bestwert ' + r.best.score + ')';
    show('level');
  }

  function pause() {
    if (app.screen === 'play') show('pause');
  }

  function resume() {
    if (app.screen === 'pause') {
      RR.Audio.unlock();
      show('play');
    }
  }

  // --- Vollbild ------------------------------------------------------------
  // Wie in Runkel Royal: Vollbild ueber die Taste, auf Android danach im Querformat festgehalten.
  const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg>';
  const ICON_SHRINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v6H3M21 9h-6V3M15 21v-6h6M3 15h6v6"/></svg>';
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fullscreenEnabled = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  // Vom Home-Bildschirm gestartet laeuft das Spiel schon ohne Browserleisten.
  function standalone() {
    return navigator.standalone === true ||
      (window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
  }

  // Das iPhone kann Webseiten nicht ins Vollbild bringen; dort hilft der Weg ueber den Home-Bildschirm.
  function needsHomeScreen() {
    const ios = /iPhone|iPod|iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !fullscreenEnabled() && !standalone();
  }

  function toggleFullscreen() {
    if (fullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    // Direkt im Klick anfragen, sonst werten manche Browser es nicht mehr als Nutzeraktion.
    let done;
    try { done = req.call(el, { navigationUI: 'hide' }); } catch (e) { return; }
    Promise.resolve(done)
      .then(() => { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape'); })
      .catch(() => { /* Desktop oder iPad: ohne Querformat-Sperre, sonst bleibt der Drehhinweis */ });
  }

  function setupFullscreen() {
    if (needsHomeScreen()) $('home-hint').classList.remove('hidden');
    if (!fullscreenEnabled() || standalone()) return;
    const b = $('btn-full');
    b.hidden = false;
    const refresh = () => {
      const on = !!fullscreenElement();
      b.innerHTML = on ? ICON_SHRINK : ICON_EXPAND;
      b.setAttribute('aria-label', on ? 'Vollbild beenden' : 'Vollbild');
      b.title = b.getAttribute('aria-label');
    };
    b.addEventListener('click', () => { toggleFullscreen(); b.blur(); });
    document.addEventListener('fullscreenchange', refresh);
    document.addEventListener('webkitfullscreenchange', refresh);
    refresh();
  }

  // Ein Web-App-Manifest laesst das Spiel vom Android-Startbildschirm im Vollbild starten.
  // Unter file:// wuerde der Browser es ohnehin abweisen.
  function addManifest() {
    if (!/^https?:$/.test(location.protocol)) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
  }

  function bindUi() {
    const click = (id, fn) => $(id).addEventListener('click', fn);
    click('btn-play', () => startLevel(Math.min(unlocked() - 1, RR.LEVELS.length - 1), true));
    click('btn-resume', resume);
    click('btn-restart', () => startLevel(app.index, false));
    click('btn-retry', () => startLevel(app.index, false));
    click('btn-quit', toTitle);
    click('btn-quit2', toTitle);
    click('btn-next', () => startLevel(app.index + 1, false));
    click('btn-credits-back', toTitle);
    click('btn-pause', pause);
    ['btn-sound', 'btn-sound-pause', 'btn-sound-top'].forEach(id => click(id, () => {
      RR.Audio.unlock();
      RR.Audio.toggle();
    }));
    RR.Audio.onChange(m => {
      ['btn-sound', 'btn-sound-pause'].forEach(id => { $(id).textContent = 'Ton: ' + (m ? 'aus' : 'an'); });
      $('btn-sound-top').classList.toggle('muted', m);
      $('btn-sound-top').setAttribute('aria-pressed', String(!m));
    });

    RR.Input.bind({
      pause() { if (app.screen === 'play') pause(); else if (app.screen === 'pause') resume(); },
      mute() { RR.Audio.unlock(); RR.Audio.toggle(); },
      isPlaying() { return app.screen === 'play'; }
    });

    // Der Browser erlaubt Ton erst nach einer Eingabe.
    ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => RR.Audio.unlock(), { passive: true }));

    const markTouch = () => {
      if (!document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        if (app.screen !== 'loading') show(app.screen);
        resize();
      }
    };
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    window.addEventListener('touchstart', markTouch, { passive: true });

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
    window.addEventListener('blur', pause);
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (app.screen === 'play') e.preventDefault(); });
  }

  // --- Zeichnen ------------------------------------------------------------
  function drawTitle(t) {
    const w = app.backdrop;
    w.time = t;
    w.cam.x = 0;
    w.cam.y = 36;
    w.draw(ctx, { hidePlayer: true });
    ctx.save();
    ctx.translate(0, -36);
    const x = app.viewW * 0.77;
    RR.Rig.draw(ctx, x, 480, { fig: 'man', t, wave: true, facing: 1 }, 2.75);
    ctx.restore();
  }

  function drawRigSheet(t) {
    ctx.fillStyle = '#bfe3f2';
    ctx.fillRect(0, 0, app.viewW, 540);
    const run = { fig: 'man', calm: 0, t, phase: t * 13.5, onGround: true, facing: 1, sn: 1, vy: 0, expr: 'scared' };
    const rows = [
      ['Laufen', run],
      ['Traben', Object.assign({}, run, { sn: 0.45, phase: t * 6 })],
      ['Sprung', Object.assign({}, run, { onGround: false, vy: -500, expr: 'jump' })],
      ['Fallen', Object.assign({}, run, { onGround: false, vy: 500, expr: 'fall' })],
      ['Ducken', Object.assign({}, run, { duck: true, sn: 0, expr: 'duck' })],
      ['Landung', Object.assign({}, run, { sn: 0, squash: 1, expr: 'happy' })],
      ['Stehen', { fig: 'man', t, facing: 1, wave: true }],
      ['Jubel', { fig: 'man', t, cheer: true, facing: 1 }],
      ['Treffer', { fig: 'inv', t, facing: 1, airK: 1, hit: t % 1 }],
      ['Verletzt', { fig: 'inv', t, facing: 1 }],
      ['Angeschlagen', Object.assign({}, run, { sn: 0.6, phase: t * 8, sick: true, expr: 'sick' })],
      ['Übergang', Object.assign({}, run, { sn: 0, calm: 0.5, expr: 'happy' })]
    ];
    ctx.fillStyle = '#000';
    ctx.font = '700 15px sans-serif';
    ctx.textAlign = 'center';
    rows.forEach((r, i) => {
      const col = i % 6, row = i < 6 ? 0 : 1;
      const x = app.viewW * (col + 0.5) / 6, y = 240 + row * 260;
      ctx.fillStyle = '#6a9e38';
      ctx.fillRect(x - 80, y, 160, 4);
      RR.Rig.draw(ctx, x, y, r[1], 1.5);
      ctx.fillStyle = '#000';
      ctx.fillText(r[0], x, y + 20);
    });
  }

  function render(t) {
    ctx.setTransform(app.px, 0, 0, app.px, 0, 0);
    if (app.screen === 'rig') {
      drawRigSheet(t);
    } else if (app.world) {
      app.world.draw(ctx, { debug: !!debug });
      RR.Hud.draw(ctx, app.world);
    } else if (app.backdrop) {
      drawTitle(t);
    } else {
      ctx.fillStyle = '#8fd3f0';
      ctx.fillRect(0, 0, app.viewW, 540);
    }
    if (debug) {
      ctx.fillStyle = '#000';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(Math.round(app.fps) + ' fps', 8, 534);
    }
  }

  // --- Schleife -------------------------------------------------------------
  let last = 0;
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    app.t += dt;
    if (dt > 0) app.fps += (1 / dt - app.fps) * 0.05;
    if (app.screen === 'play' && app.world) {
      acc += dt;
      while (acc >= STEP) {
        app.world.step(RR.Input.state, STEP);
        RR.Input.endTick();
        acc -= STEP;
      }
    } else {
      acc = 0;
      RR.Input.endTick();
    }
    render(app.t);
  }

  // --- Start ----------------------------------------------------------------
  bindUi();
  setupFullscreen();
  addManifest();
  resize();
  requestAnimationFrame(frame);
  RR.Assets.load().then(() => {
    if (debug === 'rig') {
      app.backdrop = null;
      SCREENS.forEach(s => $('screen-' + s).classList.add('hidden'));
      app.screen = 'rig';
      return;
    }
    const lv = parseInt(params.get('level'), 10);
    if (debug && lv >= 1 && lv <= RR.LEVELS.length) {
      startLevel(lv - 1, true);
    } else {
      toTitle();
    }
  }).catch(err => {
    $('screen-loading').querySelector('h2').textContent = 'Laden fehlgeschlagen: ' + err.message;
  });
})();
