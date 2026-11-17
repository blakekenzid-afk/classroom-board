// To-dos (optional due date) and reminders (date + time; an in-app notice
// pops up when one is due while the board is open).
import { h, $$, toast, ico } from '../util.js?v=4';
import * as TS from './tstore.js?v=4';
import { sv, fl, empty, fmtT, fmtShort, fmtDow } from './ui.js?v=4';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
export const nextHour = () => { const d = new Date(Date.now() + 60 * 60000); return String(d.getHours()).padStart(2, '0') + ':00'; };
const dueLabel = d => { const t = TS.todayYmd(); return d === t ? 'Today' : d === TS.addDays(t, 1) ? 'Tomorrow' : d === TS.addDays(t, -1) ? 'Yesterday' : fmtDow(d) + ' ' + fmtShort(d); };

export function todoRow(t, redraw, compact) {
  const today = TS.todayYmd();
  const box = h('button.t-cb' + (t.done ? '.on' : ''), { type: 'button', role: 'checkbox', 'aria-checked': String(t.done), 'aria-label': (t.done ? 'Not done: ' : 'Done: ') + t.text, 'data-act': 'todo-check', html: CHECK });
  const row = h('div.t-row' + (t.done ? '.done' : ''), { 'data-todo': t.id }, box,
    h('span.t-row-t', null, h('span.t-row-text', { text: t.text }), t.due ? h('small.t-due' + (!t.done && t.due < today ? '.late' : !t.done && t.due === today ? '.soon' : ''), { text: dueLabel(t.due) }) : null),
    compact ? null : h('button.icon-btn.sm.danger', { type: 'button', 'aria-label': 'Delete ' + t.text, title: 'Delete', 'data-act': 'todo-delete', html: ico.trash, onclick: () => { TS.removeTodo(t.id); redraw(); } }));
  box.onclick = () => {
    const v = !t.done; TS.updateTodo(t.id, { done: v });
    row.classList.toggle('done', v); box.classList.toggle('on', v); box.setAttribute('aria-checked', String(v));
    if (v) { row.classList.add('pop'); setTimeout(redraw, compact ? 650 : 250); } else redraw();
  };
  return row;
}
export function reminderRow(r, redraw, compact) {
  const at = TS.reminderAt(r), late = !r.done && at <= Date.now();
  const box = h('button.t-cb' + (r.done ? '.on' : ''), { type: 'button', role: 'checkbox', 'aria-checked': String(r.done), 'aria-label': (r.done ? 'Not done: ' : 'Done: ') + r.text, 'data-act': 'rem-check', html: CHECK });
  box.onclick = () => { TS.updateReminder(r.id, { done: !r.done, snooze: 0 }); redraw(); };
  return h('div.t-row' + (r.done ? '.done' : ''), { 'data-rem': r.id }, box,
    h('span.t-row-t', null, h('span.t-row-text', { text: r.text }), h('small.t-due' + (late ? '.late' : ''), null, fl('bell', 'fl-xs'), h('span', { text: (r.date === TS.todayYmd() ? '' : dueLabel(r.date) + ' · ') + fmtT(r.time) }))),
    compact ? null : h('button.icon-btn.sm.danger', { type: 'button', 'aria-label': 'Delete ' + r.text, title: 'Delete', 'data-act': 'rem-delete', html: ico.trash, onclick: () => { TS.removeReminder(r.id); redraw(); } }));
}

export function renderTasks(root) {
  const st = renderTasks.st || (renderTasks.st = { show: 'open' });
  root.append(h('header.tp-head', null, h('div.tp-title', null, fl('clipboard', 'tp-ico'), h('div', null, h('h1', { text: 'To-dos & reminders' }), h('p', { text: 'Reminders pop up on the screen when they are due' })))));
  const cols = h('div.tk');
  root.append(cols);

  // to-dos
  const tText = h('input.input', { type: 'text', placeholder: 'What needs doing?', 'aria-label': 'New to-do', maxlength: 200, 'data-testid': 'todo-in', enterkeyhint: 'done' });
  const tDue = h('input.input.tk-date', { type: 'date', 'aria-label': 'Due date (optional)', title: 'Due date (optional)', 'data-testid': 'todo-due' });
  const tList = h('div.t-list', { 'data-testid': 'todo-list' });
  const seg = h('div.seg.tk-seg', { role: 'radiogroup' }, [['open', 'To do'], ['done', 'Done'], ['all', 'All']].map(([v, l]) => {
    const b = h('button' + (st.show === v ? '.on' : ''), { type: 'button', 'data-v': v, 'aria-pressed': String(st.show === v) }, h('span', { text: l }));
    b.onclick = () => { st.show = v; $$('button', seg).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); drawT(); };
    return b;
  }));
  const addT = () => { const v = tText.value.trim(); if (!v) { tText.focus(); return; } TS.addTodo(v, tDue.value); tText.value = ''; tDue.value = ''; if (st.show === 'done') { st.show = 'open'; $$('button', seg).forEach(x => x.classList.toggle('on', x.dataset.v === 'open')); } drawT(); tText.focus(); };
  tText.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addT(); } });
  const clearBtn = h('button.btn.sm.ghost', { type: 'button', text: 'Clear done', 'data-act': 'todo-clear', onclick: () => { const n = TS.T().todos.filter(t => t.done); n.forEach(t => TS.removeTodo(t.id)); drawT(); toast(n.length + ' cleared'); } });
  function drawT() {
    tList.innerHTML = '';
    const all = TS.T().todos;
    const ls = all.filter(t => st.show === 'all' || (st.show === 'done' ? t.done : !t.done))
      .sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999') || (b.created - a.created));
    clearBtn.hidden = !all.some(t => t.done);
    if (!ls.length) tList.append(empty(st.show === 'done' ? 'clipboard' : 'check', st.show === 'done' ? 'Nothing done yet' : 'All caught up!', st.show === 'done' ? '' : 'Add a to-do above.'));
    ls.forEach(t => tList.append(todoRow(t, drawT)));
  }

  // reminders
  const rText = h('input.input', { type: 'text', placeholder: 'Remind me to…', 'aria-label': 'New reminder', maxlength: 200, 'data-testid': 'rem-in', enterkeyhint: 'done' });
  const rDate = h('input.input.tk-date', { type: 'date', value: TS.todayYmd(), 'aria-label': 'Reminder date', 'data-testid': 'rem-date' });
  const rTime = h('input.input.time', { type: 'time', value: nextHour(), 'aria-label': 'Reminder time', 'data-testid': 'rem-time' });
  const rList = h('div.t-list', { 'data-testid': 'rem-list' });
  const addR = () => {
    const v = rText.value.trim(); if (!v) { rText.focus(); return; }
    if (!rDate.value || !rTime.value) { toast('Pick a day and a time.', 'err'); return; }
    TS.addReminder(v, rDate.value, rTime.value); rText.value = ''; drawR();
    toast('Reminder set for ' + (rDate.value === TS.todayYmd() ? 'today' : fmtShort(rDate.value)) + ' at ' + fmtT(rTime.value));
  };
  rText.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addR(); } });
  function drawR() {
    rList.innerHTML = '';
    const now = Date.now(), all = TS.T().reminders.slice().sort((a, b) => TS.reminderAt(a) - TS.reminderAt(b));
    const groups = [['Due', all.filter(r => !r.done && TS.reminderAt(r) <= now)], ['Coming up', all.filter(r => !r.done && TS.reminderAt(r) > now)], ['Done', all.filter(r => r.done).reverse().slice(0, 20)]];
    if (!all.length) { rList.append(empty('bell', 'No reminders', 'Add one above – it pops up on the screen at that time, even on the board.')); return; }
    groups.forEach(([g, rs]) => { if (!rs.length) return; rList.append(h('div.t-group', { text: g })); rs.forEach(r => rList.append(reminderRow(r, drawR))); });
  }

  cols.append(
    h('section.tcard.tk-card', { 'data-testid': 'todos' }, h('header.td-card-h', null, fl('clipboard', 'td-card-ico'), h('h2', { text: 'To-dos' }), h('span.ls-gap'), clearBtn),
      h('div.tk-add', null, tText, h('label.tk-due', null, h('span', { text: 'Due' }), tDue), h('button.btn.primary', { type: 'button', 'data-act': 'todo-add', onclick: addT }, sv('plus'), 'Add')), seg, tList),
    h('section.tcard.tk-card', { 'data-testid': 'reminders' }, h('header.td-card-h', null, fl('bell', 'td-card-ico'), h('h2', { text: 'Reminders' })),
      h('div.tk-add', null, rText, h('div.tk-when', null, rDate, rTime), h('button.btn.primary', { type: 'button', 'data-act': 'rem-add', onclick: addR }, sv('plus'), 'Add')), rList));
  drawT(); drawR();
  const un = TS.onT(w => { if (w === 'reminders') drawR(); });
  const iv = setInterval(drawR, 30000);
  return { destroy: () => { un(); clearInterval(iv); } };
}
