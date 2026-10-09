// How sorted is the town? Neighbourhood similarity, contentment, the
// length of borders between groups and Theil's entropy index over blocks.

import { isContent, neighbourCounts } from './grid.js';

export function groupCounts(grid) {
  const counts = new Array(grid.groups + 1).fill(0);
  for (const c of grid.cells) counts[c]++;
  return counts;
}

// Average share of a household's occupied neighbours that belong to its own
// group, over households with at least one neighbour.
export function meanSimilarity(grid) {
  let sum = 0;
  let n = 0;
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const g = cells[i];
    if (g === 0) continue;
    const { same, total } = neighbourCounts(grid, i, g);
    if (total === 0) continue;
    sum += same / total;
    n++;
  }
  return n ? sum / n : 0;
}

// The same average when households are placed at random: each occupied
// neighbour of a group-g household is another group-g household with
// chance (n_g - 1) / (N - 1).
export function randomSimilarity(sizes) {
  const N = sizes.reduce((a, b) => a + b, 0);
  if (N < 2) return 0;
  return sizes.reduce((acc, n) => acc + (n / N) * ((n - 1) / (N - 1)), 0);
}

export function discontented(grid, pref) {
  const out = [];
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const g = cells[i];
    if (g === 0) continue;
    const { same, total } = neighbourCounts(grid, i, g);
    if (!isContent(same, total, pref)) out.push(i);
  }
  return out;
}

// Share of adjacent occupied pairs that belong to different groups: the
// length of the borders between groups, relative to all contacts.
export function mixedContacts(grid) {
  const { start, list } = grid.nbr;
  const cells = grid.cells;
  let mixed = 0;
  let all = 0;
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i];
    if (a === 0) continue;
    for (let k = start[i]; k < start[i + 1]; k++) {
      const b = cells[list[k]];
      if (b === 0) continue;
      all++;
      if (b !== a) mixed++;
    }
  }
  return all ? mixed / all : 0;
}

function entropy(counts, total) {
  let e = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      e -= p * Math.log(p);
    }
  }
  return e;
}

// Theil's multigroup entropy index H over square blocks of side `block`:
// 0 when every block has the town's mix, 1 when every block holds one group.
export function entropyIndex(grid, block = 6) {
  const { width, height, groups, cells } = grid;
  const town = new Array(groups).fill(0);
  let total = 0;
  const blocks = [];
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      const counts = new Array(groups).fill(0);
      let n = 0;
      for (let y = by; y < Math.min(by + block, height); y++) {
        for (let x = bx; x < Math.min(bx + block, width); x++) {
          const c = cells[y * width + x];
          if (c === 0) continue;
          counts[c - 1]++;
          n++;
        }
      }
      if (n === 0) continue;
      blocks.push([counts, n]);
      counts.forEach((c, g) => (town[g] += c));
      total += n;
    }
  }
  const E = entropy(town, total);
  if (E === 0) return 0;
  let h = 0;
  for (const [counts, n] of blocks) h += (n / total) * (E - entropy(counts, n));
  return h / E;
}
