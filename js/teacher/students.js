// Students: class roster by INITIALS ONLY, daily attendance
// (present / absent / tardy) and an attendance history grid.
import { h, $, $$, toast, confirmDialog, ico } from '../util.js?v=5';
import * as S from '../store.js?v=5';
import * as TS from './tstore.js?v=5';
import { sv, fl, empty, modal, tint, fmtLong, fmtShort, fmtDow } from './ui.js?v=5';

// ─────────────────────────────────────────────────────────────
// PROFILE SEAM. Student records already carry `profile: {}` (synced and
// backed up with everything else). To add profile fields later, list them
// here, e.g. { key: 'pickup', label: 'Picked up by', type: 'text' }, and
// they appear in each student's "Profile" sheet. Deliberately EMPTY for now:
// what profiles should hold (and the privacy rules for it) is not decided,
// so no behavior notes, IEP or goals fields exist yet.
// ─────────────────────────────────────────────────────────────
export const PROFILE_FIELDS = [];

const MARKS = [['P', 'Present', 'here'], ['T', 'Tardy', 'late'], ['A', 'Absent', 'absent']];
// a word like "Emma" or "liam" (3+ letters with lower case after the first) is a name, not initials
const looksLikeName = raw => String(raw).split(/[\s,;.\n-]+/).some(w => /^[A-Za-z][a-z]{2,}$/.test(w));

export function renderStudents(root, app) {
  const st = renderStudents.st || (renderStudents.st = { date: null, end: null });
  const today = TS.todayYmd();
  if (!st.date) st.date = today;
  root.append(h('header.tp-head', null,
    h('div.tp-title', null, fl('student', 'tp-ico'), h('div', null, h('h1', { text: 'Students' }), h('p', { text: 'Initials only – no full names are kept' })))));
  const cols = h('div.su');
  const rosterCard = h('section.tcard.su-roster', { 'data-testid': 'roster' });
  const attCard = h('section.tcard.su-att', { 'data-testid': 'attendance' });
  const histCard = h('section.tcard.su-hist', { 'data-testid': 'history' });
  cols.append(attCard, rosterCard, histCard);
  root.append(cols);

  // ── roster ──
  const inp = h('input.input.su-in', { type: 'text', placeholder: 'Initials only (e.g. JD)', 'aria-label': 'Student initials – initials only', maxlength: 60, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', 'data-testid': 'stu-in', enterkeyhint: 'done' });
  const msg = h('small.hint.su-msg', { text: 'Add one at a time, or several with commas (AB, CD, EF).' });
  const list = h('div.su-list', { 'data-testid': 'stu-list' });
  const add = () => {
    const raw = inp.value; if (!raw.trim()) { inp.focus(); return; }
    const vals = S.sanitizeInitials(raw);
    if (looksLikeName(raw)) { msg.textContent = 'That looks like a name. Please use initials only (e.g. JD).'; msg.classList.add('warn'); inp.select(); return; }
    const have = new Set(TS.T().students.map(s => s.initials));
    let n = 0, dup = 0; vals.forEach(v => { if (have.has(v)) dup++; else { TS.addStudent(v); have.add(v); n++; } });
    msg.classList.toggle('warn', !n);
    msg.textContent = n ? `${n} added.` + (dup ? ` ${dup} already on the list.` : '') : dup ? 'Already on the list. Add a number to tell twins apart (JD2).' : 'Please type initials (letters only).';
    inp.value = ''; drawRoster(); drawAtt(); drawHist();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  inp.addEventListener('input', () => { msg.classList.remove('warn'); });
  const toBoard = h('button.btn.sm.ghost', { type: 'button', 'data-act': 'stu-to-board', title: 'Use this roster in the Name picker and Groups widgets', onclick: () => { const ros = TS.roster().map(s => s.initials); S.setClassList(ros); toast('Name picker & Groups now use your ' + ros.length + ' students'); } }, fl('dice', 'btn-fl'), 'Use on the board');
  rosterCard.append(h('header.td-card-h', null, fl('group', 'td-card-ico'), h('h2', { text: 'Class roster' }), h('span.td-count', { 'data-testid': 'stu-count' }), h('span.ls-gap'), toBoard),
    h('div.td-add', null, inp, h('button.btn.primary', { type: 'button', 'data-act': 'stu-add', onclick: add }, sv('plus'), 'Add')), msg, list);
  function avatar(s, cls = 'su-av') { const [bg, fg] = tint(s.initials); return h('span.' + cls, { text: s.initials, style: { background: bg, color: fg } }); }
  function drawRoster() {
    list.innerHTML = '';
    const ros = TS.roster();
    $('[data-testid=stu-count]', rosterCard).textContent = String(ros.length);
    toBoard.hidden = !ros.length;
    if (!ros.length) { list.append(empty('student', 'No students yet', 'Type each child’s initials above.')); return; }
    ros.forEach(s => {
      const edit = h('button.icon-btn.sm', { type: 'button', title: 'Change initials', 'aria-label': 'Change initials for ' + s.initials, 'data-act': 'stu-edit', html: ico.pencil });
      edit.onclick = () => {
        const i = h('input.input.su-edit', { type: 'text', value: s.initials, maxlength: 5, 'aria-label': 'Initials', autocapitalize: 'characters' });
        row.querySelector('.su-name').replaceWith(i); i.focus(); i.select();
        const fin = ok => { const v = S.sanitizeInitials(i.value)[0]; if (ok && v && !looksLikeName(i.value) && !TS.T().students.some(x => x.id !== s.id && x.initials === v)) TS.updateStudent(s.id, { initials: v }); else if (ok && v && v !== s.initials) toast(looksLikeName(i.value) ? 'Initials only, please.' : 'Those initials are already on the list.', 'err'); drawRoster(); drawAtt(); drawHist(); };
        i.addEventListener('keydown', e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') { e.stopPropagation(); fin(false); } });
        i.addEventListener('blur', () => fin(true));
      };
      const del = h('button.icon-btn.sm.danger', { type: 'button', title: 'Remove', 'aria-label': 'Remove ' + s.initials, 'data-act': 'stu-delete', html: ico.trash, onclick: async () => { if (await confirmDialog('Remove ' + s.initials + '?', 'Their attendance history is removed too.', 'Remove')) { TS.removeStudent(s.id); drawRoster(); drawAtt(); drawHist(); } } });
      const prof = PROFILE_FIELDS.length ? h('button.btn.sm.ghost', { type: 'button', text: 'Profile', 'data-act': 'stu-profile', onclick: () => profileSheet(s) }) : null;
      const row = h('div.su-row', { 'data-stu': s.id }, avatar(s), h('b.su-name', { text: s.initials }), h('span.ls-gap'), prof, edit, del);
      list.append(row);
    });
  }
  function profileSheet(s) { // only reachable once PROFILE_FIELDS has entries
    modal(s.initials, body => {
      PROFILE_FIELDS.forEach(f => { const i = h(f.type === 'long' ? 'textarea.input' : 'input.input', { 'aria-label': f.label }); i.value = s.profile[f.key] || ''; i.addEventListener('input', () => TS.updateStudent(s.id, { profile: Object.assign({}, s.profile, { [f.key]: i.value }) })); body.append(h('div.field', null, h('label.flabel', { text: f.label }), i)); });
    }, { icon: 'student' });
  }

  // ── attendance for one day ──
  function drawAtt() {
    attCard.innerHTML = '';
    const d = st.date, att = TS.T().attendance[d] || {}, ros = TS.roster();
    const dateIn = h('input.input.su-date', { type: 'date', value: d, 'aria-label': 'Attendance date', 'data-testid': 'att-date' });
    dateIn.addEventListener('change', () => { if (dateIn.value) { st.date = dateIn.value; drawAtt(); } });
    const step = n => { let x = TS.addDays(st.date, n); for (let i = 0; i < 10 && TS.isWeekend(x); i++) x = TS.addDays(x, n); st.date = x; drawAtt(); };
    attCard.append(h('header.td-card-h', null, fl('check', 'td-card-ico'), h('h2', { text: 'Attendance' }), h('span.ls-gap'),
      h('div.su-nav', null, h('button.icon-btn.sm.soft', { type: 'button', 'aria-label': 'Previous day', 'data-act': 'att-prev', onclick: () => step(-1) }, sv('left')), dateIn, h('button.icon-btn.sm.soft', { type: 'button', 'aria-label': 'Next day', 'data-act': 'att-next', onclick: () => step(1) }, sv('right')),
        d !== today ? h('button.btn.sm.ghost', { type: 'button', text: 'Today', 'data-act': 'att-today', onclick: () => { st.date = today; drawAtt(); } }) : null)));
    attCard.append(h('p.su-day', { 'data-testid': 'att-day' }, h('b', { text: d === today ? 'Today · ' + fmtLong(d) : fmtLong(d) }), TS.isDayOff(d) ? h('span.t-pill.off', { text: TS.T().daysOff[d].reason }) : TS.isWeekend(d) ? h('span.t-pill.off', { text: 'Weekend' }) : null));
    if (!ros.length) { attCard.append(empty('student', 'Add your students first', 'Use the class roster to add initials.')); return; }
    const c = k => ros.filter(s => att[s.id] === k).length;
    const sum = h('div.su-sum', { 'data-testid': 'att-sum' }, MARKS.map(([k, l]) => h('span.su-sum-' + k, null, h('b', { text: String(c(k)) }), h('small', { text: l }))), h('span.su-sum-U', null, h('b', { text: String(ros.length - c('P') - c('T') - c('A')) }), h('small', { text: 'Not marked' })));
    const all = h('button.btn.sm', { type: 'button', 'data-act': 'att-all', onclick: () => { ros.forEach(s => { if (!att[s.id]) TS.setAttendance(d, s.id, 'P'); }); drawAtt(); drawHist(); } }, fl('thumbs-up', 'btn-fl'), 'Everyone else is here');
    const grid = h('div.su-marks');
    ros.forEach(s => {
      const cur = att[s.id] || '';
      grid.append(h('div.su-mrow' + (cur ? '.m-' + cur : ''), { 'data-stu': s.id }, avatar(s), h('b.su-name', { text: s.initials }), h('span.ls-gap'),
        h('div.su-seg', { role: 'radiogroup', 'aria-label': 'Attendance for ' + s.initials }, MARKS.map(([k, l]) => h('button.su-m.m-' + k + (cur === k ? '.on' : ''), { type: 'button', 'data-mark': k, 'aria-pressed': String(cur === k), title: l,
          onclick: () => { TS.setAttendance(d, s.id, cur === k ? '' : k); drawAtt(); drawHist(); } }, h('span', { text: l }))))));
    });
    attCard.append(h('div.su-tools', null, sum, all), grid);
  }

  // ── history: the last 10 school days up to `end` ──
  function drawHist() {
    histCard.innerHTML = '';
    const end = st.end || today;
    const days = TS.prevSchoolDays(TS.isSchoolDay(end) ? end : TS.prevSchoolDays(end, 1)[0] || end, 10);
    histCard.append(h('header.td-card-h', null, fl('calendar', 'td-card-ico'), h('h2', { text: 'Attendance history' }), h('span.ls-gap'),
      h('div.su-nav', null, h('button.icon-btn.sm.soft', { type: 'button', 'aria-label': 'Earlier days', 'data-act': 'hist-prev', onclick: () => { st.end = TS.addDays(days[0], -1); drawHist(); } }, sv('left')),
        h('small.su-range', { text: days.length ? fmtShort(days[0]) + ' – ' + fmtShort(days[days.length - 1]) : '' }),
        h('button.icon-btn.sm.soft', { type: 'button', 'aria-label': 'Later days', 'data-act': 'hist-next', disabled: days[days.length - 1] >= today, onclick: () => { let e = days[days.length - 1]; for (let k = 0, i = 0; k < 10 && i < 60; i++) { e = TS.addDays(e, 1); if (TS.isSchoolDay(e)) k++; } st.end = e >= today ? null : e; drawHist(); } }, sv('right')))));
    const ros = TS.roster();
    if (!ros.length) { histCard.append(empty('calendar', 'No history yet', 'Attendance you take shows up here.')); return; }
    const A = TS.T().attendance;
    const tbl = h('table.su-tbl', { 'data-testid': 'hist-table' });
    tbl.append(h('thead', null, h('tr', null, h('th', { text: '' }), days.map(d => h('th' + (d === today ? '.today' : ''), null, h('small', { text: fmtDow(d) }), h('span', { text: fmtShort(d).split(' ')[1] }))), h('th.tot', { text: 'Here' }), h('th.tot', { text: 'Absent' }), h('th.tot', { text: 'Tardy' }))));
    const tb = h('tbody');
    ros.forEach(s => {
      let p = 0, a = 0, t = 0;
      const cells = days.map(d => { const m = (A[d] || {})[s.id] || ''; if (m === 'P') p++; if (m === 'A') a++; if (m === 'T') t++; return h('td', null, m ? h('span.su-cell.m-' + m, { text: m, title: MARKS.find(x => x[0] === m)[1] }) : h('span.su-cell.none', { text: '·' })); });
      tb.append(h('tr', { 'data-stu': s.id }, h('th.su-tname', { text: s.initials }), cells, h('td.tot', { text: String(p + t) }), h('td.tot', { text: String(a) }), h('td.tot', { text: String(t) })));
    });
    tbl.append(tb);
    histCard.append(h('div.su-tbl-wrap', null, tbl), h('small.hint', { text: 'P present · T tardy (counts as here) · A absent. Weekends and days off are skipped.' }));
  }
  drawRoster(); drawAtt(); drawHist();
}
