// NUSA SKY RUN — plane.js
// One job: the aircraft. Holds its state and steps the physics: throttle,
// bank and turn, pitch and climb, stall, fuel burn, damage, landing and crash.

import { PLANE, FUEL, DAMAGE } from './config.js';
import { terrainHeight } from './terrain.js';

const DEG = Math.PI / 180;

export function makePlane(world) {
  const home = world.runways[0];
  const sx = home.cx - Math.sin(home.heading) * (home.length / 2 - 40);
  const sz = home.cz - Math.cos(home.heading) * (home.length / 2 - 40);
  return {
    x: sx,
    z: sz,
    // Parked ON the ground, not floating above the strip: altitude is the
    // terrain height here plus a tyre's worth.
    alt: terrainHeight(world, sx, sz) + 1.5,
    hdg: 0,
    pitch: 0, // degrees, + = nose up
    bank: 0, // degrees, + = right wing down
    speedKt: 0,
    thr: 0, // 0..1
    vsFpm: 0,
    fuel: FUEL.start,
    damage: 0,
    gearDown: true,
    flaps: false,
    stalled: false,
    onGround: true,
    crashed: false,
    landed: false,
    landedRunway: 0,
    time: 0,
  };
}

export function resetToRunway(plane, world, runwayIndex = 0) {
  const home = world.runways[runwayIndex];
  // Parked ON the strip (40 m past its southern threshold), on the flat top:
  // starting 60 m short of it put the plane on the rising slope, where the
  // ground climbs into the takeoff roll and scrapes the airframe.
  plane.x = home.cx - Math.sin(home.heading) * (home.length / 2 - 40);
  plane.z = home.cz - Math.cos(home.heading) * (home.length / 2 - 40);
  plane.alt = terrainHeight(world, plane.x, plane.z) + 1.5;
  plane.hdg = home.heading;
  plane.pitch = 0;
  plane.bank = 0;
  plane.speedKt = 0;
  plane.thr = 0;
  plane.vsFpm = 0;
  plane.fuel = FUEL.start;
  plane.damage = 0;
  plane.gearDown = true;
  plane.flaps = false;
  plane.stalled = false;
  plane.onGround = true;
  plane.crashed = false;
  plane.landed = false;
  plane.landedRunway = 0;
  plane.time = 0;
}

// input: { roll: -1..1, pitch: -1..1 (pull = +), throttle: -1..1 delta,
//          brake: bool, gear: 'toggle' edge handled by caller }
// Returns events: ['stall', 'touchdown', 'hard-landing', 'crash', 'fuel-empty', ...]
export function stepPlane(plane, world, input, dt) {
  const events = [];
  if (plane.crashed) return events;
  plane.time += dt;

  // --- throttle ---
  plane.thr = clamp(plane.thr + input.throttle * dt * 0.85, 0, 1);
  if (plane.fuel <= 0 && plane.thr > 0) {
    plane.thr = 0;
    events.push('fuel-empty');
  }

  // --- speed ---
  const targetAccel = plane.thr * PLANE.accelPerSec - PLANE.dragPerSec * (1 - plane.thr);
  plane.speedKt += targetAccel * dt;
  if (input.brake) plane.speedKt -= 34 * dt;
  if (plane.onGround) plane.speedKt -= 6 * dt; // rolling resistance
  plane.speedKt = clamp(plane.speedKt, 0, PLANE.maxSpeedKt);

  // --- bank + turn: heading changes only when banked and moving ---
  const bankTarget = input.roll * PLANE.maxBankDegrees;
  plane.bank += clamp(bankTarget - plane.bank, -PLANE.bankRateDegrees * dt, PLANE.bankRateDegrees * dt);
  const speedFactor = clamp(plane.speedKt / PLANE.cruiseSpeedKt, 0, 1.25);
  plane.hdg += (plane.bank / PLANE.maxBankDegrees) * PLANE.turnRateDegrees * DEG * speedFactor * dt;
  plane.hdg = normAngle(plane.hdg);

  // --- pitch + climb ---
  const stalled = plane.speedKt < PLANE.stallSpeedKt && !plane.onGround;
  plane.stalled = stalled;
  const pitchTarget = stalled ? -9 : input.pitch * PLANE.maxPitchDegrees;
  plane.pitch += clamp(pitchTarget - plane.pitch, -PLANE.pitchRateDegrees * dt, PLANE.pitchRateDegrees * dt);

  const speedMs = plane.speedKt * 0.514444;
  let vsMs = Math.sin(plane.pitch * DEG) * speedMs * PLANE.climbFactor;
  // A stall sinks any plane that is actually airborne (stalled already means
  // speed < stall speed AND not on the ground). A parked plane never stalls:
  // it sits on the ground, onGround true, so this never fires on the strip.
  // (An earlier guard also required 25 m of clearance, which let a stalled
  // plane hover forever just above the runway — a 0-kt hover is not flight.)
  if (stalled) {
    vsMs -= PLANE.sinkWhenStalledKt * 0.514444;
  }
  if (plane.onGround) vsMs = Math.max(0, vsMs);
  plane.vsFpm = vsMs * 196.85;
  plane.alt += vsMs * dt;

  // --- move forward ---
  const fwd = speedMs * dt;
  plane.x += Math.sin(plane.hdg) * fwd;
  plane.z += Math.cos(plane.hdg) * fwd;

  // --- gear: drops automatically when slow and low ---
  if (plane.speedKt < PLANE.gearSpeedKt && plane.alt < 120) plane.gearDown = true;
  if (plane.speedKt > PLANE.gearSpeedKt + 25) plane.gearDown = false;

  // --- fuel ---
  plane.fuel -= (FUEL.baseDrainPerSec + FUEL.throttleDrainPerSec * plane.thr * plane.thr) * dt;
  if (plane.fuel < 0) plane.fuel = 0;

  // --- ground contact ---
  const ground = terrainHeight(world, plane.x, plane.z);
  if (plane.alt <= ground + 1.5) {
    plane.alt = ground + 1.5;
    const runway = runwayUnder(world, plane.x, plane.z);
    const aligned = runway
      ? Math.abs(angleDiff(plane.hdg, runway.heading)) < PLANE.landingMaxHeadingErrorDegrees * DEG
      : false;
    const gentle = Math.abs(plane.vsFpm) < PLANE.landingMaxVsFpm;
    const level = Math.abs(plane.bank) < PLANE.landingMaxBankDegrees;
    if (!plane.onGround) {
      if (runway && aligned && gentle && level && plane.gearDown) {
        plane.onGround = true;
        plane.landed = true;
        plane.landedRunway = runway.index;
        plane.pitch = 0;
        events.push('touchdown');
        if (Math.abs(plane.vsFpm) < 300) events.push('perfect-touchdown');
      } else if (Math.abs(plane.vsFpm) > PLANE.crashVsFpm || !plane.gearDown) {
        plane.crashed = true;
        plane.damage = DAMAGE.max;
        events.push('crash');
      } else {
        // Hard but survivable: bounce back up a little, take damage.
        plane.damage += DAMAGE.hardLanding;
        plane.alt = ground + 6;
        plane.vsFpm = 0;
        plane.pitch = 4;
        events.push('hard-landing');
        if (plane.damage >= DAMAGE.max) {
          plane.crashed = true;
          events.push('crash');
        }
      }
    } else {
      plane.onGround = true;
      if (plane.speedKt < 2) plane.pitch = 0;
    }
  } else {
    plane.onGround = false;
    plane.landed = false;
    // Terrain scrape: flying below the treeline away from a runway. Over a
    // runway strip with the gear down there is no scrape: a low final
    // approach skims 3-5 m above the plateau, and punishing that would make
    // every landing a crash. Off the strip, clipping a hillside still hurts.
    if (plane.alt < ground + 4 && !runwayUnder(world, plane.x, plane.z)) {
      plane.damage += DAMAGE.scrapePerSec * dt;
      events.push('scrape');
      if (plane.damage >= DAMAGE.max) {
        plane.crashed = true;
        events.push('crash');
      }
    }
  }

  if (plane.stalled && !plane.onGround) events.push('stall');
  return events;
}

export function applyStormDamage(plane, dt) {
  plane.damage += DAMAGE.stormPerSec * dt;
  if (plane.damage >= DAMAGE.max) {
    plane.damage = DAMAGE.max;
    plane.crashed = true;
    return true;
  }
  return false;
}

// Is the plane over a runway strip right now (within its rectangle)?
export function runwayUnder(world, x, z) {
  for (const runway of world.runways) {
    const dx = x - runway.cx;
    const dz = z - runway.cz;
    const c = Math.cos(runway.heading);
    const s = Math.sin(runway.heading);
    const along = dx * s + dz * c;
    const across = dx * c - dz * s;
    if (Math.abs(along) < runway.length / 2 && Math.abs(across) < runway.width / 2) {
      return runway;
    }
  }
  return null;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a, b) {
  return normAngle(a - b);
}

export function headingDegrees(plane) {
  return ((plane.hdg * 180) / Math.PI + 360) % 360;
}

export function altitudeFeet(plane) {
  return Math.max(0, Math.round(plane.alt * 3.28084));
}
