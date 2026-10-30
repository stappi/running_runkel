// Tastatur und Touch-Tasten. Das Spiel liest nur den Zustand aus RR.Input.
window.RR = window.RR || {};

RR.Input = (function () {
  const state = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false };
  const keys = {};
  const touch = { left: false, right: false, down: false, jump: false };
  const actions = {}; // pause, mute

  const MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump'
  };

  function refresh() {
    const wasJump = state.jumpHeld;
    state.left = !!keys.left || touch.left;
    state.right = !!keys.right || touch.right;
    state.down = !!keys.down || touch.down;
    state.jumpHeld = !!keys.jump || touch.jump;
    if (state.jumpHeld && !wasJump) state.jumpPressed = true;
  }

  function bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat && actions.pause) actions.pause(); return; }
      if (e.code === 'KeyM') { if (!e.repeat && actions.mute) actions.mute(); return; }
      const a = MAP[e.code];
      if (!a) return;
      // Leertaste und Pfeile duerfen die Menue-Buttons nicht ausloesen, solange gespielt wird.
      if (actions.isPlaying && actions.isPlaying()) e.preventDefault();
      if (e.repeat) return;
      keys[a] = true;
      refresh();
    });
    window.addEventListener('keyup', e => {
      const a = MAP[e.code];
      if (!a) return;
      keys[a] = false;
      refresh();
    });
    window.addEventListener('blur', releaseAll);
  }

  function releaseAll() {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    Object.keys(touch).forEach(k => { touch[k] = false; });
    pointers.clear();
    syncButtons();
    refresh();
  }

  const pointers = new Map(); // pointerId -> Aktion

  function syncButtons() {
    document.querySelectorAll('#touch button').forEach(b => {
      b.classList.toggle('on', touch[b.dataset.act]);
    });
  }

  function actionAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.dataset ? el.dataset.act : undefined;
  }

  function applyPointers() {
    Object.keys(touch).forEach(k => { touch[k] = false; });
    pointers.forEach(a => { if (a) touch[a] = true; });
    syncButtons();
    refresh();
  }

  function bindTouch() {
    const root = document.getElementById('touch');
    root.addEventListener('pointerdown', e => {
      const a = e.target.dataset ? e.target.dataset.act : undefined;
      if (!a) return;
      e.preventDefault();
      pointers.set(e.pointerId, a);
      applyPointers();
    });
    // Mit dem Daumen von Links nach Rechts rutschen, ohne abzusetzen
    window.addEventListener('pointermove', e => {
      const cur = pointers.get(e.pointerId);
      if (cur !== 'left' && cur !== 'right') return;
      const a = actionAt(e.clientX, e.clientY);
      if ((a === 'left' || a === 'right') && a !== cur) {
        pointers.set(e.pointerId, a);
        applyPointers();
      }
    });
    const up = e => {
      if (pointers.delete(e.pointerId)) applyPointers();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    root.addEventListener('contextmenu', e => e.preventDefault());
  }

  return {
    state,
    bind(cb) {
      Object.assign(actions, cb);
      bindKeyboard();
      bindTouch();
    },
    endTick() { state.jumpPressed = false; },
    releaseAll
  };
})();
