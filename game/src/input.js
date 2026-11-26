// NUSA SKY RUN — input.js
// One job: read the pilot. Keyboard + mouse, with edge-triggered actions
// (pause, restart, camera, mission select) kept separate from held controls.

export function makeInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: cleared each frame by consume()
  const mouse = { x: 0, y: 0, inside: false, down: false, steering: false };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }
  function onKeyUp(e) {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    mouse.inside = true;
  }
  function onMouseDown(e) {
    mouse.down = true;
    if (e.button === 0) mouse.steering = true;
  }
  function onMouseUp() {
    mouse.down = false;
    mouse.steering = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    mouse,
    // Held flight controls, -1..1. Keyboard wins; mouse steers when held down
    // or when the pointer sits far from centre (opt-in by moving the mouse).
    flight() {
      let roll = 0;
      let pitch = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) roll -= 1;
      if (keys.has('ArrowRight') || keys.has('d')) roll += 1;
      if (keys.has('ArrowUp') || keys.has('w')) pitch += 1;
      if (keys.has('ArrowDown') || keys.has('s')) pitch -= 1;
      // Mouse steering: pointer left/right of centre banks, above/below pitches.
      if (mouse.steering && mouse.inside) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        roll = clamp((mouse.x - cx) / (cx * 0.75), -1, 1);
        pitch = clamp((cy - mouse.y) / (cy * 0.75), -1, 1);
      }
      let throttle = 0;
      if (keys.has('Shift')) throttle += 1;
      if (keys.has('Control')) throttle -= 1;
      if (mouse.down && mouse.steering) throttle += 0.35;
      return {
        roll,
        pitch,
        throttle,
        brake: keys.has(' ') || keys.has('b'),
      };
    },
    // True once for the frame the key went down.
    wasPressed(...names) {
      return names.some((n) => pressed.has(n));
    },
    consume() {
      pressed.clear();
    },
  };
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
