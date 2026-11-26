// Langit Kilat: tiny WebAudio synth for the engine hum, ring chimes, wind,
// landing thud and crash. No audio files, everything is an oscillator or
// filtered noise made at run time. The AudioContext is created on the first
// user gesture, never before, and every sound is a no-op while muted.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, seconds, type, volume, when = 0) {
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noiseBurst(seconds, volume, filterFrequency) {
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any user gesture: creates the context and resumes it. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
    },
    /** The engine hum follows throttle: faster and louder at full throttle. */
    engine(throttle, boosting, running) {
      if (!ctx || muted || !engineGain) return;
      const target = running ? 0.05 + (throttle / 100) * 0.09 + (boosting ? 0.05 : 0) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(62 + throttle * 0.9 + (boosting ? 45 : 0), ctx.currentTime, 0.1);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.25);
      tone(1318, 0.5, 'sine', 0.2, 0.08);
    },
    fuelRing() {
      tone(659, 0.3, 'sine', 0.25);
      tone(988, 0.45, 'sine', 0.22, 0.08);
    },
    land() {
      tone(98, 0.4, 'sine', 0.4);
      noiseBurst(0.25, 0.2, 500);
    },
    crash() {
      noiseBurst(0.7, 0.5, 900);
      tone(55, 0.6, 'sawtooth', 0.3);
    },
    level() {
      tone(523, 0.18, 'triangle', 0.22);
      tone(659, 0.18, 'triangle', 0.22, 0.12);
      tone(784, 0.35, 'triangle', 0.24, 0.24);
    },
    warn() {
      tone(440, 0.25, 'square', 0.12);
      tone(440, 0.25, 'square', 0.12, 0.3);
    },
  };
}
