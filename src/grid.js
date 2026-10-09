// The town: a grid of homes, each empty (0) or holding a household of group 1..k.

import { mulberry32 } from './rng.js';

export const MIN_SIZE = 10;
export const MAX_SIZE = 160;
export const MAX_GROUPS = 4;
export const NEIGHBOURHOODS = Object.freeze({
  moore: { kind: 'moore', radius: 1 },
  vonneumann: { kind: 'vonneumann', radius: 1 },
  moore2: { kind: 'moore', radius: 2 },
});

// Household numbers per group: the first group takes `majority` of the
// occupied homes and the rest share what is left evenly. Largest remainders
// make the counts add up exactly.
export function groupSizes(cells, emptyFraction, groups, majority = 1 / groups) {
  const occupied = Math.round(cells * (1 - emptyFraction));
  const first = groups === 1 ? 1 : Math.min(1, Math.max(majority, 0));
  const shares = [first];
  for (let g = 1; g < groups; g++) shares.push((1 - first) / (groups - 1));
  const raw = shares.map((s) => s * occupied);
  const sizes = raw.map(Math.floor);
  let left = occupied - sizes.reduce((a, b) => a + b, 0);
  const order = raw.map((r, g) => [r - Math.floor(r), g]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) sizes[order[k % groups][1]]++;
  return sizes;
}

export function neighbourOffsets(name) {
  const { kind, radius } = NEIGHBOURHOODS[name] || NEIGHBOURHOODS.moore;
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (kind === 'vonneumann' && Math.abs(dx) + Math.abs(dy) > radius) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}

// Neighbour lists for every home, packed so that the neighbours of i are
// list[start[i]] .. list[start[i + 1] - 1]. Without wrapping, homes on the
// edge simply have fewer neighbours.
export function buildNeighbours(width, height, offsets, wrap) {
  const n = width * height;
  const start = new Int32Array(n + 1);
  const list = new Int32Array(n * offsets.length);
  let k = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      start[y * width + x] = k;
      for (const [dx, dy] of offsets) {
        let nx = x + dx;
        let ny = y + dy;
        if (wrap) {
          nx = (nx + width) % width;
          ny = (ny + height) % height;
        } else if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        list[k++] = ny * width + nx;
      }
    }
  }
  start[n] = k;
  return { start, list: list.subarray(0, k) };
}

export function createGrid({
  width = 60,
  height = width,
  groups = 2,
  majority = 1 / groups,
  emptyFraction = 0.1,
  neighbourhood = 'moore',
  wrap = true,
  seed = 1,
} = {}) {
  const n = width * height;
  const sizes = groupSizes(n, emptyFraction, groups, majority);
  const cells = new Uint8Array(n);
  let k = 0;
  sizes.forEach((size, g) => {
    cells.fill(g + 1, k, k + size);
    k += size;
  });
  const rng = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = cells[i];
    cells[i] = cells[j];
    cells[j] = t;
  }
  const nbr = buildNeighbours(width, height, neighbourOffsets(neighbourhood), wrap);
  return { width, height, groups, wrap, neighbourhood, cells, nbr, sizes };
}

// Occupied neighbours of home i, and how many of them belong to group g.
// `skip` is a home to treat as empty: the one a mover is leaving.
export function neighbourCounts(grid, i, g, skip = -1) {
  const { start, list } = grid.nbr;
  const cells = grid.cells;
  let same = 0;
  let total = 0;
  for (let k = start[i]; k < start[i + 1]; k++) {
    const j = list[k];
    if (j === skip) continue;
    const c = cells[j];
    if (c === 0) continue;
    total++;
    if (c === g) same++;
  }
  return { same, total };
}

// A household is content when the share of its occupied neighbours from its
// own group lies in [min, max]. With no neighbours at all it is content.
export function isContent(same, total, pref) {
  if (total === 0) return true;
  const f = same / total;
  return f >= pref.min - 1e-9 && f <= pref.max + 1e-9;
}

export function householdContent(grid, i, pref) {
  const g = grid.cells[i];
  if (g === 0) return true;
  const { same, total } = neighbourCounts(grid, i, g);
  return isContent(same, total, pref);
}
