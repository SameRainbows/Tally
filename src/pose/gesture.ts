// Both hands up, held: the hands-free start (and stop) signal.

import { LM, type PoseFrame } from './types';

export function handsUp(f: PoseFrame | null) {
  if (!f) return false;
  const v = (i: number) => (f.vis[i] ?? 0) >= 0.5;
  if (![LM.nose, LM.lWrist, LM.rWrist, LM.lElbow, LM.rElbow, LM.lShoulder, LM.rShoulder].every(v)) return false;
  const head = f.img[LM.nose].y;
  const shoulderSpan = Math.abs(f.img[LM.lShoulder].x - f.img[LM.rShoulder].x);
  const above = 0.04 + shoulderSpan * 0.15;
  return (
    f.img[LM.lWrist].y < head - above &&
    f.img[LM.rWrist].y < head - above &&
    f.img[LM.lElbow].y < f.img[LM.lShoulder].y &&
    f.img[LM.rElbow].y < f.img[LM.rShoulder].y
  );
}

/** Reports 0..1 progress while a condition holds, and fires once when it has held long enough. */
export class Hold {
  private since = -1;
  private fired = false;
  constructor(public ms: number) {}

  update(on: boolean, t: number): { progress: number; fire: boolean } {
    if (!on) {
      this.since = -1;
      this.fired = false;
      return { progress: 0, fire: false };
    }
    if (this.since < 0) this.since = t;
    const progress = Math.min(1, (t - this.since) / this.ms);
    if (progress >= 1 && !this.fired) {
      this.fired = true;
      return { progress, fire: true };
    }
    return { progress: this.fired ? 0 : progress, fire: false };
  }

  reset() {
    this.since = -1;
    this.fired = false;
  }
}
