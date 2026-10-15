import { store, insert, update, remove } from '../store.js';
import { $, $$, esc, icon, fmtMoney, debounce, sum, startOfDay, addDays } from '../util.js';
import { openModal, confirmDialog, badge, empty, run, field, toast } from '../ui.js';
import { CATEGORIES, SIZES, categoryEmoji, categoryLabel, sizeShort, isCancelled } from '../domain.js';

const state = { q: '', cat: 'all', avail: '' };

export default {
  title: 'Menu',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Pizzas, sides and drinks — prices and ingredients in one place.</h2></div>
        <button class="btn primary" data-act="new">${icon('plus')} Add menu item</button>
      </div>
      <section class="card">
        <div class="toolbar">
          <div class="search">${icon('search', 16)}<input id="mq" class="input" type="search" placeholder="Search by name or ingredient…" value="${esc(state.q)}" aria-label="Search menu"></div>
          <select id="mavail" class="input" aria-label="Availability"><option value="">All items</option><option value="yes">Available</option><option value="no">Unavailable</option></select>
        </div>
        <div class="tabs" id="mtabs" role="tablist">
          <button class="tab" data-cat="all">All</button>
          ${CATEGORIES.map((c) => `<button class="tab" data-cat="${c.key}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
      </section>
      <div id="mgrid" class="menu-grid"></div>`;
    $('#mavail', root).value = state.avail;
    const list = () => renderGrid(root);
    $('#mq', root).addEventListener('input', debounce((e) => { state.q = e.target.value; list(); }));
    $('#mavail', root).addEventListener('change', (e) => { state.avail = e.target.value; list(); });
    root.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-cat]');
      if (tab) { state.cat = tab.dataset.cat; list(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const m = btn.dataset.id && store.data.menu_items.find((x) => x.id === btn.dataset.id);
      if (btn.dataset.act === 'new') openMenuForm();
      if (btn.dataset.act === 'edit') openMenuForm(m);
      if (btn.dataset.act === 'delete') {
        if (await confirmDialog({ title: 'Remove from menu?', message: `<b>${esc(m.name)}</b> will be deleted. Past orders keep their item details.` }))
          await run(() => remove('menu_items', m.id), 'Menu item removed');
      }
    });
    root.addEventListener('change', async (e) => {
      const sw = e.target.closest('[data-toggle]');
      if (sw) {
        const m = store.data.menu_items.find((x) => x.id === sw.dataset.toggle);
        await run(() => update('menu_items', m.id, { available: sw.checked }), `${m.name} marked ${sw.checked ? 'available' : 'unavailable'}`);
      }
    });
    list();
    return { refresh: list };
  },
};

function soldMap() {
  const since = addDays(startOfDay(), -29);
  const m = new Map();
  for (const o of store.data.orders) {
    if (isCancelled(o) || new Date(o.created_at) < since) continue;
    for (const i of o.items || []) m.set(i.menu_item_id, (m.get(i.menu_item_id) || 0) + i.qty);
  }
  return m;
}

function renderGrid(root) {
  $$('#mtabs .tab', root).forEach((t) => { t.classList.toggle('active', t.dataset.cat === state.cat); t.setAttribute('aria-selected', t.dataset.cat === state.cat); });
  const q = state.q.trim().toLowerCase();
  const sold = soldMap();
  const items = store.data.menu_items
    .filter((m) => (state.cat === 'all' || m.category === state.cat)
      && (!state.avail || (state.avail === 'yes') === !!m.available)
      && (!q || `${m.name} ${(m.ingredients || []).join(' ')} ${m.description || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => CATEGORIES.findIndex((c) => c.key === a.category) - CATEGORIES.findIndex((c) => c.key === b.category) || a.name.localeCompare(b.name));
  const el = $('#mgrid', root);
  if (!items.length) { el.innerHTML = `<div class="card">${empty('🍽️', 'No menu items match', 'Adjust the filters or add a new item.')}</div>`; return; }
  el.innerHTML = items.map((m) => `
    <article class="menu-card ${m.available ? '' : 'off'} cat-${m.category}">
      <div class="menu-art"><span>${esc(m.emoji || categoryEmoji(m.category))}</span>${m.available ? '' : '<em>Unavailable</em>'}</div>
      <div class="menu-body">
        <div class="menu-title"><h3>${esc(m.name)}</h3>${badge(categoryLabel(m.category), 'gray')}</div>
        <p class="menu-desc">${esc(m.description || '')}</p>
        <div class="price-row">${Object.entries(m.prices || {}).map(([k, p]) =>
          `<span class="price"><small>${k === 'regular' ? '' : sizeShort(k)}</small>${fmtMoney(p)}</span>`).join('')}</div>
        <div class="chips">${(m.ingredients || []).map((i) => `<span class="chip">${esc(i)}</span>`).join('')}</div>
      </div>
      <div class="menu-foot">
        <span class="muted sm">${sold.get(m.id) || 0} sold · 30d</span>
        <label class="switch sm" title="Toggle availability"><input type="checkbox" data-toggle="${m.id}" ${m.available ? 'checked' : ''}><span class="switch-track"></span></label>
        <button class="icon-btn" data-act="edit" data-id="${m.id}" aria-label="Edit ${esc(m.name)}">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-act="delete" data-id="${m.id}" aria-label="Delete ${esc(m.name)}">${icon('trash', 16)}</button>
      </div>
    </article>`).join('');
}

function openMenuForm(m = null) {
  const v = m || { category: 'pizza', available: true, prices: {}, ingredients: [] };
  openModal({
    title: m ? `Edit ${m.name}` : 'Add menu item', size: 'lg', submitLabel: m ? 'Save changes' : 'Add item',
    body: `<div class="form-grid">
      ${field({ name: 'name', label: 'Name', required: true, maxlength: 60 }, v.name)}
      ${field({ name: 'category', label: 'Category', type: 'select', options: CATEGORIES.map((c) => ({ value: c.key, label: c.label })) }, v.category)}
      ${field({ name: 'description', label: 'Description', span: 2, maxlength: 140 }, v.description)}
      <div class="field span-2" id="sizePrices"><label>Prices ($)</label>
        <div class="price-inputs">
          ${SIZES.map((s) => `<label class="price-in"><span>${s.label} <small>${s.desc}</small></span><input class="input" name="price_${s.key}" type="number" min="0" step="0.01" value="${v.prices?.[s.key] ?? ''}" ${s.key === 'small' ? '' : ''}></label>`).join('')}
        </div></div>
      <div class="field" id="regularPrice"><label for="f_price_regular">Price ($)</label>
        <input class="input" id="f_price_regular" name="price_regular" type="number" min="0" step="0.01" value="${v.prices?.regular ?? ''}"></div>
      ${field({ name: 'emoji', label: 'Emoji icon', maxlength: 4, placeholder: '🍕' }, v.emoji)}
      ${field({ name: 'ingredients', label: 'Ingredients', type: 'textarea', rows: 2, span: 2, placeholder: 'Tomato sauce, Mozzarella, Basil', hint: 'Separate ingredients with commas.' }, (v.ingredients || []).join(', '))}
      ${field({ name: 'available', label: 'Available to order', type: 'checkbox', span: 2 }, v.available)}
    </div>`,
    onMount: (el) => {
      const cat = $('#f_category', el);
      const sync = () => {
        const pizza = cat.value === 'pizza';
        $('#sizePrices', el).hidden = !pizza;
        $('#regularPrice', el).hidden = pizza;
      };
      cat.addEventListener('change', sync); sync();
    },
    onSubmit: async (fd) => {
      const category = fd.get('category');
      const prices = {};
      if (category === 'pizza') {
        for (const s of SIZES) { const n = parseFloat(fd.get(`price_${s.key}`)); if (!isNaN(n)) prices[s.key] = n; }
        if (!Object.keys(prices).length) { toast('Enter at least one pizza price', 'error'); return false; }
      } else {
        const n = parseFloat(fd.get('price_regular'));
        if (isNaN(n)) { toast('Enter a price', 'error'); return false; }
        prices.regular = n;
      }
      const row = {
        name: String(fd.get('name')).trim(), category, description: String(fd.get('description') || '').trim(),
        emoji: String(fd.get('emoji') || '').trim() || categoryEmoji(category), prices,
        ingredients: String(fd.get('ingredients') || '').split(',').map((s) => s.trim()).filter(Boolean),
        available: fd.get('available') === 'on',
      };
      if (m) { await update('menu_items', m.id, row); toast('Menu item updated'); }
      else { await insert('menu_items', row); toast('Menu item added'); }
    },
  });
}
