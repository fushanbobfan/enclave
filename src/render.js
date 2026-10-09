// Drawing: the town as one pixel per home scaled up crisply, and a chart
// of similarity and discontent over the sweeps.

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, '$&$&') : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a, b, t) {
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t));
}

// Fill an RGBA buffer, one pixel per home. Discontented households, when a
// set of them is given, are drawn washed out towards the empty colour.
export function paintTown(grid, rgba, colours, faded = null) {
  const rgb = colours.map(hexToRgb);
  const pale = rgb.map((c) => mix(c, rgb[0], 0.62));
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const px = faded && c !== 0 && faded.has(i) ? pale[c] : rgb[c];
    rgba[4 * i] = px[0];
    rgba[4 * i + 1] = px[1];
    rgba[4 * i + 2] = px[2];
    rgba[4 * i + 3] = 255;
  }
  return rgba;
}

// Largest whole-pixel cell size that fits the town in the canvas, centred.
export function fitTown(cols, rows, width, height) {
  const size = Math.max(1, Math.floor(Math.min(width / cols, height / rows)));
  return { size, x: Math.floor((width - cols * size) / 2), y: Math.floor((height - rows * size) / 2) };
}

export function homeAt(fit, cols, rows, px, py) {
  const x = Math.floor((px - fit.x) / fit.size);
  const y = Math.floor((py - fit.y) / fit.size);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
  return y * cols + x;
}

const PAD = { left: 34, right: 10, top: 8, bottom: 20 };

export function chartScale(history, width, height) {
  const last = Math.max(10, history.length ? history.at(-1).sweep : 0);
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  return {
    last,
    x: (sweep) => PAD.left + (sweep / last) * w,
    y: (v) => PAD.top + (1 - v) * h,
    box: { left: PAD.left, top: PAD.top, right: PAD.left + w, bottom: PAD.top + h },
  };
}

export function drawChart(ctx, history, { households, baseline }, width, height, colours) {
  const s = chartScale(history, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '10px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.grid;
  ctx.fillStyle = colours.tick;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(s.box.left, s.y(v));
    ctx.lineTo(s.box.right, s.y(v));
    ctx.stroke();
    ctx.fillText(`${Math.round(v * 100)}%`, s.box.left - 4, s.y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0', s.x(0), s.box.bottom + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${s.last} sweeps`, s.box.right, s.box.bottom + 4);

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = colours.baseline;
  ctx.beginPath();
  ctx.moveTo(s.box.left, s.y(baseline));
  ctx.lineTo(s.box.right, s.y(baseline));
  ctx.stroke();
  ctx.setLineDash([]);

  const line = (value, colour) => {
    if (!history.length) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((h, k) => {
      const px = s.x(h.sweep);
      const py = s.y(value(h));
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
  };
  line((h) => h.similarity, colours.similarity);
  line((h) => (households ? h.discontented / households : 0), colours.discontent);
  return s;
}

// The tipping chart: where the town ends up for each preference floor.
export function tippingScale(width, height) {
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  return {
    x: (t) => PAD.left + (t / 100) * w,
    y: (v) => PAD.top + (1 - v) * h,
    box: { left: PAD.left, top: PAD.top, right: PAD.left + w, bottom: PAD.top + h },
  };
}

// The floor, in whole percent, under a horizontal position on the chart.
export function floorAt(scale, px, step = 1) {
  const { left, right } = scale.box;
  const t = ((px - left) / (right - left)) * 100;
  return Math.min(100, Math.max(0, Math.round(t / step) * step));
}

export function drawTipping(ctx, points, { current, baseline }, width, height, colours) {
  const s = tippingScale(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '10px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.grid;
  ctx.fillStyle = colours.tick;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(s.box.left, s.y(v));
    ctx.lineTo(s.box.right, s.y(v));
    ctx.stroke();
    ctx.fillText(`${Math.round(v * 100)}%`, s.box.left - 4, s.y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of [0, 25, 50, 75, 100]) {
    // Pull the end labels inside the box so neither edge clips them.
    ctx.textAlign = t === 0 ? 'left' : t === 100 ? 'right' : 'center';
    ctx.fillText(`${t}%`, s.x(t) + (t === 0 ? -2 : t === 100 ? 2 : 0), s.box.bottom + 4);
  }

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = colours.baseline;
  ctx.beginPath();
  ctx.moveTo(s.box.left, s.y(baseline));
  ctx.lineTo(s.box.right, s.y(baseline));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = colours.current;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x(current), s.box.top);
  ctx.lineTo(s.x(current), s.box.bottom);
  ctx.stroke();

  const series = (value, colour) => {
    if (!points.length) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, k) => {
      if (k) ctx.lineTo(s.x(p.threshold), s.y(value(p)));
      else ctx.moveTo(s.x(p.threshold), s.y(value(p)));
    });
    ctx.stroke();
    // Runs that came to rest are filled dots; the rest are rings.
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(s.x(p.threshold), s.y(value(p)), 3, 0, Math.PI * 2);
      if (p.status === 'settled') {
        ctx.fillStyle = colour;
        ctx.fill();
      } else {
        ctx.fillStyle = colours.background;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  };
  series((p) => p.similarity, colours.similarity);
  series((p) => p.discontented, colours.discontent);
  return s;
}
