// One Euro filter (Casiez et al. 2012): smooths jitter when you're still and
// keeps up when you move fast. One per coordinate.

class LowPass {
  y = 0;
  init = false;
  step(x: number, a: number) {
    this.y = this.init ? a * x + (1 - a) * this.y : x;
    this.init = true;
    return this.y;
  }
}

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private last = -1;
  constructor(private minCutoff = 1.4, private beta = 5, private dCutoff = 1) {}

  step(v: number, tMs: number) {
    const dt = this.last < 0 ? 1 / 30 : Math.max(1e-3, (tMs - this.last) / 1000);
    this.last = tMs;
    const prev = this.x.init ? this.x.y : v;
    const d = this.dx.step((v - prev) / dt, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(d);
    return this.x.step(v, alpha(cutoff, dt));
  }
}

/** Filters a list of 3D points, one filter per axis per point. */
export class PointsFilter {
  private f: OneEuro[] = [];
  constructor(private minCutoff = 1.4, private beta = 5) {}

  step(pts: { x: number; y: number; z: number }[], tMs: number) {
    if (this.f.length !== pts.length * 3) {
      this.f = Array.from({ length: pts.length * 3 }, () => new OneEuro(this.minCutoff, this.beta));
    }
    return pts.map((p, i) => ({
      x: this.f[i * 3].step(p.x, tMs),
      y: this.f[i * 3 + 1].step(p.y, tMs),
      z: this.f[i * 3 + 2].step(p.z, tMs),
    }));
  }

  reset() {
    this.f = [];
  }
}
