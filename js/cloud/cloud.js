// ─────────────────────────────────────────────────────────────
// Shared classroom: sign-in, the classroom you belong to, and live sync of
// the board + teacher side through Firestore (free Spark plan).
//
// Signed out (or no Firebase config): nothing here loads; the app works on
// this device exactly as before (localStorage keys classboard.v1 / .teacher.v1).
// In a classroom: the app keeps the class's data in its own local keys
// (classboard.v1@<cid>, classboard.teacher.v1@<cid>) so it opens instantly and
// works offline, and RecordSync keeps those in step with Firestore.
// ─────────────────────────────────────────────────────────────
import { activeConfig } from './config.js?v=6';
import { RecordSync } from './sync.js?v=6';
import { makeCloudBlobs } from './files.js?v=6';
import * as S from '../store.js?v=6';
import * as TS from '../teacher/tstore.js?v=6';

const MEM = 'classboard.cloud';
export const bKey = cid => 'classboard.v1@' + cid;
export const tKey = cid => 'classboard.teacher.v1@' + cid;
const TEACHER_ARRAYS = ['blocks', 'lessons', 'placements', 'resources', 'todos', 'reminders', 'students'];
const NEWEST_FIRST = new Set(['lessons', 'resources', 'todos']);

export const cloud = {
  cfg: null, mode: 'local', mem: null, user: undefined, fb: null, sync: {}, files: null,
  members: [], classDoc: null, live: false, listeners: new Set()
};
const emit = () => cloud.listeners.forEach(fn => { try { fn(cloud); } catch (e) { console.error(e); } });
export const onCloud = fn => { cloud.listeners.add(fn); return () => cloud.listeners.delete(fn); };

export function readMem() { try { return JSON.parse(localStorage.getItem(MEM) || 'null'); } catch (e) { return null; } }
export function writeMem(m) { try { if (m) localStorage.setItem(MEM, JSON.stringify(m)); else localStorage.removeItem(MEM); } catch (e) { } cloud.mem = m; }

// ── Firebase SDK (vendored, loaded only when the cloud is used) ──
let sdkP = null;
export function sdk() {
  if (sdkP) return sdkP;
  sdkP = (async () => {
    const [A, Au, F] = await Promise.all([
      import('../vendor/firebase/firebase-app.js'), import('../vendor/firebase/firebase-auth.js'), import('../vendor/firebase/firebase-firestore.js')]);
    const app = A.initializeApp(cloud.cfg.config);
    let auth;
    try { auth = Au.initializeAuth(app, { persistence: [Au.indexedDBLocalPersistence, Au.browserLocalPersistence, Au.inMemoryPersistence], popupRedirectResolver: Au.browserPopupRedirectResolver }); }
    catch (e) { auth = Au.getAuth(app); }
    let db;
    try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch (e) { console.warn('offline cache unavailable', e); db = F.initializeFirestore(app, {}); }
    const emu = cloud.cfg.emulator;
    if (emu) { Au.connectAuthEmulator(auth, emu.auth, { disableWarnings: true }); F.connectFirestoreEmulator(db, emu.firestore[0], emu.firestore[1]); }
    cloud.fb = { A, Au, fs: F, app, auth, db };
    cloud.user = await new Promise(res => { const un = Au.onAuthStateChanged(auth, u => { un(); res(u); }); });
    Au.onAuthStateChanged(auth, u => { const was = cloud.user; cloud.user = u; if (!!was !== !!u || (was && u && was.uid !== u.uid)) emit(); });
    return cloud.fb;
  })();
  sdkP.catch(() => { sdkP = null; });
  return sdkP;
}

// ── records: how the board and teacher state are split into synced docs ──
export function boardRecords(st) {
  const r = {};
  st.boards.forEach((b, i) => {
    r['bd.' + b.id] = { id: b.id, name: b.name, bg: b.bg || null, created: b.created || 0, o: i };
    b.widgets.forEach(w => { r['wg.' + w.id] = Object.assign({}, w, { b: b.id }); });
  });
  r.cl = st.classList || [];
  r.pics = st.myPictures || [];
  return r;
}
export function teacherRecords(st) {
  const r = {};
  for (const a of TEACHER_ARRAYS) (st[a] || []).forEach(x => { if (x && x.id) r['t.' + a + '.' + x.id] = x; });
  for (const d in (st.daysOff || {})) r['t.off.' + d] = st.daysOff[d];
  for (const d in (st.attendance || {})) r['t.att.' + d] = st.attendance[d];
  return r;
}
const emptyBoardState = () => ({ schema: 1, boards: [], activeBoardId: null, classList: [], myPictures: [], settings: {} });
const emptyTeacherState = () => ({ schema: 1, kind: 'teacher', updated: Date.now(), settings: {}, blocks: [], lessons: [], placements: [], daysOff: {}, resources: [], todos: [], reminders: [], students: [], attendance: {}, deleted: {} });

/** A widget being dragged, resized, typed in or edited waits for its remote change. */
function widgetBusy(id) {
  const f = document.querySelector('.wg[data-id="' + id + '"]'); if (!f) return false;
  const a = document.activeElement;
  return f.matches('.dragging, .resizing, .editing') || (a && a !== document.body && f.contains(a)) || f.matches(':active');
}

/** Apply board changes to state `st`. Returns {skipped, boards, classList}. */
function applyBoardTo(st, changes, live) {
  const skipped = new Set(), boards = new Set(); let classList = false;
  const order = new Map(st.boards.map((b, i) => [b.id, i]));
  const sorted = changes.slice().sort((a, b) => (a.key.startsWith('bd.') ? 0 : 1) - (b.key.startsWith('bd.') ? 0 : 1));
  for (const c of sorted) {
    const k = c.key, v = c.v;
    if (k.startsWith('bd.')) {
      const id = k.slice(3), i = st.boards.findIndex(b => b.id === id);
      if (!v) { if (i >= 0) { st.boards.splice(i, 1); boards.add(id); } continue; }
      if (i >= 0) { const b = st.boards[i]; b.name = v.name; b.bg = v.bg; b.created = v.created; }
      else st.boards.push({ id, name: v.name, bg: v.bg, widgets: [], created: v.created, updated: Date.now() });
      order.set(id, v.o); boards.add(id);
    } else if (k.startsWith('wg.')) {
      const id = k.slice(3);
      if (live && widgetBusy(id)) { skipped.add(k); continue; }
      let at = null;
      for (const b of st.boards) { const j = b.widgets.findIndex(w => w.id === id); if (j >= 0) { at = { b, j }; break; } }
      if (!v) { if (at) { at.b.widgets.splice(at.j, 1); boards.add(at.b.id); } continue; }
      const target = st.boards.find(b => b.id === v.b);
      if (!target) { skipped.add(k); continue; } // its screen has not arrived yet
      const w = Object.assign({}, v); delete w.b;
      if (at && at.b === target) at.b.widgets[at.j] = w;
      else { if (at) { at.b.widgets.splice(at.j, 1); boards.add(at.b.id); } target.widgets.push(w); }
      boards.add(target.id);
    } else if (k === 'cl') { st.classList = Array.isArray(v) ? v : []; classList = true; }
    else if (k === 'pics') { st.myPictures = Array.isArray(v) ? v : []; }
  }
  st.boards.sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e9) - (order.has(b.id) ? order.get(b.id) : 1e9));
  return { skipped, boards, classList };
}
function applyTeacherTo(st, changes) {
  for (const c of changes) {
    const k = c.key, v = c.v, p = k.split('.');
    if (p[1] === 'off') { if (v) st.daysOff[k.slice(6)] = v; else delete st.daysOff[k.slice(6)]; continue; }
    if (p[1] === 'att') { if (v) st.attendance[k.slice(6)] = v; else delete st.attendance[k.slice(6)]; continue; }
    const arr = p[1]; if (!TEACHER_ARRAYS.includes(arr)) continue;
    const id = k.slice(3 + arr.length), list = st[arr] || (st[arr] = []);
    const i = list.findIndex(x => x.id === id);
    if (!v) { if (i >= 0) list.splice(i, 1); continue; }
    if (i >= 0) { const o = list[i]; Object.keys(o).forEach(x => delete o[x]); Object.assign(o, v); } // in place: open editors keep their object
    else if (NEWEST_FIRST.has(arr)) list.unshift(Object.assign({}, v)); else list.push(Object.assign({}, v));
  }
  return new Set();
}

// targets: before the app is up (first open on a device) the engines fill a scratch state
let scratch = null;
function applyBoard(changes) {
  if (scratch) return applyBoardTo(scratch.b, changes, false).skipped;
  let out = { skipped: new Set() };
  S.remoteUpdate(st => { out = applyBoardTo(st, changes, true); return out; });
  return out.skipped;
}
function applyTeacher(changes) {
  if (scratch) return applyTeacherTo(scratch.t, changes);
  let sk = new Set(); TS.remoteUpdateT(st => { sk = applyTeacherTo(st, changes); });
  return sk;
}
export function isReferenced(key) {
  const k = String(key);
  if (k.startsWith('teacher/')) { const id = k.slice(8).split(':')[0]; return !!(TS.T() && TS.T().resources.some(r => r.id === id)); }
  const id = k.split(':')[0], st = S.getState();
  return !!(st && st.boards.some(b => b.widgets.some(w => w.id === id)));
}

/** A local adapter that also tells the sync engine about every save. */
function wrap(local, src) {
  return { name: 'class-local', load: () => local.load(), save(st) { const ok = local.save(st); const e = cloud.sync[src]; if (e) e.local(st); return ok; } };
}

function makeEngines() {
  const f = cloud.fb, m = cloud.mem;
  const fbx = { db: f.db, fs: f.fs, cid: m.cid, uid: cloud.user.uid };
  cloud.sync.b = new RecordSync(fbx, { src: 'b', toRecords: boardRecords, apply: applyBoard, denied: onDenied });
  cloud.sync.t = new RecordSync(fbx, { src: 't', toRecords: teacherRecords, apply: applyTeacher, denied: onDenied });
  cloud.sync.b.listeners.add(emit); cloud.sync.t.listeners.add(emit);
  return fbx;
}

/**
 * Before the app loads its data: pick this device's data or the classroom's.
 * Returns once the right adapters are in place (the very first open of a
 * class on a device waits for its data; later opens are instant/offline).
 */
export async function prepare(ui) {
  cloud.cfg = activeConfig();
  if (!cloud.cfg) return;
  const mem = readMem(); cloud.mem = mem;
  if (!mem || !mem.cid) return;
  cloud.mode = 'class'; S.env.cloud = true;
  S.setAdapter(wrap(S.makeLocalAdapter(bKey(mem.cid)), 'b'));
  TS.setTeacherAdapter(wrap(S.makeLocalAdapter(tKey(mem.cid)), 't'));
  cloud.files = makeCloudBlobs(S.IDBBlobAdapter, mem.cid);
  S.setBlobAdapter(cloud.files);
  if (localStorage.getItem(bKey(mem.cid)) !== null && localStorage.getItem(tKey(mem.cid)) !== null) return;
  // first time this class opens on this device: fetch it before showing anything
  for (;;) {
    const box = ui.loading(mem.cname);
    try {
      await sdk();
      if (!cloud.user || cloud.user.uid !== mem.uid) throw Object.assign(new Error('signed out'), { code: 'signed-out' });
      scratch = { b: emptyBoardState(), t: emptyTeacherState() };
      makeEngines();
      await Promise.all([cloud.sync.b.start({ waitServer: true }), cloud.sync.t.start({ waitServer: true })]);
      const b = scratch.b, t = scratch.t; scratch = null;
      if (b.boards.length) { b.activeBoardId = b.boards[0].id; localStorage.setItem(bKey(mem.cid), JSON.stringify(b)); }
      if (TEACHER_ARRAYS.some(a => t[a].length) || Object.keys(t.daysOff).length || Object.keys(t.attendance).length) localStorage.setItem(tKey(mem.cid), JSON.stringify(t));
      box.close();
      return;
    } catch (e) {
      console.warn('class open failed', e && (e.code || e.message));
      scratch = null;
      Object.values(cloud.sync).forEach(s => s && s.stop()); cloud.sync = {};
      const choice = await box.failed(e && e.code === 'signed-out' ? 'signed-out' : e && e.code === 'permission-denied' ? 'removed' : 'offline');
      if (choice === 'retry') continue;
      // back to this device's own board (nothing is deleted)
      cloud.mode = 'local'; S.env.cloud = false;
      if (choice === 'signin') sessionStorage.setItem('classboard.openSignin', '1');
      if (choice === 'leave' || choice === 'signin' || e && e.code === 'permission-denied' || e && e.code === 'signed-out') writeMem(Object.assign({}, mem, { cid: null, cname: null, role: null }));
      S.setAdapter(S.LocalAdapter); TS.setTeacherAdapter(S.makeLocalAdapter(TS.TKEY)); S.setBlobAdapter(S.IDBBlobAdapter);
      cloud.files = null;
      return;
    }
  }
}

/** After the app is up: connect in the background and start live sync. */
export async function start() {
  if (!cloud.cfg) return;
  emit();
  // a Google sign-in that went through a full-page redirect comes back here
  if (sessionStorage.getItem('classboard.redirect')) {
    sessionStorage.removeItem('classboard.redirect');
    try { await sdk(); const r = await cloud.fb.Au.getRedirectResult(cloud.fb.auth); if (r && r.user) { cloud.user = r.user; window.dispatchEvent(new CustomEvent('cb:signed-in', { detail: r.user })); } }
    catch (e) { window.dispatchEvent(new CustomEvent('cb:signin-error', { detail: e })); }
  }
  if (cloud.mode !== 'class') { if (cloud.mem && cloud.mem.uid) sdk().then(emit, () => {}); return; }
  // let this device reopen the board without internet (network-first cache of the app's own files)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline cache not set up', e && e.message));
  try { await sdk(); } catch (e) { console.warn('cloud unavailable (offline?)', e); cloud.offlineBoot = true; emit(); window.addEventListener('online', () => location.reload(), { once: true }); return; }
  if (!cloud.user || cloud.user.uid !== cloud.mem.uid) { cloud.needsSignIn = true; emit(); return; }
  attach();
}
function attach() {
  if (!cloud.sync.b) makeEngines();
  const fbx = { db: cloud.fb.db, fs: cloud.fb.fs, cid: cloud.mem.cid, uid: cloud.user.uid };
  cloud.sync.b.local(S.getState()); cloud.sync.t.local(TS.T());
  if (!cloud.sync.b.started) cloud.sync.b.start().catch(() => {});
  if (!cloud.sync.t.started) cloud.sync.t.start().catch(() => {});
  else { cloud.sync.b.schedule(300); cloud.sync.t.schedule(300); }
  if (cloud.files) { cloud.files.attach(fbx, isReferenced); cloud.files.onStatus(emit); }
  watchClass();
  cloud.live = true; cloud.needsSignIn = false; emit();
  // tidy up shared files whose widget/resource is gone, once the class data is current
  setTimeout(() => { if (cloud.sync.b && !cloud.sync.b.fromCache) cloud.files && cloud.files.sweep(isReferenced); }, 45000);
}
/** Same person signed back in on this device: carry on without a reload. */
export function resume() { if (cloud.mode === 'class' && cloud.user && cloud.mem && cloud.user.uid === cloud.mem.uid) attach(); }

let unClass = [];
function watchClass() {
  const { fs, db } = cloud.fb, cid = cloud.mem.cid;
  unClass.forEach(u => u()); unClass = [];
  unClass.push(fs.onSnapshot(fs.doc(db, 'classrooms', cid), s => {
    if (!s.exists()) return;
    cloud.classDoc = Object.assign({ id: cid }, s.data());
    if (cloud.classDoc.name !== cloud.mem.cname) writeMem(Object.assign({}, cloud.mem, { cname: cloud.classDoc.name }));
    emit();
  }, onDenied));
  unClass.push(fs.onSnapshot(fs.collection(db, 'classrooms', cid, 'members'), s => {
    cloud.members = s.docs.map(d => d.data()).sort((a, b) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0) || (a.joined || 0) - (b.joined || 0));
    if (!s.metadata.fromCache && !cloud.members.some(m => m.uid === cloud.user.uid)) onDenied({ code: 'permission-denied' });
    emit();
  }, onDenied));
}
let deniedOnce = false;
function onDenied(e) {
  if (!e || e.code !== 'permission-denied' || deniedOnce) return;
  deniedOnce = true;
  window.dispatchEvent(new CustomEvent('cb:removed', { detail: { cname: cloud.mem && cloud.mem.cname } }));
}

// ── status for the account button ──
export function status() {
  if (!cloud.cfg) return { state: 'none' };
  if (cloud.mode !== 'class') return { state: cloud.user ? 'no-class' : 'signed-out' };
  if (cloud.needsSignIn) return { state: 'needs-signin' };
  const pend = (cloud.sync.b ? cloud.sync.b.pendingCount() : 0) + (cloud.sync.t ? cloud.sync.t.pendingCount() : 0) + (cloud.files ? cloud.files.pendingCount() : 0);
  const offline = cloud.offlineBoot || !navigator.onLine || (cloud.live && cloud.sync.b && cloud.sync.b.fromCache && cloud.sync.t.fromCache);
  const err = (cloud.sync.b && cloud.sync.b.errors > 2) || (cloud.sync.t && cloud.sync.t.errors > 2);
  return { state: offline ? 'offline' : err ? 'error' : pend ? 'syncing' : cloud.live ? 'synced' : 'connecting', pending: pend };
}
window.addEventListener('online', emit); window.addEventListener('offline', emit);

// ── account + classroom actions ──
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode() { const a = new Uint32Array(6); crypto.getRandomValues(a); return [...a].map(n => CODE_ABC[n % CODE_ABC.length]).join(''); }
const who = u => ({ name: (u.displayName || (u.email || '').split('@')[0] || 'Teacher').slice(0, 80), email: (u.email || '').slice(0, 200) });

export async function signInGoogle() {
  // The pop-up must open inside the tap itself (Safari blocks it otherwise), so the
  // SDK is loaded when the sign-in screen opens and nothing is awaited before this call.
  const { Au, auth } = cloud.fb || await sdk();
  const p = new Au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { return (await Au.signInWithPopup(auth, p)).user; }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) {
      sessionStorage.setItem('classboard.redirect', '1');
      await Au.signInWithRedirect(auth, p); return null;
    }
    throw e;
  }
}
export async function signInEmail(email, pass) { const { Au, auth } = await sdk(); return (await Au.signInWithEmailAndPassword(auth, email.trim(), pass)).user; }
export async function createEmail(name, email, pass) {
  const { Au, auth } = await sdk();
  const u = (await Au.createUserWithEmailAndPassword(auth, email.trim(), pass)).user;
  if (name) { try { await Au.updateProfile(u, { displayName: name.trim().slice(0, 60) }); } catch (e) { } }
  return u;
}
export async function resetPassword(email) { const { Au, auth } = await sdk(); await Au.sendPasswordResetEmail(auth, email.trim()); }

/** The classroom this account last used (on any device), if it can still be opened. */
export async function myClass() {
  const { fs, db } = await sdk(); const uid = cloud.user.uid;
  const u = await fs.getDoc(fs.doc(db, 'users', uid));
  const cid = u.exists() && u.data().cid; if (!cid) return null;
  try {
    const c = await fs.getDoc(fs.doc(db, 'classrooms', cid));
    if (!c.exists()) return null;
    const me = await fs.getDoc(fs.doc(db, 'classrooms', cid, 'members', uid));
    return { cid, cname: c.data().name, role: c.data().owner === uid ? 'owner' : 'member', joined: me.exists() };
  } catch (e) { if (e.code === 'permission-denied') return null; throw e; }
}
export async function createClass(name) {
  const { fs, db } = await sdk(); const u = cloud.user;
  name = String(name || '').trim().slice(0, 60) || 'My classroom';
  for (let tries = 0; tries < 4; tries++) {
    const cid = fs.doc(fs.collection(db, 'classrooms')).id, code = newCode(), now = Date.now();
    const b = fs.writeBatch(db);
    b.set(fs.doc(db, 'classrooms', cid), { name, owner: u.uid, code, created: now });
    b.set(fs.doc(db, 'joinCodes', code), { cid, owner: u.uid, created: now });
    b.set(fs.doc(db, 'classrooms', cid, 'members', u.uid), Object.assign({ uid: u.uid, role: 'owner', joined: now, code: '' }, who(u)));
    b.set(fs.doc(db, 'users', u.uid), { cid, cname: name, updated: now });
    try { await b.commit(); return { cid, cname: name, role: 'owner', code }; }
    catch (e) { if (e.code !== 'permission-denied' || tries === 3) throw e; } // a code clash: try another code
  }
}
export async function joinClass(raw) {
  const { fs, db } = await sdk(); const u = cloud.user;
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z2-9]{6}$/.test(code)) throw Object.assign(new Error('bad code'), { code: 'cb/bad-code' });
  let jc;
  try { jc = await fs.getDoc(fs.doc(db, 'joinCodes', code)); } catch (e) { throw e.code === 'permission-denied' ? Object.assign(new Error('bad code'), { code: 'cb/bad-code' }) : e; }
  if (!jc.exists()) throw Object.assign(new Error('bad code'), { code: 'cb/bad-code' });
  const cid = jc.data().cid, now = Date.now();
  const mine = fs.doc(db, 'classrooms', cid, 'members', u.uid);
  try { await fs.setDoc(mine, Object.assign({ uid: u.uid, role: 'member', joined: now, code }, who(u))); }
  catch (e) {
    // already a member (rules refuse an update) → fine; otherwise the code is not current
    let already = false; try { already = (await fs.getDoc(mine)).exists(); } catch (er) { }
    if (!already) throw e.code === 'permission-denied' ? Object.assign(new Error('bad code'), { code: 'cb/bad-code' }) : e;
  }
  const c = await fs.getDoc(fs.doc(db, 'classrooms', cid));
  const cname = c.data().name;
  await fs.setDoc(fs.doc(db, 'users', u.uid), { cid, cname, updated: now });
  return { cid, cname, role: c.data().owner === u.uid ? 'owner' : 'member' };
}
export async function regenerateCode() {
  const { fs, db } = cloud.fb; const cd = cloud.classDoc, cid = cloud.mem.cid;
  for (let tries = 0; tries < 4; tries++) {
    const code = newCode(), b = fs.writeBatch(db);
    b.set(fs.doc(db, 'joinCodes', code), { cid, owner: cloud.user.uid, created: Date.now() });
    b.update(fs.doc(db, 'classrooms', cid), { code });
    if (cd && cd.code) b.delete(fs.doc(db, 'joinCodes', cd.code));
    try { await b.commit(); return code; } catch (e) { if (e.code !== 'permission-denied' || tries === 3) throw e; }
  }
}
export async function removeMember(uid) { const { fs, db } = cloud.fb; await fs.deleteDoc(fs.doc(db, 'classrooms', cloud.mem.cid, 'members', uid)); }
export async function renameClass(name) {
  const { fs, db } = cloud.fb; name = String(name || '').trim().slice(0, 60); if (!name) return;
  await fs.updateDoc(fs.doc(db, 'classrooms', cloud.mem.cid), { name });
  fs.setDoc(fs.doc(db, 'users', cloud.user.uid), { cid: cloud.mem.cid, cname: name, updated: Date.now() }).catch(() => {});
}

/** How much this device has on its own (for the "bring it along" choice). */
export function localSummary() {
  let b = null, t = null;
  try { b = JSON.parse(localStorage.getItem('classboard.v1') || 'null'); } catch (e) { }
  try { t = JSON.parse(localStorage.getItem(TS.TKEY) || 'null'); } catch (e) { }
  const n = k => (t && Array.isArray(t[k]) ? t[k].length : 0);
  return { screens: b && b.boards ? b.boards.length : 0, widgets: b && b.boards ? b.boards.reduce((a, x) => a + x.widgets.length, 0) : 0,
    lessons: n('lessons'), resources: n('resources'), students: n('students'), todos: n('todos'), any: !!(b || t) };
}

/**
 * Open a classroom on this device. migrate = also upload this device's own
 * board + teacher data into it (copied; this device's own copy stays as it was).
 */
export function enterClass(c, migrate) {
  const u = cloud.user;
  if (migrate) {
    S.flush(); TS.flushT();
    const lb = localStorage.getItem('classboard.v1'), lt = localStorage.getItem(TS.TKEY);
    // the class's own copy on this device (if any) is replaced by a merge done by the sync engine
    if (lb !== null) localStorage.setItem(bKey(c.cid), mergeLocal(localStorage.getItem(bKey(c.cid)), lb, 'b'));
    if (lt !== null) localStorage.setItem(tKey(c.cid), mergeLocal(localStorage.getItem(tKey(c.cid)), lt, 't'));
  }
  writeMem({ uid: u.uid, email: u.email || '', name: who(u).name, cid: c.cid, cname: c.cname, role: c.role });
  location.reload();
}
function mergeLocal(classJson, localJson, kind) {
  if (!classJson) return localJson;
  try {
    const a = JSON.parse(classJson), b = JSON.parse(localJson);
    if (kind === 'b') { const ids = new Set(a.boards.map(x => x.id)); b.boards.forEach(x => { if (!ids.has(x.id)) a.boards.push(x); }); return JSON.stringify(a); }
    for (const k of TEACHER_ARRAYS) { const ids = new Set((a[k] || []).map(x => x.id)); (b[k] || []).forEach(x => { if (!ids.has(x.id)) (a[k] = a[k] || []).push(x); }); }
    for (const k of ['daysOff', 'attendance']) a[k] = Object.assign({}, b[k] || {}, a[k] || {});
    return JSON.stringify(a);
  } catch (e) { return classJson; }
}

/** Leave the classroom on this device: drop its local copy (it lives in the class). */
async function dropClassCopy() {
  const cid = cloud.mem && cloud.mem.cid; if (!cid) return;
  Object.values(cloud.sync).forEach(s => s && s.stop());
  cloud.files && cloud.files.detach();
  try { for (const r of (TS.T() && TS.T().resources) || []) if (r.file) await S.IDBBlobAdapter.del(TS.blobKey(r.id)); } catch (e) { }
  [bKey(cid), tKey(cid), 'classboard.sync.' + cid + '.b', 'classboard.sync.' + cid + '.t', 'classboard.files.' + cid].forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
}
export function pendingCount() { return status().pending || 0; }
export async function signOutEverywhere() {
  await dropClassCopy();
  if (cloud.fb) {
    try { await cloud.fb.Au.signOut(cloud.fb.auth); } catch (e) { }
    try { await cloud.fb.fs.terminate(cloud.fb.db); await cloud.fb.fs.clearIndexedDbPersistence(cloud.fb.db); } catch (e) { }
  }
  writeMem(null);
  location.reload();
}
export async function leaveClass(removed) {
  deniedOnce = true;
  const cid = cloud.mem.cid, uid = cloud.user && cloud.user.uid;
  if (!removed && cloud.fb && uid) {
    await cloud.fb.fs.deleteDoc(cloud.fb.fs.doc(cloud.fb.db, 'classrooms', cid, 'members', uid));
  }
  if (cloud.fb && uid) { try { await cloud.fb.fs.setDoc(cloud.fb.fs.doc(cloud.fb.db, 'users', uid), { cid: null, cname: null, updated: Date.now() }); } catch (e) { } }
  await dropClassCopy();
  writeMem(Object.assign({}, cloud.mem, { cid: null, cname: null, role: null }));
  location.reload();
}
