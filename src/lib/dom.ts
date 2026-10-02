// A small element builder. h('div.card', { onclick }, 'text', child)

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> | null | undefined;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'line', 'rect', 'defs', 'mask', 'use', 'symbol',
  'text', 'polyline', 'ellipse', 'filter', 'feTurbulence', 'feDisplacementMap', 'title', 'clipPath',
]);

export function h<K extends keyof HTMLElementTagNameMap>(
  sel: K | `${K}.${string}` | `${K}#${string}`,
  attrs?: Attrs,
  ...children: Child[]
): HTMLElementTagNameMap[K];
export function h(sel: string, attrs?: Attrs, ...children: Child[]): Element;
export function h(sel: string, attrs?: Attrs, ...children: Child[]): Element {
  const [tagAndId, ...classes] = sel.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (id) el.id = id;
  if (classes.length) el.setAttribute('class', classes.join(' '));
  if (attrs) setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function setAttrs(el: Element, attrs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.setAttribute('class', [el.getAttribute('class'), v].filter(Boolean).join(' '));
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign((el as HTMLElement).style, v);
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign((el as HTMLElement).dataset, v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

export function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export function svg(viewBox: string, attrs?: Attrs, ...children: Child[]) {
  return h('svg', { viewBox, 'aria-hidden': 'true', focusable: 'false', ...attrs }, ...children) as SVGSVGElement;
}

export function icon(id: string, cls = 'ico') {
  return h('svg', { class: cls, 'aria-hidden': 'true', focusable: 'false' }, h('use', { href: `#i-${id}` }));
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T | null;

export function clear(el: Element) {
  while (el.firstChild) el.firstChild.remove();
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Deterministic PRNG so a mark looks the same every time it is drawn. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uid = 0;
export const nextId = (p = 'u') => `${p}${++uid}`;
