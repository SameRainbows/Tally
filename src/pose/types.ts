export type ExerciseId =
  | 'squats'
  | 'push_ups'
  | 'jumping_jacks'
  | 'lunges'
  | 'high_knees'
  | 'sit_ups'
  | 'burpees'
  | 'jump_squats'
  | 'plank';

export type V3 = { x: number; y: number; z: number };

/** One filtered camera frame, already reduced to what the detectors need. */
export type PoseFrame = {
  /** ms */
  t: number;
  /** normalised image coordinates, 0..1, y down */
  img: V3[];
  /** metres, hip-centred, y down — the same in any part of the frame */
  world: V3[];
  /** 0..1 per landmark */
  vis: number[];
};

/** What an exercise reads off a frame. */
export type Reading = {
  /** the measured quantity, e.g. a knee angle in degrees */
  raw: number;
  /** the landmark triple the value was measured on, for drawing the dial */
  arc?: [number, number, number];
  /** a form note while moving (shown in red) */
  cue?: string | null;
};

/** If `gate` is set the body isn't in the right position to count at all. */
export type Measure = Reading | Reading[] | { gate: string } | null;

export type RepMark = {
  /** ms since the set started */
  t: number;
  /** how far through the range the rep went, 0..1 (can exceed 1) */
  depth: number;
  /** ms from leaving the top to coming back */
  tempo: number;
};

export const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30,
  lToe: 31, rToe: 32,
} as const;
