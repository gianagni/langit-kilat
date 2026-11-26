// Langit Kilat: all drawing. A sunset chase view over the archipelago: far
// mountain ridges in parallax, a glittering sea, green islands with volcanoes
// and towns, glowing target rings, storm clouds, radio towers and lit runways,
// the little prop plane always in frame, and a big readable HUD. Everything
// is drawn from the state, so the same state always paints the same frame.

import {
  FIELD, FONT, PALETTE, PLANE_X, PX_PER_M, RUNWAY,
} from './config.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  groundHeightAt, planeScreenY, segmentHasCity, terrainHeightAt, worldToScreenX,
} from './state.js';

const ALT_PX = 0.17;

function skyGradient(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.seaY);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.55, PALETTE.skyMid);
  gradient.addColorStop(1, PALETTE.skyLow);
  return gradient;
}

function seaGradient(ctx) {
  const gradient = ctx.createLinearGradient(0, FIELD.seaY, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.seaShallow);
  gradient.addColorStop(1, PALETTE.seaDeep);
  return gradient;
}

/** A soft ridge line for a parallax layer; offset scrolls slower than the world. */
function drawRidge(ctx, distance, factor, baseY, amp, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let x = 0; x <= FIELD.width; x += 16) {
    const world = (distance * factor + x * 2.2) / 1000;
    const y = baseY - (Math.sin(world * 1.7) * 0.5 + Math.sin(world * 0.6 + 2) * 0.5) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
}

function drawSun(ctx, distance) {
  const sunX = 980 - (distance * 0.02) % 200;
  const sunY = 150;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.9)');
  glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 180, sunY - 180, 360, 360);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();
  return sunX;
}

function drawSea(ctx, sunX, elapsed) {
  ctx.fillStyle = seaGradient(ctx);
  ctx.fillRect(0, FIELD.seaY, FIELD.width, FIELD.height - FIELD.seaY);
  ctx.strokeStyle = 'rgba(255, 243, 196, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const y = FIELD.seaY + 24 + i * 26;
    const wobble = Math.sin(elapsed * 0.8 + i * 1.3) * 8;
    ctx.beginPath();
    ctx.moveTo(sunX - 180 + wobble, y);
    ctx.lineTo(sunX + 180 - wobble, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const y = FIELD.seaY + 12 + i * 18;
    const offset = (elapsed * 14 * (i % 3 + 1)) % 140;
    ctx.beginPath();
    ctx.moveTo(60 + offset, y);
    ctx.lineTo(160 + offset, y);
    ctx.stroke();
  }
}

function drawTerrain(ctx, game) {
  const state = game.state;
  const step = 8;
  const samples = [];
  for (let x = 0; x <= FIELD.width; x += step) {
    const worldDist = state.distance + (x - PLANE_X) / PX_PER_M;
    samples.push({ x, worldDist, height: groundHeightAt(state.seed, worldDist, state.runways) });
  }
  let run = [];
  function flushRun() {
    if (run.length === 0) return;
    const first = run[0];
    const last = run[run.length - 1];
    const peak = run.reduce((best, s) => (s.height > best.height ? s : best), run[0]);
    if (peak.height > 500) {
      ctx.fillStyle = PALETTE.volcano;
      ctx.beginPath();
      ctx.moveTo(first.x - 20, FIELD.seaY + 4);
      ctx.lineTo(peak.x, FIELD.seaY - peak.height * ALT_PX);
      ctx.lineTo(last.x + 20, FIELD.seaY + 4);
      ctx.closePath();
      ctx.fill();
      const topY = FIELD.seaY - peak.height * ALT_PX;
      ctx.fillStyle = PALETTE.volcanoTop;
      ctx.beginPath();
      ctx.ellipse(peak.x, topY + 8, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7b54';
      ctx.beginPath();
      ctx.ellipse(peak.x, topY + 6, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(peak.x + 10, topY - 34, 12, 0, Math.PI * 2);
      ctx.arc(peak.x + 26, topY - 52, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.island;
      ctx.beginPath();
      ctx.moveTo(first.x, FIELD.seaY + 4);
      for (const s of run) ctx.lineTo(s.x, FIELD.seaY - s.height * ALT_PX);
      ctx.lineTo(last.x, FIELD.seaY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.beach;
      ctx.beginPath();
      ctx.roundRect(first.x - 4, FIELD.seaY - 3, last.x - first.x + 8, 10, 5);
      ctx.fill();
      if (segmentHasCity(state.seed, peak.worldDist)) {
        const topY = FIELD.seaY - peak.height * ALT_PX;
        ctx.fillStyle = PALETTE.city;
        for (let b = 0; b < 4; b += 1) {
          const bx = peak.x - 34 + b * 18;
          const bh = 12 + ((b * 7 + Math.floor(peak.worldDist / 50)) % 14);
          ctx.fillRect(bx, topY - bh, 13, bh);
        }
      }
    }
    run = [];
  }
  for (const s of samples) {
    if (s.height > 0) run.push(s);
    else flushRun();
  }
  flushRun();
}

function drawRunways(ctx, game) {
  const state = game.state;
  for (const runway of state.runways) {
    if (!runway.active) continue;
    const x0 = worldToScreenX(runway.dist, state.distance);
    const x1 = worldToScreenX(runway.dist + runway.len, state.distance);
    if (x1 < -50 || x0 > FIELD.width + 50) continue;
    const y = FIELD.seaY - 45 * ALT_PX;
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(x0, y, x1 - x0, 14);
    ctx.strokeStyle = PALETTE.runwayLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(x0 + 8, y + 7);
    ctx.lineTo(x1 - 8, y + 7);
    ctx.stroke();
    ctx.setLineDash([]);
    const blink = Math.sin(state.elapsed * 4) > 0;
    ctx.fillStyle = blink ? '#7CFC00' : '#2f7a1e';
    for (let x = x0 + 12; x < x1; x += 42) {
      ctx.beginPath();
      ctx.arc(x, y - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText('LANDASAN', x0 + 10, y - 12);
  }
}

function drawRings(ctx, game) {
  const state = game.state;
  for (const ring of state.rings) {
    if (!ring.active) continue;
    const x = worldToScreenX(ring.dist, state.distance);
    const y = planeScreenY(ring.alt);
    if (x < -120 || x > FIELD.width + 120) continue;
    const isFuel = ring.kind === 'fuel';
    ctx.save();
    ctx.shadowColor = isFuel ? '#4ade80' : PALETTE.ring;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = isFuel ? '#4ade80' : PALETTE.ring;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = PALETTE.ringInner;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, ring.r - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = isFuel ? '#4ade80' : PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(x + ring.r * 0.45, y - 10);
    ctx.lineTo(x + ring.r * 0.45, y + 10);
    ctx.lineTo(x + ring.r * 0.45 + 16, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawStorms(ctx, game) {
  const state = game.state;
  for (const storm of state.storms) {
    if (!storm.active) continue;
    const x = worldToScreenX(storm.dist, state.distance);
    const y = planeScreenY(storm.alt);
    if (x < -160 || x > FIELD.width + 160) continue;
    const flash = Math.sin(state.elapsed * 2 + storm.phase) > 0.86;
    ctx.fillStyle = PALETTE.stormDark;
    ctx.beginPath();
    ctx.ellipse(x, y, storm.r, storm.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.storm;
    ctx.beginPath();
    ctx.ellipse(x - 30, y - 18, storm.r * 0.6, storm.r * 0.4, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 34, y - 12, storm.r * 0.55, storm.r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    if (flash) {
      ctx.strokeStyle = '#ffe66d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 20);
      ctx.lineTo(x + 8, y + 52);
      ctx.lineTo(x - 2, y + 52);
      ctx.lineTo(x + 12, y + 86);
      ctx.stroke();
    }
  }
}

function drawTowers(ctx, game) {
  const state = game.state;
  for (const tower of state.towers) {
    if (!tower.active) continue;
    const x = worldToScreenX(tower.dist, state.distance);
    if (x < -40 || x > FIELD.width + 40) continue;
    const groundY = FIELD.seaY - terrainHeightAt(state.seed, tower.dist) * ALT_PX;
    const topY = FIELD.seaY - tower.top * ALT_PX;
    ctx.strokeStyle = PALETTE.towerWhite;
    ctx.lineWidth = TOWER_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, topY);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.tower;
    ctx.lineWidth = TOWER_WIDTH;
    const bands = 4;
    for (let b = 0; b < bands; b += 2) {
      const y0 = groundY - ((groundY - topY) * b) / bands;
      const y1 = groundY - ((groundY - topY) * (b + 1)) / bands;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    const blink = Math.sin(state.elapsed * 5 + tower.dist) > 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#7a1d1d';
    ctx.beginPath();
    ctx.arc(x, topY - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const TOWER_WIDTH = 8;

function drawPlane(ctx, game) {
  const state = game.state;
  const plane = state.plane;
  const x = PLANE_X;
  const y = planeScreenY(plane.alt);
  const groundY = FIELD.seaY - groundHeightAt(state.seed, state.distance, state.runways) * ALT_PX;
  const heightAbove = Math.max(0, groundY - y);
  if (heightAbove < 260) {
    ctx.fillStyle = `rgba(10, 20, 30, ${0.28 - heightAbove * 0.001})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6, 44, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(plane.bank * 0.45);
  if (plane.invuln > 0 && Math.floor(state.elapsed * 8) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.planeStripe;
  ctx.fillRect(-34, 4, 62, 5);
  ctx.fillStyle = PALETTE.planeGlass;
  ctx.beginPath();
  ctx.ellipse(26, -4, 12, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dbe4ea';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(26, -26);
  ctx.lineTo(34, -24);
  ctx.lineTo(14, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.lineTo(-44, 22);
  ctx.lineTo(-36, 24);
  ctx.lineTo(-22, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeStripe;
  ctx.beginPath();
  ctx.moveTo(-42, -4);
  ctx.lineTo(-52, -26);
  ctx.lineTo(-44, -28);
  ctx.lineTo(-34, -6);
  ctx.closePath();
  ctx.fill();
  const propAngle = state.elapsed * 32;
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(46 + Math.cos(propAngle) * 20, Math.sin(propAngle) * 20);
  ctx.lineTo(46 - Math.cos(propAngle) * 20, -Math.sin(propAngle) * 20);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(46, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  if (plane.gearDown || (plane.alt < 140 && plane.speed < 280)) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.lineTo(-14, 20);
    ctx.moveTo(18, 10);
    ctx.lineTo(18, 20);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-14, 22, 4, 0, Math.PI * 2);
    ctx.arc(18, 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(ctx, game) {
  const state = game.state;
  const plane = state.plane;
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(16, 14, 330, 92, 12);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('ALT', 30, 36);
  ctx.fillText('SPD', 140, 36);
  ctx.fillText('HDG', 250, 36);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(String(Math.round(plane.alt)), 30, 70);
  ctx.fillText(String(Math.round(plane.speed)), 140, 70);
  ctx.fillText(String(Math.round(plane.heading)).padStart(3, '0'), 250, 70);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('m', 96, 70);
  ctx.fillText('km/h', 196, 70);
  ctx.fillText('deg', 296, 70);
  ctx.strokeStyle = PALETTE.hudMuted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 88);
  ctx.lineTo(316, 88);
  ctx.stroke();
  const marks = ['N', 'E', 'S', 'W'];
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 12px ${FONT}`;
  for (let i = 0; i < 4; i += 1) {
    const deg = i * 90;
    let diff = ((deg - plane.heading + 540) % 360) - 180;
    const cx = 173 + diff * 1.1;
    if (cx > 30 && cx < 316) ctx.fillText(marks[i], cx - 4, 102);
  }

  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(FIELD.width - 346, 14, 330, 92, 12);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('SKOR', FIELD.width - 332, 36);
  ctx.fillText('LEVEL', FIELD.width - 222, 36);
  ctx.fillText('WAKTU', FIELD.width - 132, 36);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(String(state.score), FIELD.width - 332, 70);
  ctx.fillText(String(state.level), FIELD.width - 222, 70);
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width - 132, 70);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('NYAWA', FIELD.width - 332, 98);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < plane.lives ? PALETTE.hudGood : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(FIELD.width - 282 + i * 24, 92);
    ctx.lineTo(FIELD.width - 272 + i * 24, 100);
    ctx.lineTo(FIELD.width - 282 + i * 24, 100);
    ctx.closePath();
    ctx.fill();
  }

  const barX = 16;
  const barY = 122;
  const barW = 300;
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, 40, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('BAHAN BAKAR', barX + 12, barY + 16);
  const fuelRatio = state.fuel / 100;
  const fuelColour = state.fuel <= 20 ? PALETTE.hudWarn : state.fuel <= 45 ? '#fbbf24' : PALETTE.hudGood;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(barX + 12, barY + 22, barW - 24, 10);
  ctx.fillStyle = fuelColour;
  ctx.fillRect(barX + 12, barY + 22, (barW - 24) * fuelRatio, 10);
  if (state.fuel <= 20 && Math.floor(state.elapsed * 2) % 2 === 0) {
    ctx.fillStyle = PALETTE.hudWarn;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('BAHAN BAKAR RENDAH', barX + 12, barY + 56);
  }
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('BOOST', barX + 150, barY + 16);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(barX + 196, barY + 22, 92, 10);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(barX + 196, barY + 22, 92 * (plane.boost / 100), 10);

  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`KOMBO x${state.combo}`, FIELD.width / 2 - 60, 60);
  }
  for (const pop of state.pops) {
    if (!pop.active) continue;
    ctx.globalAlpha = Math.min(1, pop.life);
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.globalAlpha = 1;
  }
  if (state.messageTimer > 0) {
    ctx.fillStyle = 'rgba(16, 24, 40, 0.8)';
    ctx.beginPath();
    ctx.roundRect(FIELD.width / 2 - 300, FIELD.height - 78, 600, 44, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.message, FIELD.width / 2, FIELD.height - 50);
    ctx.textAlign = 'left';
  }
}

function drawTitle(ctx, game) {
  const state = game.state;
  ctx.fillStyle = 'rgba(20, 16, 40, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'center';
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText('LANGIT KILAT', FIELD.width / 2, 240);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = PALETTE.ring;
  ctx.fillText('Terbang melintasi nusantara, kejar cincin emasnya', FIELD.width / 2, 288);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `500 19px ${FONT}`;
  const lines = [
    'Atas / Bawah: naik dan turun    Kiri / Kanan: belok',
    'W / S: gas    Spasi: boost    R: ulangi    P: jeda    M: suara',
    'Terbang lewat cincin untuk poin dan bahan bakar.',
    'Mendarat di landasan untuk isi penuh dan bonus 500 poin.',
    'Hindari menara radio dan puncak gunung berapi.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, 350 + i * 32);
  });
  if (state.best > 0) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`Skor terbaik: ${state.best}`, FIELD.width / 2, 540);
  }
  if (Math.floor(state.elapsed * 1.6) % 2 === 0) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('TEKAN SPASI ATAU KLIK UNTUK TERBANG', FIELD.width / 2, 600);
  }
  ctx.textAlign = 'left';
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(20, 16, 40, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'center';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('JEDA', FIELD.width / 2, 380);
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText('Tekan P atau klik untuk lanjut terbang', FIELD.width / 2, 430);
  ctx.textAlign = 'left';
}

function drawOver(ctx, game) {
  const state = game.state;
  ctx.fillStyle = 'rgba(20, 16, 40, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'center';
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText('PENERBANGAN SELESAI', FIELD.width / 2, 300);
  ctx.font = `700 34px ${FONT}`;
  ctx.fillStyle = PALETTE.ring;
  ctx.fillText(`Skor ${state.score}`, FIELD.width / 2, 360);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Cincin dilewati: ${state.ringsPassed}    Level: ${state.level}    Kombo terbaik: x${state.bestCombo}`, FIELD.width / 2, 410);
  if (state.score >= state.best && state.score > 0) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('Skor terbaik baru!', FIELD.width / 2, 452);
  } else if (state.best > 0) {
    ctx.fillText(`Skor terbaik: ${state.best}`, FIELD.width / 2, 452);
  }
  if (Math.floor(state.elapsed * 1.6) % 2 === 0) {
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('TEKAN R UNTUK TERBANG LAGI', FIELD.width / 2, 520);
  }
  ctx.fillStyle = PALETTE.ring;
  ctx.beginPath();
  ctx.roundRect(FIELD.width / 2 - 180, 560, 360, 64, 12);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText('TERBANG LAGI', FIELD.width / 2, 602);
  ctx.textAlign = 'left';
}

/** Paint one frame of the game on the canvas context. */
export function drawGame(ctx, game) {
  const state = game.state;
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake * 10, (Math.random() - 0.5) * state.shake * 10);
  }
  ctx.fillStyle = skyGradient(ctx);
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const sunX = drawSun(ctx, state.distance);
  drawRidge(ctx, state.distance, 0.12, 560, 70, PALETTE.farMountain2);
  drawRidge(ctx, state.distance, 0.25, 600, 50, PALETTE.farMountain);
  drawSea(ctx, sunX, state.elapsed);
  drawTerrain(ctx, game);
  drawRunways(ctx, game);
  drawRings(ctx, game);
  drawStorms(ctx, game);
  drawTowers(ctx, game);
  drawPlane(ctx, game);
  drawHud(ctx, game);
  ctx.restore();
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, game);
  else if (state.screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (state.screen === SCREEN_OVER) drawOver(ctx, game);
}
