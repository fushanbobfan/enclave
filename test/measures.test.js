import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../src/grid.js';
import {
  discontented,
  entropyIndex,
  groupCounts,
  meanSimilarity,
  mixedContacts,
  randomSimilarity,
} from '../src/measures.js';

function paint(grid, f) {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) grid.cells[y * grid.width + x] = f(x, y);
  }
  return grid;
}

test('a checkerboard has no like neighbours across the von Neumann cross', () => {
  const g = paint(createGrid({ width: 20, emptyFraction: 0, neighbourhood: 'vonneumann' }), (x, y) => 1 + ((x + y) % 2));
  assert.equal(meanSimilarity(g), 0);
  assert.equal(mixedContacts(g), 1);
  const m = paint(createGrid({ width: 20, emptyFraction: 0 }), (x, y) => 1 + ((x + y) % 2));
  assert.equal(meanSimilarity(m), 0.5);
});

test('two halves of a wrapped town are almost fully sorted', () => {
  const g = paint(createGrid({ width: 30, emptyFraction: 0 }), (x) => (x < 15 ? 1 : 2));
  // Four border columns of 30 households each see 3 unlike neighbours of 8.
  assert.ok(Math.abs(meanSimilarity(g) - (1 - (3 / 8) * (4 * 30) / 900)) < 1e-12);
  assert.ok(Math.abs(entropyIndex(g, 5) - 1) < 1e-12);
  assert.ok(mixedContacts(g) < 0.1);
});

test('random towns sit near the random-placement similarity and score near zero on H', () => {
  let sim = 0;
  const runs = 20;
  let sizes;
  for (let s = 1; s <= runs; s++) {
    const g = createGrid({ width: 50, groups: 3, majority: 0.5, emptyFraction: 0.1, seed: s });
    sizes = g.sizes;
    sim += meanSimilarity(g) / runs;
    assert.ok(entropyIndex(g, 6) < 0.06);
  }
  assert.ok(Math.abs(sim - randomSimilarity(sizes)) < 0.01, `${sim} vs ${randomSimilarity(sizes)}`);
});

test('the random baseline matches the closed form', () => {
  assert.equal(randomSimilarity([1, 1]), 0);
  assert.ok(Math.abs(randomSimilarity([500, 500]) - 499 / 999) < 1e-12);
  assert.equal(randomSimilarity([7]), 1);
  assert.equal(randomSimilarity([]), 0);
});

test('discontented households are listed and counted by group', () => {
  const g = createGrid({ width: 10, emptyFraction: 0, seed: 1 });
  g.cells.fill(1);
  g.cells[44] = 2;
  g.cells[45] = 0;
  assert.deepEqual(discontented(g, { min: 0.3, max: 1 }), [44]);
  // With a ceiling of 0.9 only the seven group-1 neighbours of the lone
  // group-2 household, and that household itself, are mixed enough.
  assert.equal(discontented(g, { min: 0, max: 0.9 }).length, 98 - 7);
  assert.deepEqual(groupCounts(g), [1, 98, 1]);
});
