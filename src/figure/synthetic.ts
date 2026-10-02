// Turns the drawn figure's joints into MediaPipe-shaped landmarks. Used by
// the tests and by demo mode, where the figure stands in for a camera.

import type { Joints, Pt } from './skeleton';
import { LM, type PoseFrame, type V3 } from '../pose/types';
import { rng } from '../lib/dom';

export const FIG_W = 150;
export const FIG_H = 108;

const SCALE = 1.75 / 97; // figure units to metres

export function jointsToFrame(j: Joints, view: 'side' | 'front', t: number, noise = 0, seed = 1): PoseFrame {
  const r = rng(seed + Math.round(t));
  const n = () => (r() - 0.5) * 2 * noise;
  const [hx, hy] = j.hipC;
  const img: V3[] = [];
  const world: V3[] = [];
  const vis: number[] = [];
  // pair index 0 is "far" (side) or screen-left (front); map it to MediaPipe's left in side view, right in front view
  const farIs = view === 'side' ? 'l' : 'r';
  const put = (i: number, p: Pt, lateral: number) => {
    img[i] = { x: p[0] / FIG_W + n() / FIG_W, y: p[1] / FIG_H + n() / FIG_H, z: 0 };
    world[i] = {
      x: (p[0] - hx + n()) * SCALE,
      y: (p[1] - hy + n()) * SCALE,
      z: view === 'side' ? lateral : 0,
    };
    vis[i] = 0.95;
  };
  for (let i = 0; i < 33; i++) put(i, j.head, 0);
  put(LM.nose, j.nose, 0);
  const pair = (l: number, r: number, p: [Pt, Pt]) => {
    const [far, near] = farIs === 'l' ? [l, r] : [r, l];
    put(far, p[0], 0.1);
    put(near, p[1], -0.1);
  };
  pair(LM.lShoulder, LM.rShoulder, j.sh);
  pair(LM.lElbow, LM.rElbow, j.el);
  pair(LM.lWrist, LM.rWrist, j.wr);
  pair(LM.lHip, LM.rHip, j.hip);
  pair(LM.lKnee, LM.rKnee, j.kn);
  pair(LM.lAnkle, LM.rAnkle, j.an);
  pair(LM.lHeel, LM.rHeel, j.an);
  pair(LM.lToe, LM.rToe, j.toe);
  return { t, img, world, vis };
}

