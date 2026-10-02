import { h } from '../lib/dom';
import type { View } from '../lib/router';
import { EXERCISES, ORDER } from '../pose/exercises';
import { tallyStatic } from '../ui/ink';
import { footer } from './footer';

export function aboutView(): View {
  const el = h('div', {},
    h('section.page', {}, h('div.wrap', {},
      h('h1.page-title', {}, 'About'),
      h('div.prose', {},
        h('p', { style: { fontSize: '21px' } },
          'Tally counts your reps by watching you move. Open it, put your phone or laptop down where it can see all of you, and exercise. It counts squats, push-ups, planks and six other movements, says when a rep didn’t count and why, and keeps a ledger of what you’ve done.'),

        h('h2', {}, 'How it counts'),
        h('p', {},
          'A pose model (Google’s MediaPipe, running on your device) finds 33 points on your body in every camera frame, in three dimensions. Tally measures one angle per movement from those points. Because the angle is measured in 3D, it doesn’t change with where you stand in the picture.'),
        h('p', {},
          'A rep is that angle leaving the top of the movement, passing a depth line, and coming back. A bend that doesn’t reach the line is a miss, and Tally says so. If three misses in a row stop at the same depth, it assumes the camera angle is hiding some of it and moves the line toward you — never further than 30%.'),
        h('ul.how', {},
          ...ORDER.map((id) => h('li', {}, h('b', {}, EXERCISES[id].name), h('span', {}, EXERCISES[id].counts)))),

        h('h2', {}, 'Getting a good count'),
        h('ul', {},
          h('li', {}, h('strong', {}, 'All of you in the picture. '), 'Most counting trouble is feet or hands out of frame. The hint at the bottom of the camera tells you what it can’t see.'),
          h('li', {}, h('strong', {}, 'Side-on for floor work. '), 'Push-ups, sit-ups and planks need the camera beside you, at floor level.'),
          h('li', {}, h('strong', {}, 'Light in front of you. '), 'A bright window behind you turns you into a silhouette.'),
          h('li', {}, h('strong', {}, 'One person. '), 'Tally follows whoever it sees most clearly.'),
        ),

        h('h2', { id: 'privacy' }, 'Privacy'),
        h('p', {},
          h('strong', {}, 'Your camera picture never leaves your device. '),
          'It isn’t recorded, stored or uploaded. The pose model is downloaded once and then runs in your browser; Tally only keeps the handful of numbers it needs to count.'),
        h('p', {},
          'Your sets are stored in this browser’s local storage. There’s no account and no server holding your data. You can export everything to a file from the Ledger, import it on another device, or delete it. Clearing your browser’s site data deletes it too.'),
        h('p', {},
          'The page loads its fonts from Google Fonts and the pose model from Google’s servers the first time. After that it works offline.'),

        h('h2', {}, 'The name'),
        h('div.etym', {},
          tallyStatic(5, { perRow: 1, seed: 2 }),
          h('p', {},
            'A ', h('strong', {}, 'tally'), ' was a stick notched to keep count — from the Latin ', h('em', {}, 'talea'),
            ', a cutting. People have kept count this way for at least 20,000 years. Four strokes and one through them. One mark for each thing done.')),
        h('p', {},
          'Tally used to be called Replike, and before that RepDetect. It was rebuilt from scratch in 2026: new counting, new look, and much less in the way between you and the first rep.'),

        h('h2', {}, 'Made by'),
        h('p', {},
          h('a', { href: 'https://mehmetdedeler.com' }, 'Mehmet Dedeler'),
          '. Built with TypeScript, Vite and ', h('a', { href: 'https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker' }, 'MediaPipe Pose Landmarker'),
          '. Set in Fraunces, Spectral and DM Mono.'),
      ),
    )),
    footer(),
  );
  return { el, title: 'About — Tally' };
}
