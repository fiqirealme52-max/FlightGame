// NUSA SKY RUN — main.js
// One job: wiring. The game loop, the state machine (menu / flying / paused /
// landed / crashed / complete), and nothing else. All behaviour lives in the
// other files; this file only connects them.

import { SCREEN } from './config.js';
import { buildWorld } from './terrain.js';
import { makePlane, resetToRunway, stepPlane, applyStormDamage, altitudeFeet } from './plane.js';
import { buildMission, stepMission, scoreFor, missionObjective } from './missions.js';
import { makeInput } from './input.js';
import { makeChaseCamera, updateCamera, worldRoll } from './camera.js';
import { renderScene } from './render.js';
import { drawHud, drawMenu, drawEndScreen, drawPaused } from './hud.js';
import { makeAudio, ensureAudio, setEngine, playChime, playThud, toggleMute } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '20261126');
const shot = params.get('shot') || '';

const canvas = document.getElementById('game');
canvas.width = SCREEN.width;
canvas.height = SCREEN.height;
const ctx = canvas.getContext('2d');

const world = buildWorld(seed);
const plane = makePlane(world);
const cam = makeChaseCamera();
const input = makeInput(canvas);
const audio = makeAudio();

const game = {
  world,
  plane,
  mission: buildMission(world, 'rings'),
  cam,
  state: 'menu', // menu | flying | paused | landed | crashed | complete
  score: 0,
  time: 0,
  banner: null,
  endLine: '',
  hoverCard: -1,
  menuCam: false,
  shotMode: Boolean(shot),
};

function setBanner(text, sub, color) {
  game.banner = { text, sub: sub || '', color: color || '#fff', at: game.time };
}

function startMission(missionId) {
  game.mission = buildMission(world, missionId);
  resetToRunway(plane, world, 0);
  game.score = 0;
  game.state = 'flying';
  game.banner = null;
  game.endLine = '';
  cam.init = false;
  setBanner(game.mission.name, game.mission.tagline, '#ffe9b0');
}

function endSortie(kind, line) {
  game.state = kind;
  game.endLine = line;
  if (kind === 'crashed') playThud(audio);
}

// --- menu camera: low behind the parked plane, looking down the strip ---
function menuCamera() {
  // High, angled view of the home island: sea around it, runway strip on top,
  // plane parked on the strip. Never a flat green wall filling the frame.
  const home = world.runways[0];
  return {
    x: home.cx + 170,
    y: home.y + 235,
    z: home.cz - 820,
    hdg: 0,
    pitch: 0.14,
    f: (SCREEN.height / 2) / Math.tan((34 * Math.PI) / 180),
    cx: SCREEN.width / 2,
    cy: SCREEN.height / 2,
  };
}

function tick(dt) {
  game.time += dt;
  const keys = input;

  if (keys.wasPressed('m', 'M')) {
    const muted = toggleMute(audio);
    if (!muted) ensureAudio(audio);
  }

  if (game.state === 'menu') {
    if (keys.wasPressed('1')) startMission('rings');
    else if (keys.wasPressed('2')) startMission('hop');
    else if (keys.wasPressed('3')) startMission('rescue');
    else if (keys.wasPressed('Enter')) startMission('rings');
    return;
  }

  if (game.state === 'paused') {
    if (keys.wasPressed('p', 'P', 'Escape')) game.state = 'flying';
    return;
  }

  if (game.state === 'landed' || game.state === 'crashed' || game.state === 'complete') {
    if (keys.wasPressed('r', 'R')) startMission(game.mission.id);
    if (keys.wasPressed('m', 'M')) game.state = 'menu';
    return;
  }

  // Flying.
  if (keys.wasPressed('p', 'P', 'Escape')) {
    game.state = 'paused';
    return;
  }
  if (keys.wasPressed('r', 'R')) {
    startMission(game.mission.id);
    return;
  }
  if (keys.wasPressed('c', 'C')) {
    cam.cockpit = !cam.cockpit;
  }
  ensureAudio(audio);

  const flight = input.flight();
  const planeEvents = stepPlane(plane, world, flight, dt);

  // Storm damage for the rescue mission.
  if (game.mission.id === 'rescue' && !plane.crashed) {
    for (const cell of game.mission.stormCells) {
      const dx = plane.x - cell.x;
      const dy = plane.alt - cell.y;
      const dz = plane.z - cell.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < cell.r) {
        if (applyStormDamage(plane, dt)) planeEvents.push('crash');
        else if (Math.random() < dt * 2) setBanner('IN THE STORM — DAMAGE RISING', '', '#ff8a5c');
        break;
      }
    }
  }

  const missionEvents = stepMission(game.mission, world, plane, planeEvents, dt);
  game.score += scoreFor(missionEvents, game.mission, plane);

  if (missionEvents.includes('ring')) {
    playChime(audio);
    setBanner(`RING ${game.mission.nextRing}/${game.mission.rings.length} CLEARED`, '+100', '#7ee081');
  }
  if (missionEvents.includes('landing')) {
    playThud(audio);
    plane.fuel = Math.min(100, plane.fuel + 42);
    setBanner('TOUCHDOWN — RUNWAY SECURED', '+250 · fuel +42', '#7ee081');
  }
  if (missionEvents.includes('beacon')) {
    playChime(audio);
    setBanner('BEACON REACHED', 'Now land back on runway 1', '#ffb52e');
  }
  if (missionEvents.includes('complete')) {
    endSortie('complete', `${game.mission.name} — all objectives done. Score ${game.score}.`);
    setBanner('SORTIE COMPLETE', `Score ${game.score}`, '#7ee081');
  }
  if (planeEvents.includes('touchdown') && !missionEvents.includes('landing')) {
    playThud(audio);
    setBanner('LANDED', 'Not a mission runway — take off and try again (R restarts)', '#fff');
    endSortie('landed', 'Down safe, wrong strip. The sortie ends here.');
  }
  if (planeEvents.includes('hard-landing')) {
    setBanner('HARD LANDING', `Damage ${Math.round(plane.damage)}%`, '#ff8a5c');
  }
  if (planeEvents.includes('crash')) {
    endSortie('crashed', crashLine());
  }
  if (planeEvents.includes('fuel-empty') && plane.onGround) {
    endSortie('landed', 'Out of fuel on the ground. The sortie ends here.');
  }

  setEngine(audio, plane.thr, plane.speedKt, !plane.onGround);
}

function crashLine() {
  if (plane.damage >= 100) return 'The airframe gave up — damage 100%.';
  if (plane.alt <= 4) return 'Into the ground. The islands keep what they catch.';
  return 'Lost her. The sea does not give refunds.';
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  if (!game.shotMode) tick(dt);
  input.consume();

  // Camera + roll.
  const camProj = game.state === 'menu' ? menuCamera() : updateCamera(cam, plane, dt);
  ctx.save();
  if (game.state !== 'menu') {
    const roll = worldRoll(cam);
    ctx.translate(SCREEN.width / 2, SCREEN.height / 2);
    ctx.rotate(roll);
    ctx.translate(-SCREEN.width / 2, -SCREEN.height / 2);
  }
  renderScene(ctx, { ...game, cockpit: cam.cockpit }, camProj);
  ctx.restore();

  if (game.state === 'menu') {
    drawMenu(ctx, game);
  } else if (game.state === 'paused') {
    drawHud(ctx, game);
    drawPaused(ctx);
  } else if (game.state === 'landed' || game.state === 'crashed' || game.state === 'complete') {
    drawHud(ctx, game);
    drawEndScreen(ctx, game);
  } else {
    drawHud(ctx, game);
  }
}

// Menu clicks: cards are stored by drawMenu each frame.
canvas.addEventListener('click', (e) => {
  ensureAudio(audio);
  if (game.state !== 'menu' || !game.menuCards) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  for (const card of game.menuCards) {
    if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
      startMission(['rings', 'hop', 'rescue'][card.index]);
      return;
    }
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (game.state !== 'menu' || !game.menuCards) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  game.hoverCard = -1;
  for (const card of game.menuCards) {
    if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
      game.hoverCard = card.index;
    }
  }
});

// Screenshot poses: freeze the sim so the picture is identical every time.
if (shot) {
  applyShot(game, shot, seed);
  game.time = shot === 'play' ? 96 : shot === 'ring' ? 131 : shot === 'land' ? 214 : 0;
  plane.time = game.time;
  if (shot === 'play') {
    // No banner: the objective pill already says it, and the cover must be clean.
  }
  if (shot === 'ring') setBanner('RING 1 CLEARED +100', '', '#7ee081');
  if (shot === 'land') setBanner('FINAL — RUNWAY 2 AHEAD', 'Gear down · 72 kt', '#ffe9b0');
  // Scores match the story each pose tells (ring 1 cleared; runway 1 landed).
  if (shot === 'ring') game.score = 100;
  if (shot === 'land') game.score = 250;
}
requestAnimationFrame(frame);
