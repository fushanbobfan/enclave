// The page: wires the controls to the town, runs moving day frame by frame,
// and keeps the statistics, chart and share link up to date.

import { createGrid } from './grid.js';
import { discontented, entropyIndex, meanSimilarity, mixedContacts, randomSimilarity } from './measures.js';
import { PRESETS, matchPreset, presetSettings } from './presets.js';
import { drawChart, fitTown, paintTown } from './render.js';
import { randomSeed } from './rng.js';
import { decode, encode, gridOptions, normalise, preference } from './share.js';
import { advance, createSim, retune, sweep } from './sim.js';

const $ = (id) => document.getElementById(id);
const townCanvas = $('town');
const chartCanvas = $('chart');
const GROUP_NAMES = ['A', 'B', 'C', 'D'];

let settings = decode(location.hash);
let grid;
let sim;
let start;
let playing = false;
let colours;
let dirty = true;
const buffer = document.createElement('canvas');

function readColours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  colours = {
    town: [v('--empty'), v('--g1'), v('--g2'), v('--g3'), v('--g4')],
    panel: v('--panel'),
    chart: {
      grid: v('--grid'),
      tick: v('--muted'),
      baseline: v('--baseline'),
      similarity: v('--similarity'),
      discontent: v('--discontent'),
    },
  };
}

function build() {
  grid = createGrid(gridOptions(settings));
  start = grid.cells.slice();
  sim = createSim(grid, { pref: preference(settings), rule: settings.rule, seed: settings.seed });
  buffer.width = grid.width;
  buffer.height = grid.height;
  dirty = true;
}

function restart() {
  grid.cells.set(start);
  sim = createSim(grid, { pref: preference(settings), rule: settings.rule, seed: settings.seed });
  dirty = true;
}

function syncControls() {
  const s = settings;
  for (const key of ['size', 'groups', 'majority', 'empty', 'min', 'max']) $(key).value = s[key];
  $('majority').min = Math.ceil(100 / s.groups);
  $('neighbourhood').value = s.neighbourhood;
  $('rule').value = s.rule;
  $('wrap').checked = s.wrap;
  $('size-out').textContent = `${s.size} × ${s.size}`;
  $('groups-out').textContent = s.groups;
  $('majority-out').textContent = `${s.majority}%`;
  $('empty-out').textContent = `${s.empty}%`;
  $('min-out').textContent = `${s.min}%`;
  $('max-out').textContent = `${s.max}%`;
  const id = matchPreset(s);
  $('preset').value = id ?? '';
  $('preset-note').textContent = id ? PRESETS.find((p) => p.id === id).note : 'Your own settings.';
  history.replaceState(null, '', `#${encode(s)}`);
}

function legend() {
  const out = $('legend');
  out.textContent = '';
  grid.sizes.forEach((n, g) => {
    const key = document.createElement('span');
    key.className = 'key swatch';
    key.style.background = colours.town[g + 1];
    out.append(key, `group ${GROUP_NAMES[g]} (${n})`);
  });
  const empty = document.createElement('span');
  empty.className = 'key swatch';
  empty.style.background = colours.town[0];
  empty.style.outline = '1px solid var(--line)';
  out.append(empty, 'empty');
  if ($('fade').checked) {
    const pale = document.createElement('span');
    pale.className = 'key swatch faded';
    pale.style.background = colours.town[1];
    out.append(pale, 'discontented');
  }
}

function sizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function draw() {
  const pref = preference(settings);
  const unhappy = discontented(grid, pref);
  const households = grid.sizes.reduce((a, b) => a + b, 0);

  const bctx = buffer.getContext('2d');
  const image = bctx.createImageData(grid.width, grid.height);
  paintTown(grid, image.data, colours.town, $('fade').checked ? new Set(unhappy) : null);
  bctx.putImageData(image, 0, 0);

  sizeCanvas(townCanvas);
  const ctx = townCanvas.getContext('2d');
  ctx.fillStyle = colours.panel;
  ctx.fillRect(0, 0, townCanvas.width, townCanvas.height);
  const fit = fitTown(grid.width, grid.height, townCanvas.width, townCanvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, fit.x, fit.y, grid.width * fit.size, grid.height * fit.size);

  const dpr = sizeCanvas(chartCanvas);
  const cctx = chartCanvas.getContext('2d');
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const baseline = randomSimilarity(grid.sizes);
  drawChart(cctx, sim.history, { households, baseline }, chartCanvas.clientWidth, chartCanvas.clientHeight, colours.chart);

  $('s-sweeps').textContent = sim.sweep;
  $('s-moves').textContent = sim.lastMoves;
  $('s-discontent').textContent = `${unhappy.length} (${pct(households ? unhappy.length / households : 0)})`;
  $('s-similar').textContent = pct(meanSimilarity(grid));
  $('s-baseline').textContent = pct(baseline);
  $('s-mixed').textContent = pct(mixedContacts(grid));
  $('s-entropy').textContent = entropyIndex(grid, 6).toFixed(3);
  $('status').textContent = statusText(unhappy.length);
  dirty = false;
}

function statusText(unhappy) {
  if (sim.status === 'settled') {
    return sim.sweep === 0
      ? 'Everyone is content already: nobody moves.'
      : `Settled after ${sim.sweep} sweep${sim.sweep === 1 ? '' : 's'}: every household is content.`;
  }
  if (sim.status === 'stuck') {
    return `Stuck: ${unhappy} discontented household${unhappy === 1 ? '' : 's'}, but no empty home suits any of them.`;
  }
  return playing ? `Moving: sweep ${sim.sweep + 1}…` : 'Paused. Press Play or Sweep.';
}

function agentsPerFrame() {
  return Math.round(20 * 2.3 ** (Number($('speed').value) - 1));
}

function frame() {
  if (playing) {
    const budget = agentsPerFrame();
    let spent = 0;
    for (let guard = 0; spent < budget && sim.status === 'moving' && guard < 1000; guard++) {
      spent += advance(sim, budget - spent);
    }
    if (sim.status !== 'moving') setPlaying(false);
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

function setPlaying(on) {
  playing = on && sim.status === 'moving';
  $('play').setAttribute('aria-pressed', String(playing));
  $('play').textContent = playing ? 'Pause' : 'Play';
  dirty = true;
}

function update(patch, { rebuild = false } = {}) {
  const before = settings;
  settings = normalise({ ...settings, ...patch });
  syncControls();
  const townChanged = ['size', 'groups', 'majority', 'empty', 'neighbourhood', 'wrap', 'seed'].some(
    (k) => before[k] !== settings[k],
  );
  if (rebuild || townChanged) {
    build();
    legend();
  } else if (before.min !== settings.min || before.max !== settings.max || before.rule !== settings.rule) {
    retune(sim, { pref: preference(settings), rule: settings.rule });
  }
  setPlaying(playing);
}

function bindRange(id, key) {
  $(id).addEventListener('input', () => update({ [key]: Number($(id).value) }));
}

function init() {
  readColours();
  const select = $('preset');
  const own = new Option('Your own settings', '');
  own.disabled = true;
  select.append(own);
  for (const p of PRESETS) select.append(new Option(p.name, p.id));

  bindRange('min', 'min');
  bindRange('max', 'max');
  bindRange('size', 'size');
  bindRange('majority', 'majority');
  bindRange('empty', 'empty');
  $('groups').addEventListener('input', () => {
    const groups = Number($('groups').value);
    update({ groups, majority: Math.ceil(100 / groups) });
  });
  $('neighbourhood').addEventListener('change', () => update({ neighbourhood: $('neighbourhood').value }));
  $('rule').addEventListener('change', () => update({ rule: $('rule').value }));
  $('wrap').addEventListener('change', () => update({ wrap: $('wrap').checked }));
  select.addEventListener('change', () => {
    settings = presetSettings(select.value, settings.seed);
    syncControls();
    build();
    legend();
    setPlaying(false);
  });

  $('play').addEventListener('click', () => setPlaying(!playing));
  $('step').addEventListener('click', () => {
    setPlaying(false);
    sweep(sim);
    dirty = true;
  });
  $('reset').addEventListener('click', () => {
    setPlaying(false);
    restart();
  });
  $('reseed').addEventListener('click', () => update({ seed: randomSeed() }));
  $('fade').addEventListener('change', () => {
    legend();
    dirty = true;
  });
  $('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('copy-link').textContent = 'Copied';
    } catch {
      $('copy-link').textContent = 'Copy failed';
    }
    setTimeout(() => ($('copy-link').textContent = 'Copy link'), 1500);
  });
  $('save-png').addEventListener('click', () => {
    townCanvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `enclave-${settings.seed}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
    const key = e.key.toLowerCase();
    if (key === ' ' && tag === 'BUTTON') return;
    if (key === ' ') {
      e.preventDefault();
      setPlaying(!playing);
    } else if (key === 's') {
      $('step').click();
    } else if (key === 'r') {
      $('reset').click();
    } else if (key === 'n') {
      $('reseed').click();
    }
  });

  window.addEventListener('hashchange', () => {
    const next = decode(location.hash);
    if (encode(next) !== encode(settings)) update(next, { rebuild: true });
  });
  window.addEventListener('resize', () => (dirty = true));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readColours();
    legend();
    dirty = true;
  });

  syncControls();
  build();
  legend();
  setPlaying(false);
  requestAnimationFrame(frame);
}

init();
