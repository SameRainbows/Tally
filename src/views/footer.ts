import { h } from '../lib/dom';

export function footer() {
  return h('footer.foot', {},
    h('div.wrap', {},
      h('span', {}, 'Tally, made by ', h('a', { href: 'https://mehmetdedeler.com' }, 'Mehmet Dedeler'), '.'),
      h('nav', { 'aria-label': 'Footer' },
        h('a', { href: '/about' }, 'How it counts'),
        h('a', { href: '/about#privacy' }, 'Privacy'),
        h('a', { href: 'https://github.com/SameRainbows' }, 'GitHub'),
      ),
      h('span.mono', {}, `v${__VERSION__}`),
    ),
  );
}
