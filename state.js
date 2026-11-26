// Langit Kilat: the game's rules and state, with no drawing and no browser in
// it. The plane flies a fixed screen position while the world scrolls past;
// distance, altitude, speed, heading, fuel, rings, storms, towers and runways
// are all numbers here. updateGame advances one fixed step and returns what
// happened as bit flags, so the caller can react without the state knowing
// about screens or sound. Nothing here allocates after createGame returns.

import {
  FIELD, LEVEL, LIVES, PLANE, POOL, PX_PER_M, RING, RUNWAY, STORM, TOWER, FUEL,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_LEVEL = 3;
export const SCREEN_OVER = 4;

export const EVENT_RING = 1;
export const EVENT_FUEL_RING = 2;
export const EVENT_HIT = 4;
export const EVENT_LAND = 8;
export const EVENT_OVER = 16;
export const EVENT_LEVEL = 32;
export const EVENT_LOW_FUEL = 64;

/** A small seeded random generator (mulberry32): the same seed gives the same game. */
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable hash of a segment index and the run seed, so terrain never changes mid-flight. */
function segmentHash(seed, index) {
  let a = (seed | 0) ^ Math.imul(index + 1, 2654435761);
  a = Math.imul(a ^ (a >>> 15), 2246822519);
  a = Math.imul(a ^ (a >>> 13), 3266489917);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

const SEGMENT_M = 400;
/** The height, in metres above the sea, of the terrain under a world distance. */
export function terrainHeightAt(seed, distance) {
  if (distance < 800) return 0;
  const index = Math.floor(distance / SEGMENT_M);
  const frac = distance / SEGMENT_M - index;
  const roll = segmentHash(seed, index);
  if (roll < 0.3) return 0;
  let peak = 60 + segmentHash(seed, index + 7919) * 260;
  if (roll > 0.86) peak = 750 + segmentHash(seed, index + 104729) * 450;
  const hump = Math.sin(Math.PI * frac);
  if (roll > 0.86) return peak * Math.pow(1 - Math.abs(frac - 0.5) * 2, 0.7) + 40;
  return peak * Math.pow(hump, 1.2);
}

/** The ground under a world distance: flat 45 m over a runway strip, terrain elsewhere. */
export function groundHeightAt(seed, distance, runways) {
  for (const runway of runways) {
    if (!runway.active) continue;
    if (distance >= runway.dist - 60 && distance <= runway.dist + runway.len + 60) return 45;
  }
  return terrainHeightAt(seed, distance);
}

/** Whether a world distance holds a city (drawn on the island top). */
export function segmentHasCity(seed, distance) {
  const index = Math.floor(distance / SEGMENT_M);
  const roll = segmentHash(seed, index);
  return roll >= 0.3 && roll <= 0.62;
}

export function createGame(seed) {
  const random = createRandom(seed);
  const state = {
    seed,
    screen: SCREEN_TITLE,
    best: 0,
    muted: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    ringsPassed: 0,
    level: 1,
    elapsed: 0,
    distance: 0,
    fuel: FUEL.start,
    lowFuelWarned: false,
    plane: {
      alt: 1200, speed: 300, throttle: 55, boost: 100, heading: 85, bank: 0,
      lives: LIVES, invuln: 0, gearDown: false,
    },
    rings: [],
    storms: [],
    towers: [],
    runways: [],
    pops: [],
    message: '',
    messageTimer: 0,
    landedTimer: 0,
    shake: 0,
    spawn: { ringAt: 900, stormAt: 2600, towerAt: 1800, runwayAt: 3200, lastRingAlt: 1200 },
  };
  for (let i = 0; i < POOL.rings; i += 1) state.rings.push({ active: false, dist: 0, alt: 0, r: 0, kind: 'ring' });
  for (let i = 0; i < POOL.storms; i += 1) state.storms.push({ active: false, dist: 0, alt: 0, r: 0, phase: 0 });
  for (let i = 0; i < POOL.towers; i += 1) state.towers.push({ active: false, dist: 0, top: 0 });
  for (let i = 0; i < POOL.runways; i += 1) state.runways.push({ active: false, dist: 0, len: 0 });
  for (let i = 0; i < POOL.pops; i += 1) state.pops.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  return { state, random };
}

function freeSlot(pool) {
  for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
  return null;
}

function addPop(state, x, y, text) {
  const pop = freeSlot(state.pops);
  if (!pop) return;
  pop.active = true;
  pop.x = x;
  pop.y = y;
  pop.text = text;
  pop.life = 1.2;
}

function showMessage(state, text, seconds) {
  state.message = text;
  state.messageTimer = seconds;
}

function spawnRing(game, at) {
  const slot = freeSlot(game.state.rings);
  if (!slot) return;
  const s = game.state.spawn;
  const target = RING.minAlt + game.random() * (RING.maxAlt - RING.minAlt);
  const clamped = Math.max(s.lastRingAlt - 700, Math.min(s.lastRingAlt + 700, target));
  slot.active = true;
  slot.dist = at;
  slot.alt = clamped;
  slot.r = Math.max(RING.minRadius, RING.baseRadius - RING.radiusPerLevel * (game.state.level - 1));
  slot.kind = game.random() < 0.22 ? 'fuel' : 'ring';
  s.lastRingAlt = clamped;
}

function spawnStorm(game, at) {
  const slot = freeSlot(game.state.storms);
  if (!slot) return;
  slot.active = true;
  slot.dist = at;
  slot.alt = 600 + game.random() * 1400;
  slot.r = STORM.radius;
  slot.phase = game.random() * Math.PI * 2;
}

function spawnTower(game, at) {
  const ground = terrainHeightAt(game.state.seed, at);
  if (ground < 40) return;
  const slot = freeSlot(game.state.towers);
  if (!slot) return;
  slot.active = true;
  slot.dist = at;
  slot.top = ground + TOWER.height;
}

function spawnRunway(game, at) {
  const slot = freeSlot(game.state.runways);
  if (!slot) return;
  slot.active = true;
  slot.dist = at;
  slot.len = RUNWAY.length;
}

export function startGame(game) {
  const state = game.state;
  state.screen = SCREEN_PLAY;
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.ringsPassed = 0;
  state.level = 1;
  state.elapsed = 0;
  state.distance = 0;
  state.fuel = FUEL.start;
  state.lowFuelWarned = false;
  state.plane.alt = 1200;
  state.plane.speed = 300;
  state.plane.throttle = 55;
  state.plane.boost = 100;
  state.plane.heading = 85;
  state.plane.bank = 0;
  state.plane.lives = LIVES;
  state.plane.invuln = 0;
  state.plane.gearDown = false;
  for (const ring of state.rings) ring.active = false;
  for (const storm of state.storms) storm.active = false;
  for (const tower of state.towers) tower.active = false;
  for (const runway of state.runways) runway.active = false;
  for (const pop of state.pops) pop.active = false;
  state.spawn = { ringAt: 900, stormAt: 2600, towerAt: 1800, runwayAt: 3200, lastRingAlt: 1200 };
  state.message = '';
  state.messageTimer = 0;
  state.landedTimer = 0;
  state.shake = 0;
  showMessage(state, 'Terbang! Cari cincin emas, jaga bahan bakar.', 3);
}

/** A crash: lose a life, or end the run when none are left. */
function crash(game) {
  const state = game.state;
  state.plane.lives -= 1;
  state.combo = 0;
  state.shake = 1;
  if (state.plane.lives <= 0) {
    state.screen = SCREEN_OVER;
    return EVENT_HIT | EVENT_OVER;
  }
  state.plane.alt = 1200;
  state.plane.speed = 280;
  state.plane.throttle = 55;
  state.plane.invuln = PLANE.invulnerable;
  state.fuel = Math.max(state.fuel, 35);
  showMessage(state, 'TABRAKAN! Satu nyawa hilang.', 2);
  return EVENT_HIT;
}

function land(game, runway) {
  const state = game.state;
  state.score += RUNWAY.bonus;
  state.fuel = FUEL.max;
  state.landedTimer = RUNWAY.holdSeconds;
  state.plane.gearDown = true;
  showMessage(state, `MENDARAT! +${RUNWAY.bonus} poin, tangki penuh.`, 2);
  addPop(state, 640, 300, `+${RUNWAY.bonus}`);
  return EVENT_LAND;
}

/**
 * One fixed step. `input` carries pitch (-1 down, 0, 1 up), bank (-1 left, 0, 1
 * right), throttleUp, throttleDown and boost as held booleans. With `harmless`
 * set (the title screen's backdrop) the world scrolls but nothing scores and
 * nothing can crash the plane.
 */
export function updateGame(game, dt, input, harmless) {
  const state = game.state;
  const plane = state.plane;
  let events = 0;
  state.elapsed += dt;

  if (plane.invuln > 0) plane.invuln = Math.max(0, plane.invuln - dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);
  if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);
  for (const pop of state.pops) {
    if (!pop.active) continue;
    pop.life -= dt;
    pop.y -= 28 * dt;
    if (pop.life <= 0) pop.active = false;
  }

  if (state.landedTimer > 0) {
    state.landedTimer -= dt;
    plane.speed = Math.max(120, plane.speed - 60 * dt);
    plane.alt = 45;
    plane.gearDown = true;
    if (state.landedTimer <= 0) {
      plane.throttle = 70;
      plane.gearDown = false;
      showMessage(state, 'Lepas landas!', 1.5);
    }
    return events;
  }

  if (!harmless) {
    if (input.throttleUp) plane.throttle = Math.min(100, plane.throttle + 30 * dt);
    if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - 30 * dt);
  }
  const boosting = !harmless && input.boost && plane.boost > 0 && state.fuel > 0;
  if (boosting) plane.boost = Math.max(0, plane.boost - 35 * dt);
  else plane.boost = Math.min(100, plane.boost + 12 * dt);

  const targetSpeed = (PLANE.baseSpeed + plane.throttle * PLANE.speedPerThrottle) * (boosting ? PLANE.boostMultiplier : 1);
  if (state.fuel <= 0) plane.speed = Math.max(150, plane.speed - 25 * dt);
  else plane.speed += (Math.min(PLANE.maxSpeed, targetSpeed) - plane.speed) * Math.min(1, dt * 1.2);
  plane.speed = Math.max(PLANE.minSpeed, Math.min(PLANE.maxSpeed, plane.speed));

  const pitch = harmless ? 0 : input.pitch;
  const climb = pitch * (pitch > 0 ? PLANE.climbRate : PLANE.descendRate);
  plane.alt += climb * dt;
  if (state.fuel <= 0 && !harmless) plane.alt -= 70 * dt;
  plane.alt = Math.max(0, Math.min(3000, plane.alt));

  const bankTarget = harmless ? 0 : input.bank;
  plane.bank += (bankTarget - plane.bank) * Math.min(1, dt * 6);
  plane.heading = (plane.heading + plane.bank * PLANE.headingRate * dt + 360) % 360;

  state.distance += (plane.speed / 3.6) * dt;

  if (!harmless) {
    let drain = FUEL.drainBase + plane.throttle * FUEL.drainPerThrottle;
    if (boosting) drain += FUEL.drainBoost;
    state.fuel = Math.max(0, state.fuel - drain * dt);
    if (state.fuel <= FUEL.lowWarning && !state.lowFuelWarned) {
      state.lowFuelWarned = true;
      events |= EVENT_LOW_FUEL;
      showMessage(state, 'BAHAN BAKAR RENDAH! Cari cincin atau landasan.', 3);
    }
    if (state.fuel > FUEL.lowWarning + 10) state.lowFuelWarned = false;
  }

  const lookAhead = state.distance + 1600;
  while (state.spawn.ringAt < lookAhead) {
    spawnRing(game, state.spawn.ringAt);
    state.spawn.ringAt += RING.spawnEvery + game.random() * RING.spawnJitter;
  }
  while (state.spawn.stormAt < lookAhead) {
    if (state.level >= 2 || game.random() < 0.5) spawnStorm(game, state.spawn.stormAt);
    state.spawn.stormAt += STORM.spawnEvery + game.random() * 500;
  }
  while (state.spawn.towerAt < lookAhead) {
    spawnTower(game, state.spawn.towerAt);
    state.spawn.towerAt += TOWER.spawnEvery + game.random() * 400;
  }
  while (state.spawn.runwayAt < lookAhead) {
    spawnRunway(game, state.spawn.runwayAt);
    state.spawn.runwayAt += RUNWAY.spawnEvery + game.random() * 600;
  }

  for (const ring of state.rings) if (ring.active && ring.dist < state.distance - 300) ring.active = false;
  for (const storm of state.storms) if (storm.active && storm.dist < state.distance - 300) storm.active = false;
  for (const tower of state.towers) if (tower.active && tower.dist < state.distance - 300) tower.active = false;
  for (const runway of state.runways) if (runway.active && runway.dist + runway.len < state.distance - 300) runway.active = false;

  if (harmless) return events;

  for (const storm of state.storms) {
    if (!storm.active) continue;
    const dx = (storm.dist - state.distance) * PX_PER_M;
    const dy = (storm.alt - plane.alt) * PX_PER_M;
    const d = Math.hypot(dx, dy);
    if (d < storm.r * 1.4) {
      plane.alt += (game.random() - 0.5) * STORM.push * dt;
      plane.heading = (plane.heading + (game.random() - 0.5) * STORM.drift * dt + 360) % 360;
      state.shake = Math.max(state.shake, 0.5);
      state.fuel = Math.max(0, state.fuel - 0.4 * dt);
    }
  }

  for (const ring of state.rings) {
    if (!ring.active || ring.dist > state.distance) continue;
    ring.active = false;
    const gap = Math.abs(plane.alt - ring.alt) * PX_PER_M;
    if (gap < ring.r) {
      state.ringsPassed += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const points = (ring.kind === 'fuel' ? RING.fuelPoints : RING.points) + (state.combo - 1) * 5;
      state.score += points;
      state.fuel = Math.min(FUEL.max, state.fuel + (ring.kind === 'fuel' ? FUEL.fuelRingBonus : FUEL.ringBonus));
      addPop(state, 640, 320, `+${points}`);
      const level = Math.min(LEVEL.max, 1 + Math.floor(state.ringsPassed / LEVEL.ringsPerLevel));
      if (level > state.level) {
        state.level = level;
        events |= EVENT_LEVEL;
        showMessage(state, `LEVEL ${level}! Angin makin kencang, cincin makin sempit.`, 3);
      }
      events |= ring.kind === 'fuel' ? EVENT_FUEL_RING : EVENT_RING;
    } else {
      state.combo = 0;
    }
  }

  const terrain = groundHeightAt(state.seed, state.distance, state.runways);
  let overRunway = null;
  for (const runway of state.runways) {
    if (runway.active && state.distance >= runway.dist && state.distance <= runway.dist + runway.len) {
      overRunway = runway;
      break;
    }
  }
  const runwayTop = 45;
  if (overRunway && plane.alt <= runwayTop + 25 && plane.speed <= RUNWAY.landSpeed && plane.invuln === 0) {
    return events | land(game, overRunway);
  }
  if (plane.alt <= terrain && plane.invuln === 0) {
    return events | crash(game);
  }
  for (const tower of state.towers) {
    if (!tower.active) continue;
    if (Math.abs(tower.dist - state.distance) < 18 && plane.alt < tower.top && plane.invuln === 0) {
      return events | crash(game);
    }
  }
  return events;
}

/** Screen-space helpers the renderer and the play test share. */
export function planeScreenY(alt) {
  return FIELD.seaY - alt * 0.17;
}

export function worldToScreenX(dist, distance) {
  return 400 + (dist - distance) * PX_PER_M;
}
