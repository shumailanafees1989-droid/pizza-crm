import { store, loadSampleDataRemote, isEmpty } from '../store.js';
import {
  $, esc, icon, fmtMoney, fmtNum, fmtDate, timeAgo, sum, startOfDay, addDays, isoDay, pctChange, avatar,
} from '../util.js';
import { badge, empty, run, toast } from '../ui.js';
import { barChart, donut, hbars } from '../charts.js';
import {
  ORDER_STATUS, isActive, isCancelled, sales, revenueOf, customerMap, customerName, itemsSummary, statusLabel,
  nextStatus, stockState, STOCK, PRIORITY, getPrefs, unitsOf,
} from '../domain.js';
import { advanceOrder, openOrderDetail, openOrderForm } from './orders.js';

let range = 14;

const trend = (pct) =>
  `<span class="trend ${pct >= 0 ? 'up' : 'down'}">${icon('trend', 14)} ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%</span>`;

export default {
  title: 'Dashboard',
  render(root) {
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        const a = b.dataset.act;
        if (a === 'advance') await advanceOrder(store.data.orders.find((o) => o.id === b.dataset.id));
        if (a === 'new') openOrderForm();
        if (a === 'seed') {
          b.disabled = true; b.textContent = 'Loading sample data…';
          if (await run(() => loadSampleDataRemote(), 'Sample data loaded')) draw();
          else { b.disabled = false; b.textContent = 'Load sample data'; }
        }
        return;
      }
      const row = e.target.closest('[data-order]');
      if (row) openOrderDetail(row.dataset.order);
    });
    root.addEventListener('change', (e) => { if (e.target.id === 'drange') { range = +e.target.value; draw(); } });
    const draw = () => draw_(root);
    draw();
    return { refresh: draw };
  },
};

function draw_(root) {
  const { orders, inventory, tasks, staff } = store.data;
  const now = new Date();
  const today = startOfDay(now);
  const valid = sales(orders);
  const prefs = getPrefs();

  /* KPIs */
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= today);
  const todayRev = revenueOf(todayOrders);
  const yesterdaySameTime = revenueOf(orders.filter((o) => { const t = new Date(o.created_at); return t >= addDays(today, -1) && t <= addDays(now, -1); }));
  const last7 = revenueOf(orders.filter((o) => new Date(o.created_at) >= addDays(today, -6)));
  const prev7 = revenueOf(orders.filter((o) => { const t = new Date(o.created_at); return t >= addDays(today, -13) && t < addDays(today, -6); }));
  const active = orders.filter(isActive);
  const byStatus = (s) => active.filter((o) => o.delivery_status === s).length;

  /* chart */
  const days = Array.from({ length: range }, (_, i) => addDays(today, -(range - 1 - i)));
  const revByDay = new Map(), cntByDay = new Map();
  for (const o of valid) { const k = isoDay(o.created_at); revByDay.set(k, (revByDay.get(k) || 0) + +o.total); cntByDay.set(k, (cntByDay.get(k) || 0) + 1); }
  const bars = days.map((d) => {
    const k = isoDay(d);
    return {
      label: range <= 14 ? fmtDate(d, { weekday: 'short' }).slice(0, 3) + ' ' + d.getDate() : d.getDate() + '',
      value: revByDay.get(k) || 0, highlight: k === isoDay(today),
      tip: `${fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtMoney(revByDay.get(k) || 0)} · ${cntByDay.get(k) || 0} orders`,
    };
  });
  const rangeTotal = sum(bars, (b) => b.value);

  /* donut */
  const statusSegs = Object.entries(ORDER_STATUS).map(([k, v]) => ({ label: v.label, color: v.color, value: orders.filter((o) => o.delivery_status === k && new Date(o.created_at) >= addDays(today, -29)).length }));

  /* top sellers (30d) */
  const sold = new Map();
  for (const o of valid.filter((o) => new Date(o.created_at) >= addDays(today, -29))) for (const i of o.items || []) {
    const cur = sold.get(i.name) || { qty: 0, rev: 0 }; cur.qty += i.qty; cur.rev += i.qty * i.unit_price; sold.set(i.name, cur);
  }
  const top = [...sold.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6)
    .map(([name, v]) => ({ label: name, value: v.qty, display: `${v.qty} sold`, sub: fmtMoney(v.rev) }));

  /* alerts */
  const lowStock = inventory.filter((i) => stockState(i) !== 'ok').sort((a, b) => (stockState(a) === 'out' ? -1 : 1) - (stockState(b) === 'out' ? -1 : 1));
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const smap = new Map(staff.map((s) => [s.id, s]));
  const cmap = customerMap();
  const queue = [...active].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 7);
  const hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  const kpis = [
    { l: 'Total orders', v: fmtNum(orders.length), ic: 'bag', tone: 'blue', s: `<b>${todayOrders.length}</b> today · ${valid.length} fulfilled or active` },
    { l: 'Total sales', v: fmtMoney(sum(valid, (o) => o.total)), ic: 'dollar', tone: 'green', s: `${trend(pctChange(last7, prev7))} <span class="muted">last 7 days vs prior</span>` },
    { l: 'Pending orders', v: fmtNum(active.length), ic: 'clock', tone: 'amber', s: `${byStatus('pending')} new · ${byStatus('preparing')} preparing · ${byStatus('out_for_delivery')} on the road` },
    { l: "Today's revenue", v: fmtMoney(todayRev), ic: 'trend', tone: 'red', s: `${trend(pctChange(todayRev, yesterdaySameTime))} <span class="muted">vs yesterday so far</span>` },
  ];

  root.innerHTML = `
    <div class="page-head">
      <div><h2 class="greeting">${greet}! 👋</h2><p class="page-sub">${fmtDate(now, { weekday: 'long', month: 'long', day: 'numeric' })} · here's how ${esc(prefs.shopName)} is doing.</p></div>
    </div>
    ${store.mode === 'supabase' && isEmpty() ? `<div class="alert-banner info"><span class="alert-ic">${icon('database', 20)}</span><div><b>Your database is connected but empty</b><p>Load realistic sample data to explore the CRM, or start adding your own.</p></div><button class="btn primary sm" data-act="seed">Load sample data</button></div>` : ''}
    <div class="kpi-grid">${kpis.map((k) => `
      <article class="kpi tone-${k.tone}"><div class="kpi-ic">${icon(k.ic, 22)}</div>
        <div><span class="kpi-label">${k.l}</span><b class="kpi-val">${k.v}</b><small class="kpi-sub">${k.s}</small></div></article>`).join('')}</div>

    <div class="grid-main">
      <section class="card">
        <header class="card-head"><div><h3>Revenue</h3><p class="muted sm">${fmtMoney(rangeTotal)} over the last ${range} days</p></div>
          <select id="drange" class="input sm" aria-label="Chart range">${[7, 14, 30].map((n) => `<option value="${n}" ${n === range ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select></header>
        ${barChart(bars, { labelEvery: range > 14 ? 3 : 1 })}
      </section>
      <section class="card">
        <header class="card-head"><div><h3>Order status</h3><p class="muted sm">Last 30 days</p></div></header>
        ${donut(statusSegs, { center: fmtNum(sum(statusSegs, (s) => s.value)), sub: 'orders' })}
      </section>
    </div>

    <div class="grid-main">
      <section class="card">
        <header class="card-head"><div><h3>Live order queue</h3><p class="muted sm">Oldest first — keep the kitchen moving</p></div><a class="btn ghost sm" href="#/orders">View all ${icon('arrow', 14)}</a></header>
        ${queue.length ? `<ul class="queue">${queue.map((o) => { const nx = nextStatus(o); return `
          <li data-order="${o.id}"><div class="q-main"><b>#${o.order_no}</b> ${esc(customerName(o, cmap))}
            <div class="muted sm">${esc(itemsSummary(o, 2))}</div></div>
            <div class="q-meta"><span class="muted sm">${timeAgo(o.created_at)}</span><b>${fmtMoney(o.total)}</b></div>
            ${badge(statusLabel(o.delivery_status, o.order_type), ORDER_STATUS[o.delivery_status]?.tone)}
            ${nx ? `<button class="btn soft sm" data-act="advance" data-id="${o.id}">${icon('arrow', 14)} ${esc(statusLabel(nx, o.order_type))}</button>` : ''}</li>`; }).join('')}</ul>`
          : empty('✅', 'All caught up', 'No active orders right now.')}
      </section>
      <section class="card">
        <header class="card-head"><div><h3>Low-stock alerts</h3><p class="muted sm">${lowStock.length} item${lowStock.length === 1 ? '' : 's'} need attention</p></div><a class="btn ghost sm" href="#/inventory">Inventory</a></header>
        ${lowStock.length ? `<ul class="alerts">${lowStock.slice(0, 6).map((i) => `<li>${icon('alert', 16)}<div><b>${esc(i.name)}</b><span class="muted sm">${fmtNum(i.quantity)} ${esc(i.unit)} left · reorder at ${fmtNum(i.reorder_level)}</span></div>${badge(STOCK[stockState(i)].label, STOCK[stockState(i)].tone)}</li>`).join('')}</ul>` : empty('📦', 'Fully stocked', 'Nothing is below its reorder level.')}
      </section>
    </div>

    <div class="grid-main even">
      <section class="card">
        <header class="card-head"><div><h3>Top sellers</h3><p class="muted sm">By units, last 30 days</p></div></header>
        ${hbars(top)}
      </section>
      <section class="card">
        <header class="card-head"><div><h3>Team tasks</h3><p class="muted sm">${openTasks.length} open</p></div><a class="btn ghost sm" href="#/team">Team</a></header>
        ${openTasks.length ? `<ul class="alerts tasks">${[...openTasks].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])).slice(0, 6).map((t) => `
          <li>${avatar(smap.get(t.staff_id)?.name || '?', 'xs')}<div><b>${esc(t.title)}</b><span class="muted sm">${esc(smap.get(t.staff_id)?.name || 'Unassigned')}</span></div>${badge(PRIORITY[t.priority]?.label, PRIORITY[t.priority]?.tone)}</li>`).join('')}</ul>` : empty('🎉', 'No open tasks', 'The team is all done.')}
      </section>
    </div>`;
}
