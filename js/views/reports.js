import { store } from '../store.js';
import {
  $, $$, esc, icon, fmtMoney, fmtNum, fmtDate, sum, startOfDay, startOfWeek, startOfMonth, addDays, addMonths, isoDay,
  pctChange, toCSV, download,
} from '../util.js';
import { barChart, hbars, donut } from '../charts.js';
import { toast, empty } from '../ui.js';
import { sales, isCancelled, revenueOf, unitsOf, ORDER_TYPES, PAYMENT_METHODS, categoryLabel, CATEGORIES } from '../domain.js';

const OPTIONS = { daily: [7, 14, 30, 60], weekly: [4, 8, 12, 16], monthly: [3, 6, 12] };
const LABEL = { daily: 'day', weekly: 'week', monthly: 'month' };
const state = { period: 'daily', count: { daily: 14, weekly: 8, monthly: 6 } };

/** Build buckets [{start,end,label,long}] oldest → newest. */
function buckets() {
  const n = state.count[state.period], now = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) {
    let s, e, label, long;
    if (state.period === 'daily') {
      s = addDays(startOfDay(now), -i); e = addDays(s, 1);
      label = n <= 14 ? fmtDate(s, { weekday: 'short' }) + ' ' + s.getDate() : fmtDate(s, { month: 'numeric', day: 'numeric' });
      long = fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else if (state.period === 'weekly') {
      s = addDays(startOfWeek(now), -7 * i); e = addDays(s, 7);
      label = fmtDate(s, { month: 'short', day: 'numeric' });
      long = `Week of ${fmtDate(s, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(e, -1), { month: 'short', day: 'numeric' })}`;
    } else {
      s = addMonths(now, -i); e = addMonths(s, 1);
      label = fmtDate(s, { month: 'short' }) + (s.getMonth() === 0 || i === n - 1 ? ` '${String(s.getFullYear()).slice(2)}` : '');
      long = fmtDate(s, { month: 'long', year: 'numeric' });
    }
    out.push({ s, e, label, long });
  }
  return out;
}

const within = (orders, s, e) => orders.filter((o) => { const t = new Date(o.created_at); return t >= s && t < e; });
function summarize(orders) {
  const valid = sales(orders);
  const revenue = sum(valid, (o) => o.total);
  return {
    orders: valid.length, cancelled: orders.filter(isCancelled).length, revenue,
    avg: valid.length ? revenue / valid.length : 0, units: sum(valid, unitsOf),
    collected: sum(valid.filter((o) => o.payment_status === 'paid'), (o) => o.total),
    outstanding: sum(valid.filter((o) => o.payment_status === 'pending'), (o) => o.total),
  };
}

export default {
  title: 'Reports',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Daily, weekly and monthly sales — compare and export.</h2></div>
        <div class="head-actions">
          <button class="btn ghost" data-act="print">${icon('print')} Print</button>
          <button class="btn primary" data-act="csv">${icon('download')} Export CSV</button>
        </div>
      </div>
      <section class="card"><div class="toolbar between">
        <div class="tabs pill" id="ptabs" role="tablist">
          ${Object.keys(OPTIONS).map((p) => `<button class="tab" data-period="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}
        </div>
        <label class="inline-select"><span class="muted">Show last</span><select id="pcount" class="input"></select></label>
      </div></section>
      <div id="rbody"></div>`;
    const draw = () => drawBody(root);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-period]');
      if (t) { state.period = t.dataset.period; draw(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'print') window.print();
      if (b.dataset.act === 'csv') exportCSV();
    });
    root.addEventListener('change', (e) => { if (e.target.id === 'pcount') { state.count[state.period] = +e.target.value; draw(); } });
    draw();
    return { refresh: draw };
  },
};

function drawBody(root) {
  $$('#ptabs .tab', root).forEach((t) => t.classList.toggle('active', t.dataset.period === state.period));
  $('#pcount', root).innerHTML = OPTIONS[state.period].map((n) => `<option value="${n}" ${n === state.count[state.period] ? 'selected' : ''}>${n} ${LABEL[state.period]}s</option>`).join('');

  const bs = buckets();
  const all = store.data.orders;
  const rows = bs.map((b) => ({ ...b, ...summarize(within(all, b.s, b.e)) }));
  const rangeOrders = within(all, bs[0].s, bs[bs.length - 1].e);
  const cur = summarize(rangeOrders);
  const prevLen = bs[bs.length - 1].e - bs[0].s;
  const prevOrders = within(all, new Date(bs[0].s - prevLen), bs[0].s);
  const prev = summarize(prevOrders);
  const valid = sales(rangeOrders);

  const chg = (a, b) => { const p = pctChange(a, b); return `<span class="trend ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span> <span class="muted">vs previous</span>`; };
  const kpis = [
    ['Revenue', fmtMoney(cur.revenue), chg(cur.revenue, prev.revenue), 'green', 'dollar'],
    ['Orders', fmtNum(cur.orders), chg(cur.orders, prev.orders), 'blue', 'bag'],
    ['Avg order value', fmtMoney(cur.avg), chg(cur.avg, prev.avg), 'red', 'trend'],
    ['Items sold', fmtNum(cur.units), chg(cur.units, prev.units), 'amber', 'pizza'],
  ];

  /* breakdowns */
  const items = new Map(), cats = new Map();
  const menuCat = new Map(store.data.menu_items.map((m) => [m.id, m.category]));
  for (const o of valid) for (const i of o.items || []) {
    const r = items.get(i.name) || { qty: 0, rev: 0 }; r.qty += i.qty; r.rev += i.qty * i.unit_price; items.set(i.name, r);
    const c = menuCat.get(i.menu_item_id) || 'pizza'; cats.set(c, (cats.get(c) || 0) + i.qty * i.unit_price);
  }
  const topItems = [...items.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 6).map(([n, v]) => ({ label: n, value: v.rev, display: fmtMoney(v.rev), sub: `${v.qty} sold` }));
  const catRows = CATEGORIES.map((c) => ({ label: `${c.emoji} ${c.label}`, value: cats.get(c.key) || 0, display: fmtMoney(cats.get(c.key) || 0) })).filter((r) => r.value > 0);
  const typeSegs = Object.entries(ORDER_TYPES).map(([k, l], i) => ({ label: l, color: ['#e5432d', '#f4a622', '#3b82c4'][i], value: valid.filter((o) => o.order_type === k).length }));
  const paySegs = Object.entries(PAYMENT_METHODS).map(([k, l], i) => ({ label: l, color: ['#2f9e63', '#8b5cf6', '#5b6ee1'][i], value: valid.filter((o) => o.payment_method === k).length }));

  const bars = rows.map((r, i) => ({
    label: r.label, value: r.revenue, highlight: i === rows.length - 1,
    tip: `${r.long} · ${fmtMoney(r.revenue)} · ${r.orders} orders`,
  }));
  const best = rows.reduce((m, r) => (r.revenue > (m?.revenue ?? -1) ? r : m), null);

  const totals = rows.reduce((a, r) => ({ orders: a.orders + r.orders, units: a.units + r.units, revenue: a.revenue + r.revenue, collected: a.collected + r.collected, outstanding: a.outstanding + r.outstanding, cancelled: a.cancelled + r.cancelled }),
    { orders: 0, units: 0, revenue: 0, collected: 0, outstanding: 0, cancelled: 0 });

  $('#rbody', root).innerHTML = `
    <div class="kpi-grid">${kpis.map(([l, v, s, tone, ic]) => `<article class="kpi tone-${tone}"><div class="kpi-ic">${icon(ic, 22)}</div><div><span class="kpi-label">${l}</span><b class="kpi-val">${v}</b><small class="kpi-sub">${s}</small></div></article>`).join('')}</div>
    <section class="card">
      <header class="card-head"><div><h3>${state.period[0].toUpperCase() + state.period.slice(1)} sales</h3>
        <p class="muted sm">${best && best.revenue > 0 ? `Best ${LABEL[state.period]}: <b>${esc(best.long)}</b> — ${fmtMoney(best.revenue)}` : 'No sales in this period'}</p></div></header>
      ${barChart(bars, { height: 260, labelEvery: bars.length > 20 ? 3 : bars.length > 12 ? 2 : 1 })}
    </section>
    <div class="grid-3">
      <section class="card"><header class="card-head"><h3>Top items by revenue</h3></header>${hbars(topItems)}</section>
      <section class="card"><header class="card-head"><h3>Sales by category</h3></header>${hbars(catRows, 'var(--accent)')}</section>
      <section class="card"><header class="card-head"><h3>Order mix</h3></header>
        ${donut(typeSegs, { center: fmtNum(valid.length), sub: 'orders' })}<div class="sep"></div>${donut(paySegs, { center: '', sub: '' })}</section>
    </div>
    <section class="card">
      <header class="card-head"><div><h3>Breakdown</h3><p class="muted sm">${fmtMoney(cur.collected)} collected · ${fmtMoney(cur.outstanding)} still unpaid · ${cur.cancelled} cancelled</p></div></header>
      <div class="table-wrap"><table class="table stack">
        <thead><tr><th>${state.period === 'daily' ? 'Day' : state.period === 'weekly' ? 'Week' : 'Month'}</th><th class="num">Orders</th><th class="num">Items</th><th class="num">Avg order</th><th class="num">Revenue</th><th class="num">Collected</th><th class="num">Unpaid</th></tr></thead>
        <tbody>${[...rows].reverse().map((r) => `<tr>
          <td data-label="Period"><b>${esc(r.long)}</b></td><td data-label="Orders" class="num">${r.orders}</td><td data-label="Items" class="num">${r.units}</td>
          <td data-label="Avg order" class="num">${r.orders ? fmtMoney(r.avg) : '—'}</td><td data-label="Revenue" class="num"><b>${fmtMoney(r.revenue)}</b></td>
          <td data-label="Collected" class="num">${fmtMoney(r.collected)}</td><td data-label="Unpaid" class="num">${r.outstanding ? `<span class="warn-text">${fmtMoney(r.outstanding)}</span>` : '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td data-label="Total"><b>Total</b></td><td class="num" data-label="Orders">${totals.orders}</td><td class="num" data-label="Items">${totals.units}</td>
          <td class="num" data-label="Avg order">${totals.orders ? fmtMoney(totals.revenue / totals.orders) : '—'}</td><td class="num" data-label="Revenue"><b>${fmtMoney(totals.revenue)}</b></td>
          <td class="num" data-label="Collected">${fmtMoney(totals.collected)}</td><td class="num" data-label="Unpaid">${fmtMoney(totals.outstanding)}</td></tr></tfoot>
      </table></div>
    </section>`;
}

function exportCSV() {
  const bs = buckets();
  const data = [[state.period === 'daily' ? 'Day' : state.period === 'weekly' ? 'Week' : 'Month', 'Orders', 'Items', 'Avg order', 'Revenue', 'Collected', 'Unpaid', 'Cancelled']];
  for (const b of bs) {
    const s = summarize(within(store.data.orders, b.s, b.e));
    data.push([b.long, s.orders, s.units, s.avg.toFixed(2), s.revenue.toFixed(2), s.collected.toFixed(2), s.outstanding.toFixed(2), s.cancelled]);
  }
  download(`sales-${state.period}-${isoDay(new Date())}.csv`, toCSV(data));
  toast('Report exported');
}
