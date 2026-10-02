# Tally — goals and plan

Tally is the rebuild of Replike / RepDetect. It counts your reps by watching you
move, in the browser, with nothing uploaded.

**Address:** tally.mehmetdedeler.com (the old replike.vercel.app redirects here)

---

## Why "Tally"

A tally stick is a notched piece of wood people used to keep count for at least
20,000 years. One notch, one thing counted. Four strokes and a strike through
them is still how most people count by hand.

That's the whole app: every rep you do becomes one mark. The name is a real word,
one breath to say, and it sits next to Kairos, Formicai and Orbital without
sounding like a startup. It also gives the design its central idea for free —
the tally mark is the logo, the counter, the progress bar and the history.

Names considered and dropped: *Spotter* (good gym word, but about lifting
weights), *Cadence* and *Tempo* (overused), *Askesis* and *Arete* (Greek, fits
Kairos, but hard to say), *Kinesis* (sounds like a lab).

---

## What was wrong with the old one

- **A quiz before anything.** A "What is your primary goal?" modal sat in front
  of every page, including About. You couldn't see the product without filling
  in a profile it barely used.
- **Six nav items for one job.** Workout, Builder, History, Trends, Settings,
  About. The thing people came for (counting) was one link of six.
- **Generic look.** Dark gradient, glow, emoji icons, scrolling marquee of
  exercise names. Nothing you'd remember. Nothing that said "counting".
- **Unreadable from where you'd use it.** You use this from 2–3 m away with the
  phone propped on a chair. The count lived in a small overlay.
- **Counting maths had real bugs.** Angles came from 2D normalised coordinates
  where x and y have different scales, so a knee angle changed when you moved
  across the frame. Rep "quality" was worked out by parsing percentages back out
  of the feedback text with a regex. Lunges never reported a miss.
- **GPU only.** If WebGL failed, the model failed. No fallback.
- **Heavy stack for a static app.** Next.js 14, React, framer-motion for what is
  a single page with a camera.

---

## Goals

1. **Counting within 15 seconds of landing.** No account, no quiz, no modal. The
   home page *is* the exercise list. Pick one, allow the camera, move.
2. **A count you can believe.** 3D joint angles from MediaPipe's world landmarks
   (they don't change with where you stand in the frame), One Euro filtering,
   hysteresis on every threshold, and calibration that learns your range from
   your own reps instead of asking you to pose first. When a rep doesn't count,
   say why in one short sentence.
3. **Readable across a room.** The live screen is designed for a phone 2–3 m
   away: a huge count, one cue at a time, and sound so you don't have to look.
4. **Hands-free.** Raise both hands to start. The set ends itself when you
   stop moving. Keep the screen awake. You should never have to walk back to
   the phone mid-set.
5. **Private by construction, not by promise.** Video never leaves the device.
   Data lives in the browser and exports to a file you own. Works offline after
   the first visit.
6. **Looks like nothing else.** Paper and ink by day, slate and chalk by night.
   Tally marks drawn with a pen, every one slightly different. A small inked
   figure demonstrates each movement. It should feel like it belongs on
   mehmetdedeler.com.
7. **Simple tech.** Vite + TypeScript, no UI framework, one runtime dependency
   (MediaPipe). Static files on Vercel. Small enough for one person to hold in
   their head.
8. **Room to grow.** Exercises are data plus one measurement function. The
   stored set records keep enough detail (each rep's depth and tempo) that
   plans, goals, trends and a coach can be built on top later without a
   migration.

---

## Design

**Two materials.**

| | Paper (light) | Slate (dark) |
|---|---|---|
| Ground | warm notebook paper `#f3efe6` | chalkboard slate `#1c2120` |
| Mark | iron-gall ink `#1c1b19` | chalk `#ecebe3` |
| Correction | pencil red `#c0392b` | salmon chalk `#f08a6c` |
| Texture | paper grain | chalk dust |

Red only ever means "the coach is saying something" — a miss, a form cue.

**Type.** Fraunces for the count and headings (soft, inky serifs that stay
legible at 300px tall), Spectral for prose and DM Mono for labels and numbers —
the same body and mono faces as mehmetdedeler.com, so it reads as family.

**The tally.** Every counted rep draws one stroke, animated like a pen, with its
own small wobble. Every fifth is the strike. If you set a goal, the goal is
pre-drawn in faint pencil and each rep inks over one mark.

**The figure.** A small inked stick figure, built from joint angles (forward
kinematics) rather than drawings or video, demonstrates every exercise on the
home page. The same pen draws your own skeleton over the camera, with the joint
being measured circled in red and its angle shown.

**Your camera feed** is shown in greyscale and blended into the paper, so you
look printed on the page. One tap hides it and leaves only your inked figure.

**Layout.** A notebook spread on wide screens — you on the left page, the count
on the right. Stacked on phones, with the count big enough to read from the
floor.

---

## Tech

- **Vite + TypeScript**, plain DOM. A 40-line router and a tiny `h()` helper.
- **@mediapipe/tasks-vision 1.0** PoseLandmarker in VIDEO mode, `lite` model by
  default (`full` in settings). GPU delegate with automatic CPU fallback. WASM
  self-hosted from `/mediapipe`, model fetched with a progress bar.
- **Detector engine.** Each exercise declares the landmarks it needs, the
  camera view it prefers and one `measure()` function that returns a single
  signal (e.g. knee angle). A shared counter turns that into reps with
  hysteresis, a minimum tempo, partial-rep detection and per-user range
  learning. Plank is a hold timer on the same engine.
- **Tests** run the detectors against synthetic movement generated from the
  same figure keyframes used for the demos: the figure does ten squats, the
  detector must count ten.
- **Storage** in `localStorage`, versioned, with JSON export/import.
- **PWA**: manifest + a hand-written service worker. Installs to the home
  screen, works offline after the first load.
- **Screen Wake Lock** during a session. **Web Audio** for the tick (no audio
  files). **Speech synthesis** for counting aloud, off by default.
- **Hosting**: Vercel, static. `vercel.json` handles SPA rewrites, long cache
  headers on hashed assets, and the old Replike paths.

---

## Plan

Each phase ends with something deployed and usable. Phases after 1 are ordered
by value, not fixed — reorder freely.

### Phase 0 — Ground (first pass, 2 Oct 2026)
- [x] Name, folder, Vite + TS scaffold, design tokens in both themes
- [x] Vercel project `tally`, domain `tally.mehmetdedeler.com` attached
- [x] DNS: `A tally → 76.76.21.21` at Cloudflare, DNS only (grey cloud)
- [x] Redirect `replike.vercel.app` → `tally.mehmetdedeler.com` (old paths
      `/workout`, `/history`, `/trends` map to their new pages)
- [x] mehmetdedeler.com map: the Replike island renamed to Tally
- [x] GitHub repo renamed Replike → Tally; pushes to `main` deploy to Vercel

### Phase 1 — The core loop (first pass, 2 Oct 2026)
- [x] Home: hero with the inked figure counting its own squats; the exercise
      list with a live demo per movement
- [x] Live counting screen: camera, inked skeleton, measured-joint dial, the
      tally, one cue line, tracking status
- [x] Nine movements ported to the new engine: squats, push-ups, jumping jacks,
      lunges, high knees, sit-ups, burpees, jump squats, plank (hold)
- [x] Hands-free start (both hands up), countdown, auto-end after stillness
- [x] Optional goal per set (`?goal=20`), drawn in pencil
- [x] Set summary: count, time, average depth, a strip of every rep
- [x] Ledger: week strip, year of marks, day-by-day sets, personal bests,
      export / import / clear
- [x] Settings: theme, sound, voice count, show camera, mirror, countdown,
      model accuracy, hands-free
- [x] About: how it counts, in plain words; privacy; the name
- [x] Offline + installable
- [x] **Demo mode** (`/count/<id>?demo`): the drawn figure stands in for the
      camera and drives the real counter. Lets people see it work before
      allowing the camera, and made the whole flow testable without one.
- [x] "Challenge someone": shares a link that opens the same movement with
      your count as the goal (the cheap half of Phase 4)
- [ ] **Not yet tested with a real camera and a real person.** The counter is
      tested on synthetic movement only. First job of Phase 2.

### Phase 2 — Trust (next)
- [ ] **Recorder.** A hidden `/bench` page that records landmark traces from
      real sessions to a JSON file. No video, just numbers.
- [ ] **Real-data tests.** Commit a handful of traces per exercise (different
      people, distances, lighting) and make the tests run on them. Tune
      thresholds against the traces, not by feel.
- [ ] **Accuracy table on About.** "Counted 98 of 100 squats in testing" —
      honest numbers per exercise.
- [ ] Better side-view handling for push-ups and sit-ups (pick the side facing
      the camera by visibility).

### Phase 3 — Sessions, not just sets
- [ ] Routines: a list of sets with rest between, e.g. 3 × 15 squats, 3 × 10
      push-ups. The rest timer runs itself; the next exercise starts by
      raising your hands.
- [ ] A few starter routines written in plain words.
- [ ] Weekly target ("150 reps this week") shown as pencil marks in the ledger.
- [ ] Rest-day suggestions from the ledger (from the old ideas list).

### Phase 4 — Share
- [ ] Share card: a PNG of the set's tally, drawn on canvas, via the share
      sheet.
- [ ] Challenge links: `tally.mehmetdedeler.com/count/squats?goal=30&from=Mehmet`
      opens straight into that set with the goal drawn and a line saying who
      sent it. No server needed.

### Phase 5 — Coach (opt-in, needs a small server)
- [ ] A Vercel function that sends **numbers only** (set history, never video)
      to Claude for a weekly read of your training and a suggested next week.
- [ ] Off unless switched on, with a plain explanation of exactly what is sent.

### Experiments shelf
Ideas worth a weekend each, to try when the core is solid:
- **Ghost.** Race your previous best set: a faint pencil figure moves at the
  pace of your last attempt.
- **Tempo mode.** A metronome sets the pace (e.g. 3 s down, 1 s up); marks turn
  red when you rush.
- **Wall.** A full-screen year of tally marks, chalk on slate, for a TV.
- **Rear camera on phones** with the phone on the floor, for push-ups.
- **More movements:** glute bridges, mountain climbers, wall sits, pull-ups (a
  rep is when the chin clears the wrists).

---

## Working on it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # detector tests on synthetic movement
npm run build    # static output in dist/
vercel --prod    # deploy
```

Add an exercise: one entry in `src/pose/exercises.ts` (what to measure, the
range, the cues) and one entry in `src/figure/poses.ts` (keyframes for the
demo). The tests pick it up automatically.
