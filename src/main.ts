import './styles/main.css';
import { startRouter } from './lib/router';
import { getSettings, onSettings } from './lib/store';
import { isExercise } from './pose/exercises';
import { logo } from './ui/bits';
import { homeView } from './views/home';
import { countView } from './views/count';
import { ledgerView } from './views/ledger';
import { aboutView } from './views/about';
import { openSettings } from './views/settings';

function applyTheme() {
  const t = getSettings().theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', paper));
}
applyTheme();
onSettings(applyTheme);

document.getElementById('logo')?.replaceWith(logo());
document.getElementById('open-settings')?.addEventListener('click', openSettings);
const dlg = document.getElementById('settings') as HTMLDialogElement;
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) dlg.close();
});

const top = document.getElementById('top')!;
const onScroll = () => top.classList.toggle('scrolled', scrollY > 4);
addEventListener('scroll', onScroll, { passive: true });

startRouter(document.getElementById('view')!, [
  { match: /^\/$/, make: () => homeView() },
  {
    match: /^\/count\/([a-z_]+)$/,
    make: (m, q) => (isExercise(m[1]) ? countView(m[1], q) : homeView()),
  },
  { match: /^\/ledger$/, make: () => ledgerView() },
  { match: /^\/about$/, make: () => aboutView() },
], (path) => {
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    const n = a.dataset.nav!;
    const on = n === '/' ? path === '/' || path.startsWith('/count') : path.startsWith(n);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.dataset.route = path.split('/')[1] || 'home';
  onScroll();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
