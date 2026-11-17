// Weekly planner: the repeating weekly schedule (blocks per weekday) with
// lessons dropped into blocks. Week navigation, snow / no-school days with a
// "bump everything forward one school day", and drag lessons from the tray.
import { h, $, $$, toast, confirmDialog } from '../util.js?v=6';
import * as S from '../store.js?v=6';
import { pickPicture } from '../picker.js?v=6';
import * as TS from './tstore.js?v=6';
import { sv, fl, empty, modal, popMenu, tint, dragSource, fmtShort, fmtLong, fmtRange, fmtDow, MONTHS } from './ui.js?v=6';
import { pickSlot } from './lessons.js?v=6';

const shortRange = (a, b) => [a, b].map(t => { const [H, M] = t.split(':').map(Number); return (H % 12 || 12) + ':' + String(M).padStart(2, '0'); }).join('–');
const OFF_REASONS = [['Snow day', 'snowflake'], ['No school', 'house'], ['Holiday', 'party'], ['Teacher work day', 'teacher']];
export const offIcon = reason => (OFF_REASONS.find(r => r[0] === reason) || [0, 'house'])[1];

/** Ask how to mark a day off; returns true if marked. */
export async function markDayOff(date) {
  const later = TS.T().placements.filter(p => p.date >= date).length;
  const here = TS.placementsOn(date).length;
  const r = await modal('No school on ' + fmtLong(date) + '?', (body, done) => {
    let reason = 'Snow day';
    const seg = h('div.seg.big.off-seg', { role: 'radiogroup' });
    OFF_REASONS.forEach(([v, ico]) => { const b = h('button' + (v === reason ? '.on' : ''), { type: 'button', 'data-v': v, 'aria-pressed': String(v === reason) }, fl(ico, 'seg-fl'), h('span', { text: v })); b.onclick = () => { reason = v; $$('button', seg).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); }; seg.append(b); });
    const bump = h('input', { type: 'checkbox', checked: later > 0, 'data-testid': 'off-bump' });
    body.append(seg,
      h('label.t-check.off-bump', null, bump, h('span.t-box'), h('span', null, h('b', { text: 'Bump lessons forward one school day' }), h('small', { text: later ? `${here ? here + ' lesson' + (here > 1 ? 's' : '') + ' on this day and ' : ''}everything planned after it move${later === 1 ? 's' : ''} to the next school day (${later} in all).` : 'Nothing is planned on or after this day.' }))),
      h('div.row.end', null, h('button.btn.ghost', { type: 'button', text: 'Cancel', onclick: () => done() }), h('button.btn.primary', { type: 'button', text: 'Mark day off', 'data-act': 'off-save', onclick: () => done({ reason, bump: bump.checked }) })));
  }, { icon: 'snowflake' });
  if (!r) return false;
  TS.setDayOff(date, r.reason);
  const n = r.bump ? TS.bumpFrom(date) : 0;
  toast(r.reason + ' marked' + (n ? ' · ' + n + ' lesson' + (n > 1 ? 's' : '') + ' moved forward' : ''));
  return true;
}

export function renderPlanner(root, app, opts) {
  const st = renderPlanner.st || (renderPlanner.st = { week: null, q: '' });
  const today = TS.todayYmd();
  const thisWeek = TS.isWeekend(today) ? TS.addDays(TS.weekStart(today), 7) : TS.weekStart(today);
  if (opts.week) st.week = opts.week; else if (!st.week || !opts.keep) st.week = thisWeek;
  const label = h('b.pl-wk-label', { 'data-testid': 'week-label' });
  const nav = h('div.pl-wk', null,
    h('button.icon-btn.soft', { type: 'button', title: 'Previous week', 'aria-label': 'Previous week', 'data-act': 'week-prev', html: '', onclick: () => { st.week = TS.addDays(st.week, -7); drawWeek(); } }, sv('left')),
    label,
    h('button.icon-btn.soft', { type: 'button', title: 'Next week', 'aria-label': 'Next week', 'data-act': 'week-next', onclick: () => { st.week = TS.addDays(st.week, 7); drawWeek(); } }, sv('right')),
    h('button.btn.sm.ghost', { type: 'button', text: 'This week', 'data-act': 'week-today', onclick: () => { st.week = thisWeek; drawWeek(); } }));
  root.append(h('header.tp-head', null,
    h('div.tp-title', null, fl('calendar', 'tp-ico'), h('div', null, h('h1', { text: 'Planner' }), h('p', { text: 'Your weekly schedule with lessons in each block' }))),
    h('div.tp-actions', null, nav, h('button.btn', { type: 'button', 'data-act': 'edit-schedule', onclick: editSchedule }, fl('alarm-clock', 'btn-fl'), 'Edit schedule'))));

  const tray = h('aside.pl-tray.tcard', { 'data-testid': 'tray' });
  const week = h('div.pl-week', { 'data-testid': 'week' });
  root.append(h('div.pl', null, tray, week));

  // ── lesson tray ──
  const tq = h('input.input.t-search', { type: 'search', placeholder: 'Find a lesson', 'aria-label': 'Find a lesson', value: st.q });
  const tlist = h('div.pl-tray-list');
  tq.addEventListener('input', () => { st.q = tq.value; drawTray(); });
  tray.append(h('div.pl-tray-head', null, h('b', { text: 'Lessons' }), h('small', { text: matchMedia('(pointer:coarse)').matches ? 'Drag by the dots onto a block' : 'Drag onto a block' })), h('label.t-search-wrap', null, sv('search', 'i t-mag'), tq), tlist);
  function drawTray() {
    tlist.innerHTML = '';
    const q = st.q.trim().toLowerCase();
    const ls = TS.T().lessons.filter(l => !q || [l.title, ...l.tags].some(x => x.toLowerCase().includes(q)));
    if (!TS.T().lessons.length) { tlist.append(h('div.pl-tray-empty', null, h('span', { text: 'No lessons yet.' }), h('button.btn.sm.primary', { type: 'button', 'data-act': 'tray-new', onclick: () => { const l = TS.addLesson({}); app.go('lessons', { lessonId: l.id }); } }, sv('plus'), 'New lesson'))); return; }
    if (!ls.length) { tlist.append(h('small.muted.pl-tray-none', { text: 'No lessons match.' })); return; }
    ls.forEach(l => {
      const [bg, fg] = tint(l.tags[0] || l.title);
      const c = h('div.pl-lesson', { 'data-lesson': l.id, style: { '--lc': fg, '--lb': bg } }, h('button.t-grip', { type: 'button', 'aria-label': 'Drag ' + l.title, html: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>' }),
        h('span.pl-lesson-t', null, h('b', { text: l.title || 'Untitled lesson' }), l.tags.length ? h('small', { text: l.tags.slice(0, 2).join(' · ') }) : null),
        h('button.icon-btn.sm.pl-lesson-add', { type: 'button', title: 'Choose a day', 'aria-label': 'Put ' + l.title + ' on the planner', 'data-act': 'tray-plan', onclick: async () => { const s = await pickSlot(l.title, st.week > today ? st.week : null); if (s) { TS.placeLesson(l.id, s.date, s.blockId); st.week = TS.weekStart(s.date); drawWeek(); toast('Planned for ' + fmtLong(s.date)); } } }, sv('calPlus')));
      dragSource(c, { ghostText: () => l.title || 'Lesson', scroller: () => root, onDrop: t => drop({ lessonId: l.id }, t) });
      tlist.append(c);
    });
  }
  function drop(what, t) {
    const date = t.dataset.date, blockId = t.dataset.block || null;
    if (what.placementId) TS.movePlacement(what.placementId, date, blockId);
    else TS.placeLesson(what.lessonId, date, blockId);
    drawWeek();
    const nw = $(`.pl-slot[data-date="${date}"][data-block="${blockId || ''}"]`, week); nw && nw.classList.add('t-flash');
  }

  // ── week grid ──
  function chip(p) {
    const l = TS.getLesson(p.lessonId); if (!l) return null;
    const [bg, fg] = tint(l.tags[0] || l.title);
    const c = h('div.pl-chip', { 'data-pl': p.id, 'data-lesson': l.id, role: 'button', tabindex: '0', style: { background: bg, color: fg }, title: l.title },
      h('button.t-grip.sm', { type: 'button', 'aria-label': 'Move ' + l.title, html: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.7"/><circle cx="15" cy="7" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="17" r="1.7"/><circle cx="15" cy="17" r="1.7"/></svg>' }),
      h('span.pl-chip-t', { text: l.title || 'Untitled lesson' }));
    const menu = () => popMenu(c, [
      { label: 'Open lesson', icon: 'pencil', act: 'chip-open', fn: () => app.go('lessons', { lessonId: l.id }) },
      { label: 'Move to next school day', icon: 'bump', act: 'chip-next', fn: () => { const d = TS.nextSchoolDay(p.date); const b = TS.T().blocks.find(x => x.id === p.blockId); TS.movePlacement(p.id, d, b && b.days.includes(TS.dowOf(d)) ? b.id : null); if (TS.weekStart(d) !== st.week) toast('Moved to ' + fmtLong(d)); drawWeek(); } },
      { label: 'Remove from planner', icon: 'close', act: 'chip-remove', danger: true, fn: () => { TS.removePlacement(p.id); drawWeek(); toast('Removed from the planner', '', { label: 'Undo', act: 'toast-undo', fn: () => { TS.T().placements.push(p); TS.saveT('plan'); delete TS.T().deleted[p.id]; drawWeek(); } }); } }
    ]);
    c.addEventListener('click', e => { if (c.dataset.justDragged || e.target.closest('.t-grip')) return; menu(); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menu(); } });
    dragSource(c, { ghostText: () => l.title, scroller: () => root, onDrop: t => drop({ placementId: p.id }, t) });
    return c;
  }
  function slot(date, b) {
    const s = h('div.pl-slot' + (b ? '' : '.any'), { 'data-drop': '1', 'data-date': date, 'data-block': b ? b.id : '' },
      h('div.pl-slot-head', null, b ? fl(b.icon || 'star', 'pl-slot-ico') : null, h('span.pl-slot-t', { title: b ? b.title + ' · ' + fmtRange(b.start, b.end) : 'Anytime' }, h('b', { text: b ? b.title : 'Anytime' }), b ? h('small', null, h('span.t-long', { text: fmtRange(b.start, b.end) }), h('span.t-short', { text: shortRange(b.start, b.end) })) : null),
        h('button.icon-btn.sm.pl-add', { type: 'button', title: 'Add a lesson', 'aria-label': 'Add a lesson to ' + (b ? b.title : 'Anytime') + ' on ' + fmtLong(date), 'data-act': 'slot-add', onclick: () => addTo(date, b) }, sv('plus'))));
    const ps = TS.placementsOn(date, b ? b.id : null);
    if (ps.length) s.append(h('div.pl-chips', null, ps.map(chip)));
    return s;
  }
  async function addTo(date, b) {
    if (!TS.T().lessons.length) { if (await confirmDialog('No lessons yet', 'Write a lesson first, then put it on the planner.', 'New lesson', false)) { const l = TS.addLesson({}); app.go('lessons', { lessonId: l.id }); } return; }
    const id = await modal('Add a lesson', (body, done) => {
      const q = h('input.input.t-search', { type: 'search', placeholder: 'Search lessons', 'aria-label': 'Search lessons', autofocus: true });
      const list = h('div.att-list', { 'data-testid': 'pick-lesson' });
      const draw = () => { list.innerHTML = ''; const s = q.value.trim().toLowerCase();
        TS.T().lessons.filter(l => !s || [l.title, ...l.tags].some(x => x.toLowerCase().includes(s))).forEach(l => list.append(h('button.att-row', { type: 'button', 'data-lesson': l.id, onclick: () => done(l.id) }, fl('notebook', 'att-ico'), h('span.att-t', null, h('b', { text: l.title || 'Untitled lesson' }), h('small', { text: l.tags.join(' · ') }))))); };
      q.addEventListener('input', draw); draw();
      body.append(h('p.muted.tm-sub', { text: (b ? b.title + ' · ' : '') + fmtLong(date) }), q, list);
    }, { icon: 'notebook', cls: 'att-modal' });
    if (id) { TS.placeLesson(id, date, b ? b.id : null); drawWeek(); }
  }
  function dayMenu(btn, date) {
    const off = TS.isDayOff(date);
    popMenu(btn, [
      off ? { label: 'Make it a school day again', icon: 'reset', act: 'day-on', fn: () => { TS.setDayOff(date, null); drawWeek(); toast('Back to a school day'); } }
        : { label: 'Snow day / no school…', icon: 'snow', act: 'day-off', fn: async () => { if (await markDayOff(date)) drawWeek(); } },
      off ? null : { label: 'Bump lessons forward one day', icon: 'bump', act: 'day-bump', fn: async () => {
        const n = TS.T().placements.filter(p => p.date >= date).length;
        if (!n) { toast('Nothing is planned on or after this day.'); return; }
        if (await confirmDialog('Bump lessons forward?', `${n} lesson${n > 1 ? 's' : ''} from ${fmtLong(date)} on will each move to the next school day.`, 'Bump forward', false)) { TS.bumpFrom(date); drawWeek(); toast(n + ' lesson' + (n > 1 ? 's' : '') + ' moved forward'); }
      } }
    ]);
  }
  function drawWeek() {
    const end = TS.addDays(st.week, 4), a = TS.parseYmd(st.week), z = TS.parseYmd(end);
    label.textContent = a.getMonth() === z.getMonth() ? `${MONTHS[a.getMonth()].slice(0, 3)} ${a.getDate()} – ${z.getDate()}, ${z.getFullYear()}` : `${fmtShort(st.week)} – ${fmtShort(end)}, ${z.getFullYear()}`;
    week.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const date = TS.addDays(st.week, i), off = TS.T().daysOff[date];
      const mb = h('button.icon-btn.sm', { type: 'button', title: 'Day options', 'aria-label': 'Options for ' + fmtLong(date), 'data-act': 'day-menu', html: '' }, sv('dots'));
      mb.onclick = () => dayMenu(mb, date);
      const col = h('section.pl-day' + (date === today ? '.today' : '') + (off ? '.off' : ''), { 'data-date': date },
        h('header.pl-day-head', null, h('span.pl-dow', { text: fmtDow(date) }), h('span.pl-date', { text: String(TS.parseYmd(date).getDate()) }), date === today ? h('span.pl-today', { text: 'Today' }) : null, h('span.ls-gap'), mb));
      if (off) col.append(h('div.pl-off', null, fl(offIcon(off.reason), 'pl-off-ico'), h('b', { text: off.reason }), h('button.link', { type: 'button', text: 'Undo', 'data-act': 'off-undo', onclick: () => { TS.setDayOff(date, null); drawWeek(); } })));
      const blocks = TS.blocksFor(date);
      blocks.forEach(b => col.append(slot(date, b)));
      col.append(slot(date, null));
      week.append(col);
    }
  }

  // ── weekly schedule editor ──
  async function editSchedule() {
    await modal('Weekly schedule', (body) => {
      const list = h('div.sc-list', { 'data-testid': 'sched-list' });
      const DAYL = [[1, 'M', 'Monday'], [2, 'T', 'Tuesday'], [3, 'W', 'Wednesday'], [4, 'T', 'Thursday'], [5, 'F', 'Friday']];
      const row = b => {
        const pic = h('button.ed-pic', { type: 'button', title: 'Change picture', 'aria-label': 'Change picture', 'data-act': 'sc-pic' }, fl(b.icon || 'star', 'sc-pic-img'));
        pic.onclick = async () => { const v = await pickPicture({ current: b.icon, allowNone: false }); if (v) { TS.updateBlock(b.id, { icon: v }); pic.innerHTML = ''; pic.append(fl(v, 'sc-pic-img')); } };
        const t = h('input.input.ed-name', { type: 'text', value: b.title, maxlength: 40, 'aria-label': 'Block name', 'data-testid': 'sc-title' });
        t.addEventListener('input', () => TS.updateBlock(b.id, { title: t.value.trim() || 'Block' }));
        const warn = h('small.sc-warn');
        const chk = () => { warn.textContent = b.end <= b.start ? 'Ends before it starts' : ''; };
        const s = h('input.input.time', { type: 'time', value: b.start, 'aria-label': 'Starts', 'data-testid': 'sc-start' });
        const e = h('input.input.time', { type: 'time', value: b.end, 'aria-label': 'Ends', 'data-testid': 'sc-end' });
        s.addEventListener('change', () => { if (s.value) { TS.updateBlock(b.id, { start: s.value }); chk(); } });
        e.addEventListener('change', () => { if (e.value) { TS.updateBlock(b.id, { end: e.value }); chk(); } });
        const days = h('div.sc-days', null, DAYL.map(([n, l, full]) => { const on = b.days.includes(n);
          const d = h('button.sc-day' + (on ? '.on' : ''), { type: 'button', text: l, title: full, 'aria-label': full, 'aria-pressed': String(on), 'data-day': n });
          d.onclick = () => { const cur = TS.T().blocks.find(x => x.id === b.id).days; const nd = cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].sort(); TS.updateBlock(b.id, { days: nd }); d.classList.toggle('on', nd.includes(n)); d.setAttribute('aria-pressed', String(nd.includes(n))); };
          return d; }));
        const del = h('button.icon-btn.sm.danger', { type: 'button', title: 'Delete block', 'aria-label': 'Delete ' + b.title, 'data-act': 'sc-delete', html: '' }, sv('trash'));
        del.onclick = async () => { const n = TS.T().placements.filter(p => p.blockId === b.id).length; if (!n || await confirmDialog('Delete “' + b.title + '”?', `${n} planned lesson${n > 1 ? 's' : ''} in it will move to “Anytime”.`)) { TS.removeBlock(b.id); r.remove(); } };
        chk();
        const r = h('div.ed-row.sc-row', { 'data-block': b.id }, pic, h('div.ed-fields', null, h('div.sc-line', null, t, del), h('div.ed-times', null, s, h('span.dash', { text: '–' }), e, days), warn));
        return r;
      };
      TS.T().blocks.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(b => list.append(row(b)));
      const add = h('button.btn.primary', { type: 'button', 'data-act': 'sc-add' }, sv('plus'), 'Add a block');
      add.onclick = () => { const last = TS.T().blocks.slice().sort((a, b) => a.end.localeCompare(b.end)).pop(); const start = last ? last.end : '08:00'; const [H, M] = start.split(':').map(Number); const em = Math.min(23 * 60 + 59, H * 60 + M + 30); const b = TS.addBlock({ start, end: String(Math.floor(em / 60)).padStart(2, '0') + ':' + String(em % 60).padStart(2, '0') }); const r = row(b); list.append(r); r.scrollIntoView({ block: 'nearest' }); setTimeout(() => { const i = $('input.ed-name', r); i.focus(); i.select(); }, 30); };
      const tts = S.getState().boards.flatMap(bd => bd.widgets.filter(w => w.type === 'timetable' && (w.data.items || []).some(i => i.start && i.end)).map(w => ({ board: bd.name, title: w.data.title || 'Timetable', items: w.data.items.filter(i => i.start && i.end && !i.brk) })));
      const copy = tts.length ? h('button.btn.ghost', { type: 'button', 'data-act': 'sc-copy' }, fl('clipboard', 'btn-fl'), 'Copy from a board timetable') : null;
      if (copy) copy.onclick = () => popMenu(copy, tts.map((t, i) => ({ label: t.board + ' · ' + t.title, act: 'sc-copy-' + i, fn: () => {
        let n = 0; t.items.forEach(it => { if (!TS.T().blocks.some(b => b.title === it.title && b.start === it.start)) { TS.addBlock({ icon: it.icon || 'star', title: it.title, start: it.start, end: it.end }); n++; } });
        list.innerHTML = ''; TS.T().blocks.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(b => list.append(row(b)));
        toast(n ? n + ' block' + (n > 1 ? 's' : '') + ' added from the timetable' : 'Those blocks are already in your schedule');
      } })));
      body.append(h('p.muted.tm-sub', { text: 'Blocks repeat every week on the days you pick. Lessons go into blocks on the planner.' }), list, h('div.row.wrap.sc-acts', null, add, copy));
    }, { icon: 'alarm-clock', cls: 'sched-modal' });
    drawWeek();
  }

  drawTray(); drawWeek();
  return {};
}
