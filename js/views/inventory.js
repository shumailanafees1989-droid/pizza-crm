import { store, insert, update, remove } from '../store.js';
import { $, esc, icon, fmtMoney, fmtNum, debounce, sum, timeAgo } from '../util.js';
import { openModal, confirmDialog, badge, empty, iconBtn, run, fields, toast } from '../ui.js';
import { stockState, STOCK } from '../domain.js';

const state = { q: '', cat: '', status: '' };
const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'bunch', 'box', 'bag', 'can'];

export default {
  title: 'Inventory',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Know what's in the walk-in before the dinner rush does.</h2></div>
        <button class="btn primary" data-act="new">${icon('plus')} Add ingredient</button>
      </div>
      <div id="invkpis" class="kpi-grid compact"></div>
      <div id="invalert"></div>
      <section class="card">
        <div class="toolbar">
          <div class="search">${icon('search', 16)}<input id="iq" class="input" type="search" placeholder="Search ingredient or supplier…" value="${esc(state.q)}" aria-label="Search inventory"></div>
          <select id="icat" class="input" aria-label="Category"></select>
          <select id="istatus" class="input" aria-label="Stock status">
            <option value="">All stock levels</option><option value="attention">Needs attention</option>
            <option value="low">Low stock</option><option value="out">Out of stock</option><option value="ok">In stock</option>
          </select>
        </div>
        <div id="ilist"></div>
      </section>`;
    $('#istatus', root).value = state.status;
    const draw = () => { renderTop(root); renderList(root); };
    $('#iq', root).addEventListener('input', debounce((e) => { state.q = e.target.value; renderList(root); }));
    $('#icat', root).addEventListener('change', (e) => { state.cat = e.target.value; renderList(root); });
    $('#istatus', root).addEventListener('change', (e) => { state.status = e.target.value; renderList(root); });
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = b.dataset.id && store.data.inventory.find((x) => x.id === b.dataset.id);
      switch (b.dataset.act) {
        case 'new': openItemForm(); break;
        case 'edit': openItemForm(i); break;
        case 'restock': openRestock(i); break;
        case 'show-low': state.status = 'attention'; $('#istatus', root).value = 'attention'; renderList(root); break;
        case 'delete':
          if (await confirmDialog({ title: 'Delete ingredient?', message: `<b>${esc(i.name)}</b> will be removed from inventory.` })) await run(() => remove('inventory', i.id), 'Ingredient deleted');
          break;
      }
    });
    draw();
    return { refresh: draw };
  },
};

function renderTop(root) {
  const inv = store.data.inventory;
  const low = inv.filter((i) => stockState(i) === 'low'), out = inv.filter((i) => stockState(i) === 'out');
  const value = sum(inv, (i) => i.quantity * i.cost_per_unit);
  $('#invkpis', root).innerHTML = [
    ['Ingredients', inv.length, 'box', 'blue', 'Tracked items'],
    ['Low stock', low.length, 'alert', 'amber', 'At or below reorder level'],
    ['Out of stock', out.length, 'x', 'red', 'Needs immediate order'],
    ['Stock value', fmtMoney(value), 'dollar', 'green', 'At cost price'],
  ].map(([l, v, ic, tone, sub]) => `<div class="kpi tone-${tone}"><div class="kpi-ic">${icon(ic, 20)}</div><div><span class="kpi-label">${l}</span><b class="kpi-val">${v}</b><small class="muted">${sub}</small></div></div>`).join('');

  const need = [...out, ...low];
  $('#invalert', root).innerHTML = need.length ? `
    <div class="alert-banner"><span class="alert-ic">${icon('alert', 20)}</span>
      <div><b>${need.length} ingredient${need.length > 1 ? 's need' : ' needs'} restocking</b>
      <p>${need.slice(0, 6).map((i) => `${esc(i.name)} (${fmtNum(i.quantity)} ${esc(i.unit)})`).join(' · ')}${need.length > 6 ? ` · +${need.length - 6} more` : ''}</p></div>
      <button class="btn ghost sm" data-act="show-low">View items</button></div>` : '';

  const cats = [...new Set(inv.map((i) => i.category).filter(Boolean))].sort();
  $('#icat', root).innerHTML = `<option value="">All categories</option>${cats.map((c) => `<option ${state.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;
}

function renderList(root) {
  const q = state.q.trim().toLowerCase();
  const rows = store.data.inventory.filter((i) => {
    const st = stockState(i);
    return (!state.cat || i.category === state.cat)
      && (!state.status || (state.status === 'attention' ? st !== 'ok' : st === state.status))
      && (!q || `${i.name} ${i.supplier || ''} ${i.category || ''}`.toLowerCase().includes(q));
  }).sort((a, b) => ['out', 'low', 'ok'].indexOf(stockState(a)) - ['out', 'low', 'ok'].indexOf(stockState(b)) || a.name.localeCompare(b.name));
  const el = $('#ilist', root);
  if (!rows.length) { el.innerHTML = empty('📦', 'No ingredients found', 'Try different filters or add a new ingredient.'); return; }
  el.innerHTML = `<div class="table-wrap"><table class="table stack">
    <thead><tr><th>Ingredient</th><th>Category</th><th>In stock</th><th class="num">Reorder at</th><th class="num">Unit cost</th><th>Supplier</th><th>Status</th><th class="actions"></th></tr></thead>
    <tbody>${rows.map((i) => {
      const st = stockState(i);
      const max = Math.max(+i.reorder_level * 2.5, +i.quantity, 1);
      return `<tr>
        <td data-label="Ingredient"><b>${esc(i.name)}</b><div class="muted sm">Updated ${timeAgo(i.updated_at || i.created_at)}</div></td>
        <td data-label="Category">${esc(i.category || '—')}</td>
        <td data-label="In stock" class="stock-cell"><b>${fmtNum(i.quantity)} <small>${esc(i.unit)}</small></b>
          <div class="meter ${st}"><i style="width:${Math.min(100, (i.quantity / max) * 100)}%"></i><u style="left:${(i.reorder_level / max) * 100}%"></u></div></td>
        <td data-label="Reorder at" class="num">${fmtNum(i.reorder_level)} ${esc(i.unit)}</td>
        <td data-label="Unit cost" class="num">${fmtMoney(i.cost_per_unit)}</td>
        <td data-label="Supplier">${esc(i.supplier || '—')}</td>
        <td data-label="Status">${badge(STOCK[st].label, STOCK[st].tone)}</td>
        <td class="actions" data-label="">
          <button class="btn soft sm" data-act="restock" data-id="${i.id}">${icon('plus', 14)} Adjust</button>
          ${iconBtn('edit', 'edit', 'Edit ingredient', i.id)}${iconBtn('delete', 'trash', 'Delete ingredient', i.id, 'danger')}
        </td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function openRestock(i) {
  openModal({
    title: `Adjust stock — ${i.name}`, size: 'sm', submitLabel: 'Update stock',
    body: `<p class="muted">Currently <b>${fmtNum(i.quantity)} ${esc(i.unit)}</b> in stock.</p>
      <div class="form-grid">
        <div class="field span-2"><label for="adj">Add (or remove) quantity</label>
          <input class="input" id="adj" name="adj" type="number" step="0.01" required placeholder="e.g. 20 or -3" autofocus>
          <small class="hint">Use a negative number to record usage or waste.</small></div>
        <div class="quick span-2">${[5, 10, 25, 50].map((n) => `<button type="button" class="btn ghost sm" data-add="${n}">+${n}</button>`).join('')}</div>
      </div>`,
    onMount: (el) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) { const f = $('#adj', el); f.value = (+f.value || 0) + +b.dataset.add; } }),
    onSubmit: async (fd) => {
      const q = Math.max(0, Math.round((+i.quantity + parseFloat(fd.get('adj'))) * 100) / 100);
      await update('inventory', i.id, { quantity: q, updated_at: new Date().toISOString() });
      toast(`${i.name} now at ${fmtNum(q)} ${i.unit}`);
    },
  });
}

function openItemForm(i = null) {
  const cats = [...new Set(store.data.inventory.map((x) => x.category).filter(Boolean))].sort();
  const F = [
    { name: 'name', label: 'Ingredient', required: true, maxlength: 60, span: 2 },
    { name: 'category', label: 'Category', placeholder: 'e.g. Cheese', maxlength: 40 },
    { name: 'unit', label: 'Unit', type: 'select', options: UNITS },
    { name: 'quantity', label: 'Quantity in stock', type: 'number', required: true, min: 0, step: '0.01' },
    { name: 'reorder_level', label: 'Reorder level', type: 'number', required: true, min: 0, step: '0.01', hint: 'Alert when stock reaches this level.' },
    { name: 'cost_per_unit', label: 'Cost per unit ($)', type: 'number', min: 0, step: '0.01' },
    { name: 'supplier', label: 'Supplier', maxlength: 60 },
  ];
  openModal({
    title: i ? 'Edit ingredient' : 'Add ingredient', submitLabel: i ? 'Save changes' : 'Add ingredient',
    body: fields(F, i || { unit: 'kg', quantity: 0, reorder_level: 5, cost_per_unit: 0 }) + `<datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`,
    onMount: (el) => $('#f_category', el).setAttribute('list', 'catlist'),
    onSubmit: async (fd) => {
      const row = {
        name: String(fd.get('name')).trim(), category: String(fd.get('category') || '').trim(), unit: fd.get('unit'),
        quantity: parseFloat(fd.get('quantity')) || 0, reorder_level: parseFloat(fd.get('reorder_level')) || 0,
        cost_per_unit: parseFloat(fd.get('cost_per_unit')) || 0, supplier: String(fd.get('supplier') || '').trim(),
        updated_at: new Date().toISOString(),
      };
      if (i) await update('inventory', i.id, row); else await insert('inventory', row);
      toast(i ? 'Ingredient updated' : 'Ingredient added');
    },
  });
}
