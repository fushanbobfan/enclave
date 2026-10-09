import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, decode, encode, gridOptions, normalise, preference } from '../src/share.js';

test('the defaults encode to an empty hash and decode back', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), { ...DEFAULTS });
});

test('settings survive a round trip through the link', () => {
  const s = {
    size: 120,
    groups: 3,
    majority: 50,
    empty: 25,
    min: 40,
    max: 80,
    neighbourhood: 'moore2',
    rule: 'nearest',
    wrap: false,
    seed: 4000000000,
  };
  assert.deepEqual(decode(`#${encode(s)}`), s);
});

test('an even split for the chosen number of groups survives the link', () => {
  const s = { ...DEFAULTS, groups: 4, majority: 25 };
  const back = decode(`#${encode(s)}`);
  assert.equal(back.groups, 4);
  assert.equal(back.majority, 25);
  assert.equal(decode('#g=3').majority, 50);
});

test('broken or hostile values fall back or get clamped', () => {
  const s = decode('#n=9999&g=9&m=-5&e=80&lo=150&hi=x&nb=hex&r=teleport&w=maybe&s=-1');
  assert.equal(s.size, 160);
  assert.equal(s.groups, 4);
  assert.equal(s.majority, 25);
  assert.equal(s.empty, 50);
  assert.equal(s.min, 100);
  assert.equal(s.max, 100);
  assert.equal(s.neighbourhood, 'moore');
  assert.equal(s.rule, 'random');
  assert.equal(s.wrap, true);
  assert.equal(s.seed, 1);
  assert.equal(decode('#n=&s=').size, DEFAULTS.size);
});

test('the ceiling never sits below the floor', () => {
  assert.equal(normalise({ min: 60, max: 40 }).max, 60);
});

test('percentages turn into grid options and a preference band', () => {
  const s = normalise({ size: 30, groups: 3, majority: 60, empty: 20, min: 25, max: 75 });
  const o = gridOptions(s);
  assert.equal(o.width, 30);
  assert.equal(o.majority, 0.6);
  assert.equal(o.emptyFraction, 0.2);
  assert.deepEqual(preference(s), { min: 0.25, max: 0.75 });
});
