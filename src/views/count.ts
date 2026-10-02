// The counting screen. Camera on the left page, the tally on the right.

import { h, icon, svg } from '../lib/dom';
import { go, type View } from '../lib/router';
import { EXERCISES, ORDER } from '../pose/exercises';
import { Counter, ENTER, MOVE } from '../pose/counter';
import { framing } from '../pose/framing';
import { handsUp, Hold } from '../pose/gesture';
import { Tracker, loadModel, modelReady, cameraErrorKind, cameraPermission, MODEL_MB, type CameraError } from '../pose/tracker';
import type { ExerciseId, PoseFrame, Reading } from '../pose/types';
import { Overlay } from '../ui/overlay';
import { Tally, penStroke } from '../ui/ink';
import { Figure } from '../figure/figure';
import { DemoSource } from '../figure/demo';
import { FIG_W, FIG_H } from '../figure/synthetic';
import { repStrip, toast } from '../ui/bits';
import { sound, say, unlockAudio } from '../lib/sound';
import { addSet, removeSet, getSettings, setSettings, onSettings, newId, setsToday, clock, type SetRecord } from '../lib/store';

// One camera shared across exercise switches, closed shortly after leaving.
let shared: { tracker: Tracker; overlay: Overlay } | null = null;
let closeTimer = 0;
let sink: (f: PoseFrame | null) => void = () => undefined;

function acquire() {
  clearTimeout(closeTimer);
  if (!shared) {
    const tracker = new Tracker((f) => sink(f));
    shared = { tracker, overlay: new Overlay(tracker.video) };
  }
  return shared;
}

function release() {
  sink = () => undefined;
  closeTimer = window.setTimeout(() => {
    shared?.tracker.destroy();
    shared = null;
  }, 500);
}

type Phase = 'intro' | 'loading' | 'ready' | 'countdown' | 'live' | 'summary' | 'error';

const CAMERA_ERRORS: Record<CameraError, [string, string]> = {
  denied: ['Camera is blocked', 'Allow the camera for this site in your browser (the icon beside the address), then try again.'],
  missing: ['No camera found', 'Tally needs a camera. Plug one in, or open this page on your phone.'],
  busy: ['Camera is busy', 'Another app is using the camera. Close it and try again.'],
  insecure: ['Camera needs https', 'Browsers only allow the camera on secure pages. Open tally.mehmetdedeler.com.'],
  other: ['Camera didn’t start', 'Something stopped the camera from starting. Reloading the page usually fixes it.'],
};

export function countView(id: ExerciseId, q: URLSearchParams): View {
  const def = EXERCISES[id];
  const hold = def.kind === 'hold';
  const s0 = getSettings();
  const { tracker, overlay } = acquire();

  let phase: Phase = 'intro';
  let counter: Counter | null = null;
  let setStart = 0;
  let countdownEnd = 0;
  let lastActivity = 0;
  let lastCountdownN = -1;
  let goalReachedSaid = false;
  let lastRecord: SetRecord | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let destroyed = false;
  const startHold = new Hold(900);
  // after a set ends with hands up, wait for them to come down before listening again
  let needRelease = false;
  const stopHold = new Hold(1600);
  // demo mode: the drawn figure is the camera
  const demo = q.has('demo');
  let demoSrc: DemoSource | null = null;

  const goalOptions = hold ? [0, 30, 60, 90, 120] : [0, 10, 20, 30, 50];
  let goal = Math.max(0, Math.min(hold ? 600 : 500, Number(q.get('goal')) || 0));

  // ------------------------------------------------ left page
  const cam = h('div.cam', { class: [s0.mirror && tracker.facing === 'user' ? 'mirror' : '', s0.showVideo ? '' : 'ink-only'].join(' ') });
  const chip = h('div.cam-chip', { 'aria-live': 'polite' });
  const countdownEl = h('div.countdown', { 'aria-live': 'assertive' });
  const layer = h('div', { style: { display: 'contents' } });

  const eyeBtn = toolBtn('eye', 'Show the camera picture', s0.showVideo, () => {
    const v = !getSettings().showVideo;
    setSettings({ showVideo: v });
  });
  const mirrorBtn = toolBtn('mirror', 'Mirror the picture', s0.mirror, () => setSettings({ mirror: !getSettings().mirror }));
  const soundBtn = toolBtn('sound', 'Sound', s0.sound, () => {
    unlockAudio();
    setSettings({ sound: !getSettings().sound });
  });
  const flipBtn = toolBtn('flip', 'Switch camera', true, async () => {
    const next = tracker.facing === 'user' ? 'environment' : 'user';
    try {
      await tracker.openCamera(next);
      applyCamClasses();
    } catch {
      toast('Couldn’t switch cameras.');
    }
  });
  flipBtn.hidden = true;
  const tools = h('div.cam-tools', {}, flipBtn, mirrorBtn, eyeBtn, soundBtn);
  tools.hidden = true;

  cam.append(tracker.video, overlay.canvas, layer, countdownEl, chip, tools);

  // ------------------------------------------------ right page
  const select = h('select', { 'aria-label': 'Movement' },
    ...ORDER.map((x) => h('option', { value: x, selected: x === id }, EXERCISES[x].name)));
  select.addEventListener('change', () => go(`/count/${select.value}`));
  const setLabel = h('span', {}, `Set ${setsToday(id) + 1}`);
  const clockEl = h('span.clock', {}, '0:00');
  const head = h('div.sheet-head', {},
    h('label.pick', {}, select, icon('down')),
    h('div.sheet-meta', {}, setLabel, clockEl));

  const big = h('div.count-n.dim', { 'aria-hidden': 'true' }, '0');
  const bigWord = h('div.count-word', {}, def.many);
  const live = h('p.sr-only', { 'aria-live': 'polite' });
  const gaugeFill = h('line', { class: 'fill', x1: 11, x2: 11, y1: 100, y2: 100 }) as SVGLineElement;
  const targetY = 100 - ENTER * 100;
  const gauge = h('div.gauge', { 'aria-hidden': 'true' },
    svg('0 0 22 100', { preserveAspectRatio: 'none' },
      h('line', { class: 'track', x1: 11, x2: 11, y1: 2, y2: 98, 'vector-effect': 'non-scaling-stroke' }),
      gaugeFill,
      h('line', { class: 'target', x1: 2, x2: 20, y1: targetY, y2: targetY, 'vector-effect': 'non-scaling-stroke' })));
  gaugeFill.setAttribute('vector-effect', 'non-scaling-stroke');
  if (hold) gauge.hidden = true;
  const score = h('div.score', {}, big, gauge, bigWord);

  const tally = new Tally({ perRow: 5, seed: 7, label: '' });
  const tallyWrap = h('div.tally-wrap', {}, tally.el);
  const cue = h('p.cue', {}, '');
  const primary = h('button.btn.big', { type: 'button' }, 'Start camera') as HTMLButtonElement;
  const hint = h('span.hint-line', {}, '');
  const goalRow = h('div.goal', { role: 'group', 'aria-label': hold ? 'Goal in seconds' : 'Goal' },
    h('span.label', {}, hold ? 'Goal, seconds' : 'Goal'),
    ...goalOptions.map((g) =>
      h('button', { type: 'button', 'aria-pressed': String(g === goal), onclick: () => setGoal(g) }, g ? String(g) : 'none')));
  const controls = h('div.controls', {}, primary, hint);
  const body = h('div.sheet-body', {}, score, tallyWrap);
  const sheet = h('section.sheet', { 'aria-label': `${def.name} counter` }, head, body, cue, h('div.sheet-foot', {}, goalRow, controls), live);

  const el = h('div.count', {}, cam, sheet);

  primary.addEventListener('click', () => {
    unlockAudio();
    if (phase === 'intro' || phase === 'error') begin();
    else if (phase === 'ready') startCountdown();
    else if (phase === 'countdown') cancelCountdown();
    else if (phase === 'live') endSet();
    else if (phase === 'summary') toReady();
  });

  function toolBtn(name: string, label: string, on: boolean, fn: () => void) {
    return h('button', { type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(on), onclick: fn }, icon(name));
  }

  function setGoal(g: number) {
    goal = g;
    goalRow.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(goalOptions[i] === g)));
    tally.setGoal(hold ? Math.floor(g / 5) : g);
    paintBig(counter?.count ?? 0);
    const url = new URL(location.href);
    if (g) url.searchParams.set('goal', String(g));
    else url.searchParams.delete('goal');
    history.replaceState(null, '', url.pathname + url.search);
  }

  let painted = '';
  function paintBig(n: number) {
    const text = hold ? (n < 60 ? String(n) : clock(n * 1000)) : String(n);
    const key = `${text}/${goal}`;
    if (key === painted) return;
    painted = key;
    big.dataset.digits = String(text.replace(':', '').length);
    big.replaceChildren(text);
    if (goal) big.append(h('span.of', {}, `/${hold ? goal : goal}`));
  }

  function applyCamClasses() {
    if (demo) return;
    const s = getSettings();
    cam.classList.toggle('mirror', s.mirror && tracker.facing === 'user');
    cam.classList.toggle('ink-only', !s.showVideo);
    eyeBtn.setAttribute('aria-pressed', String(s.showVideo));
    mirrorBtn.setAttribute('aria-pressed', String(s.mirror));
    soundBtn.setAttribute('aria-pressed', String(s.sound));
  }

  const offSettings = onSettings(() => {
    applyCamClasses();
    requestAnimationFrame(() => overlay.readColors());
  });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => overlay.readColors();
  mq.addEventListener('change', onScheme);

  // ------------------------------------------------ phases

  function setPhase(p: Phase) {
    phase = p;
    el.dataset.phase = p;
    tools.hidden = !(p === 'ready' || p === 'countdown' || p === 'live' || p === 'summary');
    goalRow.hidden = !(p === 'ready' || p === 'intro');
    switch (p) {
      case 'intro':
        primary.textContent = 'Start camera';
        hint.textContent = 'Video stays on this device.';
        break;
      case 'loading':
        primary.textContent = 'Starting…';
        primary.disabled = true;
        hint.textContent = '';
        break;
      case 'ready':
        primary.disabled = false;
        primary.replaceChildren('Start set ', h('kbd', {}, 'space'));
        hint.textContent = getSettings().handsFree ? 'or raise both hands' : '';
        break;
      case 'countdown':
        primary.textContent = 'Cancel';
        hint.textContent = '';
        break;
      case 'live':
        primary.replaceChildren('End set ', h('kbd', {}, 'space'));
        hint.textContent = getSettings().autoEnd ? 'Ends by itself when you stop' : '';
        break;
      case 'summary':
        primary.replaceChildren('Next set ', h('kbd', {}, 'space'));
        hint.textContent = '';
        break;
      case 'error':
        primary.disabled = false;
        primary.textContent = 'Try again';
        hint.textContent = '';
        break;
    }
  }

  function showIntro() {
    const fig = new Figure(id, { autoplay: true, dial: true, label: `${def.name}, demonstrated` });
    introFig = fig;
    layer.replaceChildren(h('div.cam-intro', {},
      fig.el,
      h('p', {}, def.line),
      h('div.setup', {}, def.setup),
      h('a.text-btn', { href: `/count/${id}?demo${goal ? `&goal=${goal}` : ''}` }, 'Or watch it count a drawing first')));
    setPhase('intro');
    cue.textContent = '';
    cue.className = 'cue';
  }
  let introFig: Figure | null = null;

  function showLoading(progress: number, text: string) {
    const W = 300;
    let bar = layer.querySelector<SVGSVGElement>('.bar');
    if (!bar) {
      const track = penStroke([3, 5], [W - 3, 5], 2, 9, 0.01);
      const ink = penStroke([3, 5], [W - 3, 5.5], 5, 10, 0.01);
      const clipId = 'load-clip';
      bar = svg(`0 0 ${W} 10`, { class: 'bar' },
        h('defs', {}, h('clipPath', { id: clipId }, h('rect', { x: 0, y: 0, width: 0, height: 10 }))),
        h('path', { class: 'track', d: track.outline }),
        h('path', { d: ink.outline, 'clip-path': `url(#${clipId})` }));
      layer.replaceChildren(h('div.loading', {}, bar, h('p', {}, text)));
    }
    bar.querySelector('rect')?.setAttribute('width', String(progress * W));
    const p = layer.querySelector('.loading p');
    if (p) p.textContent = text;
  }

  function showError(title: string, text: string) {
    introFig?.destroy();
    layer.replaceChildren(h('div.error-box', {}, h('h2', {}, title), h('p', {}, text)));
    setPhase('error');
  }

  function beginDemo() {
    introFig?.destroy();
    introFig = null;
    layer.replaceChildren(h('a.text-btn.demo-note', { href: `/count/${id}` }, 'Demo — use your camera instead'));
    cam.classList.add('ink-only', 'demo');
    cam.classList.remove('mirror');
    overlay.readColors();
    demoSrc = new DemoSource(id, onFrame);
    demoSrc.start();
    toReady();
    setTimeout(() => {
      if (phase === 'ready' && !destroyed) startCountdown();
    }, 1400);
  }

  async function begin() {
    if (demo) return beginDemo();
    introFig?.destroy();
    introFig = null;
    setPhase('loading');
    const acc = getSettings().accuracy;
    const needsModel = !modelReady(acc);
    showLoading(0, needsModel ? `Getting ready — the pose model is ${MODEL_MB[acc]} MB, only the first time.` : 'Starting the camera…');
    let camErr: unknown = null;
    const camP = tracker.stream ? Promise.resolve() : tracker.openCamera().catch((e) => { camErr = e; });
    let modelErr = false;
    const plP = loadModel(acc, (p) => {
      if (!destroyed && phase === 'loading') showLoading(p, p < 1 ? `Getting ready — the pose model is ${MODEL_MB[acc]} MB, only the first time.` : 'Almost there…');
    }).catch(() => { modelErr = true; return null; });
    const [, pl] = await Promise.all([camP, plP]);
    if (destroyed) return;
    if (camErr) {
      const [t, d] = CAMERA_ERRORS[cameraErrorKind(camErr)];
      return showError(t, d);
    }
    if (modelErr || !pl) return showError('Couldn’t load the pose model', 'Check your connection and try again. Once it has loaded, Tally works offline.');
    layer.replaceChildren();
    Tracker.cameraCount().then((n) => { flipBtn.hidden = n < 2; });
    applyCamClasses();
    overlay.readColors();
    sink = onFrame;
    tracker.start(pl);
    requestWake();
    toReady();
  }

  function toReady() {
    counter = null;
    goalReachedSaid = false;
    startHold.reset();
    body.replaceChildren(score, tallyWrap);
    tally.set(0, false);
    tally.setGoal(hold ? Math.floor(goal / 5) : goal);
    big.classList.add('dim');
    paintBig(0);
    clockEl.textContent = '0:00';
    setLabel.textContent = `Set ${setsToday(id) + 1}`;
    setPhase('ready');
  }

  function startCountdown() {
    const secs = demo ? 2 : getSettings().countdown + (def.floor ? 2 : 0);
    countdownEnd = performance.now() + secs * 1000;
    lastCountdownN = -1;
    setPhase('countdown');
    say(def.floor ? 'Get down' : 'Ready', true);
  }

  function cancelCountdown() {
    countdownEl.replaceChildren();
    toReady();
  }

  function goLive() {
    countdownEl.replaceChildren();
    counter = new Counter(def);
    setStart = performance.now();
    lastActivity = setStart;
    stopHold.reset();
    big.classList.remove('dim');
    paintBig(0);
    setPhase('live');
    demoSrc?.perform();
    sound.pip(true);
    say('Go', true);
  }

  function endSet() {
    if (!counter) return toReady();
    const sum = counter.summary();
    const dur = performance.now() - setStart;
    const n = hold ? Math.floor(sum.holdMs / 1000) : sum.count;
    sound.done();
    if (n > 0) say(`${n} ${n === 1 ? def.one : def.many}`, true);
    lastRecord = null;
    if (n > 0 && !demo) {
      const rec: SetRecord = {
        id: newId(),
        ex: id,
        at: Date.now() - Math.round(dur),
        dur: Math.round(dur),
        n,
        goal: goal || undefined,
        misses: sum.misses,
        reps: sum.marks.map((m) => [m.t, Math.round(m.depth * 100), m.tempo]),
      };
      if (addSet(rec)) lastRecord = rec;
      else toast('Couldn’t save — browser storage is full or blocked.');
    }
    showSummary(n, dur, sum);
    counter = null;
    needRelease = true;
    startHold.reset();
    setPhase('summary');
  }

  function showSummary(n: number, dur: number, sum: ReturnType<Counter['summary']>) {
    const stats = h('div.stats', {},
      stat(clock(dur), 'time'),
      hold ? null : stat(n ? `${Math.round(sum.avgDepth * 100)}%` : '—', 'avg depth'),
      hold ? null : stat(n > 1 ? `${(sum.avgTempo / 1000).toFixed(1)}s` : '—', 'per rep'),
      stat(String(sum.misses), 'didn’t count'),
    );
    const actions = h('div', { style: { display: 'flex', gap: '8px 20px', flexWrap: 'wrap', alignItems: 'center' } },
      n > 0 && lastRecord ? h('button.text-btn', { type: 'button', onclick: discard }, 'Don’t save') : null,
      n > 0 && !demo ? h('button.text-btn', { type: 'button', onclick: () => challenge(n) }, 'Challenge someone') : null,
      h('a.text-btn', { href: '/ledger' }, 'Ledger'));
    const title = n > 0
      ? h('div.summary-title', {}, String(hold ? clock(n * 1000) : n), h('small', {}, hold ? 'held' : n === 1 ? def.one : def.many))
      : h('div.summary-title', {}, '0', h('small', {}, 'nothing counted'));
    const strip = !hold && sum.marks.length ? repStrip(sum.marks.map((m) => [m.t, Math.round(m.depth * 100), m.tempo])) : null;
    const note = demo
      ? h('p.cue', {}, 'That was the drawing — nothing saved. ', h('a', { href: `/count/${id}` }, 'Now try it with your camera.'))
      : n > 0
      ? h('p.cue', {}, lastRecord ? 'Saved to your ledger.' : '')
      : h('p.cue', {}, 'Nothing was saved. If Tally missed reps, check the hint at the bottom of the camera.');
    body.replaceChildren(h('div.summary', {}, title, stats, strip, tally.el, note, actions));
    cue.textContent = '';
    cue.className = 'cue';
  }

  function stat(v: string, k: string) {
    return h('div.stat', {}, h('b', {}, v), h('span', {}, k));
  }

  function discard() {
    if (!lastRecord) return;
    const rec = lastRecord;
    removeSet(rec.id);
    lastRecord = null;
    toast('Set removed.', { label: 'Undo', run: () => { addSet(rec); lastRecord = rec; } });
    toReady();
  }

  async function challenge(n: number) {
    const url = `${location.origin}/count/${id}?goal=${n}`;
    const text = hold ? `I held a plank for ${clock(n * 1000)}. Your turn:` : `I did ${n} ${n === 1 ? def.one : def.many}. Can you beat it?`;
    try {
      if (navigator.share) await navigator.share({ title: 'Tally', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Link copied.');
      }
    } catch {
      /* cancelled */
    }
  }

  // ------------------------------------------------ per frame

  function onFrame(f: PoseFrame | null) {
    if (destroyed) return;
    const t = f?.t ?? performance.now();
    const s = getSettings();
    const fr = framing(f, def);
    let reading: Reading | null = null;
    let ring = 0;

    if (phase === 'ready') {
      const m = f ? def.measure(f) : null;
      reading = m && !('gate' in m) ? (Array.isArray(m) ? m[0] : m) : null;
      if (s.handsFree) {
        const g = startHold.update(handsUp(f), t);
        ring = g.progress;
        if (g.fire) {
          sound.armed();
          startCountdown();
        }
      }
      setChip(demo ? 'Demo — the drawing stands in for your camera' : fr.hint ?? (s.handsFree ? 'Ready — raise both hands to start' : 'Ready'), fr.level);
    } else if (phase === 'countdown') {
      const left = Math.ceil((countdownEnd - performance.now()) / 1000);
      if (left !== lastCountdownN) {
        lastCountdownN = left;
        if (left > 0) {
          countdownEl.replaceChildren(h('span', {}, String(left)));
          sound.pip(false);
        }
      }
      if (left <= 0) goLive();
      setChip(fr.hint ?? 'Get in position', fr.level);
    } else if (phase === 'live' && counter) {
      const events = counter.update(f, t);
      for (const e of events) {
        if (e.type === 'rep') {
          lastActivity = t;
          tally.set(e.count);
          sound.rep(e.count);
          if (!hold) {
            say(String(e.count));
            live.textContent = String(e.count);
          }
          if (goal && !goalReachedSaid && (hold ? counter.holdMs >= goal * 1000 : e.count >= goal)) {
            goalReachedSaid = true;
            setTimeout(() => sound.done(), 250);
            say('Goal', true);
          }
        } else if (e.type === 'miss') {
          sound.miss();
        }
      }
      const v = counter.view;
      reading = v.reading;
      if (v.depth > MOVE || v.holding) lastActivity = t;

      paintBig(hold ? Math.floor(counter.holdMs / 1000) : counter.count);
      if (!hold) {
        const d = Math.max(0, Math.min(1.05, v.depth));
        gaugeFill.setAttribute('y1', String(100 - d * 100));
        gauge.classList.toggle('reached', d >= ENTER);
      }
      clockEl.textContent = clock(t - setStart);

      const text = v.gate ?? v.cue ?? fr.hint ?? (hold ? (v.holding ? 'Holding — keep the line' : 'Get into position') : '');
      cue.textContent = text;
      cue.className = `cue${v.gate || v.cueIsFix || (fr.hint && !v.cue) ? ' fix' : ''}`;
      setChip(fr.hint ?? (hold ? (v.holding ? 'Holding' : 'Not holding') : 'Counting'), fr.level);

      if (s.handsFree && !def.armsUp) {
        const g = stopHold.update(handsUp(f), t);
        ring = g.progress;
        if (g.fire) return endSet();
      }
      const done = hold ? counter.holdMs > 1000 : counter.count > 0;
      const idle = demo ? 2200 : hold ? 4000 : 7000;
      if ((s.autoEnd || demo) && done && t - lastActivity > idle && !demoSrc?.moving) return endSet();
    } else if (phase === 'summary') {
      setChip(fr.hint ?? (s.handsFree ? 'Raise both hands for the next set' : 'Set saved'), fr.level);
      const up = handsUp(f);
      if (!up) needRelease = false;
      if (s.handsFree && !needRelease) {
        const g = startHold.update(up, t);
        ring = g.progress;
        if (g.fire) {
          toReady();
          sound.armed();
          startCountdown();
        }
      }
    }

    overlay.draw(f, {
      mirror: cam.classList.contains('mirror'),
      reading,
      unit: def.unit ?? '°',
      handsUp: ring,
      fit: demo || !getSettings().showVideo ? 'contain' : 'cover',
      size: demo ? { w: FIG_W, h: FIG_H } : undefined,
    });
  }

  let chipText = '';
  let chipLevel = '';
  function setChip(text: string, level: string) {
    if (text === chipText && level === chipLevel) return;
    chipText = text;
    chipLevel = level;
    chip.dataset.level = level;
    chip.replaceChildren(h('span.dot'), text);
  }

  // ------------------------------------------------ wake lock, keys

  async function requestWake() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* not allowed: fine */
    }
  }
  const onVis = () => {
    if (document.visibilityState === 'visible' && phase !== 'intro' && phase !== 'error') requestWake();
  };
  document.addEventListener('visibilitychange', onVis);

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.closest?.('dialog')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      primary.click();
    } else if (e.key === 'Escape') {
      if (phase === 'countdown') cancelCountdown();
      else if (phase === 'live') endSet();
    }
  };
  document.addEventListener('keydown', onKey);

  // ------------------------------------------------ go

  tally.setGoal(hold ? Math.floor(goal / 5) : goal);
  paintBig(0);
  if (demo) {
    beginDemo();
  } else if (tracker.stream && modelReady(getSettings().accuracy)) {
    // switching movements with the camera already running
    sink = onFrame;
    Tracker.cameraCount().then((n) => { flipBtn.hidden = n < 2; });
    applyCamClasses();
    requestWake();
    toReady();
  } else {
    showIntro();
    cameraPermission().then((p) => {
      if (p === 'granted' && phase === 'intro' && !destroyed) begin();
    });
  }

  return {
    el,
    title: `${def.name} — Tally`,
    destroy() {
      destroyed = true;
      introFig?.destroy();
      demoSrc?.stop();
      offSettings();
      mq.removeEventListener('change', onScheme);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', onKey);
      wakeLock?.release().catch(() => undefined);
      if (phase === 'live' && counter && counter.count > 0 && !demo) endSet();
      release();
    },
  };
}
