// Teacher side: a separate full-screen view reached from the Board | Teacher
// switch in the top bar. Pages: Today, Planner, Lessons, Library, To-dos,
// Students. The board keeps running underneath (timers keep ticking).
import { h, $, $$, toast, confirmDialog, pickFile, picSrc } from '../util.js?v=6';
import { playSound } from '../audio.js?v=6';
import * as TS from './tstore.js?v=6';
import { activeBoard } from '../store.js?v=6';
import { sv, fl, download, fmtT, fmtShort, closePop } from './ui.js?v=6';
import { renderToday } from './today.js?v=6';
import { renderPlanner } from './planner.js?v=6';
import { renderLessons } from './lessons.js?v=6';
import { renderLibrary } from './library.js?v=6';
import { renderTasks } from './tasks.js?v=6';
import { renderStudents } from './students.js?v=6';

export const TABS = [
  ['today', 'Today', 'calendar-day', renderToday],
  ['planner', 'Planner', 'calendar', renderPlanner],
  ['lessons', 'Lessons', 'notebook', renderLessons],
  ['library', 'Library', 'books', renderLibrary],
  ['tasks', 'To-dos', 'clipboard', renderTasks],
  ['students', 'Students', 'student', renderStudents]
];

let view, page, tab = 'today', current = null, board = null, nav, trPill;
export const app = {
  go: (t, opts) => go(t, opts),
  board: () => board,
  /** Switch to the board and run fn once the stage has its size again. */
  toBoard(fn) { setMode('board'); requestAnimationFrame(() => requestAnimationFrame(() => fn && fn())); },
  opts: {}
};

export function initTeacher(boardApi) {
  board = boardApi;
  TS.loadT();
  view = h('section.tv', { id: 'teacher', 'aria-label': 'Teacher' });
  page = h('div.tv-page');
  view.append(page);
  nav = h('nav.dock.tnav', { 'aria-label': 'Teacher pages' }, h('div.dock-inner', null, TABS.map(([k, label, icon]) =>
    h('button.dock-item.tnav-item', { type: 'button', 'data-tab': k, title: label, onclick: () => go(k) },
      h('span.dk-ico', null, h('img', { src: picSrc(icon), alt: '', draggable: 'false' })), h('span.dk-lbl', { text: label })))));
  const acct = boardApi.accountButton ? boardApi.accountButton() : null;
  trPill = h('div.chrome.tr-pill.t-tr', null, acct, acct ? h('span.chrome-sep.acct-sep') : null,
    h('button.chrome-btn', { type: 'button', title: 'Download a backup of all teacher data', 'data-act': 't-backup', onclick: backup }, sv('download'), h('span.lbl', { text: 'Back up' })),
    h('button.chrome-btn', { type: 'button', title: 'Restore from a backup file', 'data-act': 't-restore', onclick: restore }, sv('upload'), h('span.lbl', { text: 'Restore' })));
  const notices = h('div.t-notices', { id: 'tNotices', 'aria-live': 'polite' });
  document.getElementById('app').append(view, nav, trPill);
  document.body.append(notices);
  TS.onT(w => { if (w === 'all' && document.body.classList.contains('teacher-mode')) go(tab); });
  // reminders: check often; a notice shows on whichever view is open
  setInterval(checkReminders, 5000); setTimeout(checkReminders, 800);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  window.addEventListener('hashchange', fromHash);
  fromHash(true);
  window.CBT = { TS, setMode, go };
}

function fromHash(first) {
  const m = location.hash.match(/^#teacher(?:\/(\w+))?/);
  if (m) { setMode('teacher', true); go(TABS.some(t => t[0] === m[1]) ? m[1] : (first === true && TS.T().settings.tab) || 'today', { fromHash: true }); }
  else if (first !== true) setMode('board', true);
}

export function setMode(mode, fromHash) {
  const on = mode === 'teacher', was = document.body.classList.contains('teacher-mode');
  closePop();
  $$('[data-mode]').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  if (on === was) return;
  document.body.classList.remove('present');
  document.body.classList.toggle('teacher-mode', on);
  document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
  if (on) { if (!current) go(TS.T().settings.tab || 'today', { fromHash }); else { refresh(); if (!fromHash) history.replaceState(null, '', '#teacher/' + tab); } }
  else {
    TS.flushT(); if (current && current.destroy) current.destroy(); current = null; page.innerHTML = '';
    if (!fromHash && location.hash) history.replaceState(null, '', location.pathname + location.search);
    const b = activeBoard(); if (b) document.title = b.name + ' · Classroom Board';
    window.dispatchEvent(new Event('resize'));
  }
}

function go(t, opts = {}) {
  closePop();
  if (current && current.destroy) current.destroy();
  tab = t; app.opts = opts;
  TS.T().settings.tab = t; TS.saveT();
  $$('.tnav-item').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  if (!opts.fromHash) history.replaceState(null, '', '#teacher/' + t);
  page.innerHTML = ''; page.scrollTop = 0; page.className = 'tv-page tp-' + t;
  const def = TABS.find(x => x[0] === t);
  document.title = def[1] + ' · Teacher · Classroom Board';
  current = def[3](page, app, opts) || null;
}
function refresh() { go(tab, { fromHash: true }); }

// ── reminders ──
const shown = new Set();
function checkReminders() {
  const box = $('#tNotices'); if (!box) return;
  const due = TS.dueReminders();
  // drop notices that are no longer due (done elsewhere, snoozed)
  $$('.t-notice', box).forEach(n => { if (!due.some(r => r.id === n.dataset.rid)) { n.remove(); shown.delete(n.dataset.rid); } });
  let rang = false;
  due.forEach(r => {
    if (shown.has(r.id)) return;
    shown.add(r.id); rang = true;
    const close = () => { n.classList.add('leaving'); setTimeout(() => { n.remove(); shown.delete(r.id); }, 180); };
    const n = h('div.t-notice', { 'data-rid': r.id, role: 'alert' },
      fl('bell', 't-notice-ico'),
      h('div.t-notice-main', null, h('b', { text: r.text }), h('small', { text: 'Reminder · ' + (r.date === TS.todayYmd() ? 'today' : fmtShort(r.date)) + ' at ' + fmtT(r.time) })),
      h('div.t-notice-acts', null,
        h('button.btn.sm.ghost', { type: 'button', 'data-act': 'rm-snooze', text: 'Snooze 10 min', onclick: () => { TS.updateReminder(r.id, { snooze: Date.now() + 10 * 60000 }); close(); } }),
        h('button.btn.sm.primary', { type: 'button', 'data-act': 'rm-done', text: 'Done', onclick: () => { TS.updateReminder(r.id, { done: true }); close(); } })));
    box.append(n);
  });
  if (rang) try { playSound('chime'); } catch (e) { }
}
TS.onT(w => { if (w === 'reminders' || w === 'remote') setTimeout(checkReminders, 0); if (w === 'remote') refreshSoon(); });

// A change from someone else in the shared classroom: redraw the open page,
// but never while this person is typing, dragging or has a window open.
let refreshT = 0;
const tBusy = () => {
  const a = document.activeElement;
  return !!((a && a !== document.body && a.closest('#teacher, .modal-back') && a.matches('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
    || document.querySelector('.modal-back, .t-pop, .t-ghost') || document.body.classList.contains('t-is-dragging'));
};
function refreshSoon() {
  clearTimeout(refreshT);
  refreshT = setTimeout(() => {
    if (!document.body.classList.contains('teacher-mode') || !current) return;
    if (tBusy()) { refreshSoon(); return; }
    const top = page.scrollTop; refresh(); page.scrollTop = top;
  }, 350);
}

// ── backup / restore ──
async function backup() {
  try {
    const json = await TS.exportBackup();
    download('classroom-board-teacher-backup-' + TS.todayYmd() + '.json', json);
    toast('Backup downloaded. Keep it somewhere safe.');
  } catch (e) { console.warn(e); toast('The backup could not be made.', 'err'); }
}
async function restore() {
  const f = await pickFile('application/json,.json'); if (!f) return;
  let o;
  try { o = TS.readBackup(await f.text()); } catch (e) { toast(e.message, 'err'); return; }
  const d = o.data, n = (k) => (d[k] || []).length;
  const when = o.exported ? new Date(o.exported).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'an unknown date';
  if (!await confirmDialog('Restore this backup?', `From ${when}: ${n('lessons')} lessons, ${n('resources')} library items, ${n('students')} students. Everything on the teacher side now will be replaced.`, 'Restore', false)) return;
  try { await TS.importBackup(o); toast('Backup restored.'); }
  catch (e) { console.warn(e); toast('That backup could not be restored.', 'err'); }
}
