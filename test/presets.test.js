import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../src/grid.js';
import { discontented, meanSimilarity, randomSimilarity } from '../src/measures.js';
import { PRESETS, matchPreset, presetSettings } from '../src/presets.js';
import { DEFAULTS, gridOptions, normalise, preference } from '../src/share.js';
import { createSim, runToRest } from '../src/sim.js';

test('every preset survives normalisation unchanged and is recognised again', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(!ids.has(p.id));
    ids.add(p.id);
    const s = presetSettings(p.id, 9);
    for (const [k, v] of Object.entries(p.settings)) assert.equal(s[k], v, `${p.id}.${k}`);
    assert.equal(s.seed, 9);
    assert.equal(matchPreset(s), p.id);
  }
  assert.equal(matchPreset({ ...DEFAULTS, min: 61 }), null);
  assert.deepEqual(presetSettings('missing', 3), normalise({ seed: 3 }));
});

function run(id, seed, sweeps = 300) {
  const s = presetSettings(id, seed);
  const g = createGrid(gridOptions({ ...s, size: 40 }));
  const sim = createSim(g, { pref: preference(s), rule: s.rule, seed });
  runToRest(sim, sweeps);
  return { g, sim };
}

test('the mild presets settle well above chance', () => {
  for (const id of ['third', 'half', 'four', 'short']) {
    const { g, sim } = run(id, 21);
    assert.equal(sim.status, 'settled', id);
    assert.ok(meanSimilarity(g) > randomSimilarity(g.sizes) + 0.15, id);
  }
});

test('under the same rule only the minority is left moving', () => {
  const { g, sim } = run('minority', 21, 150);
  assert.equal(sim.status, 'moving');
  const left = discontented(g, preference(presetSettings('minority', 21)));
  assert.ok(left.length > 0);
  assert.ok(left.every((i) => g.cells[i] === 2));
});

test('mixers settle below the random baseline', () => {
  const { g, sim } = run('mixers', 21);
  assert.equal(sim.status, 'settled');
  assert.ok(meanSimilarity(g) < randomSimilarity(g.sizes) - 0.05);
  assert.ok(meanSimilarity(run('half', 21).g) > 0.85);
});

test('the demanding preset sorts almost completely but keeps churning', () => {
  const { g, sim } = run('demanding', 21, 100);
  assert.equal(sim.status, 'moving');
  assert.ok(sim.history.at(-1).discontented > 0);
  assert.ok(meanSimilarity(g) > 0.9);
});
