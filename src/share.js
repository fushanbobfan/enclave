// Town settings in the URL hash, so a link rebuilds the same town.

import { MAX_GROUPS, MAX_SIZE, MIN_SIZE, NEIGHBOURHOODS } from './grid.js';
import { RULES } from './sim.js';

export const DEFAULTS = Object.freeze({
  size: 60,
  groups: 2,
  majority: 50,
  empty: 10,
  min: 33,
  max: 100,
  neighbourhood: 'moore',
  rule: 'random',
  wrap: true,
  seed: 1,
});

const KEYS = {
  size: 'n',
  groups: 'g',
  majority: 'm',
  empty: 'e',
  min: 'lo',
  max: 'hi',
  neighbourhood: 'nb',
  rule: 'r',
  wrap: 'w',
  seed: 's',
};

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function int(v) {
  if (v === undefined || v === null || v === '') return NaN;
  return Math.round(Number(v));
}

// Every setting is a whole number (shares are percentages) so links stay short.
export function normalise(input) {
  const s = { ...DEFAULTS };
  const num = (key, lo, hi) => {
    const v = int(input[key]);
    if (Number.isFinite(v)) s[key] = clamp(v, lo, hi);
  };
  num('size', MIN_SIZE, MAX_SIZE);
  num('groups', 2, MAX_GROUPS);
  num('majority', 0, 90);
  num('empty', 2, 50);
  num('min', 0, 100);
  num('max', 0, 100);
  // The first group is never smaller than an even split.
  s.majority = Math.max(s.majority, Math.ceil(100 / s.groups));
  if (s.max < s.min) s.max = s.min;
  if (input.neighbourhood in NEIGHBOURHOODS) s.neighbourhood = input.neighbourhood;
  if (RULES.includes(input.rule)) s.rule = input.rule;
  if (input.wrap === true || input.wrap === '1') s.wrap = true;
  else if (input.wrap === false || input.wrap === '0') s.wrap = false;
  const seed = Number(input.seed);
  if (input.seed !== '' && Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32) s.seed = seed;
  return s;
}

export function encode(settings) {
  const s = normalise(settings);
  const base = normalise(DEFAULTS);
  const params = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS)) {
    const v = s[name];
    if (v === base[name]) continue;
    params.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return params.toString();
}

export function decode(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const raw = {};
  for (const [name, key] of Object.entries(KEYS)) {
    if (params.has(key)) raw[name] = params.get(key);
  }
  return normalise(raw);
}

export function gridOptions(s) {
  return {
    width: s.size,
    height: s.size,
    groups: s.groups,
    majority: s.majority / 100,
    emptyFraction: s.empty / 100,
    neighbourhood: s.neighbourhood,
    wrap: s.wrap,
    seed: s.seed,
  };
}

export function preference(s) {
  return { min: s.min / 100, max: s.max / 100 };
}
