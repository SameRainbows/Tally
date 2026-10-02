// Keyframes for every movement. The demo figure plays these, and the tests
// turn them into synthetic camera frames to check the counting.

import type { Pose, View } from './skeleton';
import type { ExerciseId } from '../pose/types';

export type Frame = { pose: Pose; hold: number; move: number };
export type Sequence = {
  view: View;
  frames: Frame[];
  /** arriving at these frame indices completes a rep */
  rep: number[];
};

const stand: Pose = { torso: 2, ua: [-4, 4], fa: [2, 8], th: [-2, 2], sh: [-1, 1] };

const squatLow: Pose = { torso: 38, ua: [80, 86], fa: [84, 90], th: [86, 90], sh: [-22, -18], foot: [88, 88] };

const pushTop: Pose = { torso: 74, head: 6, ua: [-18, -21], fa: [-18, -21], th: [-74, -74], sh: [-74, -74], foot: [10, 10] };
const pushLow: Pose = { torso: 82.5, head: 4, ua: [-77, -80], fa: [8, 5], th: [-82.5, -82.5], sh: [-82.5, -82.5], foot: [10, 10] };

export const SEQUENCES: Record<ExerciseId, Sequence> = {
  squats: {
    view: 'side',
    frames: [
      { pose: stand, hold: 260, move: 720 },
      { pose: squatLow, hold: 120, move: 620 },
    ],
    rep: [0],
  },

  push_ups: {
    view: 'side',
    frames: [
      { pose: pushTop, hold: 260, move: 700 },
      { pose: pushLow, hold: 100, move: 560 },
    ],
    rep: [0],
  },

  jumping_jacks: {
    view: 'front',
    frames: [
      { pose: { torso: 0, ua: [-7, 7], fa: [-4, 4], th: [-4, 4], sh: [0, 0] }, hold: 60, move: 150 },
      { pose: { torso: 0, ua: [-80, 80], fa: [-95, 95], th: [-13, 13], sh: [-11, 11], lift: 8 }, hold: 0, move: 150 },
      { pose: { torso: 0, ua: [-152, 152], fa: [-166, 166], th: [-21, 21], sh: [-19, 19] }, hold: 60, move: 150 },
      { pose: { torso: 0, ua: [-80, 80], fa: [-95, 95], th: [-13, 13], sh: [-11, 11], lift: 8 }, hold: 0, move: 150 },
    ],
    rep: [0],
  },

  lunges: {
    view: 'side',
    frames: [
      { pose: stand, hold: 260, move: 760 },
      { pose: { torso: 4, ua: [-6, 4], fa: [0, 6], th: [-15, 80], sh: [-95, -5], foot: [50, 88] }, hold: 160, move: 660 },
    ],
    rep: [0],
  },

  high_knees: {
    view: 'side',
    frames: [
      { pose: { torso: 5, ua: [50, -35], fa: [120, 10], th: [0, 95], sh: [0, -5], foot: [80, 60], lift: 3 }, hold: 40, move: 260 },
      { pose: { torso: 5, ua: [-35, 50], fa: [10, 120], th: [95, 0], sh: [-5, 0], foot: [60, 80], lift: 3 }, hold: 40, move: 260 },
    ],
    rep: [0, 1],
  },

  sit_ups: {
    view: 'side',
    frames: [
      { pose: { torso: -80, ua: [100, 100], fa: [100, 100], th: [135, 135], sh: [42, 42], foot: [88, 88] }, hold: 300, move: 820 },
      { pose: { torso: 20, ua: [75, 72], fa: [75, 72], th: [135, 135], sh: [42, 42], foot: [88, 88] }, hold: 150, move: 720 },
    ],
    rep: [0],
  },

  burpees: {
    view: 'side',
    frames: [
      { pose: stand, hold: 160, move: 480 },
      { pose: { torso: 60, ua: [10, 12], fa: [0, 2], th: [100, 100], sh: [-30, -30], foot: [88, 88] }, hold: 40, move: 340 },
      { pose: { ...pushTop, x: 13.7 }, hold: 220, move: 340 },
      { pose: { torso: 60, ua: [10, 12], fa: [0, 2], th: [100, 100], sh: [-30, -30], foot: [88, 88] }, hold: 40, move: 440 },
      { pose: stand, hold: 40, move: 240 },
      { pose: { torso: 0, ua: [165, 168], fa: [172, 175], th: [-3, 3], sh: [8, 10], foot: [30, 30], lift: 12 }, hold: 40, move: 300 },
    ],
    rep: [0],
  },

  jump_squats: {
    view: 'side',
    frames: [
      { pose: stand, hold: 160, move: 520 },
      { pose: { torso: 32, ua: [-40, -36], fa: [-30, -26], th: [74, 78], sh: [-20, -16], foot: [88, 88] }, hold: 60, move: 260 },
      { pose: { torso: 0, ua: [160, 164], fa: [168, 172], th: [-3, 3], sh: [6, 8], foot: [30, 30], lift: 14 }, hold: 40, move: 300 },
    ],
    rep: [0],
  },

  plank: {
    view: 'side',
    frames: [
      { pose: { torso: 83.8, head: 4, ua: [2, 0], fa: [90, 90], th: [-83.8, -83.8], sh: [-83.8, -83.8], foot: [10, 10] }, hold: 900, move: 1400 },
      { pose: { torso: 83.2, head: 6, ua: [2, 0], fa: [90, 90], th: [-84.2, -84.2], sh: [-84.2, -84.2], foot: [10, 10] }, hold: 900, move: 1400 },
    ],
    rep: [],
  },
};

/** The pose shown when motion is off: the most telling frame. */
export const KEY_FRAME: Record<ExerciseId, number> = {
  squats: 1, push_ups: 1, jumping_jacks: 2, lunges: 1, high_knees: 0,
  sit_ups: 1, burpees: 2, jump_squats: 2, plank: 0,
};
