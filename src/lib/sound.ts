// All sound is synthesised: a pencil tick per rep, a lower one on every fifth,
// countdown pips. No audio files.

import { getSettings } from './store';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Call from a user gesture so the browser lets us play later. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
}

function tone(freq: number, dur: number, gain = 0.12, type: OscillatorType = 'sine', at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function scratch(dur: number, freq: number, gain: number) {
  if (!ctx || !noise) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t);
  bp.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

const on = () => getSettings().sound && ctx;

export const sound = {
  rep(n: number) {
    if (!on()) return;
    const strike = n % 5 === 0;
    scratch(strike ? 0.16 : 0.07, strike ? 2600 : 3800, strike ? 0.5 : 0.35);
    tone(strike ? 523 : 784, strike ? 0.28 : 0.12, strike ? 0.13 : 0.08, 'triangle');
  },
  miss() {
    if (!on()) return;
    tone(196, 0.18, 0.08, 'sine');
  },
  pip(last = false) {
    if (!on()) return;
    tone(last ? 880 : 587, last ? 0.35 : 0.12, 0.12, 'triangle');
  },
  armed() {
    if (!on()) return;
    tone(659, 0.08, 0.06, 'triangle');
  },
  done() {
    if (!on()) return;
    tone(659, 0.2, 0.1, 'triangle');
    tone(988, 0.45, 0.1, 'triangle', 0.14);
  },
};

let lastSpoken = 0;
export function say(text: string, force = false) {
  if (!getSettings().voice || !('speechSynthesis' in window)) return;
  const now = performance.now();
  if (!force && now - lastSpoken < 250) return;
  lastSpoken = now;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.15;
  if (force) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
