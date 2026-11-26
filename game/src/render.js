// NUSA SKY RUN — render.js
// One job: everything the eye sees. Sky, sea, islands, runways, rings, clouds,
// the plane itself, and the cockpit frame. No game logic lives here.

import { SCREEN, PALETTE, VIEW } from './config.js';
import {
  project, horizonY, terrainHeight, islandRimPoints, runwayCorners,
} from './terrain.js';

const TAU = Math.PI * 2;
const SUN_DIR = { x: 0.42, y: 0.15, z: 0.85 }; // low sun ahead-right: golden hour in the cover shot

// game: { world, plane, mission, time, cockpit, banner }
// cam: projection camera from camera.js
export function renderScene(ctx, game, cam) {
  const { world, plane, mission, time } = game;
  ctx.save();
  drawSky(ctx, cam, time);
  drawSea(ctx, cam, time);
  // Depth-sorted world objects: far first, so near islands overlap far ones.
  const items = [];
  for (const island of world.islands) {
    const d = distTo(cam, island.x, island.z);
    items.push({ d, fn: () => drawIsland(ctx, cam, world, island, time) });
  }
  for (const ring of mission.rings) {
    const d = distTo(cam, ring.x, ring.z);
    items.push({ d, fn: () => drawRing(ctx, cam, ring, mission, time) });
  }
  if (mission.beacon) {
    const d = distTo(cam, mission.beacon.x, mission.beacon.z);
    items.push({ d, fn: () => drawBeacon(ctx, cam, mission.beacon, time) });
  }
  for (const cell of mission.stormCells) {
    const d = distTo(cam, cell.x, cell.z);
    items.push({ d, fn: () => drawStormCell(ctx, cam, cell, time) });
  }
  for (const cloud of world.clouds) {
    const d = distTo(cam, cloud.x, cloud.z);
    items.push({ d, fn: () => drawCloud(ctx, cam, cloud, time) });
  }
  items.sort((a, b) => b.d - a.d);
  for (const item of items) item.fn();
  drawTargetMarker(ctx, cam, game);
  drawPlane(ctx, plane, time, game.cockpit);
  drawSpeedLines(ctx, plane, time);
  if (game.cockpit) drawCockpitFrame(ctx);
  ctx.restore();
}

function distTo(cam, x, z) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  return dx * dx + dz * dz;
}

// ---- sky + sea ----------------------------------------------------------

function drawSky(ctx, cam, time) {
  const hy = horizonY(cam);
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 1));
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN.width, Math.max(hy, 1));
  // Sun: fixed in the world, low over the sea.
  const sun = project(cam, cam.x + SUN_DIR.x * 15000, cam.y + SUN_DIR.y * 15000, cam.z + SUN_DIR.z * 15000);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 190);
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 179, 71, 0.45)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 200, sun.y - 200, 400, 400);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, TAU);
    ctx.fill();
  }
  // A few high, soft clouds baked into the sky for depth.
  ctx.fillStyle = 'rgba(255, 246, 230, 0.72)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 263 + 120) % SCREEN.width);
    const cy = 46 + (i % 3) * 34 + Math.sin(time * 0.05 + i) * 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 + (i % 3) * 26, 10 + (i % 2) * 4, 0, 0, TAU);
    ctx.fill();
  }
}

function drawSea(ctx, cam, time) {
  const hy = horizonY(cam);
  if (hy >= SCREEN.height) return;
  const grad = ctx.createLinearGradient(0, hy, 0, SCREEN.height);
  grad.addColorStop(0, PALETTE.seaShallow);
  grad.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, hy, SCREEN.width, SCREEN.height - hy);
  // Sun glints: a glittering path on the water toward the sun.
  const sun = project(cam, cam.x + SUN_DIR.x * 15000, cam.y + SUN_DIR.y * 15000, cam.z + SUN_DIR.z * 15000);
  if (sun) {
    ctx.fillStyle = 'rgba(255, 217, 138, 0.35)';
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const y = hy + t * (SCREEN.height - hy) * 0.92;
      const wob = Math.sin(time * 1.3 + i * 2.7) * 26 * t;
      const w = 5 + t * 26;
      const x = sun.x + wob + Math.sin(i * 12.9898) * 30 * t;
      ctx.fillRect(x - w / 2, y, w, 2);
    }
  }
}

// ---- islands ------------------------------------------------------------

function drawIsland(ctx, cam, world, island, time) {
  const rim = islandRimPoints(island, 12).map((p) => project(cam, p.x, 0, p.z));
  if (rim.some((p) => p === null)) {
    // Partly behind the camera: draw only if the peak is visible.
    const peak = project(cam, island.x, island.peak, island.z);
    if (!peak) return;
  }
  const visible = rim.filter(Boolean);
  if (visible.length < 3) return;
  const peak = project(cam, island.x, island.peak, island.z);
  if (!peak) return;

  // Beach ring.
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath();
  visible.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();

  // Hill: fan of triangles from the peak down to the rim, alternating shade
  // so the island reads as a solid, sun-lit lump, not a flat disc.
  for (let i = 0; i < visible.length; i++) {
    const a = visible[i];
    const b = visible[(i + 1) % visible.length];
    ctx.fillStyle = i % 2 === 0 ? PALETTE.grassLight : PALETTE.grassDark;
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.y);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
  }
  // Rocky cap near the peak.
  ctx.fillStyle = PALETTE.rock;
  ctx.beginPath();
  ctx.moveTo(peak.x, peak.y);
  ctx.lineTo(peak.x - 9, peak.y + 16);
  ctx.lineTo(peak.x + 9, peak.y + 16);
  ctx.closePath();
  ctx.fill();

  // Runway, if this island has one: flat strip + centreline + threshold.
  const runway = world.runways.find((r) => r.island === island);
  if (runway) drawRunway(ctx, cam, runway);

  // Palms: only the near ones, as tiny two-stroke glyphs.
  for (const palm of island.palms) {
    const ground = terrainHeight(world, palm.x, palm.z);
    const p = project(cam, palm.x, ground, palm.z);
    if (!p || p.dist > 2600) continue;
    const s = Math.max(2.5, p.scale * 9 * palm.s);
    ctx.strokeStyle = '#2f6b34';
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - s);
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x - s * 0.7, p.y - s * 1.5);
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x + s * 0.7, p.y - s * 1.5);
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x, p.y - s * 1.9);
    ctx.stroke();
  }
}

function drawRunway(ctx, cam, runway) {
  const corners = runwayCorners(runway).map((c) => project(cam, c.x, runway.y + 1, c.z));
  if (corners.some((p) => p === null)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = PALETTE.runwayMark;
  for (let t = -0.4; t <= 0.4; t += 0.2) {
    const cx = runway.cx + Math.sin(runway.heading) * runway.length * t;
    const cz = runway.cz + Math.cos(runway.heading) * runway.length * t;
    const p = project(cam, cx, runway.y + 1.5, cz);
    if (!p) continue;
    const s = Math.max(2, p.scale * 6);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x));
    ctx.fillRect(-s * 1.6, -s * 0.28, s * 3.2, s * 0.56);
    ctx.restore();
  }
  // Threshold bars at both ends + a big runway number at the near end.
  // Only when it lands on screen: a far strip's number must not clip at the edge.
  const near = project(cam, runway.cx - Math.sin(runway.heading) * runway.length * 0.42,
    runway.y + 1.5, runway.cz - Math.cos(runway.heading) * runway.length * 0.42);
  if (near && near.x > 40 && near.x < SCREEN.width - 40 && near.y > 50 && near.y < SCREEN.height - 130) {
    ctx.fillStyle = PALETTE.runwayMark;
    ctx.font = `bold ${Math.max(13, Math.round(near.scale * 16))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(runway.id), near.x, near.y - Math.max(10, near.scale * 10));
  }
}

// ---- rings, beacon, storms, clouds --------------------------------------

function drawRing(ctx, cam, ring, mission, time) {
  const c = project(cam, ring.x, ring.y, ring.z);
  if (!c) return;
  const isNext = mission.rings[mission.nextRing] === ring;
  const isDone = ring.cleared;
  const color = isDone ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ringLater;
  const viewDot = Math.abs(Math.cos(cam.hdg - ring.heading));
  const squash = 0.3 + 0.7 * viewDot;
  const rx = c.scale * ring.radius;
  const ry = rx * squash;
  if (rx < 3) return;
  // Drop line to the sea so the ring's height reads at a glance.
  const base = project(cam, ring.x, 0, ring.z);
  if (base) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + ry);
    ctx.lineTo(base.x, base.y);
    ctx.stroke();
  }
  // Glow for the next ring only — the eye goes straight to it.
  if (isNext) {
    const pulse = 1 + Math.sin(time * 3.2) * 0.1;
    ctx.strokeStyle = 'rgba(255, 194, 51, 0.35)';
    ctx.lineWidth = rx * 0.22 * pulse;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx * pulse, ry * pulse, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, rx * 0.1);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, rx * 0.03);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx * 0.82, ry * 0.82, 0, 0, TAU);
  ctx.stroke();
  // Ring number above the gate — only when the ring is on screen, so a
  // distant ring never leaves a clipped glyph on the frame's edge.
  if (c.x > 30 && c.x < SCREEN.width - 30 && c.y - ry - 8 > 24) {
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(15, Math.round(rx * 0.42))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(ring.index + 1), c.x, c.y - ry - 8);
  }
}

function drawBeacon(ctx, cam, beacon, time) {
  const c = project(cam, beacon.x, beacon.y, beacon.z);
  if (!c) return;
  const pulse = 0.6 + Math.sin(time * 4) * 0.4;
  ctx.strokeStyle = `rgba(255, 120, 40, ${0.5 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  const h = c.scale * 90;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x, c.y - h);
  ctx.stroke();
  ctx.fillStyle = '#ff7a28';
  ctx.save();
  ctx.translate(c.x, c.y - h);
  ctx.rotate(Math.PI / 4);
  const s = 10 + pulse * 5;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawStormCell(ctx, cam, cell, time) {
  const c = project(cam, cell.x, cell.y, cell.z);
  if (!c) return;
  const r = c.scale * cell.r;
  if (r < 4) return;
  ctx.fillStyle = 'rgba(61, 58, 77, 0.88)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, r, r * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 36, 58, 0.9)';
  ctx.beginPath();
  ctx.ellipse(c.x - r * 0.35, c.y + r * 0.1, r * 0.55, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x + r * 0.4, c.y + r * 0.08, r * 0.5, r * 0.28, 0, 0, TAU);
  ctx.fill();
  // Occasional lightning inside the cell.
  const flash = ((time * 0.6 + cell.x * 0.001) % 3.1) < 0.14;
  if (flash) {
    ctx.strokeStyle = 'rgba(255, 240, 160, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + r * 0.1);
    ctx.lineTo(c.x - 8, c.y + r * 0.45);
    ctx.lineTo(c.x + 6, c.y + r * 0.5);
    ctx.lineTo(c.x - 2, c.y + r * 0.85);
    ctx.stroke();
  }
}

function drawCloud(ctx, cam, cloud, time) {
  const x = cloud.x + Math.sin(time * 0.02 + cloud.z) * 8 + time * cloud.drift * 0.2;
  const c = project(cam, x, cloud.y, cloud.z);
  if (!c) return;
  // A cloud below the horizon line is not a cloud: skip it.
  if (c.y > horizonY(cam) + 6) return;
  const rx = c.scale * cloud.rx;
  if (rx < 3) return;
  ctx.fillStyle = 'rgba(255, 250, 240, 0.75)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, rx * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 250, 240, 0.55)';
  ctx.beginPath();
  ctx.ellipse(c.x - rx * 0.4, c.y - rx * 0.07, rx * 0.5, rx * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x + rx * 0.42, c.y - rx * 0.05, rx * 0.45, rx * 0.13, 0, 0, TAU);
  ctx.fill();
}

// ---- guidance marker ------------------------------------------------------

function drawTargetMarker(ctx, cam, game) {
  const { mission, plane } = game;
  if (game.state !== 'flying') return;
  const target = missionTarget(game);
  if (!target) return;
  const p = project(cam, target.x, target.y, target.z);
  const distM = Math.hypot(target.x - plane.x, target.y - plane.alt, target.z - plane.z);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const onScreen = p && p.x > 60 && p.x < SCREEN.width - 60 && p.y > 90 && p.y < SCREEN.height - 170;
  // A ring on screen IS its own marker: drawing a diamond on top of it only
  // muddies the picture. Only guide the pilot to runways and beacons.
  if (onScreen && target.label.startsWith('RING')) return;
  if (onScreen) {
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 16);
    ctx.lineTo(p.x + 11, p.y);
    ctx.lineTo(p.x, p.y + 16);
    ctx.lineTo(p.x - 11, p.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${target.label} · ${Math.round(distM)}m`, p.x, p.y - 30);
  } else {
    // Off-screen: an edge arrow points the way (kept inside the frame).
    const ang = Math.atan2((p ? p.y : SCREEN.height / 2) - SCREEN.height / 2,
      (p ? p.x : SCREEN.width / 2) - SCREEN.width / 2);
    const ex = Math.max(90, Math.min(SCREEN.width - 90,
      SCREEN.width / 2 + Math.cos(ang) * (SCREEN.width / 2 - 40)));
    const ey = Math.max(120, Math.min(SCREEN.height - 150,
      SCREEN.height / 2 + Math.sin(ang) * (SCREEN.height / 2 - 130)));
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${target.label} ${Math.round(distM)}m`, ex, ey + 26);
  }
}

function missionTarget(game) {
  const { mission, world } = game;
  if (mission.id === 'rings') {
    const ring = mission.rings[mission.nextRing];
    return ring ? { x: ring.x, y: ring.y, z: ring.z, label: `RING ${mission.nextRing + 1}` } : null;
  }
  if (mission.id === 'hop') {
    const next = mission.runways.find((r) => !r.landed);
    if (!next) return null;
    return { x: next.runway.cx, y: next.runway.y + 40, z: next.runway.cz, label: `RUNWAY ${next.runway.id}` };
  }
  if (mission.id === 'rescue') {
    if (!mission.beaconReached) {
      return { x: mission.beacon.x, y: mission.beacon.y, z: mission.beacon.z, label: 'BEACON' };
    }
    const home = world.runways[0];
    return { x: home.cx, y: home.y + 40, z: home.cz, label: 'HOME RWY 1' };
  }
  return null;
}

// ---- the plane ------------------------------------------------------------

function drawPlane(ctx, plane, time, cockpit) {
  const cx = SCREEN.width / 2;
  const cy = SCREEN.height * (cockpit ? 0.58 : 0.56);
  const speedScale = 0.9 + Math.min(0.35, plane.speedKt / 500);
  const s = speedScale;
  ctx.save();
  ctx.translate(cx, cy - plane.pitch * 1.1);
  ctx.rotate((plane.bank * Math.PI) / 180 * 0.85);
  ctx.scale(s, s);

  // Damage smoke trailing off the tail when hurt.
  if (plane.damage > 45 && !plane.crashed) {
    for (let i = 0; i < 5; i++) {
      const t = (time * 0.9 + i * 0.21) % 1;
      const px = Math.sin(i * 7.3) * 14 * t;
      const py = 66 + t * 90;
      ctx.fillStyle = `rgba(60, 60, 66, ${0.5 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(px, py, 5 + t * 13, 0, TAU);
      ctx.fill();
    }
  }

  // Main wings (seen from behind-above: broad, slightly swept).
  ctx.fillStyle = PALETTE.planeCream;
  wing(ctx, -1);
  wing(ctx, 1);
  // Orange tip stripes.
  ctx.fillStyle = PALETTE.planeOrange;
  ctx.beginPath();
  ctx.moveTo(-118, -6);
  ctx.lineTo(-96, -6);
  ctx.lineTo(-96, 10);
  ctx.lineTo(-118, 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(118, -6);
  ctx.lineTo(96, -6);
  ctx.lineTo(96, 10);
  ctx.lineTo(118, 12);
  ctx.closePath();
  ctx.fill();

  // Tailplane + vertical fin (closest to camera: drawn big, low).
  ctx.fillStyle = PALETTE.planeTeal;
  ctx.beginPath();
  ctx.moveTo(-52, 44);
  ctx.lineTo(52, 44);
  ctx.lineTo(40, 58);
  ctx.lineTo(-40, 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeOrange;
  ctx.beginPath();
  ctx.moveTo(-7, 30);
  ctx.lineTo(7, 30);
  ctx.lineTo(10, 62);
  ctx.lineTo(-10, 62);
  ctx.closePath();
  ctx.fill();

  // Fuselage: rounded body from tail (bottom) to nose (top).
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#d9c39a');
  body.addColorStop(0.5, PALETTE.planeCream);
  body.addColorStop(1, '#c9ae7e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-15, 58);
  ctx.quadraticCurveTo(-19, 10, -11, -58);
  ctx.quadraticCurveTo(0, -72, 11, -58);
  ctx.quadraticCurveTo(19, 10, 15, 58);
  ctx.quadraticCurveTo(0, 66, -15, 58);
  ctx.closePath();
  ctx.fill();
  // Panel lines + rivets so it reads as built, not drawn.
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.5)';
  ctx.lineWidth = 1;
  for (const yy of [-40, -16, 8, 32]) {
    ctx.beginPath();
    ctx.moveTo(-13, yy);
    ctx.lineTo(13, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(90, 70, 40, 0.55)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(-10, -48 + i * 18, 1.1, 0, TAU);
    ctx.arc(10, -48 + i * 18, 1.1, 0, TAU);
    ctx.fill();
  }
  // Registration on the tail.
  ctx.fillStyle = '#20303a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-NUSA', 0, 52);
  // Cabin windows.
  ctx.fillStyle = '#274b5e';
  ctx.beginPath();
  ctx.ellipse(0, -34, 8, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-2, -38, 3, 5, 0, 0, TAU);
  ctx.fill();

  // Propeller blur at the nose (spins faster with throttle).
  const propSpeed = 0.25 + plane.thr * 0.9;
  const bladeAngle = time * 22 * propSpeed;
  ctx.strokeStyle = 'rgba(40, 40, 46, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -66, 19, 5, bladeAngle, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -66, 19, 5, bladeAngle + Math.PI / 2, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#2b2b30';
  ctx.beginPath();
  ctx.arc(0, -66, 4, 0, TAU);
  ctx.fill();

  // Nav lights: red left, green right, blinking.
  const blink = Math.sin(time * 5) > -0.2 ? 1 : 0.25;
  ctx.fillStyle = `rgba(255, 60, 50, ${blink})`;
  ctx.beginPath();
  ctx.arc(-118, 2, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(80, 255, 130, ${blink})`;
  ctx.beginPath();
  ctx.arc(118, 2, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, 62, 2.5, 0, TAU);
  ctx.fill();

  // Landing gear when down.
  if (plane.gearDown) {
    ctx.strokeStyle = '#33302c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 40);
    ctx.lineTo(-20, 66);
    ctx.moveTo(14, 40);
    ctx.lineTo(20, 66);
    ctx.stroke();
    ctx.fillStyle = '#1c1a18';
    ctx.beginPath();
    ctx.arc(-20, 68, 5, 0, TAU);
    ctx.arc(20, 68, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function wing(ctx, side) {
  const m = side;
  ctx.beginPath();
  ctx.moveTo(m * 10, -14);
  ctx.lineTo(m * 122, -8);
  ctx.lineTo(m * 118, 12);
  ctx.lineTo(m * 10, 8);
  ctx.closePath();
  ctx.fill();
}

// ---- speed + cockpit frame -------------------------------------------------

function drawSpeedLines(ctx, plane, time) {
  if (plane.speedKt < 105 || plane.onGround) return;
  const strength = Math.min(1, (plane.speedKt - 105) / 60);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * strength})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + time * 0.4;
    const r0 = 330;
    const r1 = 330 + 26 + ((i * 37) % 30);
    const x0 = SCREEN.width / 2 + Math.cos(a) * r0;
    const y0 = SCREEN.height / 2 + Math.sin(a) * r0 * 0.62;
    const x1 = SCREEN.width / 2 + Math.cos(a) * r1;
    const y1 = SCREEN.height / 2 + Math.sin(a) * r1 * 0.62;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawCockpitFrame(ctx) {
  ctx.fillStyle = 'rgba(12, 16, 24, 0.92)';
  // Side pillars.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(150, 0);
  ctx.lineTo(210, SCREEN.height);
  ctx.lineTo(0, SCREEN.height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(SCREEN.width, 0);
  ctx.lineTo(SCREEN.width - 150, 0);
  ctx.lineTo(SCREEN.width - 210, SCREEN.height);
  ctx.lineTo(SCREEN.width, SCREEN.height);
  ctx.closePath();
  ctx.fill();
  // Top bar.
  ctx.fillRect(0, 0, SCREEN.width, 26);
  // Glareshield lip above the panel.
  ctx.fillStyle = 'rgba(12, 16, 24, 0.85)';
  ctx.beginPath();
  ctx.moveTo(0, SCREEN.height - 118);
  ctx.lineTo(SCREEN.width, SCREEN.height - 118);
  ctx.lineTo(SCREEN.width, SCREEN.height - 104);
  ctx.lineTo(0, SCREEN.height - 104);
  ctx.closePath();
  ctx.fill();
}
