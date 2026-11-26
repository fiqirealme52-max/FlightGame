// NUSA SKY RUN — audio.js
// One job: sound with no audio files. A WebAudio engine hum, a ring chime and
// a touchdown thud, all synthesized, all gated behind the first user gesture.

export function makeAudio() {
  const state = { ctx: null, engine: null, engineGain: null, muted: false, started: false };
  return state;
}

export function ensureAudio(state) {
  if (state.started || state.muted) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    state.ctx = ctx;
    state.engine = osc;
    state.engineGain = gain;
    state.started = true;
  } catch (e) {
    state.started = false;
  }
}

export function setEngine(state, throttle, speedKt, airborne) {
  if (!state.started || state.muted || !state.engine) return;
  try {
    const rpm = 52 + throttle * 46 + speedKt * 0.12;
    state.engine.frequency.setTargetAtTime(rpm, state.ctx.currentTime, 0.08);
    const vol = airborne ? 0.028 + throttle * 0.03 : 0.012 + throttle * 0.02;
    state.engineGain.gain.setTargetAtTime(vol, state.ctx.currentTime, 0.1);
  } catch (e) {
    /* audio is garnish; never break the game */
  }
}

function blip(state, freq, when, dur, vol) {
  if (!state.started || state.muted) return;
  try {
    const osc = state.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = state.ctx.createGain();
    gain.gain.setValueAtTime(0, state.ctx.currentTime + when);
    gain.gain.linearRampToValueAtTime(vol, state.ctx.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.ctx.currentTime + when + dur);
    osc.connect(gain);
    gain.connect(state.ctx.destination);
    osc.start(state.ctx.currentTime + when);
    osc.stop(state.ctx.currentTime + when + dur + 0.05);
  } catch (e) {
    /* ignore */
  }
}

export function playChime(state) {
  blip(state, 880, 0, 0.35, 0.12);
  blip(state, 1318, 0.09, 0.45, 0.1);
}

export function playThud(state) {
  if (!state.started || state.muted) return;
  try {
    const osc = state.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, state.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, state.ctx.currentTime + 0.22);
    const gain = state.ctx.createGain();
    gain.gain.setValueAtTime(0.22, state.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(state.ctx.destination);
    osc.start();
    osc.stop(state.ctx.currentTime + 0.32);
  } catch (e) {
    /* ignore */
  }
}

export function toggleMute(state) {
  state.muted = !state.muted;
  if (state.engineGain) {
    try {
      state.engineGain.gain.setTargetAtTime(0, state.ctx.currentTime, 0.05);
    } catch (e) {
      /* ignore */
    }
  }
  return state.muted;
}
