import { h, icon } from '../lib/dom';
import { getSettings, setSettings, type Settings } from '../lib/store';
import { unlockAudio } from '../lib/sound';
import { MODEL_MB } from '../pose/tracker';

export function openSettings() {
  const dlg = document.getElementById('settings') as HTMLDialogElement;
  const s = getSettings();

  const sw = (key: keyof Settings, title: string, desc: string) => {
    const input = h('input', { type: 'checkbox', checked: Boolean(s[key]), 'aria-label': title }) as HTMLInputElement;
    input.addEventListener('change', () => {
      if (key === 'sound' || key === 'voice') unlockAudio();
      setSettings({ [key]: input.checked } as Partial<Settings>);
    });
    return h('div.row', {}, h('div.t', {}, title), h('div.d', {}, desc), h('label.switch', {}, input, h('span')));
  };

  const seg = <K extends keyof Settings>(key: K, title: string, desc: string, opts: [Settings[K], string][]) => {
    const name = `s-${key}`;
    return h('div.row', {},
      h('div.t', {}, title),
      h('div.d', {}, desc),
      h('div.seg', { role: 'radiogroup', 'aria-label': title },
        ...opts.map(([v, label]) => {
          const input = h('input', { type: 'radio', name, value: String(v), checked: s[key] === v }) as HTMLInputElement;
          input.addEventListener('change', () => setSettings({ [key]: v } as Partial<Settings>));
          return h('label', {}, input, h('span', {}, label));
        })));
  };

  const form = h('form', { method: 'dialog' },
    h('h2#settings-title', {}, 'Settings',
      h('button.icon-btn', { type: 'submit', 'aria-label': 'Close' }, icon('close'))),
    seg('theme', 'Look', 'Paper and ink, or slate and chalk. Auto follows your device.', [['auto', 'Auto'], ['paper', 'Paper'], ['slate', 'Slate']]),
    sw('sound', 'Sound', 'A pencil tick for each rep, a lower one every fifth.'),
    sw('voice', 'Count out loud', 'Your device’s voice says each number.'),
    sw('showVideo', 'Show the camera picture', 'Off leaves just your inked outline.'),
    sw('mirror', 'Mirror the picture', 'Like a mirror, for the front camera.'),
    sw('handsFree', 'Hands-free', 'Raise both hands to start a set (and to end one, where your arms don’t go overhead).'),
    sw('autoEnd', 'End sets by themselves', 'After about seven seconds without a rep.'),
    seg('countdown', 'Countdown', 'Seconds to get in position. Floor movements get two more.', [[3, '3 s'], [5, '5 s'], [10, '10 s']]),
    seg('accuracy', 'Pose model', `Standard is ${MODEL_MB.lite} MB and quick. Accurate is ${MODEL_MB.full} MB and better on the floor.`, [['lite', 'Standard'], ['full', 'Accurate']]),
  );
  dlg.replaceChildren(form);
  dlg.showModal();
}
