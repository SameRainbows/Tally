import type { V3 } from './types';

export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mid = (a: V3, b: V3): V3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const dist = (a: V3, b: V3) => len(sub(a, b));
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Angle at b, in degrees, between b→a and b→c. 3D, so it doesn't change with where you stand. */
export function angle(a: V3, b: V3, c: V3) {
  const u = sub(a, b);
  const v = sub(c, b);
  const d = Math.max(len(u) * len(v), 1e-9);
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / d))) * 180) / Math.PI;
}

/** Angle of the segment from→to away from straight up, in degrees (0 upright, 90 lying). */
export function fromVertical(from: V3, to: V3) {
  const v = sub(to, from);
  const d = Math.max(len(v), 1e-9);
  return (Math.acos(Math.max(-1, Math.min(1, -v.y / d))) * 180) / Math.PI;
}

/**
 * Signed distance of p from the line a→b in the vertical plane, as a fraction
 * of |ab|. Positive means p sits below the line (y is down).
 */
export function belowLine(p: V3, a: V3, b: V3) {
  const ab = sub(b, a);
  const L = Math.max(Math.hypot(ab.x, ab.y, ab.z), 1e-9);
  const t = dot(sub(p, a), ab) / (L * L);
  const onLine = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
  return (p.y - onLine.y) / L;
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
