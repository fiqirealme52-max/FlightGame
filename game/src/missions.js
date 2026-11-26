// NUSA SKY RUN — missions.js
// One job: what "winning" means. Builds each mission's rings, targets and
// storm cells from the world, tracks objectives, and scores the sortie.

import { MISSIONS, SCORE } from './config.js';
import { terrainHeight, runwayCenter } from './terrain.js';
import { normAngle } from './plane.js';

export function buildMission(world, missionId) {
  if (missionId === 'hop') return buildHop(world);
  if (missionId === 'rescue') return buildRescue(world);
  return buildRings(world);
}

function buildRings(world) {
  const cfg = MISSIONS.rings;
  const islands = world.islands;
  // A tour over the archipelago: rings hover above gaps between islands so the
  // pilot threads terrain, sea and sky in one flowing line.
  const anchors = [
    { x: 0, z: 1500 }, { x: -800, z: 2100 }, { x: 500, z: 2900 },
    { x: -1300, z: 3600 }, { x: 900, z: 4200 }, { x: -500, z: 5000 },
    { x: 1400, z: 5600 }, { x: 200, z: 6400 },
  ];
  const rings = anchors.slice(0, cfg.ringCount).map((a, i) => {
    const ground = terrainHeight(world, a.x, a.z);
    return {
      x: a.x,
      z: a.z,
      y: Math.max(ground + 90, 150),
      radius: cfg.ringRadius,
      index: i,
      heading: i === 0 ? 0 : Math.atan2(a.x - anchors[i - 1].x, a.z - anchors[i - 1].z),
      cleared: false,
    };
  });
  return {
    id: 'rings',
    name: cfg.name,
    tagline: cfg.tagline,
    rings,
    nextRing: 0,
    runways: [],
    stormCells: [],
    beacon: null,
    parSeconds: cfg.parSeconds,
    done: false,
  };
}

function buildHop(world) {
  return {
    id: 'hop',
    name: MISSIONS.hop.name,
    tagline: MISSIONS.hop.tagline,
    rings: [],
    nextRing: 0,
    runways: world.runways.map((r) => ({ runway: r, landed: false })),
    stormCells: [],
    beacon: null,
    done: false,
  };
}

function buildRescue(world) {
  const beaconIsland = world.islands[3];
  const cfg = MISSIONS.rescue;
  const cells = [];
  const spots = [
    { x: 700, z: 2600 }, { x: -500, z: 3400 }, { x: 1600, z: 4200 },
    { x: 600, z: 5000 }, { x: 2000, z: 5400 },
  ];
  for (let i = 0; i < cfg.stormCount; i++) {
    cells.push({ x: spots[i].x, z: spots[i].z, y: 190, r: 150 });
  }
  return {
    id: 'rescue',
    name: cfg.name,
    tagline: cfg.tagline,
    rings: [],
    nextRing: 0,
    runways: [],
    stormCells: cells,
    beacon: { x: beaconIsland.x, z: beaconIsland.z, y: beaconIsland.peak + 60, island: beaconIsland },
    done: false,
    beaconReached: false,
  };
}

// mission: mission object, plane: plane state, events: plane events this tick.
// Returns mission events: ['ring', 'landing', 'beacon', 'complete', ...]
export function stepMission(mission, world, plane, planeEvents, dt) {
  const events = [];
  if (mission.done) return events;

  if (mission.id === 'rings') {
    const ring = mission.rings[mission.nextRing];
    if (ring) {
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.y;
      const dz = plane.z - ring.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < ring.radius + 14) {
        ring.cleared = true;
        mission.nextRing++;
        events.push('ring');
        if (mission.nextRing >= mission.rings.length) {
          mission.done = true;
          events.push('complete');
        }
      }
    }
  }

  if (mission.id === 'hop') {
    if (planeEvents.includes('touchdown')) {
      const target = mission.runways.find((r) => !r.landed);
      if (target && plane.landedRunway === target.runway.index) {
        target.landed = true;
        events.push('landing');
        if (planeEvents.includes('perfect-touchdown')) events.push('perfect-landing');
        if (mission.runways.every((r) => r.landed)) {
          mission.done = true;
          events.push('complete');
        }
      }
    }
  }

  if (mission.id === 'rescue') {
    if (!mission.beaconReached) {
      const dx = plane.x - mission.beacon.x;
      const dy = plane.alt - mission.beacon.y;
      const dz = plane.z - mission.beacon.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 90) {
        mission.beaconReached = true;
        events.push('beacon');
      }
    } else if (planeEvents.includes('touchdown') && plane.landedRunway === 0) {
      mission.done = true;
      events.push('complete');
    }
  }
  return events;
}

export function missionObjective(mission) {
  if (mission.id === 'rings') {
    return mission.done
      ? 'ALL RINGS CLEARED'
      : `RING ${mission.nextRing + 1}/${mission.rings.length} — thread the gold ring`;
  }
  if (mission.id === 'hop') {
    const done = mission.runways.filter((r) => r.landed).length;
    const next = mission.runways.find((r) => !r.landed);
    return mission.done
      ? 'ALL THREE ISLANDS LANDED'
      : `LAND RUNWAY ${next ? next.runway.id : ''} — ${done}/3 down, refuel each landing`;
  }
  if (mission.id === 'rescue') {
    if (mission.done) return 'RESCUE COMPLETE — HOME SAFE';
    if (!mission.beaconReached) return 'REACH THE BEACON — dodge the storm cells';
    return 'BEACON REACHED — land back on runway 1';
  }
  return '';
}

export function missionProgress(mission) {
  if (mission.id === 'rings') return mission.nextRing / mission.rings.length;
  if (mission.id === 'hop') {
    return mission.runways.filter((r) => r.landed).length / mission.runways.length;
  }
  if (mission.id === 'rescue') {
    if (mission.done) return 1;
    return mission.beaconReached ? 0.6 : 0.2;
  }
  return 0;
}

export function scoreFor(events, mission, plane) {
  let score = 0;
  for (const e of events) {
    if (e === 'ring') score += SCORE.ring;
    if (e === 'landing') score += SCORE.landing;
    if (e === 'perfect-landing') score += SCORE.landingPerfectBonus;
    if (e === 'beacon') score += SCORE.rescue;
    if (e === 'complete') {
      score += SCORE.missionComplete;
      if (mission.id === 'rings') {
        const under = Math.max(0, mission.parSeconds - plane.time);
        score += Math.round(under * SCORE.ringTimeBonusPerSec);
      }
    }
  }
  return score;
}

// Where should the pilot aim? Used for the HUD guidance arrow + the ring beacon.
export function currentTarget(mission, world) {
  if (mission.id === 'rings') {
    const ring = mission.rings[mission.nextRing];
    return ring ? { x: ring.x, y: ring.y, z: ring.z, label: `RING ${mission.nextRing + 1}` } : null;
  }
  if (mission.id === 'hop') {
    const next = mission.runways.find((r) => !r.landed);
    if (!next) return null;
    const c = runwayCenter(next.runway);
    return { x: c.x, y: c.y + 40, z: c.z, label: `RUNWAY ${next.runway.id}` };
  }
  if (mission.id === 'rescue') {
    if (!mission.beaconReached) {
      return { x: mission.beacon.x, y: mission.beacon.y, z: mission.beacon.z, label: 'BEACON' };
    }
    const c = runwayCenter(world.runways[0]);
    return { x: c.x, y: c.y + 40, z: c.z, label: 'HOME RUNWAY 1' };
  }
  return null;
}

export function bearingTo(plane, target) {
  if (!target) return 0;
  const want = Math.atan2(target.x - plane.x, target.z - plane.z);
  return normAngle(want - plane.hdg);
}
