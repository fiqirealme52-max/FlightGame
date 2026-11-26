// NUSA SKY RUN — camera.js
// One job: the chase camera. Sits behind and above the plane, eases toward
// its target so it never snaps or fights the pilot, and banks with the turn.

import { VIEW } from './config.js';
import { makeCamera } from './terrain.js';

export function makeChaseCamera() {
  return {
    // Smoothed copies of the plane state the camera actually uses.
    x: 0,
    z: 0,
    alt: 0,
    hdg: 0,
    bank: 0,
    pitch: 0,
    cockpit: false,
    init: false,
  };
}

export function updateCamera(cam, plane, dt) {
  if (!cam.init) {
    cam.x = plane.x;
    cam.z = plane.z;
    cam.alt = plane.alt;
    cam.hdg = plane.hdg;
    cam.bank = plane.bank;
    cam.pitch = plane.pitch;
    cam.init = true;
  }
  // Ease factor: fast enough to feel attached, slow enough to feel smooth.
  const k = 1 - Math.exp(-dt * 5.5);
  cam.x += (plane.x - cam.x) * k;
  cam.z += (plane.z - cam.z) * k;
  cam.alt += (plane.alt - cam.alt) * k;
  cam.bank += (plane.bank - cam.bank) * (1 - Math.exp(-dt * 4));
  cam.pitch += (plane.pitch - cam.pitch) * (1 - Math.exp(-dt * 4));
  // Heading eases the short way round.
  let dh = plane.hdg - cam.hdg;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  cam.hdg += dh * (1 - Math.exp(-dt * 3.2));
  return makeCamera(
    { x: cam.x, z: cam.z, alt: cam.alt, hdg: cam.hdg },
    VIEW,
  );
}

// How far the world layer rolls on screen (radians, small on purpose).
export function worldRoll(cam) {
  return (cam.bank * Math.PI) / 180 * (VIEW.maxRollDegrees / 46) * 0.9;
}
