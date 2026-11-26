// NUSA SKY RUN — shots.js
// One job: deterministic screenshot poses. A ?shot= URL poses the game in a
// fixed, good-looking state so every screenshot is a real render of the code
// and reproducible: same seed, same pose, same picture.

import { resetToRunway } from './plane.js';
import { buildMission } from './missions.js';

// Poses the game for a screenshot. game: the live game object from main.js.
export function applyShot(game, shot, seed) {
  const { world, plane } = game;
  if (shot === 'start') {
    // Menu: plane parked on the home runway at golden hour.
    game.state = 'menu';
    resetToRunway(plane, world, 0);
    plane.thr = 0;
    game.mission = buildMission(world, 'rings');
    game.cam.init = false;
    game.menuCam = true;
    return;
  }
  if (shot === 'play') {
    // Cover: mid-flight on the ring run, gold ring dead ahead and big,
    // runway island below, instruments lit. Plane is lined up on ring 1.
    game.state = 'flying';
    game.mission = buildMission(world, 'rings');
    const ring = game.mission.rings[0];
    plane.x = ring.x - Math.sin(ring.heading) * 230;
    plane.z = ring.z - Math.cos(ring.heading) * 230;
    plane.alt = ring.y + 8;
    plane.hdg = ring.heading;
    plane.pitch = 2;
    plane.bank = -6;
    plane.speedKt = 122;
    plane.thr = 0.78;
    plane.vsFpm = 180;
    plane.fuel = 71;
    plane.damage = 4;
    plane.gearDown = false;
    plane.onGround = false;
    game.cam.init = false;
    return;
  }
  if (shot === 'ring') {
    // Banking through ring 2, next ring visible beyond it.
    game.state = 'flying';
    game.mission = buildMission(world, 'rings');
    game.mission.rings[0].cleared = true;
    game.mission.nextRing = 1;
    const ring = game.mission.rings[1];
    plane.x = ring.x - Math.sin(ring.heading) * 95;
    plane.z = ring.z - Math.cos(ring.heading) * 95;
    plane.alt = ring.y - 6;
    plane.hdg = ring.heading;
    plane.pitch = 1;
    plane.bank = 24;
    plane.speedKt = 138;
    plane.thr = 0.85;
    plane.fuel = 64;
    plane.damage = 0;
    plane.gearDown = false;
    plane.onGround = false;
    game.cam.init = false;
    return;
  }
  if (shot === 'land') {
    // Final approach to runway 2: gear down, low and slow, threshold ahead.
    // Runway 1 is already landed (1/3), so the objective reads RUNWAY 2.
    // The plane sits right of the centreline so the strip stays visible.
    game.state = 'flying';
    game.mission = buildMission(world, 'hop');
    game.mission.runways[0].landed = true;
    const runway = world.runways[1];
    plane.x = runway.cx - Math.sin(runway.heading) * 760 + Math.cos(runway.heading) * 130;
    plane.z = runway.cz - Math.cos(runway.heading) * 760 - Math.sin(runway.heading) * 130;
    plane.alt = runway.y + 68;
    plane.hdg = runway.heading - 0.05;
    plane.pitch = -3;
    plane.bank = 4;
    plane.speedKt = 72;
    plane.thr = 0.42;
    plane.vsFpm = -320;
    plane.fuel = 38;
    plane.damage = 12;
    plane.gearDown = true;
    plane.flaps = true;
    plane.onGround = false;
    game.cam.init = false;
    return;
  }
  // Unknown shot: fall back to the cover pose.
  applyShot(game, 'play', seed);
}
