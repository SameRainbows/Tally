// History routing for four pages. Links with data-link are handled in place.

export type View = { el: HTMLElement; title: string; destroy?: () => void };
export type Route = { match: RegExp; make: (m: RegExpMatchArray, q: URLSearchParams) => View };

let routes: Route[] = [];
let current: View | null = null;
let outlet: HTMLElement;
let onChange: (path: string) => void = () => undefined;

export function startRouter(el: HTMLElement, rs: Route[], changed: (path: string) => void) {
  outlet = el;
  routes = rs;
  onChange = changed;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith('/mediapipe') || /\.\w+$/.test(url.pathname)) return;
    // same page, different #section: let the browser scroll
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    go(url.pathname + url.search + url.hash);
  });
  addEventListener('popstate', () => render());
  render();
}

export function go(path: string, replace = false) {
  const here = location.pathname + location.search + location.hash;
  if (path === here) return;
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}

function render() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(location.search);
  for (const r of routes) {
    const m = path.match(r.match);
    if (!m) continue;
    current?.destroy?.();
    const v = r.make(m, q);
    current = v;
    outlet.replaceChildren(v.el);
    document.title = v.title;
    if (!location.hash) window.scrollTo(0, 0);
    onChange(path);
    return;
  }
  go('/', true);
}
