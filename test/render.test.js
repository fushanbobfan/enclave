import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../src/grid.js';
import { chartScale, drawChart, fitTown, hexToRgb, homeAt, paintTown } from '../src/render.js';

function stubContext() {
  const calls = {};
  return new Proxy(
    { calls },
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          calls[key] = (calls[key] || 0) + 1;
          return args;
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
}

test('hex colours parse in short and long form', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('#0f0'), [0, 255, 0]);
});

test('each home becomes one opaque pixel in its group colour, discontented ones paler', () => {
  const g = createGrid({ width: 10, emptyFraction: 0, seed: 1 });
  g.cells.fill(1);
  g.cells[3] = 2;
  g.cells[4] = 0;
  const rgba = new Uint8ClampedArray(400);
  const colours = ['#ffffff', '#000000', '#ff0000'];
  paintTown(g, rgba, colours, new Set([3]));
  assert.deepEqual([...rgba.subarray(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...rgba.subarray(16, 20)], [255, 255, 255, 255]);
  const faded = [...rgba.subarray(12, 15)];
  assert.equal(faded[0], 255);
  assert.ok(faded[1] > 100 && faded[1] < 255);
  paintTown(g, rgba, colours);
  assert.deepEqual([...rgba.subarray(12, 16)], [255, 0, 0, 255]);
});

test('the town fits the canvas in whole pixels and clicks map back to homes', () => {
  const fit = fitTown(60, 60, 500, 400);
  assert.equal(fit.size, 6);
  assert.equal(fit.x, 70);
  assert.equal(fit.y, 20);
  assert.equal(homeAt(fit, 60, 60, 70, 20), 0);
  assert.equal(homeAt(fit, 60, 60, 70 + 6 * 59 + 5, 20 + 6 * 2), 2 * 60 + 59);
  assert.equal(homeAt(fit, 60, 60, 10, 10), -1);
  assert.equal(fitTown(160, 160, 100, 100).size, 1);
});

test('the chart spans at least ten sweeps and maps shares onto its box', () => {
  const s = chartScale([{ sweep: 0 }, { sweep: 3 }], 300, 160);
  assert.equal(s.last, 10);
  assert.equal(s.y(1), s.box.top);
  assert.equal(s.y(0), s.box.bottom);
  assert.equal(s.x(10), s.box.right);
  assert.equal(chartScale([{ sweep: 42 }], 300, 160).last, 42);
});

test('drawing the chart strokes the grid, the baseline and both series', () => {
  const ctx = stubContext();
  const history = [
    { sweep: 0, similarity: 0.5, discontented: 400 },
    { sweep: 1, similarity: 0.6, discontented: 200 },
    { sweep: 2, similarity: 0.7, discontented: 0 },
  ];
  const colours = { grid: '#ccc', tick: '#666', baseline: '#999', similarity: '#00f', discontent: '#f80' };
  drawChart(ctx, history, { households: 900, baseline: 0.5 }, 300, 160, colours);
  assert.equal(ctx.calls.stroke, 5 + 1 + 2);
  assert.equal(ctx.calls.lineTo, 5 + 1 + 4);
  drawChart(stubContext(), [], { households: 0, baseline: 0 }, 300, 160, colours);
});
