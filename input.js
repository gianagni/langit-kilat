// Langit Kilat: keyboard and mouse input. Held keys are read every frame as a
// control state (pitch, bank, throttle, boost); one-shot presses (confirm,
// pause, restart, mute) are queued as codes and taken once by the loop, so a
// press between two frames is never lost and never counted twice.

export const KEY_CONFIRM = 'confirm';
export const KEY_PAUSE = 'pause';
export const KEY_RESTART = 'restart';
export const KEY_MUTE = 'mute';

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['KeyE']);
const THROTTLE_DOWN = new Set(['KeyQ']);
const BOOST = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  const queue = [];
  const mouse = { x: -1, y: -1, inside: false };
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (PITCH_UP.has(code) || PITCH_DOWN.has(code) || BANK_LEFT.has(code) || BANK_RIGHT.has(code)
      || THROTTLE_UP.has(code) || THROTTLE_DOWN.has(code) || BOOST.has(code)) {
      held.add(code);
      // Space is also the confirm key on menus: starting the game with it must work.
      if (BOOST.has(code) && !event.repeat) queue.push(KEY_CONFIRM);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(code) || BOOST.has(code)) queue.push(KEY_CONFIRM);
    else if (PAUSE.has(code)) queue.push(KEY_PAUSE);
    else if (RESTART.has(code)) queue.push(KEY_RESTART);
    else if (MUTE.has(code)) queue.push(KEY_MUTE);
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (event.clientX - rect.left) * scaleX;
    mouse.y = (event.clientY - rect.top) * scaleY;
    mouse.inside = true;
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    clicks.push({ x: mouse.x, y: mouse.y });
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.inside = false;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    mouse,
    /** The live control state for one fixed step. */
    controls() {
      return {
        pitch: (hasAny(PITCH_UP) ? 1 : 0) - (hasAny(PITCH_DOWN) ? 1 : 0),
        bank: (hasAny(BANK_RIGHT) ? 1 : 0) - (hasAny(BANK_LEFT) ? 1 : 0),
        throttleUp: hasAny(THROTTLE_UP),
        throttleDown: hasAny(THROTTLE_DOWN),
        boost: hasAny(BOOST),
      };
    },
    /** The one-shot key presses since the last call. */
    takeKeys() {
      const taken = queue.slice();
      queue.length = 0;
      return taken;
    },
    /** The mouse clicks since the last call, in canvas pixels. */
    takeClicks() {
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
  };
}

/** True when a point in canvas pixels falls inside a rectangle. */
export function hitRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
