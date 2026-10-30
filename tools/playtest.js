// Prueft die Levels ohne Browser: Rasterbreiten und ein Bot, der jedes Level mehrfach durchspielt.
// Aufruf: node tools/playtest.js [Laeufe pro Level]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
global.window = global;
global.RR = {};
RR.Audio = { play() {} };
const warnings = [];
const origWarn = console.warn;
console.warn = m => warnings.push(m);
['physics', 'levels', 'level', 'entities', 'player', 'game'].forEach(f => {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
});

const T = RR.TILE;
const DT = 1 / 60;

// Einfacher Spieler: rennt nach rechts, springt ueber Luecken und Hindernisse, duckt sich vor hohen Knueppeln.
function bot(w, input) {
  const p = w.player;
  const lvl = w.level;
  input.right = true; input.left = false; input.down = false;
  let want = false;
  const col = Math.floor(p.x / T);
  const feet = Math.floor((p.y + 2) / T);

  if (p.onGround) {
    // Luecke: erst an der Kante abspringen, das bringt die groesste Weite
    const edgeCol = Math.floor((p.x + p.w / 2 + 12) / T);
    let safeBelow = false;
    for (let r = feet; r < RR.ROWS; r++) {
      if (lvl.water(edgeCol, r)) break;
      if (lvl.ground(edgeCol, r)) { safeBelow = true; break; }
    }
    if (!safeBelow) want = true;
    // Wand voraus
    for (let i = 1; i <= 2; i++) {
      if (lvl.solid(col + i, feet - 1) || lvl.solid(col + i, feet - 2)) want = true;
    }
    // Plattform- oder Heuabschnitt: Abstieg vorausschauen ist nicht noetig, Stege tragen.
    for (const e of w.entities) {
      if (!e.boxes) continue;
      for (const b of e.boxes()) {
        const dist = b.x - (p.x + p.w / 2);
        const closing = 300 - (e.vx || 0);
        const lead = closing * 0.28;
        if (dist > -10 && dist < lead && b.y + b.h > p.y - p.h && b.y < p.y) want = true;
      }
    }
  }
  // Knueppel hinter dem Spieler
  for (const c of w.clubs) {
    const d = (p.x - p.w / 2) - c.x;
    const contact = d / Math.max(60, c.vx - Math.max(0, p.vx));
    const rel = p.y - c.y;
    if (d > -40 && rel > 52 && contact < 0.3 && p.onGround) { input.down = true; want = false; }
    else if (d > -10 && rel <= 52 && contact < 0.14 && p.onGround) want = true;
  }
  input.jumpPressed = want && p.onGround && !input.jumpHeld;
  input.jumpHeld = want || (!p.onGround && p.vy < 0);
}

function run(index) {
  const w = new RR.World(index, 960);
  const input = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false };
  let result = null;
  w.events.win = () => { result = 'win'; };
  w.events.gameover = () => { result = 'dead'; };
  let t = 0;
  while (!result && t < 240) {
    bot(w, input);
    w.step(input, DT);
    t += DT;
  }
  return { result: result || 'timeout', t, hearts: w.player.hearts, x: Math.round(w.player.x / T), cols: w.level.cols, seeds: w.seeds, gold: w.gold, goldTotal: w.goldTotal };
}

const runs = parseInt(process.argv[2], 10) || 40;
let failed = false;
RR.LEVELS.forEach((def, i) => {
  const lv = new RR.Level(def);
  const stats = { win: 0, dead: 0, timeout: 0 };
  let timeSum = 0, far = 0, hearts = 0;
  for (let k = 0; k < runs; k++) {
    const r = run(i);
    stats[r.result]++;
    if (r.result === 'win') { timeSum += r.t; hearts += r.hearts; }
    far = Math.max(far, r.x);
  }
  const counts = {};
  lv.spawns.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
  console.log(`${def.name}: ${lv.cols} Spalten | Siege ${stats.win}/${runs}, Game Over ${stats.dead}, Zeitlimit ${stats.timeout} | Ø ${stats.win ? (timeSum / stats.win).toFixed(0) : '-'} s, Ø Herzen ${stats.win ? (hearts / stats.win).toFixed(1) : '-'} | weiteste Spalte ${far} | Objekte ${JSON.stringify(counts)}`);
  if (!stats.win) failed = true;
});
warnings.forEach(w => { origWarn(w); failed = true; });
process.exit(failed ? 1 : 0);
