// Draws your skeleton over the camera in the same pen as everything else, and
// circles the joint being measured.

import type { PoseFrame, Reading } from '../pose/types';
import { LM } from '../pose/types';

const BONES: [number, number][] = [
  [LM.lShoulder, LM.rShoulder], [LM.lHip, LM.rHip],
  [LM.lShoulder, LM.lHip], [LM.rShoulder, LM.rHip],
  [LM.lShoulder, LM.lElbow], [LM.lElbow, LM.lWrist],
  [LM.rShoulder, LM.rElbow], [LM.rElbow, LM.rWrist],
  [LM.lHip, LM.lKnee], [LM.lKnee, LM.lAnkle], [LM.lAnkle, LM.lToe],
  [LM.rHip, LM.rKnee], [LM.rKnee, LM.rAnkle], [LM.rAnkle, LM.rToe],
];

export type OverlayOpts = {
  mirror: boolean;
  reading: Reading | null;
  unit: '°' | '%';
  /** 0..1 progress of the hands-up gesture */
  handsUp: number;
  /** contain (whole frame visible) when the camera picture is hidden */
  fit: 'cover' | 'contain';
  /** the source's pixel size, when it isn't the video (demo mode) */
  size?: { w: number; h: number };
};

export class Overlay {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private colors = { ink: '#1c1b19', red: '#c0392b', paper: '#f3efe6' };

  constructor(private video: HTMLVideoElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'overlay';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Re-read theme colours (call after a theme change). */
  readColors() {
    const s = getComputedStyle(this.canvas);
    this.colors = {
      ink: s.getPropertyValue('--skel').trim() || this.colors.ink,
      red: s.getPropertyValue('--red').trim() || this.colors.red,
      paper: s.getPropertyValue('--paper').trim() || this.colors.paper,
    };
  }

  private fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width !== this.w || r.height !== this.h || dpr !== this.dpr) {
      this.w = r.width;
      this.h = r.height;
      this.dpr = dpr;
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      this.readColors();
    }
  }

  clear() {
    this.fit();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(f: PoseFrame | null, o: OverlayOpts) {
    this.clear();
    if (!f) return;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const vw = o.size?.w ?? (this.video.videoWidth || 4);
    const vh = o.size?.h ?? (this.video.videoHeight || 3);
    const scale = o.fit === 'cover' ? Math.max(this.w / vw, this.h / vh) : Math.min(this.w / vw, this.h / vh);
    const dx = (this.w - vw * scale) / 2;
    const dy = (this.h - vh * scale) / 2;
    const P = (i: number): [number, number] => {
      const p = f.img[i];
      const x = p.x * vw * scale + dx;
      return [o.mirror ? this.w - x : x, p.y * vh * scale + dy];
    };
    const lw = Math.max(3, Math.min(this.w, this.h) / 95);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.colors.ink;

    for (const [a, b] of BONES) {
      const v = Math.min(f.vis[a] ?? 0, f.vis[b] ?? 0);
      if (v < 0.3) continue;
      ctx.globalAlpha = 0.35 + 0.6 * Math.min(1, (v - 0.3) / 0.5);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(...P(a));
      ctx.lineTo(...P(b));
      ctx.stroke();
    }

    // head: a circle sized from the ears
    if ((f.vis[LM.nose] ?? 0) > 0.4) {
      const [nx, ny] = P(LM.nose);
      const [ax, ay] = P(7);
      const [bx, by] = P(8);
      const r = Math.max(lw * 2.5, Math.hypot(ax - bx, ay - by) * 0.75);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(nx, ny - r * 0.15, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // the measured joint
    const arc = o.reading?.arc;
    if (o.reading && arc) {
      const [a, b, c] = arc.map(P);
      const ra = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const rc = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = rc - ra;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const R = lw * 7;
      ctx.strokeStyle = this.colors.red;
      ctx.fillStyle = this.colors.red;
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      ctx.arc(b[0], b[1], R, ra, ra + d, d < 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b[0], b[1], lw * 1.3, 0, Math.PI * 2);
      ctx.fill();
      // label on the outside of the angle
      const mid = ra + d / 2 + Math.PI;
      const lx = b[0] + Math.cos(mid) * R * 1.9;
      const ly = b[1] + Math.sin(mid) * R * 1.9;
      const label = `${Math.round(o.reading.raw)}${o.unit}`;
      ctx.font = `500 ${Math.round(lw * 4.4)}px "DM Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = lw * 1.4;
      ctx.strokeStyle = this.colors.paper;
      ctx.strokeText(label, lx, ly);
      ctx.fillText(label, lx, ly);
    }

    // hands-up gesture: rings fill around both wrists
    if (o.handsUp > 0) {
      ctx.strokeStyle = this.colors.red;
      ctx.lineWidth = lw * 1.1;
      for (const i of [LM.lWrist, LM.rWrist]) {
        const [x, y] = P(i);
        ctx.beginPath();
        ctx.arc(x, y, lw * 6, -Math.PI / 2, -Math.PI / 2 + o.handsUp * Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
