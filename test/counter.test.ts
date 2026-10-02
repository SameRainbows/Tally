import { describe, expect, it } from 'vitest';
import { EXERCISES, ORDER } from '../src/pose/exercises';
import { Counter } from '../src/pose/counter';
import { handsUp } from '../src/pose/gesture';
import { framing } from '../src/pose/framing';
import { SEQUENCES } from '../src/figure/poses';
import { perform, hold } from './synthetic';
import type { ExerciseId, PoseFrame } from '../src/pose/types';

function run(ex: ExerciseId, frames: PoseFrame[]) {
  const c = new Counter(EXERCISES[ex]);
  for (const f of frames) c.update(f);
  return c;
}

const repsPerLoop = (ex: ExerciseId) => SEQUENCES[ex].rep.length;

describe('counts the figure doing ten of each', () => {
  for (const ex of ORDER) {
    if (EXERCISES[ex].kind === 'hold') continue;
    it(ex, () => {
      const c = run(ex, perform(ex, 10));
      expect(c.count).toBe(10 * repsPerLoop(ex));
      expect(c.misses).toBe(0);
    });
  }
});

describe('still counts with landmark jitter', () => {
  for (const ex of ORDER) {
    if (EXERCISES[ex].kind === 'hold') continue;
    it(ex, () => {
      const c = run(ex, perform(ex, 8, { noise: 0.8 }));
      expect(c.count).toBe(8 * repsPerLoop(ex));
    });
  }
});

describe('does not count holding still at the start position', () => {
  for (const ex of ORDER) {
    if (EXERCISES[ex].kind === 'hold') continue;
    it(ex, () => {
      const seq = SEQUENCES[ex];
      const c = run(ex, hold(seq.frames[0].pose, seq.view, 8000, 0.8));
      expect(c.count).toBe(0);
    });
  }
});

describe('half reps', () => {
  it('a quarter squat is not a squat', () => {
    const c = run('squats', perform('squats', 2, { amplitude: 0.3 }));
    expect(c.count).toBe(0);
  });

  it('a half squat is a miss, and says so', () => {
    const c = run('squats', perform('squats', 2, { amplitude: 0.55 }));
    expect(c.count).toBe(0);
    expect(c.misses).toBe(2);
    expect(c.view.cue === null || typeof c.view.cue === 'string').toBe(true);
  });

  it('adapts after three consistent shallow reps, then counts them', () => {
    const c = run('squats', perform('squats', 8, { amplitude: 0.5 }));
    expect(c.misses).toBe(3);
    expect(c.count).toBe(5);
  });
});

describe('plank', () => {
  it('times a held plank', () => {
    const seq = SEQUENCES.plank;
    const c = run('plank', hold(seq.frames[0].pose, 'side', 12000, 0.5));
    expect(c.holdMs).toBeGreaterThan(11500);
    expect(c.holdMs).toBeLessThan(12100);
    expect(c.count).toBe(2);
  });

  it('does not time standing', () => {
    const seq = SEQUENCES.squats;
    const c = run('plank', hold(seq.frames[0].pose, 'side', 6000));
    expect(c.holdMs).toBe(0);
    expect(c.view.gate).toBeTruthy();
  });

  it('flags sagging hips', () => {
    const sag = { ...SEQUENCES.plank.frames[0].pose, torso: 68, th: [-102, -102] as [number, number], sh: [-102, -102] as [number, number] };
    const c = run('plank', hold(sag, 'side', 2000));
    expect(c.view.cue).toMatch(/hips/i);
  });
});

describe('push-ups only count when horizontal', () => {
  it('arm curls standing up are not push-ups', () => {
    const frames = hold(SEQUENCES.squats.frames[0].pose, 'side', 3000);
    const c = run('push_ups', frames);
    expect(c.count).toBe(0);
    expect(c.view.gate).toMatch(/push-up/i);
  });
});

describe('gesture and framing', () => {
  it('sees both hands up in an open jumping jack', () => {
    const open = perform('jumping_jacks', 1).find((f) => handsUp(f));
    expect(open).toBeTruthy();
  });

  it('does not see hands up when standing', () => {
    const f = hold(SEQUENCES.squats.frames[0].pose, 'side', 100)[0];
    expect(handsUp(f)).toBe(false);
  });

  it('asks you to step back when feet are out of frame', () => {
    const f = hold(SEQUENCES.squats.frames[0].pose, 'side', 100)[0];
    for (const i of [27, 28, 29, 30, 31, 32]) f.img[i] = { ...f.img[i], y: 1.2 };
    expect(framing(f, EXERCISES.squats).hint).toMatch(/feet/);
  });
});
