import { store, insert, update, remove } from '../store.js';
import { $, $$, esc, icon, fmtMoney, fmtDay, debounce, avatar, isoDay, parseDay, startOfDay } from '../util.js';
import { openModal, confirmDialog, badge, empty, run, fields, toast } from '../ui.js';
import { ROLES, STAFF_STATUS, PRIORITY, TASK_STATUS } from '../domain.js';

const state = { tab: 'staff', q: '', role: '', status: '', assignee: '', priority: '' };

export default {
  title: 'Team',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2 class="page-sub">Who's on shift, what they do, and what needs doing today.</h2></div>
        <div class="head-actions">
          <button class="btn ghost" data-act="new-task">${icon('tasks')} Add task</button>
          <button class="btn primary" data-act="new-staff">${icon('plus')} Add staff</button>
        </div>
      </div>
      <div class="tabs big" id="ttabs" role="tablist">
        <button class="tab" data-tab="staff">${icon('users', 16)} Staff <span class="count" id="cStaff"></span></button>
        <button class="tab" data-tab="tasks">${icon('tasks', 16)} Tasks <span class="count" id="cTasks"></span></button>
      </div>
      <section class="card"><div class="toolbar" id="ttool"></div></section>
      <div id="tbody"></div>`;

    const draw = () => { renderToolbar(root); renderBody(root); };
    root.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { state.tab = tab.dataset.tab; draw(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.dataset.id;
      const s = id && store.data.staff.find((x) => x.id === id);
      const t = id && store.data.tasks.find((x) => x.id === id);
      switch (b.dataset.act) {
        case 'new-staff': openStaffForm(); break;
        case 'new-task': openTaskForm(null, { staff_id: b.dataset.staff }); break;
        case 'edit-staff': openStaffForm(s); break;
        case 'del-staff':
          if (await confirmDialog({ title: 'Remove team member?', message: `<b>${esc(s.name)}</b> will be removed. Their tasks become unassigned.` }))
            await run(() => remove('staff', s.id), 'Team member removed');
          break;
        case 'edit-task': openTaskForm(t); break;
        case 'del-task':
          if (await confirmDialog({ title: 'Delete task?', message: `<b>${esc(t.title)}</b> will be deleted.` })) await run(() => remove('tasks', t.id), 'Task deleted');
          break;
        case 'move': {
          const order = ['todo', 'in_progress', 'done'];
          const next = order[order.indexOf(t.status) + (+b.dataset.dir)];
          if (next) await run(() => update('tasks', t.id, { status: next }), `Moved to ${TASK_STATUS[next].label}`);
          break;
        }
        case 'filter-staff': state.tab = 'tasks'; state.assignee = b.dataset.id; draw(); break;
      }
    });
    draw();
    return { refresh: draw };
  },
};

function renderToolbar(root) {
  $$('#ttabs .tab', root).forEach((t) => { t.classList.toggle('active', t.dataset.tab === state.tab); });
  $('#cStaff', root).textContent = store.data.staff.length;
  $('#cTasks', root).textContent = store.data.tasks.filter((t) => t.status !== 'done').length;
  const bar = $('#ttool', root);
  const search = `<div class="search">${icon('search', 16)}<input id="tq" class="input" type="search" placeholder="${state.tab === 'staff' ? 'Search staff…' : 'Search tasks…'}" value="${esc(state.q)}" aria-label="Search"></div>`;
  if (state.tab === 'staff') {
    bar.innerHTML = `${search}
      <select id="trole" class="input" aria-label="Role"><option value="">All roles</option>${ROLES.map((r) => `<option ${state.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <select id="tstatus" class="input" aria-label="Status"><option value="">All statuses</option>${Object.entries(STAFF_STATUS).map(([k, v]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
  } else {
    bar.innerHTML = `${search}
      <select id="tassignee" class="input" aria-label="Assignee"><option value="">Everyone</option><option value="none" ${state.assignee === 'none' ? 'selected' : ''}>Unassigned</option>${store.data.staff.map((s) => `<option value="${s.id}" ${state.assignee === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select id="tprio" class="input" aria-label="Priority"><option value="">All priorities</option>${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${state.priority === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
  }
  const redraw = () => renderBody(root);
  $('#tq', root).addEventListener('input', debounce((e) => { state.q = e.target.value; redraw(); }));
  for (const [id, key] of [['trole', 'role'], ['tstatus', 'status'], ['tassignee', 'assignee'], ['tprio', 'priority']]) {
    const el = $('#' + id, root);
    if (el) el.addEventListener('change', (e) => { state[key] = e.target.value; redraw(); });
  }
}

function renderBody(root) {
  const el = $('#tbody', root);
  const q = state.q.trim().toLowerCase();
  if (state.tab === 'staff') {
    const open = new Map();
    store.data.tasks.filter((t) => t.status !== 'done').forEach((t) => open.set(t.staff_id, (open.get(t.staff_id) || 0) + 1));
    const list = store.data.staff
      .filter((s) => (!state.role || s.role === state.role) && (!state.status || s.status === state.status)
        && (!q || `${s.name} ${s.role} ${s.phone || ''} ${s.email || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
    if (!list.length) { el.innerHTML = `<div class="card">${empty('🧑‍🍳', 'No team members found', 'Add your first staff member.')}</div>`; return; }
    el.innerHTML = `<div class="staff-grid">${list.map((s) => `
      <article class="staff-card">
        <div class="staff-top">${avatar(s.name, 'lg')}
          <div class="staff-id"><h3>${esc(s.name)}</h3><span>${esc(s.role)}</span></div>
          ${badge(STAFF_STATUS[s.status]?.label || s.status, STAFF_STATUS[s.status]?.tone)}</div>
        <ul class="staff-meta">
          <li>${icon('clock', 15)}<span>${esc(s.shift || 'No shift set')}</span></li>
          <li>${icon('phone', 15)}<span>${esc(s.phone || '—')}</span></li>
          <li>${icon('mail', 15)}<span class="trunc">${esc(s.email || '—')}</span></li>
          <li>${icon('dollar', 15)}<span>${s.hourly_rate ? fmtMoney(s.hourly_rate) + ' / hr' : '—'} · since ${s.hired_on ? fmtDay(s.hired_on) : '—'}</span></li>
        </ul>
        <div class="staff-foot">
          <button class="btn soft sm" data-act="filter-staff" data-id="${s.id}">${icon('tasks', 14)} ${open.get(s.id) || 0} open task${(open.get(s.id) || 0) === 1 ? '' : 's'}</button>
          <span class="grow"></span>
          <button class="icon-btn" data-act="new-task" data-staff="${s.id}" title="Assign task" aria-label="Assign task to ${esc(s.name)}">${icon('plus', 16)}</button>
          <button class="icon-btn" data-act="edit-staff" data-id="${s.id}" aria-label="Edit ${esc(s.name)}">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-act="del-staff" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">${icon('trash', 16)}</button>
        </div>
      </article>`).join('')}</div>`;
    return;
  }

  // tasks board
  const smap = new Map(store.data.staff.map((s) => [s.id, s]));
  const tasks = store.data.tasks.filter((t) =>
    (!state.priority || t.priority === state.priority)
    && (!state.assignee || (state.assignee === 'none' ? !t.staff_id : t.staff_id === state.assignee))
    && (!q || `${t.title} ${t.description || ''} ${smap.get(t.staff_id)?.name || ''}`.toLowerCase().includes(q)));
  const prioOrder = { high: 0, medium: 1, low: 2 };
  const today = startOfDay();
  el.innerHTML = `<div class="board">${['todo', 'in_progress', 'done'].map((col) => {
    const items = tasks.filter((t) => t.status === col).sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority] || String(a.due_date).localeCompare(String(b.due_date)));
    return `<section class="column col-${col}"><header><h3>${TASK_STATUS[col].label}</h3><span class="count">${items.length}</span></header>
      <div class="col-body">${items.map((t) => {
        const who = smap.get(t.staff_id);
        const overdue = t.status !== 'done' && t.due_date && parseDay(t.due_date) < today;
        return `<article class="task">
          <div class="task-top">${badge(PRIORITY[t.priority]?.label, PRIORITY[t.priority]?.tone)}
            <span class="due ${overdue ? 'overdue' : ''}">${icon('calendar', 13)} ${t.due_date ? (isoDay(today) === t.due_date ? 'Today' : fmtDay(t.due_date)) : 'No date'}${overdue ? ' · overdue' : ''}</span></div>
          <h4>${esc(t.title)}</h4>${t.description ? `<p>${esc(t.description)}</p>` : ''}
          <div class="task-foot">
            <span class="assignee">${who ? `${avatar(who.name, 'xs')} ${esc(who.name.split(' ')[0])}` : '<span class="muted">Unassigned</span>'}</span>
            <span class="grow"></span>
            ${col !== 'todo' ? `<button class="icon-btn" data-act="move" data-dir="-1" data-id="${t.id}" title="Move back" aria-label="Move back">${icon('left', 16)}</button>` : ''}
            ${col !== 'done' ? `<button class="icon-btn ok" data-act="move" data-dir="1" data-id="${t.id}" title="${col === 'todo' ? 'Start' : 'Complete'}" aria-label="Advance task">${icon(col === 'todo' ? 'right' : 'check', 16)}</button>` : ''}
            <button class="icon-btn" data-act="edit-task" data-id="${t.id}" aria-label="Edit task">${icon('edit', 16)}</button>
            <button class="icon-btn danger" data-act="del-task" data-id="${t.id}" aria-label="Delete task">${icon('trash', 16)}</button>
          </div></article>`;
      }).join('') || '<p class="muted center pad sm">Nothing here</p>'}</div></section>`;
  }).join('')}</div>`;
}

function openStaffForm(s = null) {
  const F = [
    { name: 'name', label: 'Full name', required: true, maxlength: 80 },
    { name: 'role', label: 'Role', type: 'select', options: ROLES },
    { name: 'phone', label: 'Phone', type: 'tel', pattern: '[0-9+()\\-\\s.]{7,20}' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'shift', label: 'Shift', placeholder: 'e.g. Evening (4–11)' },
    { name: 'hourly_rate', label: 'Hourly rate ($)', type: 'number', min: 0, step: '0.25' },
    { name: 'hired_on', label: 'Hired on', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: Object.entries(STAFF_STATUS).map(([value, v]) => ({ value, label: v.label })) },
  ];
  openModal({
    title: s ? 'Edit team member' : 'Add team member', submitLabel: s ? 'Save changes' : 'Add member',
    body: fields(F, s || { role: 'Cashier', status: 'active', hourly_rate: 15 }),
    onSubmit: async (fd) => {
      const row = Object.fromEntries(F.map((f) => [f.name, String(fd.get(f.name) ?? '').trim()]));
      row.hourly_rate = parseFloat(row.hourly_rate) || 0;
      row.hired_on = row.hired_on || null;
      if (s) await update('staff', s.id, row); else await insert('staff', row);
      toast(s ? 'Team member updated' : 'Team member added');
    },
  });
}

function openTaskForm(t = null, preset = {}) {
  const F = [
    { name: 'title', label: 'Task', required: true, maxlength: 100, span: 2 },
    { name: 'description', label: 'Details', type: 'textarea', rows: 2, span: 2 },
    { name: 'staff_id', label: 'Assign to', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...store.data.staff.map((s) => ({ value: s.id, label: `${s.name} · ${s.role}` }))] },
    { name: 'due_date', label: 'Due date', type: 'date' },
    { name: 'priority', label: 'Priority', type: 'select', options: Object.entries(PRIORITY).map(([value, v]) => ({ value, label: v.label })) },
    { name: 'status', label: 'Status', type: 'select', options: Object.entries(TASK_STATUS).map(([value, v]) => ({ value, label: v.label })) },
  ];
  openModal({
    title: t ? 'Edit task' : 'New task', submitLabel: t ? 'Save changes' : 'Create task',
    body: fields(F, t || { priority: 'medium', status: 'todo', due_date: isoDay(new Date()), staff_id: preset.staff_id || '' }),
    onSubmit: async (fd) => {
      const row = Object.fromEntries(F.map((f) => [f.name, String(fd.get(f.name) ?? '').trim()]));
      row.staff_id = row.staff_id || null; row.due_date = row.due_date || null;
      if (t) await update('tasks', t.id, row); else await insert('tasks', row);
      toast(t ? 'Task updated' : 'Task created');
    },
  });
}
