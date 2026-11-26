// Langit Kilat: boot and the one loop. Input is read every frame, the flight
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, playing, paused and game over.
//
// ?shot=flight|ring|storm|landing (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?seed=N fixes the terrain and spawns for a normal run.

import { FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { KEY_CONFIRM, KEY_MUTE, KEY_PAUSE, KEY_RESTART, createInput, hitRect } from './input.js';
import { drawGame } from './render.js';
import { shotSeed, stageShot } from './shots.js';
import {
  EVENT_FUEL_RING, EVENT_HIT, EVENT_LAND, EVENT_LEVEL, EVENT_LOW_FUEL, EVENT_OVER, EVENT_RING,
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  createGame, startGame, updateGame,
} from './state.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (shot ? shotSeed(shot) : Math.floor(Math.random() * 4294967296));

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const audio = createAudio();
const state = game.state;
// Test hook: the live state is readable from the console for play-testing.
window.__langit = game;

/** Size the canvas to its logical field and keep it sharp on dense screens. */
function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const width = Math.floor(FIELD.width * scale);
  const height = Math.floor(FIELD.height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = FIELD.width * ratio;
  canvas.height = FIELD.height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

const ctx = fitCanvas();
window.addEventListener('resize', () => {
  fitCanvas();
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem('langit-kilat.best') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('langit-kilat.best', String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

state.best = readBest();

function playEvents(events) {
  if (events & EVENT_RING) audio.ring();
  else if (events & EVENT_FUEL_RING) audio.fuelRing();
  if (events & EVENT_LAND) audio.land();
  if (events & EVENT_HIT) audio.crash();
  if (events & EVENT_LEVEL) audio.level();
  if (events & EVENT_LOW_FUEL) audio.warn();
}

function runShot(name) {
  stageShot(name, game);
  let painted = 0;
  function paint() {
    drawGame(ctx, game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function endRun() {
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
    announce(`Penerbangan selesai. Skor ${state.score}.`);
  }

  function buttonRect() {
    return { x: FIELD.width / 2 - 180, y: 560, width: 360, height: 64 };
  }

  function handleClicks() {
    for (const point of input.takeClicks()) {
      audio.unlock();
      if (state.screen === SCREEN_TITLE) {
        startGame(game);
        announce('Terbang! Cari cincin emas.');
        continue;
      }
      if (state.screen === SCREEN_OVER) {
        if (hitRect(point.x, point.y, buttonRect())) {
          startGame(game);
          announce('Terbang! Cari cincin emas.');
        }
        continue;
      }
      if (state.screen === SCREEN_PAUSED) {
        state.screen = SCREEN_PLAY;
        announce('Lanjut terbang.');
      }
    }
  }

  function handleKeys() {
    for (const code of input.takeKeys()) {
      audio.unlock();
      if (code === KEY_MUTE) {
        state.muted = !state.muted;
        audio.setMuted(state.muted);
        announce(state.muted ? 'Suara mati.' : 'Suara hidup.');
        continue;
      }
      if (code === KEY_RESTART && state.screen !== SCREEN_TITLE) {
        startGame(game);
        announce('Terbang! Cari cincin emas.');
        continue;
      }
      if (code === KEY_PAUSE && state.screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSED;
        announce('Jeda.');
        continue;
      }
      if (code === KEY_PAUSE && state.screen === SCREEN_PAUSED) {
        state.screen = SCREEN_PLAY;
        announce('Lanjut terbang.');
        continue;
      }
      if (code === KEY_CONFIRM) {
        if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER) {
          startGame(game);
          announce('Terbang! Cari cincin emas.');
        } else if (state.screen === SCREEN_PAUSED) {
          state.screen = SCREEN_PLAY;
          announce('Lanjut terbang.');
        }
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleClicks();
    handleKeys();
    if (state.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = updateGame(game, STEP, input.controls(), false);
        playEvents(events);
        accumulator -= STEP;
        if (state.screen === SCREEN_OVER) {
          endRun();
          break;
        }
      }
    } else if (state.screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        updateGame(game, STEP, { pitch: 0, bank: 0, throttleUp: false, throttleDown: false, boost: false }, true);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.engine(state.plane.throttle, input.controls().boost, state.screen === SCREEN_PLAY);
    drawGame(ctx, game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Langit Kilat. Tekan Spasi atau klik untuk terbang.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
