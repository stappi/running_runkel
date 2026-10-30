// Soundeffekte und Musik werden per Web Audio erzeugt, es gibt keine Audiodateien.
window.RR = window.RR || {};

RR.Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('rr.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('rr.' + key, JSON.stringify(value)); } catch (e) { /* privater Modus */ }
  }
};

RR.Audio = (function () {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = !!RR.Store.get('muted', false);
  let musicOn = false;
  let nextNote = 0;
  let step = 0;
  let timer = null;
  const listeners = [];

  const STEP = 60 / 152 / 2; // Achtel einer flotten Polka
  // Halbtoene relativ zu C4, null = Pause
  const MELODY = [
    7, null, 12, 11, 12, null, 7, null, 9, null, 14, 12, 11, null, 7, null,
    5, null, 9, 7, 9, null, 12, null, 11, 9, 7, 5, 4, null, 7, null,
    7, null, 12, 11, 12, null, 16, null, 14, 12, 11, 9, 7, null, 14, null,
    12, 14, 16, 14, 12, 11, 9, 11, 12, null, 7, null, 12, null, null, null
  ];
  const BASS = [-12, -5, -12, -5, -10, -5, -7, -5, -7, -3, -7, -3, -12, -5, -8, -5];

  function freq(semi) { return 261.63 * Math.pow(2, semi / 12); }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    return true;
  }

  // Muss aus einer Nutzereingabe heraus aufgerufen werden.
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(f0, f1, dur, type, vol, when, target) {
    if (!ctx || muted) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(target || master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
  }

  const SFX = {
    jump() { tone(320, 680, 0.16, 'square', 0.13); },
    land() { noise(0.07, 0.12, 700); },
    seed() { tone(900, 1300, 0.08, 'triangle', 0.2); },
    gold() { [0, 4, 7, 12].forEach((s, i) => tone(freq(12 + s), null, 0.16, 'triangle', 0.22, ctx.currentTime + i * 0.07)); },
    hit() { tone(420, 90, 0.3, 'sawtooth', 0.2); noise(0.14, 0.3, 1600); },
    stomp() { tone(180, 60, 0.18, 'square', 0.22); tone(500, 900, 0.1, 'triangle', 0.15); },
    whoosh() { noise(0.22, 0.14, 2600); },
    crack() { noise(0.1, 0.3, 3200); tone(240, 90, 0.08, 'square', 0.12); },
    splash() { noise(0.35, 0.3, 1100); },
    moo() { tone(150, 105, 0.7, 'sawtooth', 0.13); },
    grunt() { tone(110, 70, 0.22, 'sawtooth', 0.2); noise(0.12, 0.1, 500); },
    checkpoint() { [0, 7].forEach((s, i) => tone(freq(7 + s), null, 0.18, 'square', 0.13, ctx.currentTime + i * 0.1)); },
    win() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(freq(s + 7), null, 0.2, 'square', 0.14, ctx.currentTime + i * 0.11)); },
    gameover() { [7, 6, 5, 3, 0].forEach((s, i) => tone(freq(s), null, 0.3, 'triangle', 0.25, ctx.currentTime + i * 0.2)); }
  };

  function play(name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    SFX[name]();
  }

  function schedule() {
    if (!ctx || !musicOn) return;
    while (nextNote < ctx.currentTime + 0.25) {
      if (!muted) {
        const m = MELODY[step % MELODY.length];
        if (m !== null) tone(freq(m), null, STEP * 1.5, 'square', 0.1, nextNote, musicGain);
        if (step % 2 === 0) {
          const b = BASS[(step / 2) % BASS.length];
          tone(freq(b - 12), null, STEP * 1.3, 'triangle', 0.5, nextNote, musicGain);
        }
      }
      nextNote += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    nextNote = ctx.currentTime + 0.05;
    step = 0;
    timer = setInterval(schedule, 80);
  }

  function stopMusic() {
    musicOn = false;
    clearInterval(timer);
  }

  function setMuted(m) {
    muted = m;
    RR.Store.set('muted', m);
    if (master) master.gain.value = m ? 0 : 0.5;
    listeners.forEach(fn => fn(m));
  }

  return {
    unlock, play, startMusic, stopMusic, setMuted,
    toggle() { setMuted(!muted); },
    isMuted() { return muted; },
    onChange(fn) { listeners.push(fn); fn(muted); }
  };
})();
