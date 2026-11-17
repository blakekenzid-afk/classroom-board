// ─────────────────────────────────────────────────────────────
// Teacher data: schedule, planner, lessons, library, to-dos,
// reminders, students and attendance. Same rules as store.js:
//  • plain JSON loaded/saved through a swappable adapter
//    (default: localStorage key "classboard.teacher.v1");
//  • big files (library PDFs/pictures) go to the shared blob store
//    (IndexedDB) under keys "teacher/<resourceId>:file".
//
// Built to sync later: every record has a stable string id and an
// `updated` timestamp, deletions leave a tombstone in `deleted`
// ({id: time}), and each top-level array maps 1:1 to a Firestore
// collection, e.g. users/{uid}/teacher/lessons/{lessonId}.
// Keyed maps (daysOff, attendance) map to one doc per date.
// ─────────────────────────────────────────────────────────────
import { uid, blobs, makeLocalAdapter } from '../store.js?v=6';

export const TKEY = 'classboard.teacher.v1';
export const TSCHEMA = 1;
export const FILE_MAX = 25 * 1024 * 1024; // same 25 MB limit as the PDF widget's "big file" line

let adapter = makeLocalAdapter(TKEY);
let state = null, saveTimer = null;
const listeners = new Set();
export function setTeacherAdapter(a) { adapter = a; }
/** Apply changes from the shared classroom (fn mutates the state in place). */
export function remoteUpdateT(fn) { if (!state) return; fn(state); normalize(state); adapter.save(state); emit('remote'); }
export function T() { return state; }
export function onT(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }

// ── dates (always the device's local calendar day, never UTC) ──
const p2 = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayYmd = () => ymd(new Date());
export const dowOf = s => parseYmd(s).getDay(); // 0 Sun … 6 Sat
export const weekStart = s => { const d = parseYmd(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); };
export const isWeekend = s => { const w = dowOf(s); return w === 0 || w === 6; };
export const isDayOff = s => !!(state.daysOff[s]);
export const isSchoolDay = s => !isWeekend(s) && !isDayOff(s);
export function nextSchoolDay(s) { let d = addDays(s, 1); for (let i = 0; i < 400 && !isSchoolDay(d); i++) d = addDays(d, 1); return d; }
export function prevSchoolDays(end, n) { const out = []; let d = end; for (let i = 0; out.length < n && i < 800; i++) { if (isSchoolDay(d)) out.unshift(d); d = addDays(d, -1); } return out; }

function seed() {
  const b = (icon, title, start, end) => ({ id: uid('blk'), icon, title, start, end, days: [1, 2, 3, 4, 5], updated: Date.now() });
  return {
    schema: TSCHEMA, kind: 'teacher', updated: Date.now(), settings: {},
    blocks: [b('wave', 'Arrival & breakfast', '07:50', '08:15'), b('group', 'Circle time', '08:15', '08:35'), b('puzzle', 'Centers', '08:35', '09:20'),
      b('apple', 'Snack', '09:30', '09:45'), b('open-book', 'Story time', '10:20', '10:40'), b('palette', 'Art', '10:40', '11:05'),
      b('plate', 'Lunch', '11:05', '11:35'), b('bed', 'Rest time', '11:35', '12:15'), b('music', 'Music & movement', '12:15', '12:45')],
    lessons: [], placements: [], daysOff: {}, resources: [], todos: [], reminders: [], students: [], attendance: {}, deleted: {}
  };
}
export function normalize(s) {
  const base = seed();
  for (const k of ['blocks', 'lessons', 'placements', 'resources', 'todos', 'reminders', 'students']) if (!Array.isArray(s[k])) s[k] = k === 'blocks' ? base.blocks : [];
  for (const k of ['daysOff', 'attendance', 'deleted', 'settings']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  s.schema = TSCHEMA; s.kind = 'teacher';
  s.lessons.forEach(l => { l.tags = Array.isArray(l.tags) ? l.tags : []; l.resources = Array.isArray(l.resources) ? l.resources : []; l.html = l.html || ''; l.objectives = l.objectives || ''; l.materials = l.materials || ''; });
  s.resources.forEach(r => { r.labels = Array.isArray(r.labels) ? r.labels : []; r.folder = r.folder || ''; });
  s.students.forEach(st => { st.profile = st.profile && typeof st.profile === 'object' ? st.profile : {}; if (st.active === undefined) st.active = true; });
  s.blocks.forEach(b => { b.days = Array.isArray(b.days) ? b.days : [1, 2, 3, 4, 5]; });
  return s;
}
export function loadT() {
  const s = adapter.load();
  state = s && s.kind === 'teacher' ? normalize(s) : seed();
  if (!s) saveNowT();
  return state;
}
export function saveNowT() { clearTimeout(saveTimer); saveTimer = null; state.updated = Date.now(); return adapter.save(state); }
export function saveT(what) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNowT, 300); if (what) emit(what); }
export function flushT() { if (saveTimer) saveNowT(); }
window.addEventListener('beforeunload', flushT);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushT(); });

const touch = o => { o.updated = Date.now(); return o; };
const tomb = id => { state.deleted[id] = Date.now(); };
const byId = (arr, id) => state[arr].find(x => x.id === id);

// ── schedule blocks (weekly repeating, days 1=Mon … 5=Fri) ──
export const blocksFor = date => { const w = dowOf(date); return state.blocks.filter(b => b.days.includes(w)).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)); };
export function addBlock(o) { const b = touch(Object.assign({ id: uid('blk'), icon: 'star', title: 'New block', start: '09:00', end: '09:30', days: [1, 2, 3, 4, 5] }, o)); state.blocks.push(b); saveT('blocks'); return b; }
export function updateBlock(id, patch) { const b = byId('blocks', id); if (!b) return; Object.assign(b, patch); touch(b); saveT('blocks'); return b; }
export function removeBlock(id) {
  state.blocks = state.blocks.filter(b => b.id !== id); tomb(id);
  state.placements.forEach(p => { if (p.blockId === id) { p.blockId = null; touch(p); } });
  saveT('blocks');
}

// ── lessons ──
export function addLesson(o) {
  const l = touch(Object.assign({ id: uid('les'), title: 'Untitled lesson', html: '', tags: [], objectives: '', materials: '', resources: [], created: Date.now() }, o));
  state.lessons.unshift(l); saveT('lessons'); return l;
}
export const getLesson = id => byId('lessons', id);
export function updateLesson(id, patch, quiet) { const l = byId('lessons', id); if (!l) return; Object.assign(l, patch); touch(l); saveT(quiet ? null : 'lessons'); return l; }
export function duplicateLesson(id) {
  const src = byId('lessons', id); if (!src) return;
  const c = JSON.parse(JSON.stringify(src)); c.id = uid('les'); c.title = (src.title + ' (copy)').slice(0, 120); c.created = Date.now(); touch(c);
  state.lessons.splice(state.lessons.indexOf(src), 0, c); saveT('lessons'); return c;
}
export function removeLesson(id) {
  state.lessons = state.lessons.filter(l => l.id !== id); tomb(id);
  state.placements.filter(p => p.lessonId === id).forEach(p => tomb(p.id));
  state.placements = state.placements.filter(p => p.lessonId !== id);
  saveT('lessons');
}
export const allTags = () => [...new Set(state.lessons.flatMap(l => l.tags))].sort((a, b) => a.localeCompare(b));

// ── planner placements: a lesson on a date, in a block (or "anytime" = null) ──
export function placementsOn(date, blockId) { return state.placements.filter(p => p.date === date && (blockId === undefined || (p.blockId || null) === (blockId || null))).sort((a, b) => (a.order || 0) - (b.order || 0)); }
export function placeLesson(lessonId, date, blockId) {
  const p = touch({ id: uid('pl'), lessonId, date, blockId: blockId || null, order: Date.now() });
  state.placements.push(p); saveT('plan'); return p;
}
export function movePlacement(id, date, blockId) { const p = byId('placements', id); if (!p) return; Object.assign(p, { date, blockId: blockId || null, order: Date.now() }); touch(p); saveT('plan'); return p; }
export function removePlacement(id) { state.placements = state.placements.filter(p => p.id !== id); tomb(id); saveT('plan'); }
/** Keep the block when the new day has it, otherwise the lesson goes to "Anytime". */
function fitBlock(blockId, date) { const b = blockId && byId('blocks', blockId); return b && b.days.includes(dowOf(date)) ? blockId : null; }
/**
 * Snow-day bump: every lesson planned on `date` or later moves forward one
 * school day (skipping weekends and days off). Returns how many moved.
 */
export function bumpFrom(date) {
  const moving = state.placements.filter(p => p.date >= date).sort((a, b) => b.date.localeCompare(a.date));
  const map = new Map(); // compute targets before changing anything
  moving.forEach(p => map.set(p.id, nextSchoolDay(p.date)));
  moving.forEach(p => { p.date = map.get(p.id); p.blockId = fitBlock(p.blockId, p.date); touch(p); });
  saveT('plan'); return moving.length;
}
export function setDayOff(date, reason) {
  if (reason) state.daysOff[date] = { reason: String(reason).slice(0, 40), updated: Date.now() };
  else { delete state.daysOff[date]; tomb('off:' + date); }
  saveT('plan');
}

// ── resources (library) ──
export const blobKey = id => 'teacher/' + id + ':file';
export function addResource(o) {
  const r = touch(Object.assign({ id: uid('res'), kind: 'link', title: 'Resource', url: '', file: null, folder: '', labels: [], created: Date.now() }, o));
  state.resources.unshift(r); saveT('resources'); return r;
}
export const getResource = id => byId('resources', id);
export function updateResource(id, patch) { const r = byId('resources', id); if (!r) return; Object.assign(r, patch); touch(r); saveT('resources'); return r; }
export async function removeResource(id) {
  const r = byId('resources', id);
  state.resources = state.resources.filter(x => x.id !== id); tomb(id);
  state.lessons.forEach(l => { if (l.resources.includes(id)) { l.resources = l.resources.filter(x => x !== id); touch(l); } });
  saveT('resources');
  if (r && r.file) try { await blobs.del(blobKey(id)); } catch (e) { console.warn(e); }
}
export const allFolders = () => [...new Set(state.resources.map(r => r.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b));
export const allLabels = () => [...new Set(state.resources.flatMap(r => r.labels))].sort((a, b) => a.localeCompare(b));

// ── to-dos & reminders ──
export function addTodo(text, due) { const t = touch({ id: uid('td'), text: String(text).slice(0, 200), done: false, due: due || '', created: Date.now() }); state.todos.unshift(t); saveT('todos'); return t; }
export function updateTodo(id, patch) { const t = byId('todos', id); if (!t) return; Object.assign(t, patch); touch(t); saveT('todos'); }
export function removeTodo(id) { state.todos = state.todos.filter(t => t.id !== id); tomb(id); saveT('todos'); }
export function addReminder(text, date, time) { const r = touch({ id: uid('rm'), text: String(text).slice(0, 200), date, time, done: false, snooze: 0, created: Date.now() }); state.reminders.push(r); saveT('reminders'); return r; }
export function updateReminder(id, patch) { const r = byId('reminders', id); if (!r) return; Object.assign(r, patch); touch(r); saveT('reminders'); }
export function removeReminder(id) { state.reminders = state.reminders.filter(r => r.id !== id); tomb(id); saveT('reminders'); }
export const reminderAt = r => { const d = parseYmd(r.date); const [H, M] = (r.time || '00:00').split(':').map(Number); d.setHours(H, M, 0, 0); return d.getTime(); };
/** Reminders that should show a notice right now. */
export const dueReminders = (now = Date.now()) => state.reminders.filter(r => !r.done && reminderAt(r) <= now && (r.snooze || 0) <= now);

// ── students (INITIALS ONLY) & attendance ──
export function addStudent(initials) { const s = touch({ id: uid('stu'), initials, active: true, profile: {}, created: Date.now() }); state.students.push(s); saveT('students'); return s; }
export function updateStudent(id, patch) { const s = byId('students', id); if (!s) return; Object.assign(s, patch); touch(s); saveT('students'); }
export function removeStudent(id) {
  state.students = state.students.filter(s => s.id !== id); tomb(id);
  Object.values(state.attendance).forEach(day => { delete day[id]; });
  saveT('students');
}
export const roster = () => state.students.filter(s => s.active);
export function setAttendance(date, studentId, mark) {
  const day = state.attendance[date] || (state.attendance[date] = {});
  if (mark) day[studentId] = mark; else delete day[studentId];
  if (!Object.keys(day).length) delete state.attendance[date];
  saveT('attendance');
}

// ── backup: all teacher data + library files in one JSON file ──
const toB64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = b => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
export async function exportBackup() {
  flushT();
  const files = {};
  for (const r of state.resources) if (r.file) {
    try { const buf = await blobs.get(blobKey(r.id)); if (buf) files[r.id] = toB64(buf); } catch (e) { console.warn('backup: file skipped', r.id, e); }
  }
  return JSON.stringify({ app: 'classroom-board', kind: 'teacher-backup', version: 1, exported: new Date().toISOString(), data: state, files });
}
export function readBackup(text) {
  let o; try { o = JSON.parse(text); } catch (e) { throw new Error('That file is not a Classroom Board backup.'); }
  if (!o || o.kind !== 'teacher-backup' || !o.data || o.data.kind !== 'teacher') throw new Error('That file is not a Classroom Board teacher backup.');
  return o;
}
export async function importBackup(o) {
  const old = state.resources.filter(r => r.file).map(r => r.id);
  state = normalize(o.data);
  for (const [id, b64] of Object.entries(o.files || {})) await blobs.put(blobKey(id), fromB64(b64));
  for (const id of old) if (!state.resources.some(r => r.id === id && r.file)) { try { await blobs.del(blobKey(id)); } catch (e) { } }
  saveNowT(); emit('all');
  return state;
}
export async function saveFileFor(id, file) { await blobs.put(blobKey(id), await file.arrayBuffer()); }
