import { store, insert, update, remove } from '../store.js';
import {
  $, $$, esc, icon, fmtMoney, fmtDateTime, timeAgo, debounce, round2, sum, startOfDay, addDays, avatar,
} from '../util.js';
import { openModal, confirmDialog, badge, pager, empty, iconBtn, run, field, toast } from '../ui.js';
import {
  ORDER_STATUS, PAYMENT_STATUS, ORDER_TYPES, PAYMENT_METHODS, SIZES, CATEGORIES, categoryLabel,
  statusLabel, nextStatus, customerMap, customerName, itemsSummary, sizeLabel, getPrefs, unitsOf,
} from '../domain.js';

const PAGE = 15;
const filters = { q: '', status: '', payment: '', type: '', range: 'all', page: 1 };

/* =========================================================== list view */
export default {
  title: 'Orders',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Every order, from the first ring of the phone to the doorstep.</h2></div>
        <button class="btn primary" data-act="new">${icon('plus')} New order</button>
      </div>
      <section class="card">
        <div class="toolbar">
          <div class="search">${icon('search', 16)}<input id="oq" class="input" type="search" placeholder="Search order #, customer, pizza…" value="${esc(filters.q)}" aria-label="Search orders"></div>
          <select id="ostatus" class="input" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active (in progress)</option>
            ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select id="opay" class="input" aria-label="Filter by payment">
            <option value="">All payments</option>
            ${Object.entries(PAYMENT_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select id="otype" class="input" aria-label="Filter by type">
            <option value="">All types</option>
            ${Object.entries(ORDER_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <select id="orange" class="input" aria-label="Filter by date">
            <option value="all">All time</option><option value="today">Today</option>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
          </select>
        </div>
        <div id="olist"></div>
      </section>`;
    $('#ostatus', root).value = filters.status;
    $('#opay', root).value = filters.payment;
    $('#otype', root).value = filters.type;
    $('#orange', root).value = filters.range;

    const list = () => renderList(root);
    $('#oq', root).addEventListener('input', debounce((e) => { filters.q = e.target.value; filters.page = 1; list(); }));
    for (const [id, key] of [['ostatus', 'status'], ['opay', 'payment'], ['otype', 'type'], ['orange', 'range']]) {
      $('#' + id, root).addEventListener('change', (e) => { filters[key] = e.target.value; filters.page = 1; list(); });
    }

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) {
        const row = e.target.closest('tr[data-id]');
        if (row && !e.target.closest('a,input,select')) openOrderDetail(row.dataset.id);
        return;
      }
      const id = btn.dataset.id;
      const order = id && store.data.orders.find((o) => o.id === id);
      switch (btn.dataset.act) {
        case 'new': openOrderForm(); break;
        case 'view': openOrderDetail(id); break;
        case 'edit': openOrderForm(order); break;
        case 'page': filters.page = +btn.dataset.p; list(); break;
        case 'advance': await advanceOrder(order); break;
        case 'pay': await markPaid(order); break;
        case 'delete': await deleteOrder(order); break;
        case 'clear':
          Object.assign(filters, { q: '', status: '', payment: '', type: '', range: 'all', page: 1 });
          $('#oq', root).value = ''; $('#ostatus', root).value = ''; $('#opay', root).value = '';
          $('#otype', root).value = ''; $('#orange', root).value = 'all';
          list(); break;
      }
    });
    list();
    return { refresh: list };
  },
};

function filtered() {
  const map = customerMap();
  const q = filters.q.trim().toLowerCase();
  const since = filters.range === 'today' ? startOfDay() : filters.range === 'all' ? null : addDays(startOfDay(), -(+filters.range - 1));
  return store.data.orders
    .filter((o) => {
      if (filters.status === 'active' ? ['delivered', 'cancelled'].includes(o.delivery_status) : filters.status && o.delivery_status !== filters.status) return false;
      if (filters.payment && o.payment_status !== filters.payment) return false;
      if (filters.type && o.order_type !== filters.type) return false;
      if (since && new Date(o.created_at) < since) return false;
      if (q) {
        const hay = `${o.order_no} ${customerName(o, map)} ${(o.items || []).map((i) => i.name).join(' ')} ${o.address || ''}`.toLowerCase();
        if (!hay.includes(q.replace('#', ''))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function renderList(root) {
  const el = $('#olist', root);
  const rows = filtered();
  const maxPage = Math.max(1, Math.ceil(rows.length / PAGE));
  if (filters.page > maxPage) filters.page = maxPage;
  const page = rows.slice((filters.page - 1) * PAGE, filters.page * PAGE);
  const map = customerMap();

  if (!rows.length) {
    el.innerHTML = empty('🍕', 'No orders found', 'Try changing your filters or create a new order.',
      `<button class="btn ghost" data-act="clear">Clear filters</button>`);
    return;
  }
  el.innerHTML = `
    <div class="table-wrap"><table class="table stack">
      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th class="num">Total</th><th>Payment</th><th>Status</th><th class="actions"></th></tr></thead>
      <tbody>${page.map((o) => {
        const next = nextStatus(o);
        return `<tr data-id="${o.id}" class="clickable">
          <td data-label="Order"><b class="order-no">#${o.order_no}</b><div class="muted sm">${fmtDateTime(o.created_at)}</div></td>
          <td data-label="Customer"><div class="cell-user">${avatar(customerName(o, map), 'sm')}<div><b>${esc(customerName(o, map))}</b><div class="muted sm">${ORDER_TYPES[o.order_type] || o.order_type}</div></div></div></td>
          <td data-label="Items" class="items-cell">${esc(itemsSummary(o))}</td>
          <td data-label="Total" class="num"><b>${fmtMoney(o.total)}</b></td>
          <td data-label="Payment">${badge(PAYMENT_STATUS[o.payment_status]?.label, PAYMENT_STATUS[o.payment_status]?.tone)}<div class="muted sm">${PAYMENT_METHODS[o.payment_method] || ''}</div></td>
          <td data-label="Status">${badge(statusLabel(o.delivery_status, o.order_type), ORDER_STATUS[o.delivery_status]?.tone)}</td>
          <td class="actions" data-label="">
            ${next ? `<button class="btn soft sm" data-act="advance" data-id="${o.id}" title="Move to ${statusLabel(next, o.order_type)}">${icon('arrow', 14)} ${esc(statusLabel(next, o.order_type))}</button>` : ''}
            ${o.payment_status === 'pending' && o.delivery_status !== 'cancelled' ? `<button class="btn soft sm green" data-act="pay" data-id="${o.id}">${icon('dollar', 14)} Mark paid</button>` : ''}
            ${iconBtn('edit', 'edit', 'Edit order', o.id)}${iconBtn('delete', 'trash', 'Delete order', o.id, 'danger')}
          </td></tr>`;
      }).join('')}</tbody></table></div>
    ${pager(filters.page, rows.length, PAGE)}`;
}

/* =========================================================== actions */
export async function advanceOrder(o) {
  const next = nextStatus(o);
  if (!next) return;
  await run(() => update('orders', o.id, { delivery_status: next }), `Order #${o.order_no} → ${statusLabel(next, o.order_type)}`);
}
export async function markPaid(o) {
  await run(() => update('orders', o.id, { payment_status: 'paid' }), `Order #${o.order_no} marked as paid`);
}
export async function deleteOrder(o) {
  if (await confirmDialog({ title: 'Delete order?', message: `Order <b>#${o.order_no}</b> (${fmtMoney(o.total)}) will be permanently removed. This also removes it from your reports.` })) {
    await run(() => remove('orders', o.id), `Order #${o.order_no} deleted`);
  }
}

/* =========================================================== detail */
export function openOrderDetail(id) {
  const o = store.data.orders.find((x) => x.id === id);
  if (!o) return;
  const map = customerMap();
  const cust = map.get(o.customer_id);
  const next = nextStatus(o);
  const subtotal = sum(o.items || [], (i) => i.qty * i.unit_price);
  const steps = o.order_type === 'delivery' ? ['pending', 'preparing', 'ready', 'out_for_delivery', 'delivered'] : ['pending', 'preparing', 'ready', 'delivered'];
  const idx = steps.indexOf(o.delivery_status);

  const m = openModal({
    title: `Order #${o.order_no}`, size: 'md',
    body: `
      <div class="detail-top">
        <div>${badge(statusLabel(o.delivery_status, o.order_type), ORDER_STATUS[o.delivery_status]?.tone)} ${badge(PAYMENT_STATUS[o.payment_status]?.label, PAYMENT_STATUS[o.payment_status]?.tone)}</div>
        <span class="muted">${fmtDateTime(o.created_at)} · ${timeAgo(o.created_at)}</span>
      </div>
      ${o.delivery_status !== 'cancelled' ? `<ol class="steps">${steps.map((s, i) => `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><i></i><span>${esc(statusLabel(s, o.order_type))}</span></li>`).join('')}</ol>` : ''}
      <div class="info-grid">
        <div><span class="lbl">Customer</span><b>${esc(customerName(o, map))}</b>${cust ? `<div class="muted sm">${esc(cust.phone)}</div>` : ''}</div>
        <div><span class="lbl">Order type</span><b>${ORDER_TYPES[o.order_type]}</b></div>
        <div><span class="lbl">Payment</span><b>${PAYMENT_METHODS[o.payment_method] || '—'}</b></div>
        ${o.order_type === 'delivery' ? `<div class="span-2"><span class="lbl">Delivery address</span><b>${esc(o.address || '—')}</b></div>` : ''}
        ${o.notes ? `<div class="span-2"><span class="lbl">Notes</span><b>${esc(o.notes)}</b></div>` : ''}
      </div>
      <table class="table mini">
        <thead><tr><th>Item</th><th>Size</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
        <tbody>${(o.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(sizeLabel(i.size))}</td><td class="num">${i.qty}</td><td class="num">${fmtMoney(i.unit_price)}</td><td class="num"><b>${fmtMoney(i.qty * i.unit_price)}</b></td></tr>`).join('')}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
        <div><span>Delivery fee</span><span>${fmtMoney(o.delivery_fee)}</span></div>
        <div class="grand"><span>Total</span><span>${fmtMoney(o.total)}</span></div>
      </div>`,
    footer: `
      <button class="btn ghost danger-text" data-do="delete">${icon('trash', 16)} Delete</button>
      <span class="grow"></span>
      <button class="btn ghost" data-do="edit">${icon('edit', 16)} Edit</button>
      ${o.payment_status === 'pending' && o.delivery_status !== 'cancelled' ? `<button class="btn soft green" data-do="pay">${icon('dollar', 16)} Mark paid</button>` : ''}
      ${next ? `<button class="btn primary" data-do="advance">${icon('arrow', 16)} ${esc(statusLabel(next, o.order_type))}</button>` : ''}
      ${!['cancelled', 'delivered'].includes(o.delivery_status) ? `<button class="btn ghost danger-text" data-do="cancel">Cancel order</button>` : ''}`,
    onMount: (el, api) => el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-do]');
      if (!b) return;
      const a = b.dataset.do;
      if (a === 'edit') { api.close(); openOrderForm(o); }
      else if (a === 'delete') { api.close(); deleteOrder(o); }
      else if (a === 'advance' || a === 'pay' || a === 'cancel') {
        let ok;
        if (a === 'advance') ok = await run(() => update('orders', o.id, { delivery_status: next }), `Order #${o.order_no} → ${statusLabel(next, o.order_type)}`);
        if (a === 'pay') ok = await run(() => update('orders', o.id, { payment_status: 'paid' }), 'Marked as paid');
        if (a === 'cancel' && await confirmDialog({ title: 'Cancel this order?', message: 'The order will be kept but excluded from sales.', confirmLabel: 'Cancel order' })) {
          const patch = { delivery_status: 'cancelled' };
          if (o.payment_status === 'paid') patch.payment_status = 'refunded';
          ok = await run(() => update('orders', o.id, patch), 'Order cancelled');
        }
        if (ok) { api.close(); openOrderDetail(id); }
      }
    }),
  });
  return m;
}

/* =========================================================== form */
const optionsHTML = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.label)}</option>`).join('');

function menuOptionsHTML(line) {
  const items = store.data.menu_items.filter((m) => m.available || m.id === line?.menu_item_id);
  let html = `<option value="" ${line ? '' : 'selected'} disabled>Select item…</option>`;
  for (const c of CATEGORIES) {
    const group = items.filter((m) => m.category === c.key).sort((a, b) => a.name.localeCompare(b.name));
    if (!group.length) continue;
    html += `<optgroup label="${esc(c.label)}">${group.map((m) =>
      `<option value="${m.id}" data-name="${esc(m.name)}" data-prices="${esc(JSON.stringify(m.prices || {}))}" ${line?.menu_item_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`;
  }
  if (line && !items.find((m) => m.id === line.menu_item_id)) {
    html += `<option value="${esc(line.menu_item_id || 'legacy')}" selected data-name="${esc(line.name)}" data-prices="${esc(JSON.stringify({ [line.size]: line.unit_price }))}">${esc(line.name)} (removed from menu)</option>`;
  }
  return html;
}
const sizeOptionsHTML = (prices, sel) =>
  Object.entries(prices).map(([k, p]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(sizeLabel(k))} · ${fmtMoney(p)}</option>`).join('');

function lineHTML(line) {
  let prices = {};
  if (line) {
    const m = store.data.menu_items.find((x) => x.id === line.menu_item_id);
    prices = m ? m.prices : { [line.size]: line.unit_price };
    if (!(line.size in prices)) prices = { ...prices, [line.size]: line.unit_price };
  }
  return `<div class="line" data-unit="${line ? line.unit_price : 0}">
    <select class="input l-item" aria-label="Menu item">${menuOptionsHTML(line)}</select>
    <select class="input l-size" aria-label="Size">${line ? sizeOptionsHTML(prices, line.size) : '<option value="">Size</option>'}</select>
    <input class="input l-qty" type="number" min="1" max="99" value="${line ? line.qty : 1}" aria-label="Quantity" inputmode="numeric">
    <span class="l-total">${fmtMoney(line ? line.qty * line.unit_price : 0)}</span>
    <button type="button" class="icon-btn danger l-del" aria-label="Remove item">${icon('x', 16)}</button>
  </div>`;
}

export function openOrderForm(order = null, preset = {}) {
  const editing = !!order;
  const prefs = getPrefs();
  const customers = [...store.data.customers].sort((a, b) => a.name.localeCompare(b.name));
  const v = order || {
    customer_id: preset.customer_id || '', order_type: 'delivery', address: '', items: [], delivery_fee: prefs.deliveryFee,
    payment_method: 'card', payment_status: 'pending', delivery_status: 'pending', notes: '', customer_name: '',
  };
  const startCust = customers.find((c) => c.id === v.customer_id);
  if (!editing && startCust) v.address = startCust.address || '';

  openModal({
    title: editing ? `Edit order #${order.order_no}` : 'New order', size: 'lg', submitLabel: editing ? 'Save changes' : 'Create order',
    body: `<div class="form-grid">
      <div class="field span-2"><label for="of_cust">Customer</label>
        <select class="input" id="of_cust" name="customer_id">
          <option value="">Walk-in / guest</option>
          ${customers.map((c) => `<option value="${c.id}" ${c.id === v.customer_id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}
        </select></div>
      <div class="field" id="guestWrap"><label for="of_guest">Guest name</label>
        <input class="input" id="of_guest" name="guest_name" maxlength="60" placeholder="e.g. Tom H." value="${esc(v.customer_id ? '' : v.customer_name)}"></div>
      <div class="field"><label for="of_type">Order type</label><select class="input" id="of_type" name="order_type">${optionsHTML(ORDER_TYPES, v.order_type)}</select></div>
      <div class="field span-2" id="addrWrap"><label for="of_addr">Delivery address</label>
        <textarea class="input" id="of_addr" name="address" rows="2" placeholder="Street, apt, city">${esc(v.address)}</textarea></div>

      <div class="field span-2"><label>Items <i class="req">*</i></label>
        <div id="lines" class="lines">${(v.items || []).map(lineHTML).join('')}</div>
        <button type="button" class="btn ghost sm" id="addLine">${icon('plus', 14)} Add item</button></div>

      <div class="field"><label for="of_fee">Delivery fee ($)</label><input class="input" id="of_fee" name="delivery_fee" type="number" min="0" step="0.01" value="${v.delivery_fee}"></div>
      <div class="field"><label for="of_pm">Payment method</label><select class="input" id="of_pm" name="payment_method">${optionsHTML(PAYMENT_METHODS, v.payment_method)}</select></div>
      <div class="field"><label for="of_ps">Payment status</label><select class="input" id="of_ps" name="payment_status">${optionsHTML(PAYMENT_STATUS, v.payment_status)}</select></div>
      <div class="field"><label for="of_ds">Delivery status</label><select class="input" id="of_ds" name="delivery_status">${optionsHTML(Object.fromEntries(Object.entries(ORDER_STATUS).map(([k, s]) => [k, s.label])), v.delivery_status)}</select></div>
      <div class="field span-2"><label for="of_notes">Notes</label><input class="input" id="of_notes" name="notes" maxlength="200" placeholder="Allergies, instructions…" value="${esc(v.notes)}"></div>
      <div class="order-total span-2">
        <div><span>Subtotal</span><b id="t_sub">$0.00</b></div><div><span>Delivery</span><b id="t_fee">$0.00</b></div>
        <div class="grand"><span>Total</span><b id="t_total">$0.00</b></div>
      </div></div>`,
    onMount: (el) => {
      const lines = $('#lines', el);
      const type = $('#of_type', el), cust = $('#of_cust', el), fee = $('#of_fee', el), addr = $('#of_addr', el);
      let feeTouched = editing;

      const recalc = () => {
        let sub = 0;
        $$('.line', lines).forEach((row) => {
          const t = (+row.dataset.unit || 0) * (+$('.l-qty', row).value || 0);
          $('.l-total', row).textContent = fmtMoney(t);
          sub += t;
        });
        const f = type.value === 'delivery' ? +fee.value || 0 : +fee.value || 0;
        $('#t_sub', el).textContent = fmtMoney(sub);
        $('#t_fee', el).textContent = fmtMoney(f);
        $('#t_total', el).textContent = fmtMoney(sub + f);
      };
      const syncVisibility = () => {
        $('#addrWrap', el).hidden = type.value !== 'delivery';
        $('#guestWrap', el).hidden = !!cust.value;
        if (!feeTouched) fee.value = type.value === 'delivery' ? prefs.deliveryFee : 0;
        recalc();
      };
      const setSizes = (row, keepSize) => {
        const opt = $('.l-item', row).selectedOptions[0];
        const prices = opt && opt.dataset.prices ? JSON.parse(opt.dataset.prices) : {};
        const keys = Object.keys(prices);
        const size = keepSize && keys.includes(keepSize) ? keepSize : keys.includes('medium') ? 'medium' : keys[0];
        $('.l-size', row).innerHTML = sizeOptionsHTML(prices, size);
        row.dataset.unit = prices[size] ?? 0;
      };

      lines.addEventListener('change', (e) => {
        const row = e.target.closest('.line');
        if (!row) return;
        if (e.target.matches('.l-item')) setSizes(row, $('.l-size', row).value);
        if (e.target.matches('.l-size')) {
          const prices = JSON.parse($('.l-item', row).selectedOptions[0].dataset.prices || '{}');
          row.dataset.unit = prices[e.target.value] ?? 0;
        }
        recalc();
      });
      lines.addEventListener('input', (e) => { if (e.target.matches('.l-qty')) recalc(); });
      lines.addEventListener('click', (e) => { if (e.target.closest('.l-del')) { e.target.closest('.line').remove(); recalc(); } });
      $('#addLine', el).addEventListener('click', () => {
        lines.insertAdjacentHTML('beforeend', lineHTML(null));
        const sel = $('.line:last-child .l-item', lines); sel.focus();
      });
      fee.addEventListener('input', () => { feeTouched = true; recalc(); });
      type.addEventListener('change', syncVisibility);
      cust.addEventListener('change', () => {
        const c = customers.find((x) => x.id === cust.value);
        if (c && !addr.value.trim()) addr.value = c.address || '';
        syncVisibility();
      });
      if (!editing && !lines.children.length) lines.insertAdjacentHTML('beforeend', lineHTML(null));
      syncVisibility();
    },
    onSubmit: async (fd, form) => {
      const items = $$('.line', form).map((row) => {
        const opt = $('.l-item', row).selectedOptions[0];
        if (!opt || !opt.value) return null;
        return {
          menu_item_id: opt.value, name: opt.dataset.name, size: $('.l-size', row).value || 'regular',
          qty: Math.max(1, parseInt($('.l-qty', row).value, 10) || 1), unit_price: +row.dataset.unit || 0,
        };
      }).filter(Boolean);
      if (!items.length) { toast('Add at least one item to the order', 'error'); return false; }

      const c = customers.find((x) => x.id === fd.get('customer_id'));
      const type = fd.get('order_type');
      const fee = type === 'delivery' || +fd.get('delivery_fee') > 0 ? round2(+fd.get('delivery_fee') || 0) : 0;
      if (type === 'delivery' && !String(fd.get('address')).trim()) { toast('Delivery orders need an address', 'error'); return false; }
      const row = {
        customer_id: c ? c.id : null,
        customer_name: c ? c.name : String(fd.get('guest_name') || '').trim() || 'Walk-in guest',
        order_type: type, address: type === 'delivery' ? String(fd.get('address')).trim() : '',
        items, delivery_fee: fee, total: round2(sum(items, (i) => i.qty * i.unit_price) + fee),
        payment_method: fd.get('payment_method'), payment_status: fd.get('payment_status'),
        delivery_status: fd.get('delivery_status'), notes: String(fd.get('notes') || '').trim(),
      };
      if (editing) { await update('orders', order.id, row); toast(`Order #${order.order_no} updated`); }
      else { const rec = await insert('orders', row); toast(`Order #${rec.order_no} created`); }
    },
  });
}
