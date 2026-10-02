// Small shared pieces: the logo, toasts, the rep strip.

import { h, svg } from '../lib/dom';
import { penStroke } from './ink';
import { ENTER } from '../pose/counter';

/** Four uprights and a red strike. */
export function logo() {
  const marks = [0, 1, 2, 3].map((i) =>
    h('path', { d: penStroke([6 + i * 7.5, 5 + (i % 2)], [6.5 + i * 7.5 + (i === 2 ? 0.6 : 0), 31 - (i % 3)], 3.4, 11 + i * 7).outline }),
  );
  const strike = h('path', { class: 'strike', d: penStroke([1, 25], [35, 10], 3.2, 5, 0.04).outline });
  return svg('0 0 38 36', {}, ...marks, strike);
}

let toastTimer = 0;
export function toast(text: string, action?: { label: string; run: () => void }, ms = 4200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.replaceChildren(h('span', {}, text));
  if (action) {
    el.append(h('button', { type: 'button', onclick: () => { action.run(); el.classList.remove('show'); } }, action.label));
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

/**
 * Every rep in a set as a pen stroke rising from a baseline: the taller, the
 * deeper. The dashed line is the depth that counts.
 */
export function repStrip(reps: [number, number, number][], cls = 'strip') {
  const n = Math.max(reps.length, 1);
  const step = 9;
  const W = Math.max(120, n * step + 8);
  const H = 40;
  const base = H - 2;
  const top = (d: number) => base - (Math.min(1.2, d) / 1.2) * (H - 6);
  const strokes = reps.map(([, depth], i) => {
    const d = Math.max(0.05, depth / 100);
    const x = 6 + i * step;
    const s = penStroke([x, base], [x + 0.6, top(d)], 2.6, i * 17 + 3, 0.06);
    return h('path', { class: `bar${d < ENTER ? ' shallow' : ''}`, d: s.outline });
  });
  const ly = top(ENTER);
  return svg(`0 0 ${W} ${H}`, { class: cls, preserveAspectRatio: 'xMinYMax meet' },
    h('rect', { class: 'base', x: 0, y: base, width: W, height: 1 }),
    h('line', { class: 'line', x1: 0, x2: W, y1: ly, y2: ly, 'vector-effect': 'non-scaling-stroke' }),
    ...strokes);
}
