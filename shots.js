// Langit Kilat: the four deterministic screenshot scenes behind
// ?shot=flight|ring|storm|landing. Each one places the plane, the rings, the
// storms and the runway by hand on a fixed world distance, so the same query
// always paints the same frame. No random draws and no clock run in a shot.

import { SCREEN_PLAY } from './state.js';

function baseScene(game, distance) {
  const state = game.state;
  state.screen = SCREEN_PLAY;
  state.distance = distance;
  state.elapsed = 42;
  state.message = '';
  state.messageTimer = 0;
  state.landedTimer = 0;
  state.shake = 0;
  state.plane.lives = 3;
  state.plane.invuln = 0;
  state.plane.gearDown = false;
  state.plane.boost = 80;
  state.plane.bank = 0;
  for (const ring of state.rings) ring.active = false;
  for (const storm of state.storms) storm.active = false;
  for (const tower of state.towers) tower.active = false;
  for (const runway of state.runways) runway.active = false;
  for (const pop of state.pops) pop.active = false;
  return state;
}

function putRing(state, index, dist, alt, kind) {
  const ring = state.rings[index];
  ring.active = true;
  ring.dist = dist;
  ring.alt = alt;
  ring.r = 58;
  ring.kind = kind;
}

function putStorm(state, index, dist, alt) {
  const storm = state.storms[index];
  storm.active = true;
  storm.dist = dist;
  storm.alt = alt;
  storm.r = 90;
  storm.phase = 0.4;
}

function putTower(state, index, dist, top) {
  const tower = state.towers[index];
  tower.active = true;
  tower.dist = dist;
  tower.top = top;
}

function putRunway(state, index, dist) {
  const runway = state.runways[index];
  runway.active = true;
  runway.dist = dist;
  runway.len = 340;
}

/**
 * Stage the named scene on `game` (flight, ring, storm, landing; anything
 * else is flight) and return the screen to draw.
 */
export function stageShot(name, game) {
  if (name === 'ring') {
    const state = baseScene(game, 5200);
    state.score = 640;
    state.combo = 3;
    state.bestCombo = 4;
    state.ringsPassed = 11;
    state.level = 2;
    state.fuel = 82;
    state.plane.alt = 1150;
    state.plane.speed = 330;
    state.plane.throttle = 62;
    state.plane.heading = 82;
    state.plane.bank = 0.12;
    putRing(state, 0, 5200, 1150, 'ring');
    putRing(state, 1, 5750, 1450, 'ring');
    putRing(state, 2, 6300, 950, 'fuel');
    state.pops[0].active = true;
    state.pops[0].x = 640;
    state.pops[0].y = 300;
    state.pops[0].text = '+55';
    state.pops[0].life = 1;
    return SCREEN_PLAY;
  }
  if (name === 'storm') {
    const state = baseScene(game, 9100);
    state.score = 980;
    state.combo = 0;
    state.ringsPassed = 14;
    state.level = 2;
    state.fuel = 18;
    state.lowFuelWarned = true;
    state.plane.alt = 900;
    state.plane.speed = 295;
    state.plane.throttle = 48;
    state.plane.heading = 96;
    state.plane.bank = -0.2;
    state.message = 'BAHAN BAKAR RENDAH! Cari cincin atau landasan.';
    state.messageTimer = 3;
    putStorm(state, 0, 9600, 1050);
    putStorm(state, 1, 10300, 1500);
    putRing(state, 0, 10900, 800, 'fuel');
    putRing(state, 1, 11500, 1200, 'ring');
    putTower(state, 0, 9800, 420);
    return SCREEN_PLAY;
  }
  if (name === 'landing') {
    const state = baseScene(game, 12400);
    state.score = 1420;
    state.combo = 1;
    state.ringsPassed = 19;
    state.level = 3;
    state.fuel = 55;
    state.plane.alt = 140;
    state.plane.speed = 210;
    state.plane.throttle = 30;
    state.plane.heading = 88;
    state.plane.bank = 0.05;
    state.plane.gearDown = true;
    putRunway(state, 0, 12600);
    putRing(state, 0, 13400, 600, 'ring');
    return SCREEN_PLAY;
  }
  const state = baseScene(game, 3400);
  state.score = 350;
  state.combo = 2;
  state.bestCombo = 2;
  state.ringsPassed = 5;
  state.level = 1;
  state.fuel = 78;
  state.plane.alt = 1200;
  state.plane.speed = 320;
  state.plane.throttle = 58;
  state.plane.heading = 85;
  state.plane.bank = 0.08;
  putRing(state, 0, 3950, 1250, 'ring');
  putRing(state, 1, 4500, 900, 'ring');
  putRing(state, 2, 5050, 1600, 'fuel');
  putStorm(state, 0, 5200, 1900);
  putTower(state, 0, 4700, 380);
  return SCREEN_PLAY;
}

export function shotSeed(name) {
  const seeds = { flight: 11, ring: 22, storm: 33, landing: 44 };
  return seeds[name] ?? 11;
}
