// Can the camera see what this exercise needs? If not, say what to change.

import type { ExerciseDef, Part } from './exercises';
import { LM, type PoseFrame } from './types';

const PARTS: Record<Part, [number, number]> = {
  head: [LM.nose, LM.nose],
  shoulders: [LM.lShoulder, LM.rShoulder],
  elbows: [LM.lElbow, LM.rElbow],
  wrists: [LM.lWrist, LM.rWrist],
  hips: [LM.lHip, LM.rHip],
  knees: [LM.lKnee, LM.rKnee],
  ankles: [LM.lAnkle, LM.rAnkle],
};

const HINTS: [Part, string][] = [
  ['ankles', 'Step back so I can see your feet'],
  ['knees', 'Step back so I can see your knees'],
  ['hips', 'Step back so I can see your hips'],
  ['head', 'Tilt the camera up — your head is out of frame'],
  ['shoulders', 'Tilt the camera up — your shoulders are out of frame'],
  ['wrists', 'Keep your hands in view'],
  ['elbows', 'Keep your arms in view'],
];

export type Framing = { level: 'good' | 'partial' | 'none'; hint: string | null };

function seen(f: PoseFrame, i: number) {
  const p = f.img[i];
  return (f.vis[i] ?? 0) >= 0.5 && p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;
}

export function framing(f: PoseFrame | null, def: ExerciseDef): Framing {
  if (!f) return { level: 'none', hint: 'Step into view' };
  const both = def.view === 'front';
  const missing = new Set<Part>();
  for (const part of def.needs) {
    const [l, r] = PARTS[part];
    const ok = both ? seen(f, l) && seen(f, r) : seen(f, l) || seen(f, r);
    if (!ok) missing.add(part);
  }
  if (!missing.size) return { level: 'good', hint: null };
  if (missing.has('hips') && missing.has('shoulders')) return { level: 'none', hint: 'Step into view' };
  const hint = HINTS.find(([p]) => missing.has(p))?.[1] ?? 'Move so your whole body is in frame';
  return { level: 'partial', hint };
}
