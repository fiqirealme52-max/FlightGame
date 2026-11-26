// NUSA SKY RUN — config.js
// One job: every tunable number in one place (physics, fuel/damage, missions,
// palette, screen). No other file hard-codes a balance number.

export const SCREEN = { width: 1280, height: 720 };

export const VIEW = {
  fovDegrees: 68,
  cameraDistance: 26, // metres behind the plane
  cameraHeight: 7, // metres above the plane
  cameraLookAhead: 46, // metres ahead of the plane the camera aims at
  cameraPitchDown: 0.055, // radians the camera looks down
  maxRollDegrees: 7, // how far the world layer rolls with a bank
};

export const PLANE = {
  maxSpeedKt: 165,
  cruiseSpeedKt: 118,
  stallSpeedKt: 55,
  accelPerSec: 26, // kt gained per second at full throttle
  dragPerSec: 9, // kt lost per second with throttle closed
  maxBankDegrees: 46,
  bankRateDegrees: 95, // how fast the bank answers the stick
  turnRateDegrees: 26, // heading change per second at full bank
  maxPitchDegrees: 17,
  pitchRateDegrees: 42,
  climbFactor: 0.8, // vertical speed from pitch, as a share of speed
  sinkWhenStalledKt: 34, // extra sink (kt of vertical speed) in a stall
  gearSpeedKt: 78, // gear auto-drops below this speed when low
  landingMaxVsFpm: 620, // vertical speed (ft/min) a touchdown may have
  landingMaxBankDegrees: 12,
  landingMaxHeadingErrorDegrees: 18,
  crashVsFpm: 1400, // vertical speed that breaks the plane on the ground
};

export const FUEL = {
  start: 100,
  baseDrainPerSec: 0.1, // always burning a little
  throttleDrainPerSec: 0.52, // at full throttle (times throttle^2)
  refuelOnLanding: 42, // island-hop landing bonus
  emptyWarningAt: 22,
};

export const DAMAGE = {
  stormPerSec: 16, // inside a storm cell
  scrapePerSec: 22, // brushing terrain while airborne
  hardLanding: 38, // one hard touchdown
  max: 100,
};

export const SCORE = {
  ring: 100,
  ringTimeBonusPerSec: 4, // bonus per second under par, ring run
  landing: 250,
  landingPerfectBonus: 150, // touchdown under 300 fpm
  rescue: 400,
  missionComplete: 500,
};

export const MISSIONS = {
  rings: {
    id: 'rings',
    key: '1',
    name: 'RING RUN',
    tagline: 'Thread 8 sky rings over the islands before the fuel runs dry.',
    ringCount: 8,
    ringRadius: 26,
    parSeconds: 210,
  },
  hop: {
    id: 'hop',
    key: '2',
    name: 'ISLAND HOP',
    tagline: 'Land on three island runways in order. Every good landing refuels you.',
    runwayCount: 3,
  },
  rescue: {
    id: 'rescue',
    key: '3',
    name: 'STORM RESCUE',
    tagline: 'Reach the beacon island through the storm cells, then bring her home.',
    stormCount: 5,
  },
};

export const PALETTE = {
  skyTop: '#2e4a7a',
  skyMid: '#7fa8c9',
  skyHorizon: '#f7c873',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  seaDeep: '#14506e',
  seaShallow: '#2e8fa8',
  seaGlint: '#ffd98a',
  sand: '#e8d29a',
  grassLight: '#5da24a',
  grassDark: '#2f6b34',
  rock: '#6b5d4f',
  runway: '#3a3f46',
  runwayMark: '#f5f2e4',
  ringNext: '#ffc233',
  ringLater: '#37d3e6',
  ringDone: '#7ee081',
  storm: '#3d3a4d',
  planeCream: '#f6ead2',
  planeTeal: '#1f7a6d',
  planeOrange: '#e8732a',
  hudAmber: '#ffb52e',
  hudGreen: '#7ee081',
  hudRed: '#ff5a4e',
  panelBg: '#10151f',
  panelGlass: '#0c2b33',
};

export const SHOTS = ['start', 'play', 'ring', 'land'];
