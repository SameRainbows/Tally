// Synthetic camera frames from the demo figure: the figure performs the
// movement, we turn its joints into MediaPipe-shaped landmarks.

import { solve, lerpPose, type Pose } from '../src/figure/skeleton';
import { poseAt } from '../src/figure/figure';
import { SEQUENCES } from '../src/figure/poses';
import { jointsToFrame } from '../src/figure/synthetic';
import type { ExerciseId, PoseFrame } from '../src/pose/types';

/** Frames of the figure performing `loops` full cycles at 30 fps. */
export function perform(ex: ExerciseId, loops: number, opts: { noise?: number; speed?: number; amplitude?: number } = {}) {
  const seq = SEQUENCES[ex];
  const total = seq.frames.reduce((s, f) => s + f.hold + f.move, 0);
  const speed = opts.speed ?? 1;
  const amp = opts.amplitude ?? 1;
  const out: PoseFrame[] = [];
  const dur = (total * loops) / speed;
  const rest = seq.frames[0].pose;
  // a short still lead-in, like a real person waiting at the top
  for (let t = 0; t < 600; t += 33.3) out.push(frameOf(rest, seq.view, t, opts.noise));
  for (let t = 0; t <= dur + 400; t += 33.3) {
    const p = poseAt(seq, Math.min(t, dur) * speed);
    const pose: Pose = amp === 1 ? p : lerpPose(rest, p, amp);
    out.push(frameOf(pose, seq.view, 600 + t, opts.noise));
  }
  return out;
}

export function hold(pose: Pose, view: 'side' | 'front', ms: number, noise = 0) {
  const out: PoseFrame[] = [];
  for (let t = 0; t <= ms; t += 33.3) out.push(frameOf(pose, view, t, noise));
  return out;
}

function frameOf(p: Pose, view: 'side' | 'front', t: number, noise = 0) {
  return jointsToFrame(solve(p, view, 100, 75), view, t, noise);
}
