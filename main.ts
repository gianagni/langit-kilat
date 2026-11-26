// Langit Kilat, a best-flight-game entry (Node 22, standard library only).
// The playable game lives in this directory's game/ folder: plain static
// files a desktop browser loads offline (game/index.html plus its ES modules,
// no library, no network request). This program is the hand-in: it gathers
// game/ and screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library.
//
// The game itself: a 2D canvas chase-view flight over the Indonesian
// archipelago. Fly through glowing rings for points and fuel, dodge storm
// clouds, radio towers and volcano peaks, and land on island runways to
// refuel. Keyboard and mouse, title, playing, paused and game-over screens,
// WebAudio synth sounds, deterministic screenshot scenes behind ?shot=.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// A blank output dir is not an error: the grader creates it, and the local
// run does the same through mkdir -p before calling this program.

/** Copy a folder from the entry into the output, creating it first when needed. */
function handInFolder(name) {
  const from = join(rootDir, name);
  const to = join(outDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
handInFolder('game');
handInFolder('screenshots');

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes. The rest refuse an entry the scorer would refuse: more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all; a path under game/ over 1000 bytes. game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
const dossierText = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierText);
