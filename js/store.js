// ─────────────────────────────────────────────────────────────
// Data module: the ONE place boards and widgets are loaded/saved.
// Everything is plain JSON so a Firestore sync layer can be added
// later by writing another adapter with the same load()/save() shape
// (e.g. one doc per board: users/{uid}/boards/{boardId}).
// ─────────────────────────────────────────────────────────────

const KEY = 'classboard.v1';
const SCHEMA = 1;

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/** A localStorage adapter for one key (boards use KEY, the teacher side its own key). */
export function makeLocalAdapter(key) {
  return {
    name: 'local',
    load() {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch (e) { console.warn('load failed', e); return null; }
    },
    save(json) {
      try { localStorage.setItem(key, JSON.stringify(json)); return true; }
      catch (e) {
        // Quota exceeded is the realistic failure (big uploaded pictures).
        window.dispatchEvent(new CustomEvent('cb:save-error', { detail: e }));
        return false;
      }
    }
  };
}
/** Default adapter: browser localStorage. */
export const LocalAdapter = makeLocalAdapter(KEY);

let adapter = LocalAdapter;
let state = null;
let saveTimer = null;
const listeners = new Set();

export function setAdapter(a) { adapter = a; }
export const getAdapter = () => adapter;
/** Set by the shared-classroom module: env.cloud = this device is showing a shared classroom. */
export const env = { cloud: false };
/**
 * Apply changes that came from the shared classroom. fn(state) mutates the
 * state and returns the ids of boards it touched. No undo step is made; the
 * touched screens lose their undo history (it would undo the other person's edit).
 */
export function remoteUpdate(fn) {
  if (!state) return;
  const info = fn(state) || {};
  const boards = info.boards || new Set();
  boards.forEach(id => hist.delete(id));
  if (!state.boards.length) state.boards.push(newBoard('My classroom'));
  info.activeGone = !state.boards.find(b => b.id === state.activeBoardId);
  if (info.activeGone) state.activeBoardId = state.boards[0].id;
  adapter.save(state);
  if (boards.has(state.activeBoardId) || info.activeGone) record();
  emit('remote', info);
  if (info.classList) emit('classlist');
}
export function getState() { return state; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function emit(reason, info) { listeners.forEach(fn => fn(reason, info)); }

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
  record();
  return state;
}

export function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  const b = activeBoard(); if (b) b.updated = Date.now();
  record();
  return adapter.save(state);
}
/** Write any pending debounced save right now. */
export function flush() { if (saveTimer) saveNow(); }
/** Debounced save – call freely after any mutation */
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });

// ── boards ──
export function activeBoard() { return state && state.boards.find(b => b.id === state.activeBoardId); }
export function setActiveBoard(id) { flush(); state.activeBoardId = id; saveNow(); emit('board'); }
export function addBoard(name) {
  flush();
  const b = newBoard(name || nextName());
  state.boards.push(b); state.activeBoardId = b.id; saveNow(); emit('board'); return b;
}
export function renameBoard(id, name) {
  const b = state.boards.find(x => x.id === id); if (!b) return;
  b.name = (name || '').trim().slice(0, 40) || b.name; saveNow(); emit('rename');
}
export function duplicateBoard(id) {
  const src = state.boards.find(x => x.id === id); if (!src) return;
  flush();
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('b'); copy.name = (src.name + ' copy').slice(0, 40); copy.created = Date.now();
  copy.widgets.forEach(w => { const old = w.id; w.id = uid('w'); blobs.copyPrefix(old, w.id); });
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
export function setBackground(bg) { flush(); const b = activeBoard(); b.bg = bg; saveNow(); emit('bg'); }

// ── widgets ──
export function addWidget(w) { flush(); const b = activeBoard(); w.z = topZ() + 1; b.widgets.push(w); saveNow(); return w; }
export function removeWidget(id) { flush(); const b = activeBoard(); b.widgets = b.widgets.filter(w => w.id !== id); saveNow(); }
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

// ─────────────────────────────────────────────────────────────
// Board undo / redo: snapshot history of each screen (in memory only).
// Every mutation already funnels through saveNow(), so record() compares
// the screen with its last snapshot and pushes the old one when it changed.
// z-order and each widget type's `transient` keys (a running timer, the
// dice faces showing) are ignored so they never make an undo step.
// ─────────────────────────────────────────────────────────────
const HIST_MAX = 50;
const hist = new Map(); // boardId -> { undo: [], redo: [], cur }
let transient = {};      // widget type -> [data keys]
let recording = true;
export function setTransient(map) { transient = map || {}; }
function snapOf(b) {
  const s = JSON.stringify({ bg: b.bg, widgets: b.widgets });
  const g = JSON.stringify({ bg: b.bg, widgets: b.widgets.map(w => {
    const d = Object.assign({}, w.data); (transient[w.type] || []).forEach(k => delete d[k]);
    return [w.id, w.type, +w.x.toFixed(5), +w.y.toFixed(5), +w.w.toFixed(5), +w.h.toFixed(5), d];
  }) });
  return { s, g };
}
function record() {
  const b = activeBoard(); if (!b || !recording) return;
  const cur = snapOf(b), H = hist.get(b.id);
  if (!H) { hist.set(b.id, { undo: [], redo: [], cur }); emit('history'); return; }
  if (cur.g === H.cur.g) { H.cur = cur; return; }
  H.undo.push(H.cur); if (H.undo.length > HIST_MAX) H.undo.shift();
  H.redo = []; H.cur = cur; emit('history');
}
/** Take the current screen as the new baseline without adding a step (after mounting). */
export function rebase() { const b = activeBoard(); const H = b && hist.get(b.id); if (H) H.cur = snapOf(b); else record(); }
export function canUndo() { const b = activeBoard(); const H = b && hist.get(b.id); return !!(H && (H.undo.length || saveTimer)); }
export function canRedo() { const b = activeBoard(); const H = b && hist.get(b.id); return !!(H && H.redo.length && !saveTimer); }
function applySnap(b, snap) {
  const o = JSON.parse(snap.s), now = new Map(b.widgets.map(w => [w.id, w]));
  const settled = w => { const d = Object.assign({}, w.data); (transient[w.type] || []).forEach(k => delete d[k]); return JSON.stringify(d); };
  // A widget whose own settings are not part of this step keeps what it is doing now
  // (a running timer keeps running); one whose settings change comes back whole.
  o.widgets.forEach(w => { const c = now.get(w.id); if (c && settled(c) === settled(w)) (transient[w.type] || []).forEach(k => { if (k in c.data) w.data[k] = c.data[k]; else delete w.data[k]; }); });
  b.bg = o.bg; b.widgets = o.widgets;
}
function step(dir) {
  flush();
  const b = activeBoard(); const H = b && hist.get(b.id); if (!H) return false;
  const from = dir < 0 ? H.undo : H.redo, to = dir < 0 ? H.redo : H.undo;
  if (!from.length) return false;
  const snap = from.pop(); to.push(H.cur);
  applySnap(b, snap);
  recording = false; saveNow(); recording = true;
  H.cur = snapOf(b);
  emit('history-apply'); emit('history');
  return true;
}
export const undo = () => step(-1);
export const redo = () => step(1);

// ─────────────────────────────────────────────────────────────
// Blob store: big things (PDF files, drawings, PDF notes) live in
// IndexedDB instead of localStorage (which tops out around 5 MB).
// Keys are "<widgetId>:<name>", so a widget's blobs can be copied with
// its screen and cleaned up when the widget is gone. Swappable like the
// board adapter: anything with get/put/del/keys works (e.g. Firebase Storage).
// ─────────────────────────────────────────────────────────────
const DB = 'classboard', OS = 'blobs';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(new Error('indexedDB open failed: ' + (r.error && r.error.message)));
    r.onblocked = () => rej(new Error('indexedDB blocked'));
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(OS, mode), os = t.objectStore(OS); let out;
    const r = fn(os); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  }));
}
export const IDBBlobAdapter = {
  name: 'indexeddb',
  get: k => tx('readonly', os => os.get(k)),
  put: (k, v) => tx('readwrite', os => os.put(v, k)),
  del: k => tx('readwrite', os => os.delete(k)),
  keys: () => tx('readonly', os => os.getAllKeys())
};
/** Fallback when IndexedDB is unavailable (some private-browsing modes): memory only. */
export const MemoryBlobAdapter = (() => { const m = new Map(); return {
  name: 'memory', get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, keys: async () => [...m.keys()] }; })();
let blobAdapter = IDBBlobAdapter;
export function setBlobAdapter(a) { blobAdapter = a; }
const safe = (fn, fb) => (...a) => fn(...a).catch(e => {
  if (blobAdapter === IDBBlobAdapter && /indexedDB/.test(e && e.message || '')) { blobAdapter = MemoryBlobAdapter; window.dispatchEvent(new CustomEvent('cb:blob-fallback')); return fn(...a); }
  throw e;
});
let pending = Promise.resolve(); // copies in flight (duplicate screen) finish before reads
export const blobs = {
  get: safe(k => pending.then(() => blobAdapter.get(k))),
  put: safe((k, v) => blobAdapter.put(k, v)),
  del: safe(k => blobAdapter.del(k)),
  keys: safe(() => blobAdapter.keys()),
  copyPrefix(from, to) {
    const run = async () => {
      try { for (const k of await blobs.keys()) if (String(k).startsWith(from + ':')) await blobAdapter.put(to + String(k).slice(from.length), await blobAdapter.get(k)); }
      catch (e) { console.warn('blob copy failed', e); }
    };
    pending = pending.then(run); return pending;
  },
  /** Remove blobs whose widget no longer exists on any screen (run at start-up). */
  async gc() {
    try {
      // widgets of every board set kept on this device (this device's own + any shared classroom)
      const ids = new Set(state.boards.flatMap(b => b.widgets.map(w => w.id)));
      for (let i = 0; i < localStorage.length; i++) {
        const lk = localStorage.key(i); if (!lk || !lk.startsWith(KEY)) continue;
        try { (JSON.parse(localStorage.getItem(lk)).boards || []).forEach(b => (b.widgets || []).forEach(w => ids.add(w.id))); } catch (e) { }
      }
      const a = blobAdapter;
      const ks = a.localKeys ? await a.localKeys() : await blobs.keys();
      for (const k of ks) {
        if (String(k).startsWith('teacher/')) continue; // teacher library files are not widget blobs
        const id = String(k).split(':')[0]; if (!ids.has(id)) await (a.evict ? a.evict(k) : blobs.del(k));
      }
    } catch (e) { console.warn('blob gc skipped', e); }
  }
};
