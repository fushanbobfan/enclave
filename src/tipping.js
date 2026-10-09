// Micromotives against macrobehaviour: rebuild the same starting town for a
// range of preference floors, let each run come to rest, and record where
// it ends up. The work is split into small steps so a page can spread it
// over animation frames.

import { createGrid } from './grid.js';
import { discontented, entropyIndex, meanSimilarity } from './measures.js';
import { gridOptions } from './share.js';
import { advance, createSim } from './sim.js';

export const TIPPING_STEP = 5;
export const TIPPING_MAX_SWEEPS = 200;

// Floors from 0% up to the ceiling, every `step` points.
export function floors(max = 100, step = TIPPING_STEP) {
  const out = [];
  for (let t = 0; t <= max; t += step) out.push(t);
  return out;
}

export function createTipping(settings, { step = TIPPING_STEP, maxSweeps = TIPPING_MAX_SWEEPS } = {}) {
  return { settings, thresholds: floors(settings.max, step), maxSweeps, points: [], sim: null, done: false };
}

function begin(job) {
  const t = job.thresholds[job.points.length];
  const grid = createGrid(gridOptions(job.settings));
  const pref = { min: t / 100, max: job.settings.max / 100 };
  job.sim = createSim(grid, { pref, rule: job.settings.rule, seed: job.settings.seed });
}

function finish(job) {
  const { sim } = job;
  const { grid } = sim;
  const households = grid.sizes.reduce((a, b) => a + b, 0);
  job.points.push({
    threshold: job.thresholds[job.points.length],
    similarity: meanSimilarity(grid),
    discontented: households ? discontented(grid, sim.pref).length / households : 0,
    entropy: entropyIndex(grid, 6),
    sweeps: sim.sweep,
    status: sim.status === 'moving' ? 'unsettled' : sim.status,
  });
  job.sim = null;
  if (job.points.length === job.thresholds.length) job.done = true;
}

// Spend up to `budget` household turns on the job. Returns the turns used.
export function stepTipping(job, budget = Infinity) {
  let spent = 0;
  while (!job.done && spent < budget) {
    if (!job.sim) begin(job);
    const { sim } = job;
    if (sim.status === 'moving' && sim.sweep < job.maxSweeps) {
      spent += advance(sim, budget - spent);
      // A sweep boundary costs no turns; count it so a run of empty sweeps
      // cannot spin here.
      spent += 1;
      continue;
    }
    finish(job);
  }
  return spent;
}

export function runTipping(settings, options) {
  const job = createTipping(settings, options);
  stepTipping(job);
  return job.points;
}

export function progress(job) {
  return job.thresholds.length ? job.points.length / job.thresholds.length : 1;
}
