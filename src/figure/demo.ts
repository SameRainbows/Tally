// Demo mode: the drawn figure stands in for a camera, so anyone can watch the
// real counter work without turning theirs on.

import type { ExerciseId, PoseFrame } from '../pose/types';
import { SEQUENCES } from './poses';
import { poseAt } from './figure';
import { solve, type Pose } from './skeleton';
import { jointsToFrame } from './synthetic';

const STAND: Pose = SEQUENCES.squats.frames[0].pose;

export class DemoSource {
  private timer = 0;
  private from = -1;
  private until = -1;

  constructor(private ex: ExerciseId, private onFrame: (f: PoseFrame) => void) {}

  start() {
    this.stop();
    this.timer = window.setInterval(() => this.tick(), 33);
  }

  /** Do a set: a number of reps (or a hold for timed movements), then stand still. */
  perform() {
    const seq = SEQUENCES[this.ex];
    const loop = seq.frames.reduce((a, f) => a + f.hold + f.move, 0);
    const loops = this.ex === 'plank' ? Math.ceil(16000 / loop) : Math.ceil(8 / Math.max(1, seq.rep.length));
    this.from = performance.now() + 300;
    this.until = this.from + loop * loops;
  }

  get moving() {
    const now = performance.now();
    return now >= this.from && now < this.until;
  }

  private tick() {
    const now = performance.now();
    const seq = SEQUENCES[this.ex];
    const rest = this.ex === 'plank' ? STAND : seq.frames[0].pose;
    const pose = this.moving ? poseAt(seq, now - this.from) : rest;
    const f = jointsToFrame(solve(pose, seq.view, 100, 75), seq.view, now, 0.35, 7);
    // leave a margin so the drawing never touches the frame edges
    f.img = f.img.map((p) => ({ x: 0.08 + p.x * 0.84, y: 0.14 + p.y * 0.8, z: p.z }));
    this.onFrame(f);
  }

  stop() {
    clearInterval(this.timer);
  }
}
