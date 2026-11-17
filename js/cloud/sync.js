// ─────────────────────────────────────────────────────────────
// Record sync: keeps a local JSON state (boards or teacher data) and the
// classroom's Firestore records in step.
//  • The state is split into records (one widget, one lesson, one day of
//    attendance…). Each record is one doc in classrooms/{cid}/items, holding
//    its canonical JSON (`j`), a hash (`h`), the time it changed (`u`) and
//    a tombstone flag (`d`). Records over ~900 KB are split into `parts`.
//  • Local changes are found by hashing records after every save (the
//    "shadow" = what the class last agreed on, kept in localStorage), so
//    edits made offline are pushed the next time the app is online.
//  • Conflicts: last write wins per record, by change time.
// ─────────────────────────────────────────────────────────────

/** JSON with sorted keys, so the same data always gives the same string. */
export function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(x => x === undefined || typeof x === 'function' ? 'null' : canon(x)).join(',') + ']';
  const ks = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort();
  return '{' + ks.map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
/** Fast 64-bit-ish string hash (two FNV-1a lanes) as 16 hex chars. */
export function hashStr(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function hashBytes(u8) {
  let a = 0x811c9dc5, b = 0x01000193 ^ u8.length;
  for (let i = 0; i < u8.length; i++) { const c = u8[i]; a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const enc = new TextEncoder();
export const utf8Len = s => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c < 0xDC00) ? (i++, 4) : 3; } return n; };
/** Split a string into pieces of at most `max` UTF-8 bytes (never inside a surrogate pair). */
export function splitStr(s, max = 900000) {
  const out = []; let i = 0;
  while (i < s.length) {
    let n = Math.min(s.length - i, max);
    let piece = s.slice(i, i + n);
    while (utf8Len(piece) > max) { n = Math.floor(n * 0.8); piece = s.slice(i, i + n); }
    const last = piece.charCodeAt(piece.length - 1);
    if (last >= 0xD800 && last < 0xDC00 && piece.length > 1) { n--; piece = s.slice(i, i + n); }
    out.push(piece); i += n;
  }
  return out;
}
export const docId = key => String(key).replace(/\//g, '|').replace(/^\.+/, '_');
const PART_MAX = 900000;

/**
 * fb: { db, fs (firestore functions), cid, uid }
 * opts: { src: 'b'|'t', toRecords(state) → {key: value}, apply(changes) → Set of keys NOT applied (busy), status(fn) }
 */
export class RecordSync {
  constructor(fb, opts) {
    Object.assign(this, fb); this.o = opts; this.src = opts.src;
    this.lsKey = 'classboard.sync.' + fb.cid + '.' + opts.src;
    let saved = null; try { saved = JSON.parse(localStorage.getItem(this.lsKey) || 'null'); } catch (e) { }
    this.shadow = (saved && saved.shadow) || {}; // key -> {h, u, d, p}
    this.dirty = (saved && saved.dirty) || {};   // key -> time of the local change
    this.lastH = {};      // key -> hash of the record as it is locally now
    this.cur = new Map(); // key -> {j, h}
    this.inflight = {};   // key -> hash being written
    this.pending = new Map(); // remote changes waiting (busy widget / missing parts)
    this.writes = 0; this.timer = null; this.unsub = null; this.started = false; this.fromCache = true; this.errors = 0;
    this.listeners = new Set();
  }
  col(name) { return this.fs.collection(this.db, 'classrooms', this.cid, name); }
  persist() {
    clearTimeout(this.pt);
    this.pt = setTimeout(() => { try { localStorage.setItem(this.lsKey, JSON.stringify({ shadow: this.shadow, dirty: this.dirty })); } catch (e) { console.warn('sync state not saved', e); } }, 60);
  }
  persistNow() { clearTimeout(this.pt); try { localStorage.setItem(this.lsKey, JSON.stringify({ shadow: this.shadow, dirty: this.dirty })); } catch (e) { } }
  pendingCount() { return Object.keys(this.dirty).length + Object.keys(this.inflight).length; }
  emit() { this.listeners.forEach(fn => { try { fn(this); } catch (e) { console.error(e); } }); }

  /** Called after every local save with the whole state. */
  local(state) {
    if (!state) return;
    const recs = this.o.toRecords(state), now = Date.now(), seen = new Set();
    for (const k in recs) {
      seen.add(k);
      const j = canon(recs[k]), h = hashStr(j);
      this.cur.set(k, { j, h });
      if (this.lastH[k] === h) continue;
      this.lastH[k] = h;
      const sh = this.shadow[k];
      if (sh && !sh.d && sh.h === h) delete this.dirty[k];
      else this.dirty[k] = Math.max(now, (sh && sh.u || 0) + 1);
    }
    for (const k of [...this.cur.keys()]) if (!seen.has(k)) { this.cur.delete(k); delete this.lastH[k]; }
    for (const k in this.shadow) if (!seen.has(k) && !this.shadow[k].d && !this.dirty[k]) this.dirty[k] = Math.max(now, (this.shadow[k].u || 0) + 1);
    for (const k in this.dirty) if (!seen.has(k) && (!this.shadow[k] || this.shadow[k].d)) delete this.dirty[k]; // made and removed while offline
    this.persist();
    this.schedule();
  }
  schedule(ms = 1200) { if (!this.started) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), ms); this.emit(); }

  push() {
    const { fs } = this;
    for (const k of Object.keys(this.dirty)) {
      const c = this.cur.get(k), u = this.dirty[k];
      const h = c ? c.h : '';
      if (this.inflight[k] === h + ':' + u) continue;
      this.inflight[k] = h + ':' + u;
      const ref = fs.doc(this.col('items'), docId(k));
      this.writes++;
      const old = this.shadow[k];
      let p;
      if (c) {
        const big = utf8Len(c.j) > PART_MAX;
        const pieces = big ? splitStr(c.j, PART_MAX) : [];
        if (big) {
          pieces.forEach((piece, i) => fs.setDoc(fs.doc(this.col('parts'), docId(k) + '~' + h + '~' + i), { j: piece }).catch(e => this.fail(e)));
          p = fs.setDoc(ref, { k, s: this.src, j: null, p: pieces.length, h, u, by: this.uid, d: false });
        } else p = fs.setDoc(ref, { k, s: this.src, j: c.j, p: 0, h, u, by: this.uid, d: false });
        p.then(() => {
          if (old && old.p && old.h !== h) for (let i = 0; i < old.p; i++) fs.deleteDoc(fs.doc(this.col('parts'), docId(k) + '~' + old.h + '~' + i)).catch(() => {});
          this.done(k, { h, u, p: pieces.length });
        }, e => { delete this.inflight[k]; this.fail(e); });
      } else {
        p = fs.setDoc(ref, { k, s: this.src, j: null, p: 0, h: '', u, by: this.uid, d: true });
        p.then(() => {
          if (old && old.p) for (let i = 0; i < old.p; i++) fs.deleteDoc(fs.doc(this.col('parts'), docId(k) + '~' + old.h + '~' + i)).catch(() => {});
          this.done(k, { h: '', u, d: true });
        }, e => { delete this.inflight[k]; this.fail(e); });
      }
    }
    this.emit();
  }
  done(k, sh) {
    delete this.inflight[k];
    this.shadow[k] = sh;
    if (this.dirty[k] && this.dirty[k] <= sh.u) {
      const c = this.cur.get(k);
      if ((sh.d && !c) || (c && c.h === sh.h)) delete this.dirty[k];
    }
    this.errors = 0; this.persist(); this.emit();
    if (Object.keys(this.dirty).some(x => !this.inflight[x])) this.schedule(400);
  }
  fail(e) {
    console.warn('sync write failed', e && e.code, e && e.message);
    if (e && e.code === 'permission-denied') { this.o.denied && this.o.denied(e); return; }
    this.errors++; this.lastError = e; this.emit();
    this.schedule(Math.min(60000, 2000 * this.errors));
  }

  /** Start listening. Resolves after the first snapshot from the server (or rejects on timeout/denied). */
  start({ waitServer = false, timeout = 25000 } = {}) {
    const { fs } = this;
    this.started = true;
    return new Promise((resolve, reject) => {
      let settled = false;
      const t = waitServer ? setTimeout(() => { if (!settled) { settled = true; reject(Object.assign(new Error('timeout'), { code: 'timeout' })); } }, timeout) : null;
      const q = fs.query(this.col('items'), fs.where('s', '==', this.src));
      this.unsub = fs.onSnapshot(q, { includeMetadataChanges: true }, snap => {
        this.fromCache = snap.metadata.fromCache;
        const changes = snap.docChanges().filter(c => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites);
        if (changes.length) this.remote(changes.map(c => c.doc.data()));
        this.emit();
        if (!settled && (!waitServer || !snap.metadata.fromCache)) {
          // make sure parts for big records are in before we say "ready"
          settled = true; clearTimeout(t); this.ready().then(resolve, resolve);
        }
      }, err => {
        console.warn('sync listen failed', err && err.code);
        if (err && err.code === 'permission-denied') this.o.denied && this.o.denied(err);
        if (!settled) { settled = true; clearTimeout(t); reject(err); }
        this.listenError = err; this.emit();
      });
      this.retry = setInterval(() => { if (this.pending.size) this.flushPending(); }, 1000);
      this.schedule(300);
    });
  }
  ready() { return this.loading || Promise.resolve(); }
  stop() { this.started = false; this.unsub && this.unsub(); clearTimeout(this.timer); clearInterval(this.retry); this.persistNow(); }

  remote(docs) {
    for (const d of docs) {
      const k = d.k; if (!k) continue;
      const sh = this.shadow[k];
      if (sh && sh.h === (d.h || '') && !!sh.d === !!d.d) { if ((d.u || 0) > (sh.u || 0)) sh.u = d.u; continue; }
      if (!d.d && this.lastH[k] === d.h) { // we already have exactly this (our own write coming back)
        this.shadow[k] = { h: d.h, u: Math.max(d.u || 0, sh && sh.u || 0), p: d.p || 0 };
        if (this.dirty[k] && this.dirty[k] <= (d.u || 0)) delete this.dirty[k];
        this.persist(); continue;
      }
      if (d.d && !this.cur.has(k) && !this.dirty[k]) { this.shadow[k] = { h: '', u: d.u || 0, d: true }; this.persist(); continue; }
      if (this.dirty[k] && this.dirty[k] > (d.u || 0)) continue; // our newer change wins and is on its way
      if (sh && (d.u || 0) < (sh.u || 0)) continue;              // older than what we have
      this.pending.set(k, d);
    }
    this.flushPending();
  }
  async flushPending() {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const ready = [];
      for (const [k, d] of [...this.pending]) {
        let v = null;
        if (!d.d) {
          if (d.p > 0) {
            if (!d._j) {
              try {
                const parts = await Promise.all(Array.from({ length: d.p }, (_, i) => this.fs.getDoc(this.fs.doc(this.col('parts'), docId(k) + '~' + d.h + '~' + i))));
                if (parts.some(p => !p.exists())) continue; // not there yet – try again soon
                d._j = parts.map(p => p.data().j).join('');
              } catch (e) { continue; }
            }
            try { v = JSON.parse(d._j); } catch (e) { this.pending.delete(k); continue; }
          } else { try { v = JSON.parse(d.j); } catch (e) { this.pending.delete(k); continue; } }
        }
        // a local change made while we fetched still wins if it is newer
        if (this.dirty[k] && this.dirty[k] > (d.u || 0)) { this.pending.delete(k); continue; }
        ready.push({ key: k, v: d.d ? null : v, d });
      }
      if (!ready.length) return;
      let skipped = new Set();
      try { skipped = this.o.apply(ready) || new Set(); } catch (e) { console.error('apply remote failed', e); return; }
      for (const c of ready) {
        if (skipped.has(c.key)) continue;
        this.pending.delete(c.key);
        this.shadow[c.key] = { h: c.d.h || '', u: c.d.u || 0, d: !!c.d.d, p: c.d.p || 0 };
        delete this.dirty[c.key];
        this.lastH[c.key] = c.d.d ? undefined : c.d.h;
      }
      this.persist(); this.emit();
    })();
    this.loading = this.flushing;
    try { await this.flushing; } finally { this.flushing = null; }
  }
}
