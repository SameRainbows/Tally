// Everything Tally keeps, in this browser only. Versioned so it can migrate.

import type { ExerciseId } from '../pose/types';
import { isExercise } from '../pose/exercises';

export type SetRecord = {
  id: string;
  ex: ExerciseId;
  /** start, epoch ms */
  at: number;
  /** ms */
  dur: number;
  /** reps, or seconds held for a hold */
  n: number;
  goal?: number;
  misses: number;
  /** each rep: [ms into the set, depth %, tempo ms] */
  reps: [number, number, number][];
};

export type Settings = {
  theme: 'auto' | 'paper' | 'slate';
  sound: boolean;
  voice: boolean;
  showVideo: boolean;
  mirror: boolean;
  handsFree: boolean;
  autoEnd: boolean;
  countdown: number;
  accuracy: 'lite' | 'full';
};

const SETS_KEY = 'tally.sets.v1';
const SETTINGS_KEY = 'tally.settings.v1';

export const DEFAULTS: Settings = {
  theme: 'auto',
  sound: true,
  voice: false,
  showVideo: true,
  mirror: true,
  handsFree: true,
  autoEnd: true,
  countdown: 3,
  accuracy: 'lite',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- settings

let settings: Settings = { ...DEFAULTS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
const listeners = new Set<(s: Settings) => void>();

export const getSettings = () => settings;

export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(SETTINGS_KEY, settings);
  listeners.forEach((fn) => fn(settings));
}

export function onSettings(fn: (s: Settings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- sets

let sets: SetRecord[] = read<{ v: number; sets: SetRecord[] }>(SETS_KEY, { v: 1, sets: [] }).sets ?? [];

const persist = () => write(SETS_KEY, { v: 1, sets });

export const allSets = () => sets;

export function addSet(r: SetRecord) {
  sets = [...sets, r].sort((a, b) => a.at - b.at);
  return persist();
}

export function removeSet(id: string) {
  sets = sets.filter((s) => s.id !== id);
  persist();
}

export function clearSets() {
  sets = [];
  persist();
}

export function exportData() {
  return JSON.stringify({ app: 'tally', v: 1, exported: new Date().toISOString(), sets }, null, 1);
}

/** Merge sets from an export. Returns how many were new. */
export function importData(text: string) {
  const data = JSON.parse(text) as { sets?: unknown };
  if (!data || !Array.isArray(data.sets)) throw new Error('That file isn’t a Tally export.');
  const have = new Set(sets.map((s) => s.id));
  let added = 0;
  for (const s of data.sets as SetRecord[]) {
    if (!s || typeof s.id !== 'string' || !isExercise(String(s.ex)) || typeof s.at !== 'number' || typeof s.n !== 'number') continue;
    if (have.has(s.id)) continue;
    sets.push({ id: s.id, ex: s.ex, at: s.at, dur: Number(s.dur) || 0, n: s.n, goal: s.goal, misses: Number(s.misses) || 0, reps: Array.isArray(s.reps) ? s.reps : [] });
    have.add(s.id);
    added++;
  }
  sets.sort((a, b) => a.at - b.at);
  persist();
  return added;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ---------------------------------------------------------------- dates

export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function dayLabel(key: string) {
  const today = dayKey(Date.now());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y.getTime())) return 'Yesterday';
  const [Y, M, D] = key.split('-').map(Number);
  const d = new Date(Y, M - 1, D);
  const sameYear = Y === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
}

export function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function setsToday(ex: ExerciseId) {
  const k = dayKey(Date.now());
  return sets.filter((s) => s.ex === ex && dayKey(s.at) === k).length;
}
