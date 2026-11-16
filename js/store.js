// ─────────────────────────────────────────────────────────────
// Data module: the ONE place boards and widgets are loaded/saved.
// Everything is plain JSON so a Firestore sync layer can be added
// later by writing another adapter with the same load()/save() shape
// (e.g. one doc per board: users/{uid}/boards/{boardId}).
// ─────────────────────────────────────────────────────────────

const KEY = 'classboard.v1';
const SCHEMA = 1;

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/** Default adapter: browser localStorage. */
export const LocalAdapter = {
  name: 'local',
  load() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { console.warn('load failed', e); return null; }
  },
  save(json) {
    try { localStorage.setItem(KEY, JSON.stringify(json)); return true; }
    catch (e) {
      // Quota exceeded is the realistic failure (big uploaded pictures).
      window.dispatchEvent(new CustomEvent('cb:save-error', { detail: e }));
      return false;
    }
  }
};

let adapter = LocalAdapter;
let state = null;
let saveTimer = null;
const listeners = new Set();

export function setAdapter(a) { adapter = a; }
export function getState() { return state; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function emit(reason) { listeners.forEach(fn => fn(reason)); }

/** Board JSON shape */
export function newBoard(name = 'New screen') {
  return { id: uid('b'), name, bg: { type: 'grid', value: 'paper' }, widgets: [], created: Date.now(), updated: Date.now() };
}

/** Widget JSON shape: frame is fractions (0..1) of the stage */
export function newWidget(type, frame, data) {
  return { id: uid('w'), type, x: frame.x, y: frame.y, w: frame.w, h: frame.h, z: frame.z || 1, data: data || {} };
}

export function load(seedFn) {
  const s = adapter.load();
  if (s && s.schema === SCHEMA && Array.isArray(s.boards) && s.boards.length) {
    state = s;
  } else {
    state = { schema: SCHEMA, boards: [], activeBoardId: null, classList: [], myPictures: [], settings: {} };
    if (seedFn) seedFn(state); else state.boards.push(newBoard('My classroom'));
    state.activeBoardId = state.boards[0].id;
    saveNow();
  }
  state.classList = state.classList || [];
  state.myPictures = state.myPictures || [];
  state.settings = state.settings || {};
  if (!state.boards.find(b => b.id === state.activeBoardId)) state.activeBoardId = state.boards[0].id;
  return state;
}

export function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  const b = activeBoard(); if (b) b.updated = Date.now();
  return adapter.save(state);
}
/** Debounced save – call freely after any mutation */
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });

// ── boards ──
export function activeBoard() { return state && state.boards.find(b => b.id === state.activeBoardId); }
export function setActiveBoard(id) { state.activeBoardId = id; saveNow(); emit('board'); }
export function addBoard(name) {
  const b = newBoard(name || nextName());
  state.boards.push(b); state.activeBoardId = b.id; saveNow(); emit('board'); return b;
}
export function renameBoard(id, name) {
  const b = state.boards.find(x => x.id === id); if (!b) return;
  b.name = (name || '').trim().slice(0, 40) || b.name; saveNow(); emit('rename');
}
export function duplicateBoard(id) {
  const src = state.boards.find(x => x.id === id); if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('b'); copy.name = (src.name + ' copy').slice(0, 40); copy.created = Date.now();
  copy.widgets.forEach(w => w.id = uid('w'));
  state.boards.splice(state.boards.indexOf(src) + 1, 0, copy);
  state.activeBoardId = copy.id; saveNow(); emit('board'); return copy;
}
export function deleteBoard(id) {
  if (state.boards.length <= 1) return false;
  const i = state.boards.findIndex(x => x.id === id); if (i < 0) return false;
  state.boards.splice(i, 1);
  if (state.activeBoardId === id) state.activeBoardId = state.boards[Math.max(0, i - 1)].id;
  saveNow(); emit('board'); return true;
}
function nextName() {
  let n = state.boards.length + 1;
  while (state.boards.some(b => b.name === 'Screen ' + n)) n++;
  return 'Screen ' + n;
}
export function setBackground(bg) { const b = activeBoard(); b.bg = bg; saveNow(); emit('bg'); }

// ── widgets ──
export function addWidget(w) { const b = activeBoard(); w.z = topZ() + 1; b.widgets.push(w); saveNow(); return w; }
export function removeWidget(id) { const b = activeBoard(); b.widgets = b.widgets.filter(w => w.id !== id); saveNow(); }
export function getWidget(id) { const b = activeBoard(); return b && b.widgets.find(w => w.id === id); }
export function topZ() { const b = activeBoard(); return b.widgets.reduce((m, w) => Math.max(m, w.z || 0), 0); }
export function bringToFront(id) {
  const b = activeBoard(); const w = getWidget(id); if (!w) return 0;
  if (w.z === topZ() && b.widgets.filter(x => x.z === w.z).length === 1) return w.z;
  w.z = topZ() + 1;
  if (w.z > 5000) { b.widgets.sort((a, c) => a.z - c.z).forEach((x, i) => x.z = i + 1); }
  save(); return w.z;
}

// ── shared class list (INITIALS ONLY) ──
export function sanitizeInitials(text) {
  return String(text || '').split(/[\n,;]+/).map(s => s.toUpperCase().replace(/[^A-Z.\- ]/g, '').replace(/\s+/g, '').slice(0, 5))
    .filter(Boolean);
}
export function setClassList(list) { state.classList = list.slice(0, 60); saveNow(); emit('classlist'); }

export function exportJSON() { return JSON.stringify(state); }
