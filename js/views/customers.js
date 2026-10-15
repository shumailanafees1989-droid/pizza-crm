import { store, insert, update, remove } from '../store.js';
import { $, esc, icon, fmtMoney, fmtDate, timeAgo, debounce, avatar, sum } from '../util.js';
import { openModal, confirmDialog, badge, empty, iconBtn, run, fields, pager, toast } from '../ui.js';
import { ordersByCustomer, revenueOf, sales, ORDER_STATUS, statusLabel, itemsSummary } from '../domain.js';
import { openOrderForm, openOrderDetail } from './orders.js';

const PAGE = 12;
const state = { q: '', sort: 'recent', page: 1 };

const FORM = [
  { name: 'name', label: 'Full name', required: true, maxlength: 80, span: 2, autocomplete: 'off' },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '(555) 123-4567', pattern: '[0-9+()\\-\\s.]{7,20}', inputmode: 'tel' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'name@email.com' },
  { name: 'address', label: 'Delivery address', type: 'textarea', rows: 2, span: 2, placeholder: 'Street, apt, city' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: 2, placeholder: 'Preferences, allergies, gate codes…' },
];

function stats(c, byCust) {
  const orders = byCust.get(c.id) || [];
  const valid = sales(orders);
  const last = orders.reduce((m, o) => (!m || o.created_at > m ? o.created_at : m), null);
  return { orders, count: orders.length, spent: revenueOf(orders), avg: valid.length ? revenueOf(orders) / valid.length : 0, last };
}

export default {
  title: 'Customers',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Your regulars, their addresses and everything they've ordered.</h2></div>
        <button class="btn primary" data-act="new">${icon('plus')} Add customer</button>
      </div>
      <section class="card">
        <div class="toolbar">
          <div class="search">${icon('search', 16)}<input id="cq" class="input" type="search" placeholder="Search name, phone, email or address…" value="${esc(state.q)}" aria-label="Search customers"></div>
          <select id="csort" class="input" aria-label="Sort customers">
            <option value="recent">Recent orders</option><option value="name">Name A–Z</option>
            <option value="orders">Most orders</option><option value="spent">Top spenders</option><option value="new">Newest customers</option>
          </select>
        </div>
        <div id="clist"></div>
      </section>`;
    $('#csort', root).value = state.sort;
    const list = () => renderList(root);
    $('#cq', root).addEventListener('input', debounce((e) => { state.q = e.target.value; state.page = 1; list(); }));
    $('#csort', root).addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; list(); });
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) { const row = e.target.closest('tr[data-id]'); if (row) openCustomer(row.dataset.id); return; }
      const c = btn.dataset.id && store.data.customers.find((x) => x.id === btn.dataset.id);
      switch (btn.dataset.act) {
        case 'new': openCustomerForm(); break;
        case 'view': openCustomer(c.id); break;
        case 'edit': openCustomerForm(c); break;
        case 'delete': await deleteCustomer(c); break;
        case 'order': openOrderForm(null, { customer_id: c.id }); break;
        case 'page': state.page = +btn.dataset.p; list(); break;
      }
    });
    list();
    return { refresh: list };
  },
};

function renderList(root) {
  const el = $('#clist', root);
  const byCust = ordersByCustomer();
  const q = state.q.trim().toLowerCase();
  let rows = store.data.customers.map((c) => ({ c, s: stats(c, byCust) }))
    .filter(({ c }) => !q || `${c.name} ${c.phone} ${c.email || ''} ${c.address || ''}`.toLowerCase().includes(q));
  const sorters = {
    name: (a, b) => a.c.name.localeCompare(b.c.name),
    orders: (a, b) => b.s.count - a.s.count,
    spent: (a, b) => b.s.spent - a.s.spent,
    new: (a, b) => b.c.created_at.localeCompare(a.c.created_at),
    recent: (a, b) => String(b.s.last || '').localeCompare(String(a.s.last || '')),
  };
  rows.sort(sorters[state.sort]);
  const maxPage = Math.max(1, Math.ceil(rows.length / PAGE));
  if (state.page > maxPage) state.page = maxPage;
  const page = rows.slice((state.page - 1) * PAGE, state.page * PAGE);

  if (!rows.length) { el.innerHTML = empty('👥', 'No customers found', q ? 'Try a different search.' : 'Add your first customer to get started.'); return; }
  el.innerHTML = `
    <div class="table-wrap"><table class="table stack">
      <thead><tr><th>Customer</th><th>Phone</th><th>Address</th><th class="num">Orders</th><th class="num">Total spent</th><th>Last order</th><th class="actions"></th></tr></thead>
      <tbody>${page.map(({ c, s }) => `
        <tr data-id="${c.id}" class="clickable">
          <td data-label="Customer"><div class="cell-user">${avatar(c.name)}<div><b>${esc(c.name)}</b><div class="muted sm">${esc(c.email || 'No email')}</div></div></div></td>
          <td data-label="Phone">${esc(c.phone)}</td>
          <td data-label="Address" class="addr-cell">${esc(c.address || '—')}</td>
          <td data-label="Orders" class="num">${s.count}</td>
          <td data-label="Total spent" class="num"><b>${fmtMoney(s.spent)}</b></td>
          <td data-label="Last order">${s.last ? timeAgo(s.last) : '<span class="muted">Never</span>'}</td>
          <td class="actions" data-label="">
            <button class="btn soft sm" data-act="order" data-id="${c.id}">${icon('plus', 14)} Order</button>
            ${iconBtn('edit', 'edit', 'Edit customer', c.id)}${iconBtn('delete', 'trash', 'Delete customer', c.id, 'danger')}
          </td></tr>`).join('')}</tbody></table></div>
    ${pager(state.page, rows.length, PAGE)}`;
}

export function openCustomerForm(c = null) {
  openModal({
    title: c ? 'Edit customer' : 'Add customer', submitLabel: c ? 'Save changes' : 'Add customer',
    body: fields(FORM, c || {}),
    onSubmit: async (fd) => {
      const row = Object.fromEntries(FORM.map((f) => [f.name, String(fd.get(f.name) || '').trim()]));
      const digits = (s) => s.replace(/\D/g, '');
      const dupe = store.data.customers.find((x) => x.id !== c?.id && digits(x.phone) === digits(row.phone));
      if (dupe) throw new Error(`${dupe.name} already uses that phone number`);
      if (c) { await update('customers', c.id, row); } else { await insert('customers', row); }
      toast(c ? 'Customer updated' : 'Customer added');
    },
  });
}

async function deleteCustomer(c) {
  const n = (ordersByCustomer().get(c.id) || []).length;
  if (await confirmDialog({
    title: 'Delete customer?',
    message: `<b>${esc(c.name)}</b> will be removed.${n ? ` Their ${n} past order${n > 1 ? 's' : ''} will stay in your sales history as guest orders.` : ''}`,
  })) await run(() => remove('customers', c.id), 'Customer deleted');
}

export function openCustomer(id) {
  const c = store.data.customers.find((x) => x.id === id);
  if (!c) return;
  const s = stats(c, ordersByCustomer());
  const history = [...s.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  openModal({
    title: 'Customer profile', side: true, size: 'md',
    body: `
      <div class="profile-head">${avatar(c.name, 'lg')}<div><h3>${esc(c.name)}</h3><span class="muted">Customer since ${fmtDate(c.created_at, { month: 'short', year: 'numeric' })}</span></div></div>
      <div class="mini-kpis">
        <div><b>${s.count}</b><span>Orders</span></div><div><b>${fmtMoney(s.spent)}</b><span>Spent</span></div><div><b>${fmtMoney(s.avg)}</b><span>Avg order</span></div>
      </div>
      <ul class="contact-list">
        <li>${icon('phone', 16)}<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></li>
        <li>${icon('mail', 16)}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '<span class="muted">No email</span>'}</li>
        <li>${icon('pin', 16)}<span>${esc(c.address || 'No address saved')}</span></li>
      </ul>
      ${c.notes ? `<div class="note-box">${esc(c.notes)}</div>` : ''}
      <h4 class="section-title">Order history</h4>
      ${history.length ? `<ul class="history">${history.map((o) => `
        <li data-order="${o.id}"><div><b>#${o.order_no}</b> <span class="muted sm">· ${fmtDate(o.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <div class="muted sm">${esc(itemsSummary(o, 3))}</div></div>
        <div class="right"><b>${fmtMoney(o.total)}</b><br>${badge(statusLabel(o.delivery_status, o.order_type), ORDER_STATUS[o.delivery_status]?.tone)}</div></li>`).join('')}</ul>`
        : '<p class="muted">No orders yet.</p>'}`,
    footer: `<button class="btn ghost danger-text" data-do="delete">${icon('trash', 16)} Delete</button><span class="grow"></span>
      <button class="btn ghost" data-do="edit">${icon('edit', 16)} Edit</button><button class="btn primary" data-do="order">${icon('plus', 16)} New order</button>`,
    onMount: (el, api) => el.addEventListener('click', (e) => {
      const li = e.target.closest('[data-order]');
      if (li) { api.close(); openOrderDetail(li.dataset.order); return; }
      const b = e.target.closest('[data-do]');
      if (!b) return;
      api.close();
      if (b.dataset.do === 'edit') openCustomerForm(c);
      if (b.dataset.do === 'delete') deleteCustomer(c);
      if (b.dataset.do === 'order') openOrderForm(null, { customer_id: c.id });
    }),
  });
}
