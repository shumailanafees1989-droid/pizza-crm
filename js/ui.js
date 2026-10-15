/* UI primitives: toasts, modals, confirm dialogs, form fields, pager, badges. */
import { esc, icon } from './util.js';

/* ---------- toast ---------- */
export function toast(msg, type = 'success') {
  let c = document.getElementById('toasts');
  if (!c) { c = Object.assign(document.createElement('div'), { id: 'toasts' }); c.setAttribute('aria-live', 'polite'); document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-ic">${icon(type === 'error' ? 'alert' : 'check', 16)}</span><span>${esc(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, type === 'error' ? 5000 : 2800);
}

/* ---------- modal ---------- */
const stack = [];
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

export function openModal({
  title, body = '', footer, size = 'md', side = false, submitLabel = 'Save', cancelLabel = 'Cancel',
  danger = false, onSubmit, onMount, onClose,
}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap' + (side ? ' side' : '');
  const tag = onSubmit ? 'form' : 'div';
  const foot = footer ?? (onSubmit
    ? `<button type="button" class="btn ghost" data-close>${esc(cancelLabel)}</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(submitLabel)}</button>`
    : '');
  wrap.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <${tag} class="modal-form">
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </${tag}>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');

  let closed = false;
  const api = {
    el: wrap,
    $: (s) => wrap.querySelector(s),
    close() {
      if (closed) return; closed = true;
      stack.splice(stack.indexOf(api), 1);
      wrap.classList.add('closing');
      if (!stack.length) document.body.classList.remove('modal-open');
      setTimeout(() => wrap.remove(), 180);
      onClose && onClose();
    },
  };
  stack.push(api);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });

  if (onSubmit) {
    const form = wrap.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true; btn.classList.add('loading');
      try {
        const r = await onSubmit(new FormData(form), form, api);
        if (r !== false) api.close();
      } catch (err) {
        console.error(err);
        toast(err.message || 'Something went wrong', 'error');
      } finally { btn.disabled = false; btn.classList.remove('loading'); }
    });
  }
  onMount && onMount(wrap, api);
  const first = wrap.querySelector('input:not([type=hidden]),select,textarea');
  if (first && !side && matchMedia('(pointer:fine)').matches) first.focus();
  return api;
}

export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title, size: 'sm',
      body: `<p class="confirm-msg">${message}</p>`,
      footer: `<button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>`,
      onMount: (el, api) => el.querySelector('[data-ok]').addEventListener('click', () => { result = true; api.close(); }),
      onClose: () => resolve(result),
    });
  });
}

/* ---------- form fields ---------- */
const opt = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

export function field(f, v = '') {
  const id = `f_${f.name}`;
  const req = f.required ? 'required' : '';
  const attrs = ['min', 'max', 'step', 'maxlength', 'pattern', 'placeholder', 'autocomplete', 'inputmode']
    .filter((k) => f[k] !== undefined).map((k) => `${k}="${esc(f[k])}"`).join(' ');
  let ctrl;
  if (f.type === 'select') {
    ctrl = `<select class="input" id="${id}" name="${f.name}" ${req}>${(f.options || []).map(opt)
      .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    ctrl = `<textarea class="input" id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} ${attrs}>${esc(v)}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<div class="field ${f.span === 2 ? 'span-2' : ''}"><label class="switch"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}><span class="switch-track"></span><span>${esc(f.label)}</span></label></div>`;
  } else {
    ctrl = `<input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${attrs}>`;
  }
  return `<div class="field ${f.span === 2 ? 'span-2' : ''}" ${f.id ? `id="${f.id}"` : ''}><label for="${id}">${esc(f.label)}${f.required ? ' <i class="req">*</i>' : ''}</label>${ctrl}${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
}
export const fields = (list, values = {}) => `<div class="form-grid">${list.map((f) => field(f, values[f.name] ?? f.default ?? '')).join('')}</div>`;

/* ---------- small renderers ---------- */
export const badge = (label, tone = 'gray') => `<span class="badge tone-${tone}">${esc(label)}</span>`;

export function pager(page, total, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return `<div class="pager"><span class="muted">Showing ${from}–${to} of ${total}</span>
    <div class="pager-btns">
      <button class="btn ghost sm" data-act="page" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${icon('left', 16)} Prev</button>
      <span class="pager-now">${page} / ${pages}</span>
      <button class="btn ghost sm" data-act="page" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next ${icon('right', 16)}</button>
    </div></div>`;
}

export const empty = (emoji, title, text = '', action = '') =>
  `<div class="empty"><div class="empty-emoji">${emoji}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

export const iconBtn = (act, ic, label, id = '', extra = '') =>
  `<button class="icon-btn ${extra}" data-act="${act}" ${id ? `data-id="${id}"` : ''} title="${esc(label)}" aria-label="${esc(label)}">${icon(ic, 16)}</button>`;

/** Run an async action with a toast on success / failure. */
export async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true; }
  catch (e) { console.error(e); toast(e.message || 'Something went wrong', 'error'); return false; }
}
