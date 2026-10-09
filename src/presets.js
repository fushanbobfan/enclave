// Named starting points. Each lists only what differs from the defaults.

import { normalise } from './share.js';

export const PRESETS = [
  {
    id: 'third',
    name: 'A third is enough',
    note: 'Everyone is happy as a two-to-one minority, yet the town ends up sorted.',
    settings: { min: 33 },
  },
  {
    id: 'half',
    name: 'Wanting half',
    note: 'Asking for an even split among neighbours carves out large, solid enclaves.',
    settings: { min: 50 },
  },
  {
    id: 'minority',
    name: 'Majority and minority',
    note: 'A 75/25 town under the same rule: the majority settles fast, but minority households keep landing in majority blocks and some never find a home.',
    settings: { majority: 75, min: 33 },
  },
  {
    id: 'four',
    name: 'Four groups',
    note: 'With four equal groups a random block is only a quarter alike, so a third is a real demand.',
    settings: { groups: 4, majority: 25, min: 33 },
  },
  {
    id: 'short',
    name: 'Short moves',
    note: 'Households move to the nearest home that suits them, which settles sooner and sorts a little less than long random moves.',
    settings: { min: 33, rule: 'nearest' },
  },
  {
    id: 'mixers',
    name: 'Mixers',
    note: 'Nobody needs like neighbours, but households leave any block more than 60% like them: the town ends up more mixed than chance.',
    settings: { min: 0, max: 60 },
  },
  {
    id: 'demanding',
    name: 'Too demanding',
    note: 'Wanting three quarters alike with few empty homes: the town sorts almost completely, yet some households are always on the move.',
    settings: { min: 75, empty: 4 },
  },
];

export function presetSettings(id, seed) {
  const p = PRESETS.find((x) => x.id === id);
  return normalise({ ...(p ? p.settings : {}), seed });
}

// The preset whose settings match, ignoring the seed, if any.
export function matchPreset(settings) {
  const s = normalise({ ...settings, seed: 1 });
  for (const p of PRESETS) {
    const q = presetSettings(p.id, 1);
    if (Object.keys(q).every((k) => q[k] === s[k])) return p.id;
  }
  return null;
}
