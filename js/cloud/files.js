// ─────────────────────────────────────────────────────────────
// Shared files without Firebase Storage (free Spark plan):
// PDFs, library files, drawings and PDF notes are kept in IndexedDB on each
// device, and copied into Firestore in pieces (classrooms/{cid}/files = small
// info docs, /fileparts = the data in ≤750 KB pieces). Other devices fetch a
// file the first time it is opened, then keep it in IndexedDB.
// Files over CLOUD_FILE_MAX stay on the device that added them.
// ─────────────────────────────────────────────────────────────
import { hashBytes, hashStr, splitStr, docId } from './sync.js?v=6';
import { CLOUD_FILE_MAX } from './config.js?v=6';

const BIN_PART = 750000;
const isBin = v => v instanceof ArrayBuffer || ArrayBuffer.isView(v);
const u8Of = v => v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

export function makeCloudBlobs(base, cid) {
  const lsKey = 'classboard.files.' + cid;
  let saved = null; try { saved = JSON.parse(localStorage.getItem(lsKey) || 'null'); } catch (e) { }
  const shadow = (saved && saved.shadow) || {}; // key -> {h, u, d}
  const dirty = (saved && saved.dirty) || {};   // key -> time changed here
  const remote = new Map();                     // key -> info doc
  const fetching = new Map();
  let fb = null, readyRes, timer = null, unsub = null, errors = 0;
  const ready = new Promise(r => { readyRes = r; });
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(lsKey, JSON.stringify({ shadow, dirty })); } catch (e) { } };
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { } });
  const col = n => fb.fs.collection(fb.db, 'classrooms', cid, n);
  const schedule = (ms = 2500) => { clearTimeout(timer); timer = setTimeout(push, ms); emit(); };
  const mark = k => { dirty[k] = Date.now(); persist(); if (fb) schedule(); };

  async function push() {
    if (!fb) return;
    const { fs } = fb;
    for (const k of Object.keys(dirty)) {
      const at = dirty[k];
      let v; try { v = await base.get(k); } catch (e) { v = undefined; }
      const old = shadow[k] || remote.get(k) || null;
      const ref = fs.doc(col('files'), docId(k));
      try {
        if (v === undefined || v === null) {
          if (old && !old.d) {
            await fs.setDoc(ref, { k, kind: '', n: 0, h: '', size: 0, u: at, by: fb.uid, d: true, big: false, mime: '' });
            if (old.n) for (let i = 0; i < old.n; i++) fs.deleteDoc(fs.doc(col('fileparts'), docId(k) + '~' + old.h + '~' + i)).catch(() => {});
          }
          shadow[k] = { h: '', u: at, d: true, n: 0 };
        } else {
          let meta, parts = [];
          if (isBin(v)) {
            const u8 = u8Of(v), h = hashBytes(u8);
            if (old && old.h === h && !old.d) { shadow[k] = { h, u: old.u, n: old.n || 0 }; if (dirty[k] === at) delete dirty[k]; continue; }
            if (u8.length > CLOUD_FILE_MAX) meta = { k, kind: 'bin', n: 0, h, size: u8.length, u: at, by: fb.uid, d: false, big: true, mime: '' };
            else {
              for (let i = 0; i < u8.length; i += BIN_PART) parts.push({ b: fs.Bytes.fromUint8Array(u8.slice(i, i + BIN_PART)) });
              meta = { k, kind: 'bin', n: parts.length, h, size: u8.length, u: at, by: fb.uid, d: false, big: false, mime: '' };
            }
          } else {
            const j = JSON.stringify(v), h = hashStr(j);
            if (old && old.h === h && !old.d) { shadow[k] = { h, u: old.u, n: old.n || 0 }; if (dirty[k] === at) delete dirty[k]; continue; }
            parts = splitStr(j, 900000).map(p => ({ j: p }));
            meta = { k, kind: 'json', n: parts.length, h, size: j.length, u: at, by: fb.uid, d: false, big: false, mime: '' };
          }
          await Promise.all(parts.map((p, i) => fs.setDoc(fs.doc(col('fileparts'), docId(k) + '~' + meta.h + '~' + i), p)));
          await fs.setDoc(ref, meta);
          if (old && old.n && old.h && old.h !== meta.h) for (let i = 0; i < old.n; i++) fs.deleteDoc(fs.doc(col('fileparts'), docId(k) + '~' + old.h + '~' + i)).catch(() => {});
          shadow[k] = { h: meta.h, u: at, n: meta.n, big: meta.big };
        }
        if (dirty[k] === at) delete dirty[k];
        errors = 0; persist();
      } catch (e) {
        console.warn('file sync failed', k, e && e.code);
        if (e && e.code === 'permission-denied') return;
        errors++; schedule(Math.min(60000, 3000 * errors)); return;
      }
    }
    emit();
  }

  function onRemote(d) {
    const k = d.k; if (!k) return;
    remote.set(k, d);
    const sh = shadow[k];
    if (sh && sh.h === d.h && !!sh.d === !!d.d) return;
    if (dirty[k] && dirty[k] > (d.u || 0)) return;
    if (sh && (d.u || 0) < (sh.u || 0)) return;
    if (d.big) { shadow[k] = { h: d.h, u: d.u, big: true }; persist(); return; } // nothing to fetch: it lives on its own device
    shadow[k] = { h: d.h, u: d.u, d: !!d.d, n: d.n || 0, stale: true };
    persist();
    base.del(k).catch(() => {}).then(() => window.dispatchEvent(new CustomEvent('cb:blob-remote', { detail: { key: k } })));
  }

  async function download(k) {
    if (fetching.has(k)) return fetching.get(k);
    const p = (async () => {
      const d = remote.get(k);
      if (!d || d.d || d.big || !d.n) return undefined;
      const { fs } = fb;
      const parts = await Promise.all(Array.from({ length: d.n }, (_, i) => fs.getDoc(fs.doc(col('fileparts'), docId(k) + '~' + d.h + '~' + i))));
      if (parts.some(p => !p.exists())) return undefined;
      let v;
      if (d.kind === 'bin') {
        const arrs = parts.map(p => p.data().b.toUint8Array()); const total = arrs.reduce((a, b) => a + b.length, 0);
        const out = new Uint8Array(total); let o = 0; arrs.forEach(a => { out.set(a, o); o += a.length; }); v = out.buffer;
      } else v = JSON.parse(parts.map(p => p.data().j).join(''));
      if (dirty[k]) return base.get(k); // changed here while fetching
      await base.put(k, v);
      shadow[k] = { h: d.h, u: d.u, n: d.n };
      persist();
      return v;
    })();
    fetching.set(k, p);
    try { return await p; } catch (e) { console.warn('file fetch failed', k, e && e.code); return undefined; } finally { fetching.delete(k); }
  }

  const adapter = {
    name: 'cloud+' + base.name,
    async get(k) {
      const v = await base.get(k);
      if (v !== undefined && !(shadow[k] && shadow[k].stale)) return v;
      if (!fb) await Promise.race([ready, new Promise(r => setTimeout(r, 12000))]);
      if (!fb) return v;
      const got = await download(k);
      return got !== undefined ? got : v;
    },
    async put(k, v) { await base.put(k, v); if (shadow[k]) delete shadow[k].stale; mark(k); },
    async del(k) { await base.del(k); mark(k); },
    async keys() {
      const ks = new Set(await base.keys());
      remote.forEach((d, k) => { if (!d.d && !d.big) ks.add(k); });
      return [...ks];
    },
    localKeys: () => base.keys(),
    evict: k => base.del(k),
    /** {big, size, here} for "only on this device" badges */
    info(k) { const d = remote.get(k); return d ? { big: !!d.big, size: d.size || 0, mine: d.by === (fb && fb.uid), deleted: !!d.d } : null; },
    pendingCount: () => Object.keys(dirty).length,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Start syncing. isReferenced(key) says whether a local file still belongs to something in the class. */
    attach(f, isReferenced) {
      fb = f;
      let first = true;
      unsub = f.fs.onSnapshot(col('files'), { includeMetadataChanges: false }, async snap => {
        snap.docChanges().forEach(c => { if (c.type !== 'removed' && !c.doc.metadata.hasPendingWrites) onRemote(c.doc.data()); });
        if (first && !snap.metadata.fromCache) {
          first = false; readyRes();
          // upload files this device has that the class does not (first sign-in, offline edits)
          try {
            for (const k of await base.keys()) {
              if (!isReferenced(String(k))) continue;
              const d = remote.get(k), sh = shadow[k];
              if (!d || (d.d && !(sh && sh.d)) || dirty[k]) { if (!dirty[k]) dirty[k] = Date.now(); }
            }
            persist();
          } catch (e) { }
          schedule(800);
        } else if (first) readyRes();
        emit();
      }, err => { console.warn('files listen failed', err && err.code); readyRes(); });
      if (Object.keys(dirty).length) schedule(1500);
    },
    /** Tombstone class files whose widget/resource is gone (run once the class data is current). */
    async sweep(isReferenced) {
      if (!fb) return;
      const old = Date.now() - 60 * 60 * 1000;
      for (const [k, d] of remote) if (!d.d && (d.u || 0) < old && !isReferenced(k)) { try { await base.del(k); } catch (e) { } dirty[k] = Date.now(); }
      persist(); schedule(3000);
    },
    detach() { unsub && unsub(); clearTimeout(timer); fb = null; }
  };
  return adapter;
}
