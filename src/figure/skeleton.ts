// A stick figure built from joint angles (forward kinematics), so every demo
// pose is anatomically consistent and the same figure can feed the tests.

export type Pt = [number, number];
export type Pair = [number, number];
export type View = 'side' | 'front';

/**
 * Angles in degrees. Limbs: 0 points straight down, +90 points forward
 * (screen right). Torso: 0 is upright, +90 leans fully forward.
 * Pairs are [far, near] in side view and [screen-left, screen-right] in front.
 */
export type Pose = {
  torso: number;
  head?: number;
  ua: Pair;
  fa: Pair;
  th: Pair;
  sh: Pair;
  foot?: Pair;
  /** raise the whole figure off the ground (a jump) */
  lift?: number;
  /** nudge sideways */
  x?: number;
};

export const BONE = { torso: 30, neck: 11, headR: 6.5, ua: 16, fa: 15, th: 24, sh: 23, foot: 8, footFront: 4 };

export type Joints = {
  head: Pt;
  nose: Pt;
  neck: Pt;
  hipC: Pt;
  sh: [Pt, Pt];
  el: [Pt, Pt];
  wr: [Pt, Pt];
  hip: [Pt, Pt];
  kn: [Pt, Pt];
  an: [Pt, Pt];
  toe: [Pt, Pt];
};

const rad = (d: number) => (d * Math.PI) / 180;
const limb = (p: Pt, a: number, len: number): Pt => [p[0] + Math.sin(rad(a)) * len, p[1] + Math.cos(rad(a)) * len];

export function solve(p: Pose, view: View, ground = 100, cx = 75): Joints {
  const hipC: Pt = [0, 0];
  const t = rad(p.torso);
  const neck: Pt = [Math.sin(t) * BONE.torso, -Math.cos(t) * BONE.torso];
  const ht = rad(p.torso + (p.head ?? 0));
  const head: Pt = [neck[0] + Math.sin(ht) * BONE.neck, neck[1] - Math.cos(ht) * BONE.neck];
  // the nose sits on the face side of the head
  const facing = view === 'side' ? 1 : 0;
  const nose: Pt = [head[0] + Math.cos(ht) * BONE.headR * 0.7 * facing, head[1] + Math.sin(ht) * BONE.headR * 0.7 * facing + (view === 'front' ? 1.5 : 0)];

  const shoulderW = view === 'front' ? 8 : 0;
  const hipW = view === 'front' ? 5 : 0;
  const sh: [Pt, Pt] = [[neck[0] - shoulderW, neck[1] + 2], [neck[0] + shoulderW, neck[1] + 2]];
  const hip: [Pt, Pt] = [[-hipW, 0], [hipW, 0]];
  const foot = p.foot ?? (view === 'front' ? [-80, 80] : [82, 82]);
  const footLen = view === 'front' ? BONE.footFront : BONE.foot;

  const el = [0, 1].map((i) => limb(sh[i], p.ua[i], BONE.ua)) as [Pt, Pt];
  const wr = [0, 1].map((i) => limb(el[i], p.fa[i], BONE.fa)) as [Pt, Pt];
  const kn = [0, 1].map((i) => limb(hip[i], p.th[i], BONE.th)) as [Pt, Pt];
  const an = [0, 1].map((i) => limb(kn[i], p.sh[i], BONE.sh)) as [Pt, Pt];
  const toe = [0, 1].map((i) => limb(an[i], foot[i], footLen)) as [Pt, Pt];

  const j: Joints = { head, nose, neck, hipC, sh, el, wr, hip, kn, an, toe };

  // stand it on the ground: the lowest point touches, unless it's jumping
  const ys = [head[1] + BONE.headR, neck[1], hipC[1], ...el.map((q) => q[1]), ...wr.map((q) => q[1]), ...kn.map((q) => q[1]), ...an.map((q) => q[1]), ...toe.map((q) => q[1])];
  const low = Math.max(...ys);
  const dy = ground - low - (p.lift ?? 0);
  const dx = cx + (p.x ?? 0);
  return map(j, (q) => [q[0] + dx, q[1] + dy]);
}

export function map(j: Joints, fn: (p: Pt) => Pt): Joints {
  const two = (a: [Pt, Pt]) => [fn(a[0]), fn(a[1])] as [Pt, Pt];
  return {
    head: fn(j.head), nose: fn(j.nose), neck: fn(j.neck), hipC: fn(j.hipC),
    sh: two(j.sh), el: two(j.el), wr: two(j.wr), hip: two(j.hip), kn: two(j.kn), an: two(j.an), toe: two(j.toe),
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const lp = (x: Pair, y: Pair): Pair => [l(x[0], y[0]), l(x[1], y[1])];
  return {
    torso: l(a.torso, b.torso),
    head: l(a.head ?? 0, b.head ?? 0),
    ua: lp(a.ua, b.ua), fa: lp(a.fa, b.fa), th: lp(a.th, b.th), sh: lp(a.sh, b.sh),
    foot: a.foot && b.foot ? lp(a.foot, b.foot) : (t < 0.5 ? a.foot : b.foot),
    lift: l(a.lift ?? 0, b.lift ?? 0),
    x: l(a.x ?? 0, b.x ?? 0),
  };
}
