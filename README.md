# Tally

Counts your reps by watching you move. In the browser, nothing uploaded.

**https://tally.mehmetdedeler.com**

Prop up your phone or laptop, pick a movement, raise both hands and go. Tally
finds 33 points on your body with an on-device pose model, measures one angle
per movement, and inks a tally mark for every rep. If a rep doesn't count, it
says why.

Formerly Replike (and before that RepDetect). Rebuilt from scratch in October
2026 — see [PLAN.md](PLAN.md) for the goals, design and roadmap.

## Movements

Squats · push-ups · jumping jacks · lunges · plank (timed hold) · sit-ups ·
high knees · burpees · jump squats

## How it counts

Each movement in [`src/pose/exercises.ts`](src/pose/exercises.ts) declares what
it needs to see and returns one number per frame — usually a 3D joint angle
from MediaPipe's world landmarks, which doesn't change with where you stand in
the frame. [`src/pose/counter.ts`](src/pose/counter.ts) turns that number into
reps:

- depth is the reading mapped onto the movement's range (0 at the top, 1 at the
  bottom)
- a rep is an excursion past 65% that returns below 24%
- a shallow excursion is a miss, with a reason
- the range learns from your own reps (never stricter than the default), and
  three consistent shallow reps move the line toward you, at most 30%
- landmarks are smoothed with a One Euro filter first

The tests run the counter against synthetic movement generated from the same
stick-figure keyframes used for the demos: the figure does ten squats, the
counter must count ten.

## Privacy

Video never leaves the device. Sets are stored in `localStorage` and can be
exported to JSON from the Ledger. The pose model is fetched once from Google's
model storage and cached; the MediaPipe WASM runtime is served from this site.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # counter tests on synthetic movement
npm run build    # static site in dist/
```

Try any movement without a camera at `/count/<id>?demo` — the drawn figure
stands in for the camera and drives the real counter.

## Stack

Vite + TypeScript, no UI framework. One runtime dependency:
`@mediapipe/tasks-vision`. Hosted on Vercel as static files.
Fraunces, Spectral and DM Mono.
