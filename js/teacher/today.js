// Today: the day at a glance – schedule blocks (with what is on now),
// today's lessons, to-dos, reminders and attendance.
import { h, $, $$, toast } from '../util.js?v=5';
import * as TS from './tstore.js?v=5';
import { sv, fl, empty, fmtLong, fmtRange, fmtT, fmtShort, fmtDow, tint } from './ui.js?v=5';
import { offIcon } from './planner.js?v=5';
import { resIcon, openResource } from './library.js?v=5';
import { todoRow, reminderRow, nextHour } from './tasks.js?v=5';

const mins = s => { const [H, M] = s.split(':').map(Number); return H * 60 + M; };

export function renderToday(root, app) {
  const today = TS.todayYmd(), now = new Date();
  const hr = now.getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const off = TS.T().daysOff[today];
  root.append(h('header.tp-head.td-head', null,
    h('div.tp-title', null, fl(hr < 17 ? 'sun' : 'owl', 'tp-ico'), h('div', null, h('h1', { text: hello + '!' }), h('p', { text: fmtLong(today) + ', ' + now.getFullYear(), 'data-testid': 'today-date' }))),
    h('div.tp-actions', null, h('button.btn', { type: 'button', 'data-act': 'open-board', onclick: () => app.toBoard() }, sv('board'), 'Open the board'))));
  if (off) root.append(h('div.td-banner', { 'data-testid': 'today-off' }, fl(offIcon(off.reason), 'td-banner-ico'), h('div', null, h('b', { text: off.reason + ' today' }), h('small', { text: 'No school blocks today.' }))));

  const grid = h('div.td-grid');
  root.append(grid);
  const card = (cls, icon, title, action, ...kids) => h('section.tcard.td-card.' + cls, null, h('header.td-card-h', null, fl(icon, 'td-card-ico'), h('h2', { text: title }), h('span.ls-gap'), action || null), ...kids);

  // schedule
  const sched = h('div.td-sched', { 'data-testid': 'today-schedule' });
  const school = TS.isSchoolDay(today);
  function drawSched() {
    sched.innerHTML = '';
    const blocks = school ? TS.blocksFor(today) : [];
    if (!blocks.length) { sched.append(empty(off ? offIcon(off.reason) : TS.isWeekend(today) ? 'sunflower' : 'alarm-clock', off ? 'No school today' : TS.isWeekend(today) ? 'It’s the weekend' : 'No blocks today', off || TS.isWeekend(today) ? 'Enjoy the day!' : 'Add blocks to your weekly schedule in the Planner.')); return; }
    const m = new Date().getHours() * 60 + new Date().getMinutes();
    let nextMarked = false;
    blocks.forEach(b => {
      const s = mins(b.start), e = mins(b.end);
      const state = m >= e ? 'done' : m >= s ? 'now' : (!nextMarked ? (nextMarked = true, 'next') : '');
      const n = TS.placementsOn(today, b.id).length;
      sched.append(h('div.td-blk' + (state ? '.' + state : ''), { 'data-block': b.id },
        fl(b.icon || 'star', 'td-blk-ico'),
        h('span.td-blk-t', null, h('b', { text: b.title }), h('small', { text: fmtRange(b.start, b.end) })),
        state === 'now' ? h('span.td-now', { text: 'Now' }) : state === 'next' ? h('span.td-next', { text: 'Next' }) : null,
        n ? h('span.td-blk-n', { title: n + ' lesson' + (n > 1 ? 's' : ''), text: n + ' lesson' + (n > 1 ? 's' : '') }) : null));
    });
  }
  drawSched();

  // lessons (today's; on a day with no school, the next school day's)
  const lessonDay = TS.placementsOn(today).length || school ? today : TS.nextSchoolDay(today);
  const lbox = h('div.td-lessons', { 'data-testid': 'today-lessons' });
  const ps = TS.placementsOn(lessonDay).filter(p => TS.getLesson(p.lessonId));
  const blocks = TS.blocksFor(lessonDay);
  ps.sort((a, b) => { const ba = blocks.find(x => x.id === a.blockId), bb = blocks.find(x => x.id === b.blockId); return (ba ? ba.start : '99') .localeCompare(bb ? bb.start : '99') || (a.order - b.order); });
  if (!ps.length) lbox.append(empty('notebook', 'Nothing planned' + (lessonDay === today ? ' today' : ' for ' + fmtDow(lessonDay)), 'Drag lessons onto the planner to see them here.', h('button.btn.sm.primary', { type: 'button', 'data-act': 'goto-planner', onclick: () => app.go('planner') }, 'Open the planner')));
  ps.forEach(p => {
    const l = TS.getLesson(p.lessonId), b = blocks.find(x => x.id === p.blockId);
    const [bg, fg] = tint(l.tags[0] || l.title);
    const rs = l.resources.map(TS.getResource).filter(Boolean).slice(0, 4);
    lbox.append(h('div.td-lesson', { 'data-lesson': l.id, style: { '--lb': bg, '--lc': fg } },
      h('button.td-lesson-main', { type: 'button', 'data-act': 'open-lesson', onclick: () => app.go('lessons', { lessonId: l.id }) },
        h('span.td-lesson-when', { text: b ? b.title + ' · ' + fmtT(b.start) : 'Anytime' }), h('b', { text: l.title || 'Untitled lesson' }),
        l.objectives ? h('small', { text: l.objectives.split('\n')[0].slice(0, 120) }) : null),
      rs.length ? h('div.td-lesson-res', null, rs.map(r => h('button.td-res', { type: 'button', title: 'Open ' + r.title, 'data-act': 'today-res', 'data-res': r.id, onclick: () => openResource(r, app) }, fl(resIcon(r), 'fl-xs'), h('span', { text: r.title })))) : null));
  });

  // to-dos
  const tlist = h('div.td-list', { 'data-testid': 'today-todos' });
  const tin = h('input.input', { type: 'text', placeholder: 'Add a to-do…', 'aria-label': 'Add a to-do', maxlength: 200, 'data-testid': 'today-todo-in', enterkeyhint: 'done' });
  const addT = () => { const v = tin.value.trim(); if (!v) return; TS.addTodo(v, ''); tin.value = ''; drawTodos(); };
  tin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addT(); } });
  function drawTodos() {
    tlist.innerHTML = '';
    const open = TS.T().todos.filter(t => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    if (!open.length) tlist.append(h('p.td-none', null, fl('check', 'fl-xs'), h('span', { text: 'All caught up!' })));
    open.slice(0, 7).forEach(t => tlist.append(todoRow(t, drawTodos, true)));
    if (open.length > 7) tlist.append(h('button.link.td-more', { type: 'button', text: '+ ' + (open.length - 7) + ' more', onclick: () => app.go('tasks') }));
  }
  drawTodos();

  // reminders
  const rlist = h('div.td-list', { 'data-testid': 'today-reminders' });
  const rin = h('input.input', { type: 'text', placeholder: 'Remind me to…', 'aria-label': 'Reminder', maxlength: 200, 'data-testid': 'today-rem-in', enterkeyhint: 'done' });
  const rtime = h('input.input.time', { type: 'time', value: nextHour(), 'aria-label': 'Time today', 'data-testid': 'today-rem-time' });
  const addR = () => { const v = rin.value.trim(); if (!v || !rtime.value) { (v ? rtime : rin).focus(); return; } TS.addReminder(v, today, rtime.value); rin.value = ''; drawRems(); toast('Reminder set for ' + fmtT(rtime.value)); };
  rin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addR(); } });
  function drawRems() {
    rlist.innerHTML = '';
    const rs = TS.T().reminders.filter(r => !r.done && r.date <= TS.addDays(today, 1)).sort((a, b) => TS.reminderAt(a) - TS.reminderAt(b));
    if (!rs.length) rlist.append(h('p.td-none', null, fl('bell', 'fl-xs'), h('span', { text: 'No reminders today.' })));
    rs.forEach(r => rlist.append(reminderRow(r, drawRems, true)));
  }
  drawRems();

  // attendance
  const ros = TS.roster(), att = TS.T().attendance[today] || {};
  const cnt = k => ros.filter(s => att[s.id] === k).length;
  const abox = h('div.td-att', { 'data-testid': 'today-att' }, ros.length
    ? [h('div.td-att-n', null, h('span.p', null, h('b', { text: String(cnt('P') + cnt('T')) }), h('small', { text: 'here' })), h('span.a', null, h('b', { text: String(cnt('A')) }), h('small', { text: 'absent' })), h('span.u', null, h('b', { text: String(ros.length - cnt('P') - cnt('A') - cnt('T')) }), h('small', { text: 'not marked' }))),
       h('button.btn.primary.full', { type: 'button', 'data-act': 'take-att', onclick: () => app.go('students') }, 'Take attendance')]
    : empty('student', 'No students yet', 'Add your class by initials.', h('button.btn.sm.primary', { type: 'button', 'data-act': 'goto-students', onclick: () => app.go('students') }, 'Add students')));

  const cards = {
    sched: card('c-sched', 'alarm-clock', 'Today’s schedule', h('button.btn.sm.ghost', { type: 'button', text: 'Planner', 'data-act': 'goto-planner', onclick: () => app.go('planner') }), sched),
    lessons: card('c-lessons', 'notebook', lessonDay === today ? 'Today’s lessons' : fmtDow(lessonDay) + '’s lessons', h('span.td-count', { text: String(ps.length) }), lbox),
    todos: card('c-todos', 'clipboard', 'To-dos', h('button.btn.sm.ghost', { type: 'button', text: 'All', 'data-act': 'goto-tasks', onclick: () => app.go('tasks') }), h('div.td-add', null, tin, h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Add to-do', 'data-act': 'today-todo-add', onclick: addT }, sv('plus'))), tlist),
    rems: card('c-rems', 'bell', 'Reminders', h('button.btn.sm.ghost', { type: 'button', text: 'All', 'data-act': 'goto-tasks', onclick: () => app.go('tasks') }), h('div.td-add', null, rin, rtime, h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Add reminder', 'data-act': 'today-rem-add', onclick: addR }, sv('plus'))), rlist),
    att: card('c-att', 'student', 'Attendance', null, abox) };
  // cards stack in columns (no gaps under short cards); the column plan follows the width
  let plan = '';
  function columns() {
    const w = root.clientWidth, p = w >= 1180 ? 'three' : w >= 720 ? 'two' : 'one';
    if (p === plan) return; plan = p;
    const sets = { three: [['sched'], ['lessons', 'att'], ['todos', 'rems']], two: [['lessons', 'todos', 'rems'], ['sched', 'att']], one: [['lessons', 'sched', 'todos', 'rems', 'att']] }[p];
    grid.innerHTML = ''; grid.className = 'td-grid cols-' + p;
    sets.forEach(keys => grid.append(h('div.td-col', null, keys.map(k => cards[k]))));
  }
  columns();
  const ro = new ResizeObserver(columns); ro.observe(root);
  const iv = setInterval(drawSched, 30000);
  return { destroy: () => { clearInterval(iv); ro.disconnect(); } };
}
