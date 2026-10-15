/* Lightweight, dependency-free charts (HTML/CSS based so they stay responsive). */
import { esc, fmtMoneyShort } from './util.js';

const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceTop(max) {
  if (max <= 0) return 4;
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = STEPS.find((s) => s * mag >= raw) * mag;
  return step * 4;
}

/** bars: [{label, value, tip, highlight?}] */
export function barChart(bars, { height = 230, fmt = fmtMoneyShort, labelEvery = 1 } = {}) {
  const top = niceTop(Math.max(0, ...bars.map((b) => b.value)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => top * f);
  return `<div class="chart" style="--h:${height}px; --n:${bars.length}">
    <div class="chart-y">${ticks.map((t) => `<span>${fmt(t)}</span>`).join('')}</div>
    <div class="chart-plot">
      <div class="chart-grid">${ticks.map(() => '<i></i>').join('')}</div>
      <div class="chart-bars">${bars.map((b, i) => `
        <div class="bar-col" tabindex="0" data-tip="${esc(b.tip || '')}">
          <div class="bar ${b.highlight ? 'hl' : ''}" style="height:${(b.value / top) * 100}%"></div>
          <span class="bar-label">${i % labelEvery === 0 ? esc(b.label) : ''}</span>
        </div>`).join('')}</div>
    </div></div>`;
}

/** segments: [{label, value, color}] */
export function donut(segments, { center = '', sub = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  let acc = 0;
  const stops = total
    ? segments.filter((s) => s.value > 0).map((s) => { const a = (acc / total) * 100; acc += s.value; return `${s.color} ${a}% ${(acc / total) * 100}%`; }).join(',')
    : 'var(--border) 0 100%';
  return `<div class="donut-wrap">
    <div class="donut" style="background:conic-gradient(${stops})"><div class="donut-hole"><b>${esc(center)}</b><small>${esc(sub)}</small></div></div>
    <ul class="legend">${segments.map((s) => `<li><i style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${s.value}</b></li>`).join('')}</ul>
  </div>`;
}

/** rows: [{label, value, display, sub?}] */
export function hbars(rows, color = 'var(--primary)') {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return '<p class="muted center pad">No data for this period.</p>';
  return `<div class="hbars">${rows.map((r) => `
    <div class="hbar">
      <div class="hbar-top"><span>${esc(r.label)}${r.sub ? ` <small class="muted">${esc(r.sub)}</small>` : ''}</span><b>${esc(r.display)}</b></div>
      <div class="hbar-track"><i style="width:${Math.max(2, (r.value / max) * 100)}%;background:${color}"></i></div>
    </div>`).join('')}</div>`;
}
