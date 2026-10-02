import { h, icon, svg } from '../lib/dom';
import type { View } from '../lib/router';
import { allSets, removeSet, addSet, clearSets, exportData, importData, dayKey, dayLabel, clock, type SetRecord } from '../lib/store';
import { EXERCISES, ORDER } from '../pose/exercises';
import { penStroke, tallyStatic } from '../ui/ink';
import { repStrip, toast } from '../ui/bits';
import { footer } from './footer';

const DAY = 86400000;

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday of this week, local time. */
function weekStart(ms: number) {
  const d = new Date(startOfDay(ms));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

const volume = (s: SetRecord) => (EXERCISES[s.ex].kind === 'hold' ? Math.round(s.n / 5) : s.n);

export function ledgerView(): View {
  const el = h('div', {});
  render();
  return { el, title: 'Ledger — Tally' };

  function render() {
    const sets = allSets();
    const now = Date.now();
    const wk = weekStart(now);
    const thisWeek = sets.filter((s) => s.at >= wk);
    const byDay = new Map<string, SetRecord[]>();
    for (const s of sets) {
      const k = dayKey(s.at);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(s);
    }

    const page = h('section.page', {}, h('div.wrap', {},
      h('h1.page-title', {}, 'Ledger'),
      h('p.page-sub', {}, sets.length
        ? 'Every set you’ve done, kept in this browser.'
        : 'Your sets will show up here. They stay in this browser — nothing is sent anywhere.'),
      sets.length ? content() : empty(),
      tools(),
    ));
    el.replaceChildren(page, footer());

    function content() {
      const repsWeek = thisWeek.filter((s) => EXERCISES[s.ex].kind === 'reps').reduce((a, s) => a + s.n, 0);
      const holdWeek = thisWeek.filter((s) => EXERCISES[s.ex].kind === 'hold').reduce((a, s) => a + s.n, 0);
      const allReps = sets.filter((s) => EXERCISES[s.ex].kind === 'reps').reduce((a, s) => a + s.n, 0);

      // streak: consecutive days with a set, ending today or yesterday
      let streak = 0;
      let d = startOfDay(now);
      if (!byDay.has(dayKey(d))) d -= DAY;
      while (byDay.has(dayKey(d))) {
        streak++;
        d -= DAY;
      }

      const totals = h('div.totals', {},
        total(repsWeek, 'reps this week'),
        holdWeek ? total(clock(holdWeek * 1000), 'held this week') : total(thisWeek.length, thisWeek.length === 1 ? 'set this week' : 'sets this week'),
        total(streak, streak === 1 ? 'day in a row' : 'days in a row'),
        total(allReps, 'reps, all time'),
      );

      // this week, Monday to Sunday
      const week = h('div.week', { role: 'list', 'aria-label': 'This week' },
        ...Array.from({ length: 7 }, (_, i) => {
          const ms = wk + i * DAY + 3600000 * 12;
          const k = dayKey(ms);
          const ds = byDay.get(k) ?? [];
          const reps = ds.reduce((a, s) => a + volume(s), 0);
          const name = new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
          return h('div.day-col', { role: 'listitem', class: `${k === dayKey(now) ? 'today' : ''} ${ds.length ? '' : 'empty'}`, 'aria-label': `${name}: ${ds.length} sets` },
            h('span.label', {}, name),
            ds.length ? tallyStatic(ds.length, { perRow: 1, seed: i + 3 }) : h('span'),
            h('b', {}, reps ? String(reps) : '·'));
        }));

      return h('div', {},
        totals,
        h('div.section-head', {}, h('h2.h2', {}, 'This week'), h('span.label', {}, 'a mark per set')),
        week,
        year(byDay),
        bests(sets),
        days(byDay),
      );
    }

    function total(v: number | string, k: string) {
      return h('div.total', {}, h('b', {}, String(v)), h('span', {}, k));
    }

    function empty() {
      return h('div.empty-state', {},
        tallyStatic(0, { perRow: 1 }),
        h('a.btn', { href: '/' }, 'Do your first set', icon('arrow')));
    }

    function tools() {
      const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true }) as HTMLInputElement;
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try {
          const added = importData(await f.text());
          toast(added ? `Imported ${added} ${added === 1 ? 'set' : 'sets'}.` : 'Nothing new in that file.');
          render();
        } catch (e) {
          toast((e as Error).message || 'Couldn’t read that file.');
        }
        file.value = '';
      });
      return h('div.tools', {},
        h('button.text-btn', { type: 'button', onclick: download, disabled: !sets.length }, 'Export'),
        h('button.text-btn', { type: 'button', onclick: () => file.click() }, 'Import'),
        sets.length ? h('button.text-btn', { type: 'button', onclick: wipe }, 'Clear everything') : null,
        file);
    }
  }

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `tally-${dayKey(Date.now())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function wipe() {
    if (!confirm('Delete every set in this browser? Export first if you want a copy.')) return;
    clearSets();
    render();
    toast('Ledger cleared.');
  }

  function year(byDay: Map<string, SetRecord[]>) {
    // 53 weeks ending this week, one cell per day, marks scaled to your busiest day
    const end = weekStart(Date.now()) + 7 * DAY;
    const start = end - 53 * 7 * DAY;
    const vols = new Map<string, number>();
    for (const [k, ds] of byDay) vols.set(k, ds.reduce((a, s) => a + volume(s), 0));
    const max = Math.max(1, ...vols.values());
    const C = 13;
    const nodes: Element[] = [];
    for (let w = 0; w < 53; w++) {
      for (let d = 0; d < 7; d++) {
        const ms = start + (w * 7 + d) * DAY + 12 * 3600000;
        if (ms > Date.now() + DAY) continue;
        const v = vols.get(dayKey(ms)) ?? 0;
        const x = w * C + 2;
        const y = d * C + 2;
        if (!v) {
          nodes.push(h('rect', { class: 'c0', x: x + 4.5, y: y + 4.5, width: 1.6, height: 1.6, rx: 0.8 }));
          continue;
        }
        const marks = Math.max(1, Math.ceil((v / max) * 5));
        for (let m = 0; m < Math.min(marks, 4); m++) {
          nodes.push(h('path', { class: 'mk', d: penStroke([x + 1.5 + m * 2.4, y + 1], [x + 1.7 + m * 2.4, y + 10], 1.05, w * 7 + d + m * 13, 0.05).outline }));
        }
        if (marks >= 5) nodes.push(h('path', { class: 'mk', d: penStroke([x, y + 8.5], [x + 10.5, y + 2], 1, w + d * 7, 0.03).outline }));
      }
    }
    return h('div.year', {},
      h('div.section-head', {}, h('h2.h2', {}, 'The year'), h('span.label', {}, 'more marks, more reps')),
      svg(`0 0 ${53 * C + 2} ${7 * C + 2}`, { class: 'year-grid', role: 'img', 'aria-label': `Activity over the last year: ${byDay.size} active days` }, ...nodes),
      h('div.year-legend', {}, h('span.label', {}, new Date(start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })), h('span.label', {}, 'This week')));
  }

  function bests(sets: SetRecord[]) {
    const rows = ORDER.map((id) => {
      const mine = sets.filter((s) => s.ex === id);
      if (!mine.length) return null;
      const d = EXERCISES[id];
      const best = Math.max(...mine.map((s) => s.n));
      const sum = mine.reduce((a, s) => a + s.n, 0);
      return h('div.best', {},
        h('h3', {}, d.name),
        h('p', {}, d.kind === 'hold'
          ? `Longest ${clock(best * 1000)} · ${clock(sum * 1000)} total`
          : `Best ${best} · ${sum} total · ${mine.length} ${mine.length === 1 ? 'set' : 'sets'}`));
    }).filter(Boolean) as Element[];
    return h('div', {}, h('div.section-head', {}, h('h2.h2', {}, 'Bests')), h('div.bests', {}, ...rows));
  }

  function days(byDay: Map<string, SetRecord[]>) {
    const keys = [...byDay.keys()].sort().reverse();
    let shown = 14;
    const list = h('div.days', {});
    const more = h('button.btn.ghost', { type: 'button' }, 'Show older days');
    const paint = () => {
      list.replaceChildren(...keys.slice(0, shown).map((k) => dayBlock(k, byDay.get(k)!)));
      more.hidden = shown >= keys.length;
    };
    more.addEventListener('click', () => { shown += 30; paint(); });
    paint();
    return h('div', {}, h('div.section-head', {}, h('h2.h2', {}, 'Day by day')), list, h('div', { style: { marginBottom: '48px' } }, more));
  }

  function dayBlock(k: string, ds: SetRecord[]) {
    const vol = ds.filter((s) => EXERCISES[s.ex].kind === 'reps').reduce((a, s) => a + s.n, 0);
    return h('article.day', {},
      h('h3', {}, dayLabel(k), h('span.mono', {}, `${ds.length} ${ds.length === 1 ? 'set' : 'sets'}${vol ? ` · ${vol} reps` : ''}`)),
      ...[...ds].reverse().map(setRow));
  }

  function setRow(s: SetRecord) {
    const d = EXERCISES[s.ex];
    const time = new Date(s.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const meta = [time, clock(s.dur), s.goal ? `goal ${d.kind === 'hold' ? clock(s.goal * 1000) : s.goal}` : null, s.misses ? `${s.misses} didn’t count` : null]
      .filter(Boolean).join(' · ');
    return h('div.set-row', {},
      h('div.name', {}, d.name),
      h('div.meta', {}, meta),
      h('div.n', {}, d.kind === 'hold' ? clock(s.n * 1000) : String(s.n)),
      h('button.x', {
        type: 'button', 'aria-label': `Delete this set of ${d.many}`, title: 'Delete',
        onclick: () => {
          removeSet(s.id);
          render();
          toast('Set deleted.', { label: 'Undo', run: () => { addSet(s); render(); } });
        },
      }, icon('close')),
      d.kind === 'reps' && s.reps.length ? repStrip(s.reps) : null);
  }
}
