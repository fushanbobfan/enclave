// Moving day. Each sweep visits the discontented households in random order;
// any still discontented when its turn comes looks for an empty home.

import { isContent, neighbourCounts } from './grid.js';
import { discontented, meanSimilarity } from './measures.js';
import { mulberry32 } from './rng.js';

// random:         move to any empty home, content there or not (Schelling's
//                 coin-and-board version as most textbooks run it)
// random-content: move to a random empty home where it would be content
// nearest:        move to the nearest empty home where it would be content
export const RULES = ['random', 'random-content', 'nearest'];

export function createSim(grid, { pref = { min: 0.375, max: 1 }, rule = 'random', seed = 1 } = {}) {
  const n = grid.cells.length;
  const empties = [];
  const emptyAt = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (grid.cells[i] === 0) {
      emptyAt[i] = empties.length;
      empties.push(i);
    }
  }
  const sim = {
    grid,
    pref,
    rule: RULES.includes(rule) ? rule : 'random',
    rng: mulberry32(seed ^ 0x9e3779b9),
    empties,
    emptyAt,
    queue: [],
    cursor: 0,
    sweep: 0,
    moves: 0,
    totalMoves: 0,
    lastMoves: 0,
    status: 'moving',
    history: [],
    rings: null,
  };
  record(sim);
  startSweep(sim);
  return sim;
}

function record(sim) {
  sim.history.push({
    sweep: sim.sweep,
    moves: sim.lastMoves,
    discontented: discontented(sim.grid, sim.pref).length,
    similarity: meanSimilarity(sim.grid),
  });
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function startSweep(sim) {
  sim.queue = shuffle(discontented(sim.grid, sim.pref), sim.rng);
  sim.cursor = 0;
  sim.moves = 0;
  if (sim.queue.length === 0) sim.status = 'settled';
}

function finishSweep(sim) {
  sim.sweep++;
  sim.lastMoves = sim.moves;
  record(sim);
  if (sim.moves === 0) {
    // Nobody could find a better home, so nobody ever will.
    sim.status = sim.history.at(-1).discontented ? 'stuck' : 'settled';
    sim.queue = [];
    sim.cursor = 0;
    return;
  }
  startSweep(sim);
}

function contentAt(sim, j, g, from) {
  const { same, total } = neighbourCounts(sim.grid, j, g, from);
  return isContent(same, total, sim.pref);
}

// Offsets sorted by distance, grouped into rings of equal distance, so the
// nearest content home can be found by walking outwards.
function rings(grid) {
  const { width: w, height: h, wrap } = grid;
  const xs = wrap ? [-Math.floor((w - 1) / 2), Math.floor(w / 2)] : [-(w - 1), w - 1];
  const ys = wrap ? [-Math.floor((h - 1) / 2), Math.floor(h / 2)] : [-(h - 1), h - 1];
  const offs = [];
  for (let dy = ys[0]; dy <= ys[1]; dy++) {
    for (let dx = xs[0]; dx <= xs[1]; dx++) {
      if (dx || dy) offs.push([dx * dx + dy * dy, dx, dy]);
    }
  }
  offs.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const o of offs) {
    if (!out.length || out.at(-1).d2 !== o[0]) out.push({ d2: o[0], cells: [] });
    out.at(-1).cells.push([o[1], o[2]]);
  }
  return out;
}

export function destination(sim, from) {
  const { grid, empties, rng } = sim;
  if (empties.length === 0) return -1;
  const g = grid.cells[from];
  if (sim.rule === 'random') return empties[Math.floor(rng() * empties.length)];
  if (sim.rule === 'random-content') {
    const ok = empties.filter((j) => contentAt(sim, j, g, from));
    return ok.length ? ok[Math.floor(rng() * ok.length)] : -1;
  }
  sim.rings ??= rings(grid);
  const { width: w, height: h, wrap } = grid;
  const x0 = from % w;
  const y0 = (from - x0) / w;
  for (const ring of sim.rings) {
    const ok = [];
    for (const [dx, dy] of ring.cells) {
      let x = x0 + dx;
      let y = y0 + dy;
      if (wrap) {
        x = (x + w) % w;
        y = (y + h) % h;
      } else if (x < 0 || y < 0 || x >= w || y >= h) {
        continue;
      }
      const j = y * w + x;
      if (grid.cells[j] === 0 && contentAt(sim, j, g, from)) ok.push(j);
    }
    if (ok.length) return ok[Math.floor(rng() * ok.length)];
  }
  return -1;
}

export function move(sim, from, to) {
  const { grid, empties, emptyAt } = sim;
  const k = emptyAt[to];
  grid.cells[to] = grid.cells[from];
  grid.cells[from] = 0;
  empties[k] = from;
  emptyAt[from] = k;
  emptyAt[to] = -1;
}

// Give up to `budget` queued households their turn and return how many
// turns were taken. Stops early at the end of a sweep, which is recorded
// before the next one is queued.
export function advance(sim, budget = Infinity) {
  let turns = 0;
  while (turns < budget && sim.status === 'moving') {
    if (sim.cursor >= sim.queue.length) {
      finishSweep(sim);
      break;
    }
    const i = sim.queue[sim.cursor++];
    turns++;
    const g = sim.grid.cells[i];
    if (g === 0) continue;
    const { same, total } = neighbourCounts(sim.grid, i, g);
    if (isContent(same, total, sim.pref)) continue;
    const j = destination(sim, i);
    if (j < 0) continue;
    move(sim, i, j);
    sim.moves++;
    sim.totalMoves++;
  }
  return turns;
}

// Run the current sweep to its end.
export function sweep(sim) {
  advance(sim);
}

// Sweeps until the town settles, gets stuck or the limit runs out.
export function runToRest(sim, maxSweeps = 500) {
  while (sim.status === 'moving' && sim.sweep < maxSweeps) sweep(sim);
  return sim.status;
}

// Change what households want or how they move without resetting the town.
// The current sweep is abandoned and a fresh one queued under the new rules.
export function retune(sim, { pref = sim.pref, rule = sim.rule } = {}) {
  sim.pref = pref;
  sim.rule = RULES.includes(rule) ? rule : sim.rule;
  sim.status = 'moving';
  sim.history.at(-1).discontented = discontented(sim.grid, sim.pref).length;
  startSweep(sim);
}
