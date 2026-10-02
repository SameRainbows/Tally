// Pen strokes and tally marks. Every stroke is a filled outline with a little
// bow and pressure taper, seeded so the same mark always looks the same.

import { h, rng, svg, nextId } from '../lib/dom';

type Pt = [number, number];

export type Stroke = { outline: string; center: string; length: number };

const f = (n: number) => Math.round(n * 100) / 100;

/** A tapered, slightly bowed pen stroke from a to b. */
export function penStroke(a: Pt, b: Pt, width: number, seed: number, bow = 0.07): Stroke {
  const r = rng(seed);
  const [x0, y0] = a;
  const [x1, y1] = b;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (r() - 0.5) * 2 * len * bow;
  const cx = (x0 + x1) / 2 + nx * bend;
  const cy = (y0 + y1) / 2 + ny * bend;
  const press = 0.85 + r() * 0.3;

  const N = 12;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const px = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const py = u * u * y0 + 2 * u * t * cy + t * t * y1;
    // derivative for the local normal
    const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const lx = -ty / tl;
    const ly = tx / tl;
    // heavier where the pen lands, lighter as it lifts
    const w = width * press * (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (1 - 0.3 * t);
    left.push([px + (lx * w) / 2, py + (ly * w) / 2]);
    right.push([px - (lx * w) / 2, py - (ly * w) / 2]);
  }
  const startR = Math.max(0.4, (width * press * 0.62) / 2);
  const endR = Math.max(0.3, (width * press * 0.62 * 0.7) / 2);
  let d = `M${f(left[0][0])} ${f(left[0][1])}`;
  for (let i = 1; i < left.length; i++) d += `L${f(left[i][0])} ${f(left[i][1])}`;
  const re = right[right.length - 1];
  d += `A${f(endR)} ${f(endR)} 0 0 1 ${f(re[0])} ${f(re[1])}`;
  for (let i = right.length - 2; i >= 0; i--) d += `L${f(right[i][0])} ${f(right[i][1])}`;
  d += `A${f(startR)} ${f(startR)} 0 0 1 ${f(left[0][0])} ${f(left[0][1])}Z`;

  const center = `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`;
  return { outline: d, center, length: len };
}

/** A stroke as SVG. With `animate`, it draws itself like a pen. */
export function strokeEl(s: Stroke, width: number, animate: boolean, durMs = 220, cls = '') {
  if (!animate) return h('path', { d: s.outline, class: cls || null });
  const id = nextId('m');
  return h('g', { class: cls || null },
    h('mask', { id, maskUnits: 'userSpaceOnUse' },
      h('path', {
        d: s.center, fill: 'none', stroke: '#fff', 'stroke-width': width * 2.4,
        'stroke-linecap': 'round', pathLength: 1, class: 'pen-draw',
        style: { animationDuration: `${durMs}ms` },
      })),
    h('path', { d: s.outline, mask: `url(#${id})` }));
}

// ---------------------------------------------------------------- tally

export type TallyOpts = {
  /** groups of five per row */
  perRow?: number;
  /** mark height in viewBox units */
  size?: number;
  seed?: number;
  label?: string;
};

const GAP = 10;      // between strokes in a group
const GROUP_W = 58;  // group pitch
const ROW_H = 62;

/** Geometry of mark i (0-based). Strokes 0-3 are uprights, 4 is the strike. */
function markGeom(i: number, perRow: number, size: number, seed: number) {
  const g = Math.floor(i / 5);
  const k = i % 5;
  const row = Math.floor(g / perRow);
  const col = g % perRow;
  const ox = 10 + col * GROUP_W;
  const oy = 8 + row * ROW_H;
  const r = rng(seed * 7919 + i * 104729);
  const j = () => (r() - 0.5) * 2;
  if (k < 4) {
    const x = ox + 6 + k * GAP + j() * 1.4;
    const lean = j() * 2.2;
    const a: Pt = [x - lean / 2, oy + 2 + j() * 3];
    const b: Pt = [x + lean / 2, oy + size - 2 + j() * 3];
    return { a, b, w: 3.3 + r() * 0.8, strike: false, seed: i * 31 + seed };
  }
  const a: Pt = [ox - 1 + j() * 2, oy + size - 9 + j() * 3];
  const b: Pt = [ox + 6 + 3 * GAP + 7 + j() * 2, oy + 8 + j() * 3];
  return { a, b, w: 3.1 + r() * 0.6, strike: true, seed: i * 31 + seed };
}

/**
 * A live tally. `set(n)` inks marks up to n; marks for an optional goal are
 * pre-drawn in pencil underneath.
 */
export class Tally {
  el: SVGSVGElement;
  private ink: SVGGElement;
  private pencil: SVGGElement;
  private count = 0;
  private goal = 0;
  private perRow: number;
  private size: number;
  private seed: number;

  constructor(opts: TallyOpts = {}) {
    this.perRow = opts.perRow ?? 5;
    this.size = opts.size ?? 44;
    this.seed = opts.seed ?? 1;
    this.pencil = h('g', { class: 'tally-pencil' }) as SVGGElement;
    this.ink = h('g', { class: 'tally-ink' }) as SVGGElement;
    this.el = svg('0 0 10 10', { class: 'tally', role: 'img', 'aria-label': opts.label ?? '', preserveAspectRatio: 'xMinYMax meet' }, this.pencil, this.ink);
    this.el.removeAttribute('aria-hidden');
    this.layout();
  }

  private rowsFor(n: number) {
    return Math.max(1, Math.ceil(Math.ceil(Math.max(n, 1) / 5) / this.perRow));
  }

  private layout() {
    const n = Math.max(this.count, this.goal);
    const groups = Math.max(1, Math.min(this.perRow, Math.ceil(Math.max(n, 1) / 5)));
    const w = 10 + this.perRow * GROUP_W;
    const rows = this.rowsFor(n);
    this.el.setAttribute('viewBox', `0 0 ${w} ${rows * ROW_H + 6}`);
    this.el.dataset.groups = String(groups);
    this.el.dataset.rows = String(rows);
  }

  private draw(i: number, animate: boolean, into: SVGGElement, cls = '') {
    const m = markGeom(i, this.perRow, this.size, this.seed);
    const s = penStroke(m.a, m.b, m.w, m.seed, m.strike ? 0.05 : 0.08);
    into.append(strokeEl(s, m.w, animate, m.strike ? 300 : 200, cls));
  }

  setGoal(goal: number) {
    this.goal = Math.max(0, Math.floor(goal));
    this.pencil.replaceChildren();
    for (let i = 0; i < this.goal; i++) this.draw(i, false, this.pencil);
    this.layout();
  }

  set(n: number, animate = true) {
    n = Math.max(0, Math.floor(n));
    if (n < this.count) {
      this.ink.replaceChildren();
      this.count = 0;
    }
    for (let i = this.count; i < n; i++) this.draw(i, animate && n - i <= 5, this.ink);
    this.count = n;
    this.layout();
  }

  get value() { return this.count; }
}

/** A static tally as markup, for lists and summaries. */
export function tallyStatic(n: number, opts: TallyOpts = {}) {
  const t = new Tally(opts);
  t.set(n, false);
  return t.el;
}

/** One hand-drawn underline / rule, used as a divider. */
export function rule(width = 300, seed = 3, cls = 'rule') {
  const s = penStroke([2, 5], [width - 2, 4 + (rng(seed)() - 0.5) * 3], 2.2, seed, 0.015);
  return svg(`0 0 ${width} 10`, { class: cls, preserveAspectRatio: 'none' }, h('path', { d: s.outline }));
}
