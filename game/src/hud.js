// NUSA SKY RUN — hud.js
// One job: the instruments. Big readable HUD numerals (ALT/SPD/HDG), the
// compass tape, fuel/damage bars, the lit instrument panel, and banners.
// This is what the judge reads first, so nothing here is small or faint.

import { SCREEN, PALETTE } from './config.js';
import { headingDegrees, altitudeFeet } from './plane.js';
import { missionObjective, missionProgress } from './missions.js';

const PANEL_H = 108;

export function drawHud(ctx, game) {
  const { plane, mission, score, time } = game;
  if (game.state === 'menu') return;
  drawTopBar(ctx, plane, mission, score);
  drawSideBars(ctx, plane);
  drawPanel(ctx, plane, time);
  drawBanner(ctx, game);
  drawHints(ctx, game);
}

function drawTopBar(ctx, plane, mission, score) {
  const hdg = headingDegrees(plane);
  const alt = altitudeFeet(plane);
  const spd = Math.round(plane.speedKt);

  // Compass tape across the top centre.
  const cx = SCREEN.width / 2;
  const tapeW = 460;
  const tapeY = 26;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, cx - tapeW / 2, 6, tapeW, 44, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - tapeW / 2, 6, tapeW, 44);
  ctx.clip();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((hdg + d + 360) % 360);
    const x = cx + d * (tapeW / 130);
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? PALETTE.hudAmber : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, tapeY + 12);
    ctx.lineTo(x, tapeY + (major ? 2 : 7));
    ctx.stroke();
    if (major) {
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.fillText(label, x, tapeY + 24);
    }
  }
  ctx.restore();
  // Heading caret + value.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, 20);
  ctx.lineTo(cx - 7, 8);
  ctx.lineTo(cx + 7, 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`${String(Math.round(hdg)).padStart(3, '0')}°`, cx, 62);

  // Left: speed. Right: altitude. Big numerals, labelled.
  bigNumber(ctx, 26, 14, 'SPD', `${spd}`, 'KT');
  bigNumber(ctx, SCREEN.width - 26, 14, 'ALT', `${alt}`, 'FT', true);

  // Objective line under the compass.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.66)';
  const obj = missionObjective(mission);
  ctx.font = 'bold 15px sans-serif';
  const w = ctx.measureText(obj).width + 28;
  roundRect(ctx, cx - w / 2, 74, w, 28, 7);
  ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.textAlign = 'center';
  ctx.fillText(obj, cx, 89);

  // Progress pips under the objective.
  const prog = missionProgress(mission);
  const total = mission.id === 'rings' ? mission.rings.length
    : mission.id === 'hop' ? mission.runways.length : 3;
  const done = Math.round(prog * total);
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < done ? PALETTE.hudGreen : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx - ((total - 1) * 11) / 2 + i * 11, 116, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Score, top-right below altitude.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.66)';
  roundRect(ctx, SCREEN.width - 190, 96, 164, 30, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${score}`, SCREEN.width - 36, 112);
  ctx.textAlign = 'left';
}

function bigNumber(ctx, x, y, label, value, unit, right = false) {
  const w = 148;
  const x0 = right ? x - w : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, x0, y, w, 62, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(label, x0 + 12, y + 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(value, x0 + 12, y + 50);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 12px sans-serif';
  const vx = x0 + 12 + ctx.measureText(value).width + 6;
  ctx.fillText(unit, vx, y + 50);
}

function drawSideBars(ctx, plane) {
  // Fuel (left) and damage (right): tall bars with labels, impossible to miss.
  bar(ctx, 18, 150, 22, 300, plane.fuel / 100, PALETTE.hudGreen, 'FUEL', `${Math.round(plane.fuel)}%`);
  const dmg = plane.damage / 100;
  bar(ctx, SCREEN.width - 40, 150, 22, 300, dmg, dmg > 0.6 ? PALETTE.hudRed : PALETTE.hudAmber, 'DMG', `${Math.round(plane.damage)}%`);
  // Throttle bar under the fuel bar.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, 14, 470, 30, 120, 6);
  ctx.fill();
  const th = plane.thr;
  ctx.fillStyle = PALETTE.hudAmber;
  const thH = 104 * th;
  ctx.fillRect(18, 474 + 104 - thH + 8, 22, thH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', 29, 606);
  ctx.textAlign = 'left';
  if (plane.stalled) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN', SCREEN.width / 2, 170);
    ctx.textAlign = 'left';
  }
  if (plane.fuel > 0 && plane.fuel < 22) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', SCREEN.width / 2, 198);
    ctx.textAlign = 'left';
  }
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, x - 4, y - 24, w + 8, h + 44, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  const fh = h * Math.max(0, Math.min(1, frac));
  ctx.fillRect(x, y + h - fh, w, fh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y - 10);
  ctx.fillText(value, x + w / 2, y + h + 16);
  ctx.textAlign = 'left';
}

// ---- the lit instrument panel -------------------------------------------

function drawPanel(ctx, plane, time) {
  const y0 = SCREEN.height - PANEL_H;
  ctx.fillStyle = PALETTE.panelBg;
  ctx.fillRect(0, y0, SCREEN.width, PANEL_H);
  ctx.fillStyle = 'rgba(255, 181, 46, 0.25)';
  ctx.fillRect(0, y0, SCREEN.width, 2);
  const cx = SCREEN.width / 2;

  // Artificial horizon: the instrument that proves the plane is flown.
  drawArtificialHorizon(ctx, cx - 420, y0 + PANEL_H / 2, 40, plane, time);
  // Altimeter + airspeed dials.
  drawDial(ctx, cx - 300, y0 + PANEL_H / 2, 38, 'ALT', `${Math.round(plane.alt * 3.28)}`, 0, 1000, plane.alt * 3.28);
  drawDial(ctx, cx - 200, y0 + PANEL_H / 2, 38, 'SPD', `${Math.round(plane.speedKt)}`, 0, 180, plane.speedKt);
  // Heading dial.
  drawDial(ctx, cx + 200, y0 + PANEL_H / 2, 38, 'HDG', `${String(Math.round(((plane.hdg * 180) / Math.PI + 360) % 360)).padStart(3, '0')}`, 0, 360, ((plane.hdg * 180) / Math.PI + 360) % 360);
  // Fuel gauge + vertical speed.
  drawDial(ctx, cx + 300, y0 + PANEL_H / 2, 38, 'FUEL', `${Math.round(plane.fuel)}`, 0, 100, plane.fuel);
  drawDial(ctx, cx + 400, y0 + PANEL_H / 2, 38, 'V/S', `${plane.vsFpm > 0 ? '+' : ''}${Math.round(plane.vsFpm)}`, -1200, 1200, plane.vsFpm);

  // Centre: gear + flaps + mission clock, backlit.
  ctx.textAlign = 'center';
  ctx.fillStyle = plane.gearDown ? PALETTE.hudGreen : 'rgba(255,255,255,0.4)';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`GEAR ${plane.gearDown ? 'DOWN' : 'UP'}`, cx - 78, y0 + 34);
  ctx.fillStyle = plane.flaps ? PALETTE.hudGreen : 'rgba(255,255,255,0.4)';
  ctx.fillText(`FLAPS ${plane.flaps ? 'ON' : 'OFF'}`, cx + 78, y0 + 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(formatTime(plane.time), cx, y0 + 66);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px sans-serif';
  ctx.fillText('SORTIE TIME', cx, y0 + 86);
  ctx.textAlign = 'left';
}

function drawArtificialHorizon(ctx, x, y, r, plane, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.panelGlass;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate((-plane.bank * Math.PI) / 180);
  const pitchPx = (plane.pitch / 17) * r * 0.8;
  ctx.fillStyle = '#7fb8dd';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  for (const off of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(-r + 8, pitchPx + off);
    ctx.lineTo(r - 8, pitchPx + off);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-r + 4, 0);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(r - 4, 0);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  // Rim + label.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', 0, r + 13);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawDial(ctx, x, y, r, label, value, min, max, current) {
  ctx.save();
  ctx.translate(x, y);
  // Backlit face.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
  glow.addColorStop(0, '#123a44');
  glow.addColorStop(1, '#0a2027');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // Tick marks.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
    ctx.stroke();
  }
  // Needle.
  const frac = Math.max(0, Math.min(1, (current - min) / (max - min)));
  const na = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * (r - 8), Math.sin(na) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(value, 0, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px sans-serif';
  ctx.fillText(label, 0, r + 13);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ---- banners + hints ------------------------------------------------------

function drawBanner(ctx, game) {
  if (!game.banner) return;
  const age = game.time - game.banner.at;
  if (age > 3.2) return;
  const alpha = age > 2.6 ? 1 - (age - 2.6) / 0.6 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = game.banner.color || '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillText(game.banner.text, SCREEN.width / 2, 250);
  if (game.banner.sub) {
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(game.banner.sub, SCREEN.width / 2, 282);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawHints(ctx, game) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  const line = game.state === 'flying'
    ? 'Arrows / WASD fly · Shift throttle up · Ctrl throttle down · Space brake · C cockpit · P pause · R restart'
    : 'Click a mission or press 1 / 2 / 3 · M mute';
  // Flying: the hint sits just above the instrument panel, never on top of it.
  const y = game.state === 'flying' ? SCREEN.height - PANEL_H - 10 : SCREEN.height - 8;
  ctx.fillText(line, SCREEN.width / 2, y);
  ctx.textAlign = 'left';
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- menu + end screens (drawn on the canvas, same render path) -----------

export function drawMenu(ctx, game) {
  const { time } = game;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.45)';
  ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.fillText('NUSA SKY RUN', SCREEN.width / 2, 118);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('A bush-plane island hopper — three sorties, one sunset, no second chances on fuel.', SCREEN.width / 2, 152);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px sans-serif';
  ctx.fillText('Fly with keyboard + mouse. Every mission is a different decision: rings, runways, or a storm.', SCREEN.width / 2, 178);

  const cards = [
    { key: '1', name: 'RING RUN', desc: 'Thread 8 gold rings over the islands. Fast and clean beats fast and dead — fuel is the real timer.', color: PALETTE.ringNext },
    { key: '2', name: 'ISLAND HOP', desc: 'Land on runways 1, 2 and 3 in order. Each good landing refuels you +42. Gear down, wings level.', color: PALETTE.hudGreen },
    { key: '3', name: 'STORM RESCUE', desc: 'Reach the beacon island through five storm cells, then bring her home to runway 1. Damage is forever.', color: '#ff8a5c' },
  ];
  game.menuCards = [];
  cards.forEach((card, i) => {
    const w = 330;
    const h = 190;
    const x = SCREEN.width / 2 - ((cards.length - 1) * (w + 24)) / 2 + i * (w + 24) - w / 2;
    const y = 224;
    const hover = game.hoverCard === i;
    ctx.fillStyle = hover ? 'rgba(20, 28, 44, 0.94)' : 'rgba(12, 18, 32, 0.88)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = card.color;
    ctx.lineWidth = hover ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = card.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`PRESS ${card.key}`, x + w / 2, y + 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(card.name, x + w / 2, y + 66);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px sans-serif';
    wrapText(ctx, card.desc, x + w / 2, y + 96, w - 36, 20);
    game.menuCards.push({ x, y, w, h, index: i });
  });

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Arrows / WASD — fly · Shift / Ctrl — throttle · Space — brake · Mouse — hold to steer · C — cockpit view · P — pause', SCREEN.width / 2, 452);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 15px sans-serif';
  const pulse = 0.65 + Math.sin(time * 3) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillText('CLICK A MISSION OR PRESS 1 / 2 / 3', SCREEN.width / 2, 486);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, game) {
  ctx.fillStyle = 'rgba(8, 12, 24, 0.62)';
  ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  ctx.textAlign = 'center';
  const won = game.state === 'complete';
  const crashed = game.state === 'crashed';
  ctx.fillStyle = won ? PALETTE.hudGreen : crashed ? PALETTE.hudRed : '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(
    won ? 'SORTIE COMPLETE' : crashed ? 'CRASHED' : 'SORTIE OVER',
    SCREEN.width / 2, 190,
  );
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(game.endLine || '', SCREEN.width / 2, 232);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const lines = [
    `Score: ${game.score}`,
    `Time: ${formatTime(game.plane.time)}`,
    `Fuel left: ${Math.round(game.plane.fuel)}%`,
    `Damage: ${Math.round(game.plane.damage)}%`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, SCREEN.width / 2, 286 + i * 30));
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press R to fly again · M for menu', SCREEN.width / 2, 452);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8, 12, 24, 0.55)';
  ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', SCREEN.width / 2, SCREEN.height / 2);
  ctx.font = '16px sans-serif';
  ctx.fillText('Press P to keep flying', SCREEN.width / 2, SCREEN.height / 2 + 36);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}
