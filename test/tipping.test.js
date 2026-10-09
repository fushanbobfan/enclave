import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise } from '../src/share.js';
import { createTipping, floors, progress, runTipping, stepTipping } from '../src/tipping.js';

const small = normalise({ size: 30, seed: 3 });

test('floors run from zero to the ceiling', () => {
  assert.deepEqual(floors(20, 5), [0, 5, 10, 15, 20]);
  assert.equal(floors(100).length, 21);
  assert.deepEqual(floors(12, 5), [0, 5, 10]);
});

test('a stepped job gives the same points as running it in one go', () => {
  const whole = runTipping(small, { step: 20 });
  const job = createTipping(small, { step: 20 });
  let frames = 0;
  while (!job.done) {
    stepTipping(job, 50);
    frames++;
    assert.ok(progress(job) <= 1);
  }
  assert.ok(frames > 5);
  assert.deepEqual(job.points, whole);
  assert.equal(progress(job), 1);
});

test('no preference means no moves; the floor stops at the ceiling', () => {
  const points = runTipping(normalise({ ...small, max: 60 }), { step: 20 });
  assert.deepEqual(points.map((p) => p.threshold), [0, 20, 40, 60]);
  // With a ceiling, even a floor of zero leaves some households wanting to move.
  assert.ok(points[0].sweeps > 0);
  const [free] = runTipping(small, { step: 50 });
  assert.equal(free.sweeps, 0);
  assert.equal(free.status, 'settled');
});

test("Schelling's curve: sorting climbs with the floor, then collapses when nobody can be satisfied", () => {
  const points = runTipping(normalise({ size: 40, seed: 1 }), { step: 10 });
  const at = (t) => points.find((p) => p.threshold === t);
  assert.ok(at(0).similarity < 0.55);
  assert.ok(at(30).similarity > 0.7);
  assert.ok(at(50).similarity > at(30).similarity);
  assert.ok(at(70).similarity > 0.95);
  for (const t of [0, 10, 20, 30, 40, 50]) assert.equal(at(t).status, 'settled', `${t}`);
  // Wanting every neighbour alike: almost everyone is discontented, the
  // random moves never stop and the town stays as mixed as it began.
  assert.equal(at(100).status, 'unsettled');
  assert.ok(at(100).discontented > 0.9);
  assert.ok(at(100).similarity < 0.55);
  assert.equal(at(100).sweeps, 200);
});

test('each point carries the measures the chart needs', () => {
  const [p] = runTipping(small, { step: 50 });
  for (const key of ['threshold', 'similarity', 'discontented', 'entropy', 'sweeps', 'status']) assert.ok(key in p);
});
