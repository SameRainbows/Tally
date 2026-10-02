import { h, icon, reducedMotion } from '../lib/dom';
import { Figure } from '../figure/figure';
import { Tally } from '../ui/ink';
import { EXERCISES, ORDER } from '../pose/exercises';
import type { ExerciseId } from '../pose/types';
import type { View } from '../lib/router';
import { footer } from './footer';

const SHOWCASE: ExerciseId[] = ['squats', 'push_ups', 'jumping_jacks', 'lunges', 'sit_ups'];
const PER_SHOWCASE = 10;

export function homeView(): View {
  const figures: Figure[] = [];

  // ------------------------------------------------ hero: the figure counts itself
  let idx = 0;
  let n = 0;
  const count = h('div.stage-count', { 'aria-hidden': 'true' }, '0');
  const word = h('div.stage-word', {}, EXERCISES[SHOWCASE[0]].many);
  const tally = new Tally({ perRow: 2, seed: 4 });
  const hero = new Figure(SHOWCASE[0], {
    dial: true,
    autoplay: true,
    label: 'A drawn figure doing squats while Tally counts them',
    onRep: () => {
      n++;
      count.textContent = String(n);
      tally.set(n);
      if (n >= PER_SHOWCASE) setTimeout(() => select((idx + 1) % SHOWCASE.length), 900);
    },
  });
  figures.push(hero);

  const tabs = SHOWCASE.map((id, i) =>
    h('button', { type: 'button', 'aria-pressed': String(i === 0), onclick: () => select(i) }, EXERCISES[id].name),
  );

  function select(i: number) {
    idx = i;
    n = 0;
    count.textContent = '0';
    tally.set(0);
    word.textContent = EXERCISES[SHOWCASE[i]].many;
    hero.setExercise(SHOWCASE[i]);
    tabs.forEach((t, k) => t.setAttribute('aria-pressed', String(k === i)));
  }

  if (reducedMotion()) {
    count.textContent = '7';
    tally.set(7, false);
  }

  const heroEl = h('section.hero', {},
    h('div.wrap', {},
      h('div', {},
        h('h1.display', {}, 'Every rep, ', h('em', {}, 'marked'), '.'),
        h('p.lede', {},
          'Prop up your phone or laptop, pick a movement and go. Tally watches you through the camera and counts each rep — ',
          h('strong', {}, 'in this browser, with nothing uploaded'), ' and nothing to sign up for.'),
        h('div.hero-cta', {},
          h('a.btn.big', { href: '/count/squats' }, 'Start with squats', icon('arrow')),
          h('a.text-btn', { href: '#moves' }, 'or pick a movement'),
        ),
      ),
      h('div.stage-card', {},
        hero.el,
        h('div.stage-foot', {}, tally.el, h('div.stage-num', {}, count, word)),
        h('div.stage-tabs', { role: 'group', 'aria-label': 'Example movement' }, ...tabs),
      ),
    ),
  );

  // ------------------------------------------------ the list
  const cards = ORDER.map((id) => {
    const d = EXERCISES[id];
    const fig = new Figure(id, { autoplay: true, label: `${d.name}, demonstrated` });
    figures.push(fig);
    const view = d.view === 'front' ? 'Facing the camera' : d.view === 'side' ? 'Side-on' : 'Side-on or facing';
    return h('a.move', { href: `/count/${id}` },
      fig.el,
      h('div.move-name', {}, d.name, icon('arrow')),
      h('p.move-line', {}, d.line),
      h('div.move-meta', {}, `${view} · ${d.kind === 'hold' ? 'timed hold' : 'reps'}`),
    );
  });

  const moves = h('section.section#moves', {},
    h('div.wrap', {},
      h('div.section-head', {},
        h('h2.h2', {}, 'Nine movements'),
        h('span.label', {}, 'Pick one to start'),
      ),
      h('div.moves', {}, ...cards),
    ),
  );

  const steps = h('section.section', {},
    h('div.wrap', {},
      h('div.section-head', {}, h('h2.h2', {}, 'How it works')),
      h('div.steps', {},
        h('div.step', {}, h('div.step-n', {}, '1'), h('h3', {}, 'Stand back'),
          h('p', {}, 'Put the phone down 2–3 metres away so your whole body is in the picture. Tally tells you if it can’t see your feet.')),
        h('div.step', {}, h('div.step-n', {}, '2'), h('h3', {}, 'Raise both hands'),
          h('p', {}, 'That starts the set — no walking back to the screen. A short countdown gives you time to get into position.')),
        h('div.step', {}, h('div.step-n', {}, '3'), h('h3', {}, 'Move'),
          h('p', {}, 'Each rep inks a mark. If one doesn’t count, it says why. Stop moving and the set ends and saves itself.')),
      ),
    ),
  );

  const priv = h('section.section', {},
    h('div.wrap', {},
      h('div.private', {},
        h('div', {},
          h('h2.h2', {}, 'Your camera stays yours'),
          h('p', { style: { marginTop: '14px' } }, 'The pose model runs on your device. Tally only ever sees 33 points on your body, a few dozen times a second, and keeps the numbers it needs to count.'),
        ),
        h('ul', {},
          h('li', {}, 'No video is recorded, stored or sent anywhere.'),
          h('li', {}, 'No account. Your sets live in this browser.'),
          h('li', {}, 'Export them to a file any time, or wipe them.'),
          h('li', {}, 'Works offline once it has loaded.'),
        ),
      ),
    ),
  );

  const el = h('div', {}, heroEl, moves, steps, priv, footer());

  return {
    el,
    title: 'Tally — counts your reps by watching you move',
    destroy: () => figures.forEach((f) => f.destroy()),
  };
}
