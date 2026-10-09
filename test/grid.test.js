import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brushHomes,
  buildNeighbours,
  createGrid,
  groupSizes,
  householdContent,
  isContent,
  neighbourCounts,
  neighbourOffsets,
} from '../src/grid.js';

function count(cells, v) {
  let c = 0;
  for (const x of cells) if (x === v) c++;
  return c;
}

test('group sizes add up to the occupied homes and follow the majority share', () => {
  assert.deepEqual(groupSizes(100, 0.1, 2), [45, 45]);
  assert.deepEqual(groupSizes(100, 0.2, 2, 0.75), [60, 20]);
  const s = groupSizes(3600, 0.13, 3);
  assert.equal(s.reduce((a, b) => a + b, 0), Math.round(3600 * 0.87));
  assert.ok(Math.max(...s) - Math.min(...s) <= 1);
  assert.deepEqual(groupSizes(10, 0, 4, 0.7), [7, 1, 1, 1]);
});

test('neighbourhoods have the expected shapes', () => {
  assert.equal(neighbourOffsets('moore').length, 8);
  assert.equal(neighbourOffsets('vonneumann').length, 4);
  assert.equal(neighbourOffsets('moore2').length, 24);
  assert.equal(neighbourOffsets('nonsense').length, 8);
});

test('wrapped grids give every home a full neighbourhood; walls trim the edges', () => {
  const off = neighbourOffsets('moore');
  const torus = buildNeighbours(10, 10, off, true);
  for (let i = 0; i < 100; i++) assert.equal(torus.start[i + 1] - torus.start[i], 8);
  const box = buildNeighbours(10, 10, off, false);
  const deg = (i) => box.start[i + 1] - box.start[i];
  assert.equal(deg(0), 3);
  assert.equal(deg(5), 5);
  assert.equal(deg(55), 8);
  const nb = Array.from(torus.list.subarray(torus.start[0], torus.start[1])).sort((a, b) => a - b);
  assert.deepEqual(nb, [1, 9, 10, 11, 19, 90, 91, 99]);
});

test('a grid holds exactly the planned households, shuffled by its seed', () => {
  const a = createGrid({ width: 40, groups: 3, emptyFraction: 0.2, seed: 7 });
  assert.equal(count(a.cells, 0), 320);
  assert.deepEqual([1, 2, 3].map((g) => count(a.cells, g)), a.sizes);
  const b = createGrid({ width: 40, groups: 3, emptyFraction: 0.2, seed: 7 });
  assert.deepEqual(a.cells, b.cells);
  const c = createGrid({ width: 40, groups: 3, emptyFraction: 0.2, seed: 8 });
  assert.notDeepEqual(a.cells, c.cells);
});

test('neighbour counts ignore empty homes and the home being left', () => {
  const g = createGrid({ width: 10, emptyFraction: 0, seed: 1 });
  g.cells.fill(0);
  // Home 11 sits at (1, 1); give it two like and one unlike neighbour.
  g.cells[11] = 1;
  g.cells[0] = 1;
  g.cells[2] = 1;
  g.cells[12] = 2;
  assert.deepEqual(neighbourCounts(g, 11, 1), { same: 2, total: 3 });
  assert.deepEqual(neighbourCounts(g, 11, 1, 0), { same: 1, total: 2 });
  assert.deepEqual(neighbourCounts(g, 55, 1), { same: 0, total: 0 });
});

test('contentment uses an inclusive band and counts the isolated as content', () => {
  const pref = { min: 1 / 3, max: 1 };
  assert.ok(isContent(1, 3, pref));
  assert.ok(!isContent(2, 7, pref));
  assert.ok(isContent(0, 0, pref));
  assert.ok(!isContent(8, 8, { min: 0, max: 0.75 }));
  const g = createGrid({ width: 10, emptyFraction: 0, seed: 1 });
  g.cells.fill(2);
  g.cells[33] = 1;
  assert.ok(!householdContent(g, 33, pref));
  assert.ok(householdContent(g, 34, pref));
});

test('a brush covers a rounded patch, wrapping or clipping at the edges', () => {
  const torus = createGrid({ width: 20, seed: 1 });
  assert.deepEqual(brushHomes(torus, 45, 0), [45]);
  assert.equal(brushHomes(torus, 45, 1).length, 9);
  const r2 = brushHomes(torus, 210, 2);
  assert.equal(r2.length, 21);
  assert.ok(!r2.includes(210 - 42));
  const corner = brushHomes(torus, 0, 1).sort((a, b) => a - b);
  assert.deepEqual(corner, [0, 1, 19, 20, 21, 39, 380, 381, 399]);
  const box = createGrid({ width: 20, wrap: false, seed: 1 });
  assert.deepEqual(brushHomes(box, 0, 1).sort((a, b) => a - b), [0, 1, 20, 21]);
  // A brush wider than a small town never lists a home twice.
  const tiny = createGrid({ width: 10, seed: 1 });
  assert.equal(brushHomes(tiny, 0, 8).length, 100);
});
