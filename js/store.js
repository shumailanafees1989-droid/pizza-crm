/* Data layer: Supabase when configured, localStorage "demo mode" otherwise. */
import { CONFIG, loadEnvConfig } from './config.js';
import { buildSeed } from './seed.js';
import { uid } from './util.js';

export const TABLES = ['customers', 'menu_items', 'orders', 'staff', 'tasks', 'inventory'];
const LS = 'pizzacrm:v3:';
const SB_KEY = 'pizzacrm:supabase';

export const store = {
  mode: 'local', // 'local' | 'supabase'
  client: null,
  session: null,
  connectError: null,
  data: Object.fromEntries(TABLES.map((t) => [t, []])),
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (table) => listeners.forEach((fn) => fn(table));

export function getCredentials() {
  let url = CONFIG.SUPABASE_URL, key = CONFIG.SUPABASE_ANON_KEY, source = 'config';
  if (!url || !key) {
    try {
      const s = JSON.parse(localStorage.getItem(SB_KEY) || 'null');
      if (s && s.url && s.key) { url = s.url; key = s.key; source = 'browser'; }
    } catch { /* ignore */ }
  }
  return { url, key, source: url && key ? source : null };
}
export const saveCredentials = (url, key) => localStorage.setItem(SB_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
export const clearCredentials = () => localStorage.removeItem(SB_KEY);

export async function init() {
  await loadEnvConfig();
  const { url, key } = getCredentials();
  if (url && key) {
    try {
      const initPromise = (async () => {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        const client = createClient(url, key);
        const { data } = await client.auth.getSession();
        return { client, session: data?.session };
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase connection timeout')), 3000)
      );

      const res = await Promise.race([initPromise, timeoutPromise]);
      store.client = res.client;
      store.session = res.session;
      store.mode = 'supabase';
      store.client.auth.onAuthStateChange((_e, s) => { store.session = s; });
    } catch (e) {
      console.warn('Supabase init failed or timed out, using local mode:', e.message || e);
      store.mode = 'local';
      store.connectError = e.message || String(e);
    }
  }
  return store;
}

export const signIn = async (email, password) => {
  const { data, error } = await store.client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  store.session = data.session;
};
export const signOut = async () => { await store.client.auth.signOut(); store.session = null; };

/* ---------- local helpers ---------- */
const lsRead = (t) => JSON.parse(localStorage.getItem(LS + t) || '[]');
const lsWrite = (t) => localStorage.setItem(LS + t, JSON.stringify(store.data[t]));
const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));

export function seedLocal() {
  const seed = buildSeed();
  for (const t of TABLES) localStorage.setItem(LS + t, JSON.stringify(seed[t]));
  localStorage.setItem(LS + 'seeded', '1');
}
export function resetLocal() {
  for (const t of TABLES) localStorage.removeItem(LS + t);
  localStorage.removeItem(LS + 'seeded');
  seedLocal();
}

/* ---------- loading ---------- */
async function fetchAll(t) {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await store.client.from(t).select('*')
      .order('created_at', { ascending: false }).order('id').range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export async function loadAll() {
  if (store.mode === 'local') {
    if (!localStorage.getItem(LS + 'seeded')) seedLocal();
    for (const t of TABLES) store.data[t] = lsRead(t).sort(byNewest);
  } else {
    const res = await Promise.all(TABLES.map(fetchAll));
    TABLES.forEach((t, i) => { store.data[t] = res[i]; });
  }
  emit('*');
}

export async function reload(t) {
  if (store.mode === 'supabase') store.data[t] = await fetchAll(t);
  else store.data[t] = lsRead(t).sort(byNewest);
  emit(t);
}

/* ---------- CRUD ---------- */
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

export async function insert(t, row) {
  let rec;
  if (store.mode === 'supabase') {
    const { data, error } = await store.client.from(t).insert(clean(row)).select().single();
    if (error) throw error;
    rec = data;
  } else {
    rec = { id: uid(), created_at: new Date().toISOString(), ...row };
    if (t === 'orders' && !rec.order_no) rec.order_no = Math.max(1000, ...store.data.orders.map((o) => +o.order_no || 0)) + 1;
  }
  store.data[t].unshift(rec);
  if (store.mode === 'local') lsWrite(t);
  emit(t);
  return rec;
}

export async function update(t, id, patch) {
  let rec;
  if (store.mode === 'supabase') {
    const { data, error } = await store.client.from(t).update(clean(patch)).eq('id', id).select().single();
    if (error) throw error;
    rec = data;
  } else {
    const cur = store.data[t].find((r) => r.id === id);
    if (!cur) throw new Error('Record not found');
    rec = { ...cur, ...patch };
  }
  const i = store.data[t].findIndex((r) => r.id === id);
  if (i >= 0) store.data[t][i] = rec;
  if (store.mode === 'local') lsWrite(t);
  emit(t);
  return rec;
}

export async function remove(t, id) {
  if (store.mode === 'supabase') {
    const { error } = await store.client.from(t).delete().eq('id', id);
    if (error) throw error;
  }
  store.data[t] = store.data[t].filter((r) => r.id !== id);
  if (store.mode === 'local') {
    lsWrite(t);
    // mimic ON DELETE SET NULL
    if (t === 'customers') { store.data.orders.forEach((o) => { if (o.customer_id === id) o.customer_id = null; }); lsWrite('orders'); }
    if (t === 'staff') { store.data.tasks.forEach((k) => { if (k.staff_id === id) k.staff_id = null; }); lsWrite('tasks'); }
  } else {
    if (t === 'customers') await reload('orders');
    if (t === 'staff') await reload('tasks');
  }
  emit(t);
}

/** Insert the generated sample data into the connected Supabase project. */
export async function loadSampleDataRemote(onProgress = () => {}) {
  const seed = buildSeed();
  const order = ['customers', 'menu_items', 'staff', 'tasks', 'inventory', 'orders'];
  for (const t of order) {
    let rows = seed[t];
    if (t === 'orders') rows = rows.map(({ order_no, ...r }) => r); // let the identity column number them
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await store.client.from(t).insert(rows.slice(i, i + 400));
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    onProgress(t);
  }
  await loadAll();
}

export const isEmpty = () => TABLES.every((t) => store.data[t].length === 0);
