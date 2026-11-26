// Langit Kilat: every tuning number and colour in one place. The playfield is
// a fixed 1280x800 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size. Distances are metres, speeds km/h,
// altitudes metres. One screen pixel stands for 0.8 metres of world.

export const FIELD = { width: 1280, height: 800, seaY: 640 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres shown per screen pixel along the flight path. */
export const PX_PER_M = 0.8;

/** The plane's fixed screen position; the world scrolls past it. */
export const PLANE_X = 400;

export const PLANE = {
  radius: 26,
  climbRate: 260,
  descendRate: 300,
  bankRate: 55,
  headingRate: 26,
  minSpeed: 140,
  maxSpeed: 520,
  baseSpeed: 150,
  speedPerThrottle: 3.4,
  boostMultiplier: 1.6,
  invulnerable: 2,
};

export const LIVES = 3;

export const FUEL = {
  max: 100,
  start: 100,
  drainBase: 0.45,
  drainPerThrottle: 0.009,
  drainBoost: 2.2,
  ringBonus: 6,
  fuelRingBonus: 25,
  lowWarning: 20,
};

export const RING = {
  baseRadius: 58,
  radiusPerLevel: 4,
  minRadius: 38,
  points: 50,
  fuelPoints: 30,
  spawnEvery: 420,
  spawnJitter: 160,
  minAlt: 350,
  maxAlt: 2300,
};

export const STORM = {
  radius: 90,
  spawnEvery: 1100,
  push: 320,
  drift: 40,
};

export const TOWER = {
  width: 14,
  height: 150,
  spawnEvery: 850,
};

export const RUNWAY = {
  spawnEvery: 2400,
  length: 340,
  landAlt: 130,
  landSpeed: 250,
  bonus: 500,
  holdSeconds: 1.4,
};

export const LEVEL = { ringsPerLevel: 8, max: 12, speedPerLevel: 0.08 };

/** How many rings, storms, towers and runways can exist at once; pools are allocated once, at boot. */
export const POOL = { rings: 12, storms: 8, towers: 10, runways: 4, pops: 16 };

export const PALETTE = {
  skyTop: '#ffe3b3',
  skyMid: '#ffb37a',
  skyLow: '#ff8f6b',
  sun: '#fff3c4',
  farMountain: '#8a6fa8',
  farMountain2: '#6f5a94',
  seaDeep: '#17617a',
  seaShallow: '#2a9d8f',
  island: '#3e9e5f',
  islandDark: '#2c7a46',
  beach: '#f2d8a0',
  volcano: '#5d4a68',
  volcanoTop: '#3c2f45',
  city: '#e8e0d0',
  runway: '#3a3f4a',
  runwayLine: '#f5f0e0',
  ring: '#ffd23f',
  ringInner: '#fff3b0',
  storm: '#4a4560',
  stormDark: '#35314a',
  tower: '#e5534b',
  towerWhite: '#f5f0e0',
  planeBody: '#f8fafc',
  planeStripe: '#e63946',
  planeGlass: '#7dd3fc',
  hudPanel: 'rgba(16, 24, 40, 0.72)',
  hudText: '#f8fafc',
  hudMuted: '#cbd5e1',
  hudWarn: '#ff5d5d',
  hudGood: '#4ade80',
  text: '#f8fafc',
  muted: '#cbd5e1',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'langit-kilat.best';
