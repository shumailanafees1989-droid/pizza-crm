import {
  store, getCredentials, saveCredentials, clearCredentials, resetLocal, loadAll, loadSampleDataRemote, isEmpty, TABLES,
} from '../store.js';
import { $, esc, icon, download, isoDay } from '../util.js';
import { confirmDialog, toast, run } from '../ui.js';
import { getPrefs, setPrefs } from '../domain.js';

export default {
  title: 'Settings',
  render(root) {
    const creds = getCredentials();
    const prefs = getPrefs();
    const live = store.mode === 'supabase';
    root.innerHTML = `
      <div class="page-head"><div><h2 class="page-sub">Shop preferences, database connection and data tools.</h2></div></div>
      <div class="settings-grid">
        <section class="card">
          <header class="card-head"><div><h3>Shop preferences</h3><p class="muted sm">Saved in this browser</p></div></header>
          <form id="prefsForm" class="form-grid">
            <div class="field span-2"><label for="s_name">Shop name</label><input class="input" id="s_name" name="shopName" maxlength="40" required value="${esc(prefs.shopName)}"></div>
            <div class="field span-2"><label for="s_fee">Default delivery fee ($)</label><input class="input" id="s_fee" name="deliveryFee" type="number" min="0" step="0.01" value="${prefs.deliveryFee}"></div>
            <div class="field span-2"><button class="btn primary" type="submit">Save preferences</button></div>
          </form>
        </section>

        <section class="card">
          <header class="card-head"><div><h3>Database connection</h3>
            <p class="muted sm">${live ? '<span class="dot ok"></span> Connected to Supabase' : '<span class="dot warn"></span> Demo mode — data is stored in this browser only'}</p></div></header>
          ${store.connectError ? `<div class="alert-banner"><span class="alert-ic">${icon('alert', 18)}</span><div><b>Could not connect</b><p>${esc(store.connectError)}</p></div></div>` : ''}
          <form id="dbForm" class="form-grid">
            <div class="field span-2"><label for="s_url">Supabase project URL</label><input class="input" id="s_url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(creds.url || '')}" ${creds.source === 'config' ? 'disabled' : ''}></div>
            <div class="field span-2"><label for="s_key">Anon / public key</label><input class="input" id="s_key" type="password" autocomplete="off" placeholder="eyJhbGciOi…" value="${esc(creds.key || '')}" ${creds.source === 'config' ? 'disabled' : ''}></div>
            <div class="field span-2 row-gap">
              ${creds.source === 'config' ? '<small class="hint">Credentials loaded from <code>.env</code> / <code>js/config.js</code>.</small>' : `
                <button class="btn primary" type="submit">${icon('database', 16)} Save &amp; connect</button>
                ${creds.source === 'browser' ? '<button class="btn ghost" type="button" id="dbDisc">Disconnect</button>' : ''}`}
            </div>
            <p class="hint span-2">Run <code>supabase/schema.sql</code> in the Supabase SQL editor first, then create a user under Authentication → Users to sign in.</p>
          </form>
        </section>

        <section class="card">
          <header class="card-head"><div><h3>Data tools</h3><p class="muted sm">Backup, sample data and reset</p></div></header>
          <div class="tool-list">
            <div><div><b>Export backup</b><span class="muted sm">Download all tables as one JSON file.</span></div><button class="btn ghost" id="tExport">${icon('download', 16)} Export</button></div>
            ${live
              ? `<div><div><b>Load sample data</b><span class="muted sm">Adds realistic customers, menu, staff, inventory &amp; 120 days of orders.</span></div><button class="btn ghost" id="tSeed">Load</button></div>`
              : `<div><div><b>Reset demo data</b><span class="muted sm">Wipe local changes and restore the original sample data.</span></div><button class="btn ghost danger-text" id="tReset">${icon('refresh', 16)} Reset</button></div>`}
          </div>
        </section>
      </div>`;

    $('#prefsForm', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      setPrefs({ shopName: String(fd.get('shopName')).trim(), deliveryFee: parseFloat(fd.get('deliveryFee')) || 0 });
      document.dispatchEvent(new CustomEvent('prefs-changed'));
      toast('Preferences saved');
    });
    $('#dbForm', root).addEventListener('submit', (e) => {
      e.preventDefault();
      if (getCredentials().source === 'config') return;
      const url = $('#s_url', root).value.trim(), key = $('#s_key', root).value.trim();
      if (!url || !key) return toast('Enter both the project URL and anon key', 'error');
      saveCredentials(url, key);
      toast('Saved — reloading…');
      setTimeout(() => location.reload(), 600);
    });
    $('#dbDisc', root)?.addEventListener('click', () => { clearCredentials(); location.reload(); });
    $('#tExport', root).addEventListener('click', () => {
      download(`pizza-crm-backup-${isoDay(new Date())}.json`, JSON.stringify(store.data, null, 2), 'application/json');
      toast('Backup downloaded');
    });
    $('#tReset', root)?.addEventListener('click', async () => {
      if (await confirmDialog({ title: 'Reset demo data?', message: 'All changes you made in demo mode will be lost.', confirmLabel: 'Reset' })) {
        resetLocal(); await loadAll(); toast('Demo data restored');
      }
    });
    $('#tSeed', root)?.addEventListener('click', async () => {
      if (!isEmpty() && !(await confirmDialog({ title: 'Add sample data?', message: 'Your database already has data. Sample records will be added alongside it.', confirmLabel: 'Add anyway', danger: false }))) return;
      await run(() => loadSampleDataRemote(), 'Sample data loaded');
    });
    return {};
  },
};
