// The inked figure: renders a pose as pen strokes and plays a sequence.

import { h, svg, reducedMotion } from '../lib/dom';
import { penStroke } from '../ui/ink';
import { solve, lerpPose, type Joints, type Pt, type Pose, type View } from './skeleton';
import { SEQUENCES, KEY_FRAME, type Sequence } from './poses';
import type { ExerciseId } from '../pose/types';

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

const P = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

function limbPath(a: Pt, b: Pt, c: Pt, d?: Pt) {
  return `M${P(a)}L${P(b)}L${P(c)}${d ? `L${P(d)}` : ''}`;
}

export function poseAt(seq: Sequence, ms: number): Pose {
  const total = seq.frames.reduce((s, f) => s + f.hold + f.move, 0);
  let t = ((ms % total) + total) % total;
  for (let i = 0; i < seq.frames.length; i++) {
    const f = seq.frames[i];
    if (t < f.hold) return f.pose;
    t -= f.hold;
    if (t < f.move) {
      const next = seq.frames[(i + 1) % seq.frames.length];
      return lerpPose(f.pose, next.pose, ease(t / f.move));
    }
    t -= f.move;
  }
  return seq.frames[0].pose;
}

/** Times (ms from the start of a loop) at which a rep completes. */
export function repTimes(seq: Sequence) {
  const out: number[] = [];
  let t = 0;
  const n = seq.frames.length;
  for (let i = 0; i < n; i++) {
    t += seq.frames[i].hold + seq.frames[i].move;
    if (seq.rep.includes((i + 1) % n)) out.push(t);
  }
  return { times: out, total: t };
}

type Pick = (j: Joints) => [Pt, Pt, Pt];

/** The joint each exercise measures, on the near side, for the red dial. */
const DIAL: Partial<Record<ExerciseId, Pick>> = {
  squats: (j) => [j.hip[1], j.kn[1], j.an[1]],
  jump_squats: (j) => [j.hip[1], j.kn[1], j.an[1]],
  lunges: (j) => [j.hip[1], j.kn[1], j.an[1]],
  push_ups: (j) => [j.sh[1], j.el[1], j.wr[1]],
  sit_ups: (j) => [j.sh[1], j.hip[1], j.kn[1]],
  high_knees: (j) => [j.neck, j.hip[1], j.kn[1]],
  plank: (j) => [j.sh[1], j.hip[1], j.an[1]],
  jumping_jacks: (j) => [j.hip[1], j.sh[1], j.el[1]],
};

type FigureOpts = {
  /** draw the measured joint's angle in red */
  dial?: boolean;
  /** play automatically while on screen */
  autoplay?: boolean;
  speed?: number;
  ground?: boolean;
  label?: string;
  onRep?: () => void;
};

export class Figure {
  el: SVGSVGElement;
  private far: SVGPathElement[];
  private near: SVGPathElement[];
  private torso: SVGPathElement;
  private head: SVGCircleElement;
  private dial: { arc: SVGPathElement; dot: SVGCircleElement; label: SVGTextElement; pick: Pick } | null = null;
  private seq: Sequence;
  private view: View;
  private raf = 0;
  private t0 = 0;
  private elapsed = 0;
  private playing = false;
  private visible = true;
  private io?: IntersectionObserver;
  private lastLoopT = 0;
  speed: number;
  onRep?: () => void;

  constructor(public exercise: ExerciseId, opts: FigureOpts = {}) {
    this.seq = SEQUENCES[exercise];
    this.view = this.seq.view;
    this.speed = opts.speed ?? 1;
    this.onRep = opts.onRep;
    const mk = (cls: string) => h('path', { class: cls }) as SVGPathElement;
    this.far = [mk('fig-far'), mk('fig-far')];
    this.near = [mk('fig-near'), mk('fig-near')];
    this.torso = mk('fig-near');
    this.head = h('circle', { class: 'fig-head', r: 6.5 }) as SVGCircleElement;
    const ground = opts.ground === false ? null : groundLine(exercise);
    const pick = DIAL[exercise];
    if (opts.dial && pick) {
      this.dial = {
        arc: h('path', { class: 'fig-dial' }) as SVGPathElement,
        dot: h('circle', { class: 'fig-dial-dot', r: 1.6 }) as SVGCircleElement,
        label: h('text', { class: 'fig-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }) as SVGTextElement,
        pick,
      };
    }
    this.el = svg('0 0 150 108', { class: `figure fig-${this.view}`, role: 'img', 'aria-label': opts.label ?? '' },
      ground, ...this.far, this.torso, this.head, ...this.near,
      this.dial?.arc, this.dial?.dot, this.dial?.label);
    this.el.removeAttribute('aria-hidden');
    if (this.view === 'front') this.far[0].setAttribute('class', 'fig-near');
    this.show(this.seq.frames[KEY_FRAME[exercise]].pose);

    if (opts.autoplay && !reducedMotion()) {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible) this.play();
        else this.pause();
      });
      this.io.observe(this.el);
    }
  }

  show(p: Pose) {
    this.draw(solve(p, this.view, 100, 75));
  }

  draw(j: Joints) {
    // far side in side view; screen-left in front view
    const side = this.view === 'side';
    const arm = (i: 0 | 1) => limbPath(j.sh[i], j.el[i], j.wr[i]);
    const leg = (i: 0 | 1) => limbPath(j.hip[i], j.kn[i], j.an[i], j.toe[i]);
    if (side) {
      this.far[0].setAttribute('d', arm(0));
      this.far[1].setAttribute('d', leg(0));
      this.near[0].setAttribute('d', arm(1));
      this.near[1].setAttribute('d', leg(1));
      this.torso.setAttribute('d', `M${P(j.hipC)}L${P(j.neck)}`);
    } else {
      this.far[0].setAttribute('d', `${arm(0)}${limbPath(j.sh[1], j.el[1], j.wr[1])}`);
      this.far[1].setAttribute('d', '');
      this.near[0].setAttribute('d', `${leg(0)}${leg(1)}`);
      this.near[1].setAttribute('d', `M${P(j.sh[0])}L${P(j.sh[1])}M${P(j.hip[0])}L${P(j.hip[1])}`);
      this.torso.setAttribute('d', `M${P(j.hipC)}L${P(j.neck)}`);
    }
    this.head.setAttribute('cx', j.head[0].toFixed(2));
    this.head.setAttribute('cy', j.head[1].toFixed(2));
    if (this.dial) this.drawDial(this.dial.pick(j));
  }

  private drawDial([a, b, c]: [Pt, Pt, Pt]) {
    const d = this.dial!;
    const ra = Math.atan2(a[1] - b[1], a[0] - b[0]);
    let delta = Math.atan2(c[1] - b[1], c[0] - b[0]) - ra;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const R = 7.5;
    const p0: Pt = [b[0] + Math.cos(ra) * R, b[1] + Math.sin(ra) * R];
    const p1: Pt = [b[0] + Math.cos(ra + delta) * R, b[1] + Math.sin(ra + delta) * R];
    d.arc.setAttribute('d', `M${P(p0)}A${R} ${R} 0 0 ${delta > 0 ? 1 : 0} ${P(p1)}`);
    d.dot.setAttribute('cx', b[0].toFixed(2));
    d.dot.setAttribute('cy', b[1].toFixed(2));
    const m = ra + delta / 2 + Math.PI;
    d.label.setAttribute('x', (b[0] + Math.cos(m) * 12).toFixed(2));
    d.label.setAttribute('y', (b[1] + Math.sin(m) * 12).toFixed(2));
    d.label.textContent = `${Math.round(Math.abs(delta) * 180 / Math.PI)}°`;
  }

  /** Switch to another movement in place. */
  setExercise(ex: ExerciseId) {
    this.exercise = ex;
    this.seq = SEQUENCES[ex];
    this.view = this.seq.view;
    this.el.setAttribute('class', `figure fig-${this.view}`);
    this.far[0].setAttribute('class', this.view === 'front' ? 'fig-near' : 'fig-far');
    const pick = DIAL[ex];
    if (this.dial) {
      if (pick) this.dial.pick = pick;
      for (const n of [this.dial.arc, this.dial.dot, this.dial.label]) n.style.display = pick ? '' : 'none';
    }
    this.elapsed = 0;
    this.lastLoopT = 0;
    this.t0 = performance.now();
    this.show(this.seq.frames[0].pose);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.t0 = performance.now() - this.elapsed;
    const tick = (now: number) => {
      if (!this.playing) return;
      const { times, total } = repTimes(this.seq);
      const ms = (now - this.t0) * this.speed;
      this.elapsed = now - this.t0;
      this.show(poseAt(this.seq, ms));
      if (this.onRep && times.length) {
        const prev = this.lastLoopT;
        const cur = ms;
        for (let k = Math.floor(prev / total); k <= Math.floor(cur / total); k++) {
          for (const rt of times) {
            const at = k * total + rt;
            if (at > prev && at <= cur) this.onRep();
          }
        }
        this.lastLoopT = cur;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.pause();
    this.io?.disconnect();
  }
}

function groundLine(ex: ExerciseId) {
  let seed = 0;
  for (const c of ex) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const s = penStroke([14, 101.5], [136, 101], 1.6, seed, 0.01);
  return h('path', { class: 'fig-ground', d: s.outline });
}
