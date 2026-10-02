// Every movement Tally counts. Each one says what it needs to see and how to
// read a single number off your body; the counter does the rest.

import { LM, type ExerciseId, type Measure, type PoseFrame, type Reading } from './types';
import { angle, belowLine, clamp, dist, fromVertical, mid } from './geometry';

export type Part = 'head' | 'shoulders' | 'elbows' | 'wrists' | 'hips' | 'knees' | 'ankles';

export type ExerciseDef = {
  id: ExerciseId;
  name: string;
  one: string;
  many: string;
  kind: 'reps' | 'hold';
  /** where the camera should be */
  view: 'front' | 'side' | 'either';
  line: string;
  setup: string;
  /** how it counts, in plain words (About page) */
  counts: string;
  needs: Part[];
  /** raw value at the top of the movement, and at full depth */
  start: number;
  end: number;
  /** a rep shorter than this is a bounce, not a rep */
  minRepMs: number;
  /** what to say when a rep doesn't go far enough */
  shallow: string;
  /** on the floor: give more time to get down after starting */
  floor?: boolean;
  /** arms go overhead during the movement, so hands-up can't end the set */
  armsUp?: boolean;
  /** what the raw number is, for the dial label */
  unit?: '°' | '%';
  measure(f: PoseFrame): Measure;
};

type Triple = [number, number, number];
type Pair = { l: Triple; r: Triple };

const LEG: Pair = { l: [LM.lHip, LM.lKnee, LM.lAnkle], r: [LM.rHip, LM.rKnee, LM.rAnkle] };
const ARM: Pair = { l: [LM.lShoulder, LM.lElbow, LM.lWrist], r: [LM.rShoulder, LM.rElbow, LM.rWrist] };
const HIP: Pair = { l: [LM.lShoulder, LM.lHip, LM.lKnee], r: [LM.rShoulder, LM.rHip, LM.rKnee] };
const LINE: Pair = { l: [LM.lShoulder, LM.lHip, LM.lAnkle], r: [LM.rShoulder, LM.rHip, LM.rAnkle] };
const ABD: Pair = { l: [LM.lHip, LM.lShoulder, LM.lElbow], r: [LM.rHip, LM.rShoulder, LM.rElbow] };

const vis = (f: PoseFrame, idx: number[]) => Math.min(...idx.map((i) => f.vis[i] ?? 0));
const ang = (f: PoseFrame, t: Triple) => angle(f.world[t[0]], f.world[t[1]], f.world[t[2]]);

/** The side the camera sees best, if it sees it well enough. */
function best(f: PoseFrame, p: Pair, min = 0.5): Triple | null {
  const l = vis(f, p.l);
  const r = vis(f, p.r);
  if (Math.max(l, r) < min) return null;
  return l >= r ? p.l : p.r;
}

/** Both sides averaged when both are clear (facing the camera), else the clearer one. */
function joint(f: PoseFrame, p: Pair, min = 0.5): Reading | null {
  if (vis(f, p.l) >= 0.65 && vis(f, p.r) >= 0.65) {
    const l = ang(f, p.l);
    const r = ang(f, p.r);
    return { raw: (l + r) / 2, arc: l <= r ? p.l : p.r };
  }
  const t = best(f, p, min);
  return t ? { raw: ang(f, t), arc: t } : null;
}

/** The more bent of the visible sides. */
function bentMost(f: PoseFrame, p: Pair, min = 0.5): Reading | null {
  const out: Reading[] = [];
  if (vis(f, p.l) >= min) out.push({ raw: ang(f, p.l), arc: p.l });
  if (vis(f, p.r) >= min) out.push({ raw: ang(f, p.r), arc: p.r });
  if (!out.length) return null;
  return out.reduce((a, b) => (a.raw <= b.raw ? a : b));
}

const shoulders = (f: PoseFrame) => mid(f.world[LM.lShoulder], f.world[LM.rShoulder]);
const hips = (f: PoseFrame) => mid(f.world[LM.lHip], f.world[LM.rHip]);
const torsoTilt = (f: PoseFrame) => fromVertical(hips(f), shoulders(f));
const torsoSeen = (f: PoseFrame) =>
  Math.max(f.vis[LM.lShoulder], f.vis[LM.rShoulder]) >= 0.5 && Math.max(f.vis[LM.lHip], f.vis[LM.rHip]) >= 0.5;

/** Hips sagging or piking, given the shoulder–hip–ankle line. */
function hipCue(f: PoseFrame, t: Triple, straight: number) {
  if (straight >= 160) return null;
  const below = belowLine(f.world[t[1]], f.world[t[0]], f.world[t[2]]);
  return below > 0 ? 'Hips are dropping — squeeze and lift' : 'Hips are high — lower them in line';
}

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  squats: {
    id: 'squats', name: 'Squats', one: 'squat', many: 'squats', kind: 'reps', view: 'either',
    line: 'Sit back and down, then stand tall.',
    setup: 'Phone at hip height, 2–3 m away. Side-on is most accurate.',
    counts: 'Reads the angle at your knee. A rep counts when it bends past about 120° and you stand back up.',
    needs: ['hips', 'knees', 'ankles'],
    start: 170, end: 90, minRepMs: 550,
    shallow: 'Go a little deeper',
    measure(f) {
      const r = joint(f, LEG);
      if (!r) return null;
      if (r.raw < 135 && torsoSeen(f) && torsoTilt(f) > 55) r.cue = 'Chest up';
      else if (r.raw < 140 && vis(f, [LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle]) > 0.7) {
        const knees = dist(f.world[LM.lKnee], f.world[LM.rKnee]);
        const ankles = dist(f.world[LM.lAnkle], f.world[LM.rAnkle]);
        if (knees < ankles * 0.72) r.cue = 'Push your knees out';
      }
      return r;
    },
  },

  push_ups: {
    id: 'push_ups', name: 'Push-ups', one: 'push-up', many: 'push-ups', kind: 'reps', view: 'side', floor: true,
    line: 'Chest to the floor and back, body straight.',
    setup: 'Phone on the floor, side-on, 2 m away. Your whole body in frame.',
    counts: 'Reads the angle at your elbow while your body is horizontal. A rep counts when it bends past about 115° and straightens again.',
    needs: ['shoulders', 'elbows', 'wrists', 'hips'],
    start: 160, end: 90, minRepMs: 500,
    shallow: 'Lower your chest a bit more',
    measure(f) {
      if (!torsoSeen(f)) return null;
      if (torsoTilt(f) < 45) return { gate: 'Get down into a push-up, side-on to the camera' };
      const t = best(f, ARM, 0.45);
      if (!t) return null;
      const r: Reading = { raw: ang(f, t), arc: t };
      const line = best(f, LINE, 0.45);
      if (line) r.cue = hipCue(f, line, ang(f, line));
      return r;
    },
  },

  jumping_jacks: {
    id: 'jumping_jacks', name: 'Jumping jacks', one: 'jumping jack', many: 'jumping jacks', kind: 'reps', view: 'front', armsUp: true, unit: '%',
    line: 'Jump wide with hands overhead, then back.',
    setup: 'Face the camera, 2.5–3 m away, hands and feet in frame.',
    counts: 'Reads how high your arms go and how wide your feet are. A rep counts when both open up — arms near overhead, feet past hip width — and close again.',
    needs: ['shoulders', 'elbows', 'hips', 'ankles'],
    start: 0, end: 100, minRepMs: 280,
    shallow: 'Hands all the way up, feet wide',
    measure(f) {
      if (vis(f, [...ABD.l, ...ABD.r, LM.lAnkle, LM.rAnkle]) < 0.45) return null;
      const arms = Math.min(ang(f, ABD.l), ang(f, ABD.r));
      const hipW = Math.max(dist(f.world[LM.lHip], f.world[LM.rHip]), 0.05);
      const spread = dist(f.world[LM.lAnkle], f.world[LM.rAnkle]) / hipW;
      const a = clamp((arms - 25) / (150 - 25), 0, 1.2);
      const l = clamp((spread - 1.3) / (2.7 - 1.3), 0, 1.2);
      const r: Reading = { raw: Math.min(a, l) * 100, arc: ABD.r };
      if (a > 0.75 && l < 0.45) r.cue = 'Jump your feet wider';
      else if (l > 0.75 && a < 0.45) r.cue = 'Hands all the way up';
      return r;
    },
  },

  lunges: {
    id: 'lunges', name: 'Lunges', one: 'lunge', many: 'lunges', kind: 'reps', view: 'side',
    line: 'Step, drop the back knee, push back up.',
    setup: 'Side-on, 2.5–3 m away, hips to feet in frame.',
    counts: 'Reads the angle at whichever knee bends most. A rep counts when it passes about 120° and you come back up.',
    needs: ['hips', 'knees', 'ankles'],
    start: 170, end: 95, minRepMs: 550,
    shallow: 'Drop the back knee lower',
    measure(f) {
      const r = bentMost(f, LEG);
      if (!r) return null;
      if (r.raw < 135 && torsoSeen(f) && torsoTilt(f) > 35) r.cue = 'Keep your chest tall';
      return r;
    },
  },

  high_knees: {
    id: 'high_knees', name: 'High knees', one: 'knee', many: 'knees', kind: 'reps', view: 'either',
    line: 'Run in place, knees up to hip height.',
    setup: 'Side-on or facing, 2.5–3 m away, whole body in frame.',
    counts: 'Reads the angle at each hip separately. Every knee that comes up past about 125° is one.',
    needs: ['shoulders', 'hips', 'knees'],
    start: 170, end: 100, minRepMs: 140,
    shallow: 'Knees up to hip height',
    measure(f) {
      const out: Reading[] = [];
      for (const t of [HIP.l, HIP.r]) if (vis(f, t) >= 0.35) out.push({ raw: ang(f, t), arc: t });
      return out.length ? out : null;
    },
  },

  sit_ups: {
    id: 'sit_ups', name: 'Sit-ups', one: 'sit-up', many: 'sit-ups', kind: 'reps', view: 'side', floor: true,
    line: 'Knees bent, curl up, lower with control.',
    setup: 'Phone on the floor, side-on, 2 m away.',
    counts: 'Reads the angle at your hip between your back and thigh. A rep counts when you curl up past about 80° and lie back down.',
    needs: ['shoulders', 'hips', 'knees'],
    start: 128, end: 55, minRepMs: 600,
    shallow: 'Sit up a little higher',
    measure(f) {
      const t = best(f, HIP, 0.45);
      return t ? { raw: ang(f, t), arc: t } : null;
    },
  },

  burpees: {
    id: 'burpees', name: 'Burpees', one: 'burpee', many: 'burpees', kind: 'reps', view: 'side', armsUp: true,
    line: 'Down, kick back, chest in, up and jump.',
    setup: 'Side-on, 3 m away. Leave room to kick back.',
    counts: 'Reads how far your back tips from upright. A rep counts when you go from standing to the floor and back to standing.',
    needs: ['shoulders', 'hips', 'knees'],
    start: 15, end: 72, minRepMs: 1000,
    shallow: 'All the way down to the floor',
    measure(f) {
      if (!torsoSeen(f)) return null;
      return { raw: torsoTilt(f) };
    },
  },

  jump_squats: {
    id: 'jump_squats', name: 'Jump squats', one: 'jump squat', many: 'jump squats', kind: 'reps', view: 'either', armsUp: true,
    line: 'Squat, then jump. Land soft.',
    setup: 'Phone at hip height, 3 m away. Room overhead.',
    counts: 'Reads the angle at your knee like a squat, a little shallower. A rep counts when you bend past about 125° and rise again.',
    needs: ['hips', 'knees', 'ankles'],
    start: 170, end: 100, minRepMs: 420,
    shallow: 'Sink a little lower before you jump',
    measure(f) {
      return joint(f, LEG);
    },
  },

  plank: {
    id: 'plank', name: 'Plank', one: 'second', many: 'seconds', kind: 'hold', view: 'side', floor: true,
    line: 'Hold a straight line from shoulders to heels.',
    setup: 'Phone on the floor, side-on, 2 m away.',
    counts: 'Times how long your shoulders, hips and ankles stay in a straight line while horizontal. One mark for every five seconds.',
    needs: ['shoulders', 'hips', 'ankles'],
    start: 180, end: 150, minRepMs: 0,
    shallow: 'Straighten up',
    measure(f) {
      if (!torsoSeen(f)) return null;
      if (torsoTilt(f) < 55) return { gate: 'Get down into a plank, side-on to the camera' };
      const t = best(f, LINE, 0.4);
      if (!t) return null;
      const raw = ang(f, t);
      return { raw, arc: t, cue: hipCue(f, t, raw) };
    },
  },
};

export const ORDER: ExerciseId[] = [
  'squats', 'push_ups', 'jumping_jacks', 'lunges', 'plank', 'sit_ups', 'high_knees', 'burpees', 'jump_squats',
];

export const isExercise = (id: string): id is ExerciseId => id in EXERCISES;
