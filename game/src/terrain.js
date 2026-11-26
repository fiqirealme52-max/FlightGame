// NUSA SKY RUN — terrain.js
// One job: the world. Builds the archipelago (islands, runways, palms, clouds),
// answers "how high is the ground here?", and projects world points to the screen.

import { makeRng } from './random.js';
import { SCREEN, VIEW, PALETTE } from './config.js';

const TAU = Math.PI * 2;

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const islands = [];
  // Home island: big, flat-topped, runway 0 on it, dead ahead of the start.
  islands.push(makeIsland(rng, 0, 900, 620, 150, true));
  // Hop islands: two more flat-topped runway islands, spread out.
  islands.push(makeIsland(rng, -1450, 2600, 430, 110, true));
  islands.push(makeIsland(rng, 1500, 4300, 460, 120, true));
  // Beacon island for the rescue mission, far north-east.
  islands.push(makeIsland(rng, 2600, 6200, 380, 95, false));
  // Scenery islands: smaller, rounder, no runways.
  const spots = [
    [-900, 1700, 260, 80], [1100, 1800, 300, 95], [-1900, 3400, 330, 90],
    [600, 3300, 240, 70], [2300, 2900, 280, 85], [-600, 4700, 310, 100],
    [900, 5400, 260, 75], [-2100, 5200, 300, 88], [3200, 4800, 270, 80],
    [-1200, 6500, 340, 105], [1400, 6800, 290, 82], [300, 7400, 320, 92],
  ];
  for (const [x, z, r, peak] of spots) islands.push(makeIsland(rng, x, z, r, peak, false));

  const runways = islands
    .filter((island) => island.hasRunway)
    .map((island, i) => makeRunway(island, i));

  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: rng.range(-3200, 3600),
      z: rng.range(300, 7600),
      y: rng.range(300, 460),
      rx: rng.range(90, 220),
      ry: rng.range(18, 34),
      drift: rng.range(1.5, 4),
    });
  }
  return { seed, islands, runways, clouds, rng };
}

function makeIsland(rng, x, z, radius, peak, hasRunway) {
  const palms = [];
  const palmCount = Math.floor(radius / 26);
  for (let i = 0; i < palmCount; i++) {
    const a = rng.angle();
    const d = rng.range(radius * 0.35, radius * 0.88);
    palms.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, s: rng.range(0.7, 1.25) });
  }
  return { x, z, radius, peak, hasRunway, palms, hue: rng.range(-8, 8) };
}

function makeRunway(island, index) {
  // Runway strip across the flat top, pointing north (heading 0) with a little
  // variety per island so each approach feels different. The strip sits
  // toward the northern edge of its island (offset 0.22 of the radius along
  // its heading) so takeoffs roll out over the sea, not over the whole hill,
  // and approaches come in over water instead of over rising ground.
  const heading = [0, 0.22, -0.18][index] ?? 0;
  const length = island.radius * 1.15;
  const width = 46;
  const top = island.peak * 0.92;
  const off = island.radius * 0.22;
  const cx = island.x + Math.sin(heading) * off;
  const cz = island.z + Math.cos(heading) * off;
  return { island, index, heading, length, width, y: top, cx, cz, id: index + 1 };
}

export function terrainHeight(world, x, z) {
  let h = 0;
  for (const island of world.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= island.radius) continue;
    const t = 1 - (d / island.radius) * (d / island.radius);
    let bump = island.peak * t * t * (3 - 2 * t);
    // Flat top on runway islands so the strip sits on level ground. The flat
    // radius (0.62) covers the whole strip (half-length 0.575 of the radius).
    if (island.hasRunway && d < island.radius * 0.62) {
      bump = island.peak * 0.92;
    }
    if (bump > h) h = bump;
  }
  return h;
}

export function runwayCenter(runway) {
  return { x: runway.cx, z: runway.cz, y: runway.y };
}

// ---- projection ---------------------------------------------------------

export function makeCamera(plane, view) {
  const fwdX = Math.sin(plane.hdg);
  const fwdZ = Math.cos(plane.hdg);
  const cam = {
    x: plane.x - fwdX * view.cameraDistance,
    y: plane.alt + view.cameraHeight,
    z: plane.z - fwdZ * view.cameraDistance,
    hdg: plane.hdg,
    pitch: view.cameraPitchDown,
    f: (SCREEN.height / 2) / Math.tan(((VIEW.fovDegrees / 2) * Math.PI) / 180),
    cx: SCREEN.width / 2,
    cy: SCREEN.height / 2,
  };
  return cam;
}

// Projects a world point to screen space. Returns null when behind the camera.
export function project(cam, px, py, pz) {
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const sinH = Math.sin(cam.hdg);
  const cosH = Math.cos(cam.hdg);
  // Camera space: forward = +z, right = +x, up = +y.
  let fwd = dx * sinH + dz * cosH;
  const right = dx * cosH - dz * sinH;
  let up = dy;
  // Apply the camera's downward pitch.
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const fwd2 = fwd * cp - up * sp;
  const up2 = fwd * sp + up * cp;
  fwd = fwd2;
  up = up2;
  if (fwd < 4) return null;
  return {
    x: cam.cx + (right / fwd) * cam.f,
    y: cam.cy - (up / fwd) * cam.f,
    scale: cam.f / fwd,
    dist: fwd,
  };
}

export function horizonY(cam) {
  // Screen height of the sea horizon: a point far ahead at camera height.
  const far = project(cam, cam.x + Math.sin(cam.hdg) * 20000, cam.y, cam.z + Math.cos(cam.hdg) * 20000);
  return far ? far.y : SCREEN.height * 0.42;
}

// ---- drawing helpers shared by render.js --------------------------------

export function islandRimPoints(island, steps = 10) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    pts.push({ x: island.x + Math.cos(a) * island.radius, z: island.z + Math.sin(a) * island.radius });
  }
  return pts;
}

export function runwayCorners(runway) {
  const c = Math.cos(runway.heading);
  const s = Math.sin(runway.heading);
  const halfL = runway.length / 2;
  const halfW = runway.width / 2;
  // Local axes: along = (sin, cos) in world xz, across = (cos, -sin).
  const ax = s;
  const az = c;
  const bx = c;
  const bz = -s;
  const cx0 = runway.cx;
  const cz0 = runway.cz;
  return [
    { x: cx0 - ax * halfL - bx * halfW, z: cz0 - az * halfL - bz * halfW },
    { x: cx0 + ax * halfL - bx * halfW, z: cz0 + az * halfL - bz * halfW },
    { x: cx0 + ax * halfL + bx * halfW, z: cz0 + az * halfL + bz * halfW },
    { x: cx0 - ax * halfL + bx * halfW, z: cz0 - az * halfL + bz * halfW },
  ];
}

export { PALETTE };
