// Turns one number per frame into reps.
//
// Depth is the reading mapped onto the exercise's range: 0 at the top, 1 at
// full depth. A rep is an excursion that passes ENTER and returns below EXIT.
// The range learns from your own reps, within limits, so the count adapts to
// your body and camera angle without a calibration step.

import type { ExerciseDef } from './exercises';
import type { PoseFrame, Reading, RepMark } from './types';
import { clamp } from './geometry';

export const ENTER = 0.65;
export const MOVE = 0.32;
export const EXIT = 0.24;
const MISS = 0.42;
const LOST_MS = 1200;
export const HOLD_MARK_MS = 5000;

export type CounterEvent =
  | { type: 'rep'; count: number; mark: RepMark }
  | { type: 'miss'; reason: 'shallow' | 'fast'; depth: number }
  | { type: 'adjust' };

type Track = { phase: 'top' | 'down'; peak: number; peakRaw: number; t0: number };

export type CounterView = {
  count: number;
  /** live depth of the deepest reading, 0..1+ */
  depth: number;
  /** the reading used for the dial */
  reading: Reading | null;
  /** body in the wrong position for this exercise */
  gate: string | null;
  /** a short line for the person: form note or why the last rep didn't count */
  cue: string | null;
  cueIsFix: boolean;
  /** hold exercises */
  holdMs: number;
  holding: boolean;
};

export class Counter {
  readonly def: ExerciseDef;
  count = 0;
  marks: RepMark[] = [];
  misses = 0;
  holdMs = 0;

  private start: number;
  private end: number;
  private tracks = new Map<number, Track>();
  private t0 = -1;
  private lastT = -1;
  private lastSeen = -1;
  private lastRepT = -Infinity;
  private shallowRun: number[] = [];
  private note: { text: string; until: number; fix: boolean } | null = null;
  private holdingSince = -1;
  private brokenSince = -1;

  view: CounterView = { count: 0, depth: 0, reading: null, gate: null, cue: null, cueIsFix: false, holdMs: 0, holding: false };

  constructor(def: ExerciseDef) {
    this.def = def;
    this.start = def.start;
    this.end = def.end;
  }

  /** Where the counter currently thinks the movement starts and ends. */
  get range() {
    return { start: this.start, end: this.end };
  }

  depthOf(raw: number) {
    return (raw - this.start) / (this.end - this.start || 1);
  }

  update(f: PoseFrame | null, t = f?.t ?? performance.now()): CounterEvent[] {
    if (this.t0 < 0) this.t0 = t;
    const dt = this.lastT < 0 ? 0 : Math.min(250, t - this.lastT);
    this.lastT = t;
    const events: CounterEvent[] = [];

    const m = f ? this.def.measure(f) : null;
    const gate = m && 'gate' in m ? m.gate : null;
    const readings: Reading[] = !m || gate ? [] : Array.isArray(m) ? m : [m as Reading];

    if (readings.length) this.lastSeen = t;
    else if (t - this.lastSeen > LOST_MS) {
      // lost you mid-rep: drop it rather than guess
      for (const tr of this.tracks.values()) tr.phase = 'top';
    }

    if (this.def.kind === 'hold') {
      this.updateHold(readings[0] ?? null, t, dt, events);
    } else {
      readings.forEach((r, i) => this.updateTrack(i, r, t, events));
    }

    // what to show
    const deepest = readings.reduce<Reading | null>((a, b) => (!a || this.depthOf(b.raw) > this.depthOf(a.raw) ? b : a), null);
    const depth = deepest ? this.depthOf(deepest.raw) : 0;
    let cue: string | null = null;
    let fix = false;
    if (this.note && t < this.note.until) {
      cue = this.note.text;
      fix = this.note.fix;
    } else if (deepest?.cue && (this.def.kind === 'hold' || depth > MOVE)) {
      cue = deepest.cue;
      fix = true;
    }
    this.view = {
      count: this.count,
      depth,
      reading: deepest,
      gate,
      cue,
      cueIsFix: fix,
      holdMs: this.holdMs,
      holding: this.holdingSince >= 0,
    };
    return events;
  }

  private updateTrack(i: number, r: Reading, t: number, events: CounterEvent[]) {
    let tr = this.tracks.get(i);
    if (!tr) {
      tr = { phase: 'top', peak: 0, peakRaw: r.raw, t0: t };
      this.tracks.set(i, tr);
    }
    const d = this.depthOf(r.raw);

    if (tr.phase === 'top') {
      // settle the top of the range toward where you actually stand
      if (d < 0.2) this.learnStart(r.raw);
      if (d > MOVE) {
        tr.phase = 'down';
        tr.peak = d;
        tr.peakRaw = r.raw;
        tr.t0 = t;
      }
      return;
    }

    if (d > tr.peak) {
      tr.peak = d;
      tr.peakRaw = r.raw;
    }
    if (d >= EXIT) return;

    // back at the top: was that a rep?
    tr.phase = 'top';
    const tempo = t - tr.t0;
    const gap = t - this.lastRepT;
    if (tr.peak >= ENTER) {
      if (tempo < this.def.minRepMs * 0.5) return; // a flicker, not a movement
      if (tempo < this.def.minRepMs || gap < this.def.minRepMs * 0.7) {
        this.misses++;
        this.say('Slow down a touch', t, true);
        events.push({ type: 'miss', reason: 'fast', depth: tr.peak });
        return;
      }
      this.count++;
      this.lastRepT = t;
      this.shallowRun = [];
      const mark: RepMark = { t: Math.round(t - this.t0), depth: Math.round(tr.peak * 100) / 100, tempo: Math.round(tempo) };
      this.marks.push(mark);
      this.learnEnd(tr.peakRaw);
      events.push({ type: 'rep', count: this.count, mark });
    } else if (tr.peak >= MISS && tempo >= this.def.minRepMs * 0.6) {
      this.misses++;
      this.shallowRun.push(tr.peak);
      events.push({ type: 'miss', reason: 'shallow', depth: tr.peak });
      if (this.adaptToShallow()) {
        this.say('Adjusted to your range', t, false);
        events.push({ type: 'adjust' });
      } else {
        this.say(this.def.shallow, t, true);
      }
    }
  }

  private updateHold(r: Reading | null, t: number, dt: number, events: CounterEvent[]) {
    const ok = !!r && r.raw >= this.def.end;
    if (ok) {
      this.brokenSince = -1;
      if (this.holdingSince < 0) this.holdingSince = t;
      const before = Math.floor(this.holdMs / HOLD_MARK_MS);
      this.holdMs += dt;
      const after = Math.floor(this.holdMs / HOLD_MARK_MS);
      if (after > before) {
        this.count = after;
        const mark: RepMark = { t: Math.round(t - this.t0), depth: 1, tempo: HOLD_MARK_MS };
        this.marks.push(mark);
        events.push({ type: 'rep', count: after, mark });
      }
    } else if (this.holdingSince >= 0) {
      // a short wobble doesn't stop the clock
      if (this.brokenSince < 0) this.brokenSince = t;
      if (t - this.brokenSince < 500) this.holdMs += dt;
      else this.holdingSince = -1;
    }
  }

  private say(text: string, t: number, fix: boolean) {
    this.note = { text, until: t + 2200, fix };
  }

  private span0() {
    return this.def.end - this.def.start;
  }

  /** Move the bottom of the range toward your real depth: easier down to 75%, never stricter than the default. */
  private learnEnd(peakRaw: number) {
    const s0 = this.span0();
    const next = this.end + 0.25 * (peakRaw - this.end);
    const span = clamp((next - this.start) / s0, 0.75, 1);
    this.end = this.start + span * s0;
  }

  private learnStart(raw: number) {
    const s0 = this.span0();
    const next = this.start + 0.02 * (raw - this.start);
    const lo = this.def.start - 0.2 * Math.abs(s0);
    const hi = this.def.start + 0.2 * Math.abs(s0);
    this.start = clamp(next, lo, hi);
  }

  /**
   * Three shallow attempts in a row at about the same depth usually means the
   * camera angle is hiding depth, not that you're cheating. Meet them partway.
   */
  private adaptToShallow() {
    if (this.shallowRun.length < 3) return false;
    const last = this.shallowRun.slice(-3);
    const avg = last.reduce((a, b) => a + b, 0) / 3;
    if (Math.max(...last) - Math.min(...last) > 0.15) return false;
    const s0 = this.span0();
    const curSpan = (this.end - this.start) / s0;
    const want = (avg * curSpan) / (ENTER + 0.06);
    const span = Math.max(0.7, want);
    if (span >= curSpan - 0.01) return false;
    this.end = this.start + span * s0;
    this.shallowRun = [];
    return true;
  }

  summary() {
    const n = this.marks.length;
    const avgDepth = n ? this.marks.reduce((a, m) => a + Math.min(1, m.depth), 0) / n : 0;
    const avgTempo = n ? this.marks.reduce((a, m) => a + m.tempo, 0) / n : 0;
    return { count: this.count, holdMs: this.holdMs, misses: this.misses, avgDepth, avgTempo, marks: this.marks };
  }
}
