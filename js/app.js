import { store, init, loadAll, onChange, signIn, signOut } from './store.js';
import { $, $$, esc, icon, fmtDate } from './util.js';
import { toast } from './ui.js';
import { getPrefs, isActive, stockState } from './domain.js';
import dashboard from './views/dashboard.js';
import orders, { openOrderForm } from './views/orders.js';
import customers from './views/customers.js';
import menu from './views/menu.js';
import team from './views/team.js';
import inventory from './views/inventory.js';
import reports from './views/reports.js';
import settings from './views/settings.js';

const ROUTES = {
  dashboard: { view: dashboard, icon: 'dashboard', label: 'Dashboard' },
  orders: { view: orders, icon: 'bag', label: 'Orders', badge: () => store.data.orders.filter(isActive).length },
  customers: { view: customers, icon: 'users', label: 'Customers' },
  menu: { view: menu, icon: 'pizza', label: 'Menu' },
  team: { view: team, icon: 'badge', label: 'Team' },
  inventory: { view: inventory, icon: 'box', label: 'Inventory', badge: () => store.data.inventory.filter((i) => stockState(i) !== 'ok').length, warn: true },
  reports: { view: reports, icon: 'chart', label: 'Reports' },
  settings: { view: settings, icon: 'sliders', label: 'Settings' },
};

const root = $('#root');
let current = null; // { key, api }

/* ------------------------------------------------------------ theme */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('pizzacrm:theme', t);
  const b = $('#themeBtn');
  if (b) b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
}

/* ------------------------------------------------------------ shell */
function renderShell() {
  const prefs = getPrefs();
  const dark = document.documentElement.dataset.theme === 'dark';
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="brand"><span class="brand-logo">🍕</span><div><b id="brandName">${esc(prefs.shopName)}</b><small>Pizza Shop CRM</small></div></div>
        <nav class="nav">
          ${Object.entries(ROUTES).map(([k, r]) => `
            <a href="#/${k}" data-route="${k}" class="nav-link">${icon(r.icon, 20)}<span>${r.label}</span><em class="nav-badge ${r.warn ? 'warn' : ''}" data-badge="${k}" hidden></em></a>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="mode-pill ${store.mode}">${icon('database', 14)}<span>${store.mode === 'supabase' ? 'Supabase connected' : 'Demo mode (local)'}</span></div>
          ${store.session ? `<div class="user-line" title="${esc(store.session.user.email)}">${icon('lock', 14)}<span>${esc(store.session.user.email)}</span></div>` : ''}
        </div>
      </aside>
      <div class="scrim" id="scrim"></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">${icon('menu', 22)}</button>
          <h1 id="pageTitle">Dashboard</h1>
          <span class="grow"></span>
          <span class="today-chip">${icon('calendar', 15)} ${fmtDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode">${icon(dark ? 'sun' : 'moon')}</button>
          <button class="btn primary sm top-new" id="topNew">${icon('plus', 16)}<span>New order</span></button>
          ${store.mode === 'supabase' ? `<button class="icon-btn" id="logoutBtn" aria-label="Sign out" title="Sign out">${icon('logout')}</button>` : ''}
        </header>
        <main id="view" class="view" tabindex="-1"></main>
      </div>
    </div>`;

  const sidebar = $('#sidebar');
  const toggle = (open) => document.body.classList.toggle('nav-open', open);
  $('#menuBtn').addEventListener('click', () => toggle(true));
  $('#scrim').addEventListener('click', () => toggle(false));
  sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) toggle(false); });
  $('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#topNew').addEventListener('click', () => openOrderForm());
  $('#logoutBtn')?.addEventListener('click', async () => { await signOut(); location.reload(); });
  document.addEventListener('prefs-changed', () => { const n = $('#brandName'); if (n) n.textContent = getPrefs().shopName; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}

function updateBadges() {
  for (const [k, r] of Object.entries(ROUTES)) {
    const el = $(`[data-badge="${k}"]`);
    if (!el || !r.badge) continue;
    const n = r.badge();
    el.hidden = !n; el.textContent = n;
  }
}

/* ------------------------------------------------------------ router */
function navigate() {
  const key = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const route = ROUTES[key] || ROUTES.dashboard;
  const k = ROUTES[key] ? key : 'dashboard';
  $$('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.route === k));
  $('#pageTitle').textContent = route.label;
  $('#topNew').hidden = k === 'orders';
  document.title = `${route.label} · ${getPrefs().shopName} CRM`;
  const view = $('#view');
  // fresh container each navigation so listeners never pile up
  const holder = document.createElement('div');
  holder.className = 'view-inner';
  view.replaceChildren(holder);
  try {
    current = { key: k, api: route.view.render(holder) || {} };
  } catch (e) {
    console.error(e);
    holder.innerHTML = `<div class="card pad"><h3>Something went wrong</h3><p class="muted">${esc(e.message)}</p></div>`;
    current = null;
  }
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------ login */
function renderLogin() {
  $('#splash')?.remove();
  root.innerHTML = `
    <div class="login">
      <div class="login-art" aria-hidden="true"><div class="orbit">🍕</div><h2>Run the shop,<br>not the spreadsheet.</h2><p>Orders, customers, menu, team and inventory — all in one place.</p></div>
      <form class="login-card" id="loginForm">
        <div class="brand dark"><span class="brand-logo">🍕</span><div><b>${esc(getPrefs().shopName)}</b><small>Pizza Shop CRM</small></div></div>
        <h1>Welcome back</h1><p class="muted">Sign in with your staff account to continue.</p>
        <div class="field"><label for="l_email">Email</label><input class="input" id="l_email" type="email" required autocomplete="username" placeholder="you@shop.com"></div>
        <div class="field"><label for="l_pw">Password</label><input class="input" id="l_pw" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
        <p class="form-error" id="loginErr" hidden></p>
        <button class="btn primary block" type="submit">Sign in</button>
        <p class="hint center">Accounts are created by the owner in Supabase → Authentication.</p>
      </form>
    </div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target), err = $('#loginErr');
    btn.disabled = true; btn.classList.add('loading'); err.hidden = true;
    try { await signIn($('#l_email').value.trim(), $('#l_pw').value); await start(); }
    catch (ex) { err.textContent = ex.message || 'Sign in failed'; err.hidden = false; btn.disabled = false; btn.classList.remove('loading'); }
  });
}

/* ------------------------------------------------------------ boot */
async function start() {
  try { await loadAll(); }
  catch (e) {
    console.error(e);
    $('#splash')?.remove();
    root.innerHTML = `<div class="login"><div class="login-card"><h1>Couldn’t load your data</h1>
      <p class="muted">${esc(e.message || e)}</p>
      <p class="hint">Make sure you ran <code>supabase/schema.sql</code> in your project and that you are signed in.</p>
      <div class="row-gap"><button class="btn primary" onclick="location.reload()">Retry</button>
      <button class="btn ghost" id="fbSettings">Use demo mode</button></div></div></div>`;
    $('#fbSettings').onclick = () => { localStorage.removeItem('pizzacrm:supabase'); location.reload(); };
    return;
  }
  renderShell();
  updateBadges();
  $('#splash')?.remove();
  window.addEventListener('hashchange', navigate);
  navigate();
  onChange(() => {
    updateBadges();
    if (current?.api?.refresh) {
      try { current.api.refresh(); } catch (e) { console.error(e); }
    }
  });
}

(async function boot() {
  await init();
  if (store.mode === 'supabase' && !store.session) return renderLogin();
  await start();
})();
