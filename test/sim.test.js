import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, neighbourCounts, isContent } from '../src/grid.js';
import { discontented, groupCounts, meanSimilarity, randomSimilarity } from '../src/measures.js';
import { advance, createSim, destination, move, runToRest, sweep } from '../src/sim.js';

const classic = { min: 3 / 8, max: 1 };

test('moving keeps every household and the list of empty homes in step', () => {
  const g = createGrid({ width: 30, groups: 3, emptyFraction: 0.15, seed: 2 });
  const before = groupCounts(g);
  const sim = createSim(g, { pref: classic, seed: 2 });
  for (let k = 0; k < 5; k++) sweep(sim);
  assert.deepEqual(groupCounts(g), before);
  assert.equal(sim.empties.length, before[0]);
  for (const [k, j] of sim.empties.entries()) {
    assert.equal(g.cells[j], 0);
    assert.equal(sim.emptyAt[j], k);
  }
});

test("Schelling's mild preference still sorts a random town far past chance", () => {
  for (const rule of ['random', 'random-content', 'nearest']) {
    const g = createGrid({ width: 40, emptyFraction: 0.1, seed: 11 });
    const start = meanSimilarity(g);
    const sim = createSim(g, { pref: classic, rule, seed: 11 });
    const status = runToRest(sim, 300);
    assert.equal(status, 'settled', rule);
    assert.ok(Math.abs(start - randomSimilarity(g.sizes)) < 0.03);
    // Short moves to the nearest home sort a little less than long random ones.
    assert.ok(meanSimilarity(g) > (rule === 'nearest' ? 0.65 : 0.7), `${rule}: ${meanSimilarity(g)}`);
    assert.equal(discontented(g, classic).length, 0);
  }
});

test('nobody moves when nobody minds', () => {
  const g = createGrid({ width: 20, seed: 3 });
  const copy = g.cells.slice();
  const sim = createSim(g, { pref: { min: 0, max: 1 } });
  assert.equal(sim.status, 'settled');
  assert.equal(advance(sim, 1000), 0);
  assert.deepEqual(g.cells, copy);
});

test('a demand no layout can meet ends stuck when no content home exists', () => {
  const g = createGrid({ width: 20, emptyFraction: 0.02, seed: 4 });
  const sim = createSim(g, { pref: { min: 1, max: 1 }, rule: 'random-content', seed: 4 });
  const status = runToRest(sim, 200);
  assert.ok(status === 'stuck' || sim.sweep === 200);
  assert.ok(sim.history.at(-1).discontented > 0);
});

test('content-seeking rules only ever move a household somewhere it is content', () => {
  for (const rule of ['random-content', 'nearest']) {
    const g = createGrid({ width: 25, emptyFraction: 0.2, seed: 5 });
    const sim = createSim(g, { pref: classic, rule, seed: 5 });
    for (const from of discontented(g, classic).slice(0, 40)) {
      const to = destination(sim, from);
      if (to < 0) continue;
      assert.equal(g.cells[to], 0);
      const { same, total } = neighbourCounts(g, to, g.cells[from], from);
      assert.ok(isContent(same, total, classic), rule);
    }
  }
});

test('the nearest rule picks the closest content home', () => {
  const g = createGrid({ width: 15, emptyFraction: 0, seed: 1 });
  g.cells.fill(2);
  const from = 7 * 15 + 7;
  g.cells[from] = 1;
  // Two empty homes, one next to group-1 neighbours far away, one adjacent but hostile.
  g.cells[7 * 15 + 8] = 0;
  g.cells[1 * 15 + 1] = 0;
  g.cells[0] = 1;
  g.cells[1] = 1;
  g.cells[15] = 1;
  const sim = createSim(g, { pref: { min: 0.3, max: 1 }, rule: 'nearest' });
  assert.equal(destination(sim, from), 16);
  sim.pref = { min: 0, max: 1 };
  assert.equal(destination(sim, from), 7 * 15 + 8);
});

test('a ceiling on similarity makes households seek mixed blocks', () => {
  const g = createGrid({ width: 30, emptyFraction: 0, seed: 6 });
  for (let i = 0; i < g.cells.length; i++) g.cells[i] = (i % 30) < 15 ? 1 : 2;
  for (let k = 0; k < 90; k++) g.cells[k * 10] = 0;
  const pref = { min: 0, max: 0.6 };
  const sim = createSim(g, { pref, rule: 'random-content', seed: 6 });
  const start = meanSimilarity(g);
  runToRest(sim, 200);
  assert.ok(meanSimilarity(g) < start - 0.2, `${start} -> ${meanSimilarity(g)}`);
});

test('history records one entry per finished sweep', () => {
  const g = createGrid({ width: 30, seed: 8 });
  const sim = createSim(g, { pref: classic, seed: 8 });
  sweep(sim);
  sweep(sim);
  assert.deepEqual(sim.history.map((h) => h.sweep), [0, 1, 2]);
  assert.ok(sim.history[1].moves > 0);
  assert.ok(sim.history[2].similarity > sim.history[0].similarity);
});

test('advance splits a sweep across calls without losing turns', () => {
  const a = createSim(createGrid({ width: 30, seed: 9 }), { pref: classic, seed: 9 });
  const b = createSim(createGrid({ width: 30, seed: 9 }), { pref: classic, seed: 9 });
  sweep(a);
  while (b.sweep < 1) advance(b, 7);
  assert.deepEqual(a.grid.cells.slice(), b.grid.cells.slice());
  assert.equal(a.history[1].moves, b.history[1].moves);
});

test('move swaps a household into an empty home', () => {
  const g = createGrid({ width: 10, emptyFraction: 0.5, seed: 1 });
  const sim = createSim(g, { pref: { min: 0, max: 1 } });
  const to = sim.empties[0];
  const from = g.cells.findIndex((c) => c !== 0);
  const group = g.cells[from];
  move(sim, from, to);
  assert.equal(g.cells[to], group);
  assert.equal(g.cells[from], 0);
  assert.equal(sim.empties[0], from);
});
