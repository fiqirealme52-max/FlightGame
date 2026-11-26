# NUSA SKY RUN

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/fiqirealme52-max/FlightGame/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/fiqirealme52-max/FlightGame/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-plane island hopper for the make.fun **best flight game** bounty.
Chase-view flying over a golden-hour archipelago: thread sky rings, land on
island runways, or brave the storm to reach the beacon — and mind the fuel,
because the sea does not give refunds.

**Three sorties, one sunset:**

- **Ring Run** — thread 8 gold rings over the islands before the fuel runs dry.
- **Island Hop** — land on runways 1, 2 and 3 in order. Every good landing refuels you +42.
- **Storm Rescue** — reach the beacon island through five storm cells, then bring her home to runway 1.

**What you see:** a chase view over recognisable island terrain, the plane
in frame with a lit instrument panel (artificial horizon, altimeter, airspeed,
heading, fuel, vertical speed), a runway or a target ring ahead, and
altitude, speed and heading on the HUD.

## Controls

- **Arrows / WASD** — fly (pitch + bank)
- **Shift / Ctrl** — throttle up / down
- **Space** — brake
- **Mouse** — hold to steer toward the cursor
- **C** — cockpit frame view · **P** — pause · **R** — restart · **M** — mute
- **1 / 2 / 3** — pick a mission (or click its card)

## Play

Open `game/index.html` in a desktop browser. Static files only, no network,
no build step. Screenshots are real renders of the game (`?shot=play|ring|land|start`).

## Layout

- `game/index.html` — page shell
- `game/src/config.js` — every tunable number (physics, fuel, damage, palette)
- `game/src/random.js` — seeded RNG, so every run builds the same archipelago
- `game/src/terrain.js` — islands, runways, palms, clouds + projection
- `game/src/plane.js` — aircraft state + physics (throttle, stall, landing, crash)
- `game/src/missions.js` — the three missions, objectives, scoring
- `game/src/input.js` — keyboard + mouse
- `game/src/camera.js` — chase camera that never fights the pilot
- `game/src/render.js` — sky, sea, islands, rings, the plane itself
- `game/src/hud.js` — HUD numerals, compass tape, lit instrument panel
- `game/src/audio.js` — synthesized engine hum + chimes (WebAudio, no files)
- `game/src/shots.js` — deterministic screenshot poses
- `game/src/main.js` — game loop + state machine, wiring only
- `main.ts` — the make.fun hand-in program (writes `dossier.json`)
