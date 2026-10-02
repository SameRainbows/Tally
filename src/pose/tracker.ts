// Camera + MediaPipe PoseLandmarker. Loads once per page, runs a frame loop,
// hands out filtered frames. Nothing here leaves the device.

import type { PoseLandmarker as PL } from '@mediapipe/tasks-vision';
import { PointsFilter } from './filter';
import type { PoseFrame } from './types';

export type Accuracy = 'lite' | 'full';

const MODEL_URL = (a: Accuracy) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${a}/float16/latest/pose_landmarker_${a}.task`;
export const MODEL_MB: Record<Accuracy, number> = { lite: 5.8, full: 9.4 };

const MODEL_CACHE = 'tally-models-v1';

let landmarker: PL | null = null;
let loadedAccuracy: Accuracy | null = null;
let loading: Promise<PL> | null = null;

/** Fetch the model with progress, from the cache when we have it. */
async function fetchModel(a: Accuracy, onProgress: (p: number) => void): Promise<Uint8Array> {
  const url = MODEL_URL(a);
  let cache: Cache | null = null;
  try {
    cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(url);
    if (hit) {
      onProgress(1);
      return new Uint8Array(await hit.arrayBuffer());
    }
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Model download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || MODEL_MB[a] * 1e6;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(0.99, got / total));
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.length;
  }
  try {
    await cache?.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } }));
  } catch {
    /* private mode or quota: fine, we just download again next time */
  }
  onProgress(1);
  return buf;
}

export function modelReady(a: Accuracy) {
  return !!landmarker && loadedAccuracy === a;
}

export async function loadModel(a: Accuracy, onProgress: (p: number) => void): Promise<PL> {
  if (landmarker && loadedAccuracy === a) return landmarker;
  if (loading) return loading;
  loading = (async () => {
    const [{ FilesetResolver, PoseLandmarker }, model] = await Promise.all([
      import('@mediapipe/tasks-vision'),
      fetchModel(a, onProgress),
    ]);
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: model, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    let pl: PL;
    try {
      pl = await make('GPU');
    } catch {
      // no WebGL2 or a flaky driver: the CPU path is slower but works
      pl = await make('CPU');
    }
    landmarker?.close();
    landmarker = pl;
    loadedAccuracy = a;
    return pl;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export type CameraError = 'denied' | 'missing' | 'busy' | 'insecure' | 'other';

export function cameraErrorKind(e: unknown): CameraError {
  if (!window.isSecureContext) return 'insecure';
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'other';
}

export async function cameraPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return p.state;
  } catch {
    return 'unknown';
  }
}

export class Tracker {
  video: HTMLVideoElement;
  stream: MediaStream | null = null;
  facing: 'user' | 'environment' = 'user';
  fps = 0;
  /** the latest unfiltered image landmarks, for drawing */
  rawImg: { x: number; y: number }[] | null = null;

  private pl: PL | null = null;
  private running = false;
  private handle = 0;
  private lastTs = -1;
  private imgF = new PointsFilter(1.6, 6);
  private worldF = new PointsFilter(1.6, 6);
  private fpsT = 0;
  private fpsN = 0;
  private lostFrames = 0;

  constructor(private onFrame: (f: PoseFrame | null) => void) {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
  }

  async openCamera(facing: 'user' | 'environment' = this.facing) {
    this.closeCamera();
    this.facing = facing;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
    });
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play().catch(() => undefined);
    if (this.video.readyState < 2) {
      await new Promise<void>((res) => this.video.addEventListener('loadeddata', () => res(), { once: true }));
    }
  }

  static async cameraCount() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'videoinput').length;
    } catch {
      return 1;
    }
  }

  closeCamera() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  start(pl: PL) {
    this.pl = pl;
    if (this.running) return;
    this.running = true;
    this.imgF.reset();
    this.worldF.reset();
    this.schedule();
  }

  stop() {
    this.running = false;
    const v = this.video as HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void };
    if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.handle);
    cancelAnimationFrame(this.handle);
  }

  destroy() {
    this.stop();
    this.closeCamera();
  }

  private schedule() {
    if (!this.running) return;
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    this.handle = v.requestVideoFrameCallback
      ? v.requestVideoFrameCallback(() => this.step())
      : requestAnimationFrame(() => this.step());
  }

  private step() {
    if (!this.running) return;
    try {
      this.detect();
    } finally {
      this.schedule();
    }
  }

  private detect() {
    const v = this.video;
    if (!this.pl || v.readyState < 2 || !v.videoWidth) return;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    const res = this.pl.detectForVideo(v, ts);
    this.fpsN++;
    if (ts - this.fpsT > 1000) {
      this.fps = Math.round((this.fpsN * 1000) / (ts - this.fpsT));
      this.fpsT = ts;
      this.fpsN = 0;
    }
    const lm = res.landmarks[0];
    const wl = res.worldLandmarks[0];
    if (!lm || !wl) {
      this.rawImg = null;
      // after a few empty frames, forget the filter state so we don't glide in from the last pose
      if (++this.lostFrames > 8) {
        this.imgF.reset();
        this.worldF.reset();
      }
      this.onFrame(null);
      return;
    }
    this.lostFrames = 0;
    this.rawImg = lm;
    const img = this.imgF.step(lm, ts);
    const world = this.worldF.step(wl, ts);
    const vis = lm.map((p) => p.visibility ?? 1);
    this.onFrame({ t: ts, img, world, vis });
  }
}
