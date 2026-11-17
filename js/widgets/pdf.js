// PDF: upload or drop a PDF, page through it, zoom, full screen, and draw
// notes on top of each page. pdf.js loads from jsDelivr (pinned) only when a
// PDF widget is used. The file lives in IndexedDB ("<id>:pdf"), notes per page
// ("<id>:ann:<page>"), so big files never hit the localStorage limit.
import { h, $, $$, icon, ico, section, toast, pickFile, confirmDialog } from '../util.js?v=5';
import { blobs, env } from '../store.js?v=5';
import { CLOUD_FILE_MAX } from '../cloud/config.js?v=5';
import { createSketch, sketchToolbar, SKETCH_SVG } from '../sketch.js?v=5';

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
const BIG = 25 * 1024 * 1024, MAX = 250 * 1024 * 1024;
let libP = null;
export function loadPdfJs() {
  if (!libP) libP = import(PDFJS + 'legacy/build/pdf.min.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = PDFJS + 'legacy/build/pdf.worker.min.mjs';
    return lib;
  }).catch(e => { libP = null; throw e; });
  return libP;
}
const mb = n => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
const SV = {
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  fitw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>',
  fitp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'
};
const tb = (html, label, act, cls = '') => h('button.pf-tb' + cls, { type: 'button', title: label, 'aria-label': label, 'data-act': act, html });

export const pdf = {
  type: 'pdf', label: 'PDF', icon: 'pdf',
  size: { w: 640, h: 600 }, min: { w: 320, h: 300 },
  transient: ['page', 'fit', 'zoom', 'annotate', 'tool', 'color', 'size'],
  defaults: () => ({ name: '', bytes: 0, pages: 0, page: 1, fit: 'page', zoom: 1, annotate: false, tool: 'pen', color: '#E2483D', size: 'm' }),
  mount(ctx) {
    const d = ctx.data, id = ctx.w.id;
    const root = h('div.pf', { 'data-testid': 'pdf' }); ctx.body.append(root);
    let doc = null, task = null, sk = null, bar = null, alive = true, page = null, renderSeq = 0, loadingFile = false;
    const els = {};

    async function loadFile(file) {
      if (!file) return;
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name || '')) { toast('That is not a PDF file.', 'err'); return; }
      if (file.size > MAX) { toast('That PDF is ' + mb(file.size) + ' – too big for this board. Try a smaller copy.', 'err'); return; }
      loadingFile = true; showMsg('Opening ' + (file.name || 'PDF') + '…', true);
      try {
        const buf = await file.arrayBuffer();
        const head = new Uint8Array(buf.slice(0, 1024)); if (!String.fromCharCode(...head).includes('%PDF')) throw new Error('not a pdf');
        for (const k of await blobs.keys()) if (String(k).startsWith(id + ':ann:')) await blobs.del(k);
        await blobs.put(id + ':pdf', buf);
        Object.assign(d, { name: (file.name || 'Document.pdf').slice(0, 80), bytes: file.size, pages: 0, page: 1, annotate: false });
        ctx.save();
        if (file.size > BIG) toast('This PDF is big (' + mb(file.size) + '). It is saved, but pages may open slowly on an iPad.');
        loadingFile = false;
        await open();
      } catch (e) {
        loadingFile = false;
        console.warn('pdf load', e);
        if (/quota/i.test(e && (e.name + e.message))) toast('There is no room left to save this PDF on this device.', 'err');
        else toast(e.message === 'not a pdf' ? 'That file does not look like a PDF.' : 'That PDF could not be opened.', 'err');
        draw();
      }
    }
    function showMsg(text, spin) {
      root.innerHTML = '';
      root.append(h('div.pf-msg', null, spin ? h('i.pf-spin') : null, h('b', { text })));
    }
    function draw() {
      root.innerHTML = '';
      if (!d.name) {
        const dz = h('button.pf-empty', { type: 'button', 'data-act': 'pdf-upload', onclick: () => choose() },
          h('img.pf-hero', { src: 'icons/pdf.svg', alt: '' }), h('b', { text: 'Add a PDF' }), h('small', { text: 'Tap to choose a file, or drop a PDF here' }));
        root.append(dz);
        return;
      }
      open();
    }
    async function choose() { const f = await pickFile('application/pdf,.pdf'); if (f) loadFile(f); }

    async function open() {
      showMsg('Opening ' + d.name + '…', true);
      let lib, buf;
      try { lib = await loadPdfJs(); }
      catch (e) { console.warn(e); return fail('The PDF viewer needs the internet to load. Check the connection and try again.'); }
      try { buf = await blobs.get(id + ':pdf'); } catch (e) { buf = null; }
      if (!alive) return;
      if (!buf) return fail(env.cloud && d.bytes > CLOUD_FILE_MAX ? 'This PDF is over 10 MB, so it stays on the device that added it.' : 'This PDF is not saved on this device. Add it again.', true);
      try {
        if (doc) { doc.destroy(); doc = null; }
        doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)), cMapUrl: PDFJS + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS + 'standard_fonts/', isEvalSupported: false, verbosity: 0 }).promise;
      } catch (e) { console.warn(e); return fail('That PDF could not be opened.', true); }
      if (!alive) { doc.destroy(); return; }
      if (d.pages !== doc.numPages) { d.pages = doc.numPages; ctx.save(); }
      d.page = Math.min(Math.max(1, d.page || 1), d.pages);
      viewer();
    }
    function fail(text, offerNew) {
      root.innerHTML = '';
      root.append(h('div.pf-msg', null, h('img.pf-hero', { src: 'icons/pdf.svg', alt: '' }), h('b', { text }),
        h('div.row', null, offerNew ? h('button.btn.primary', { type: 'button', text: 'Choose a PDF', onclick: () => choose() }) : h('button.btn.primary', { type: 'button', text: 'Try again', onclick: () => open() }))));
    }

    function viewer() {
      root.innerHTML = '';
      if (env.cloud && d.bytes > CLOUD_FILE_MAX) root.append(h('span.only-here.pf-only', { 'data-testid': 'only-here', title: 'Over 10 MB, so it is not copied to your class', text: 'Only on this device' }));
      els.scroll = h('div.pf-scroll');
      els.pageEl = h('div.pf-page');
      els.canvas = h('canvas.pf-cv');
      els.pageEl.append(els.canvas);
      els.scroll.append(els.pageEl);
      els.ind = h('div.pf-ind', { 'data-testid': 'pdf-page' });
      els.prev = tb(SV.prev, 'Previous page', 'pdf-prev'); els.next = tb(SV.next, 'Next page', 'pdf-next');
      els.zout = tb(ico.minus, 'Zoom out', 'pdf-zoom-out'); els.zin = tb(ico.plus, 'Zoom in', 'pdf-zoom-in');
      els.fit = tb(SV.fitw, 'Fit width', 'pdf-fit');
      els.ann = h('button.pf-tb.pf-ann', { type: 'button', 'data-act': 'pdf-annotate', 'aria-pressed': 'false', title: 'Draw on this page' }, h('span.i', { html: SKETCH_SVG.pen }), h('span.pf-annl', { text: 'Draw' }));
      els.fs = tb(ico.expand, 'Full screen', 'pdf-fullscreen');
      els.navGrp = h('div.pf-grp', null, els.prev, els.ind, els.next);
      const nav = h('div.pf-bar', null,
        els.navGrp,
        h('div.pf-grp.pf-zoom', null, els.zout, els.fit, els.zin),
        h('div.pf-grp', null, els.ann, els.fs));
      els.prev.onclick = () => go(d.page - 1); els.next.onclick = () => go(d.page + 1);
      els.zin.onclick = () => zoomBy(1.25); els.zout.onclick = () => zoomBy(1 / 1.25);
      els.fit.onclick = () => { d.fit = d.fit === 'page' ? 'width' : 'page'; d.zoom = 1; ctx.save(); render(); };
      els.ann.onclick = () => setAnnotate(!d.annotate);
      els.fs.onclick = toggleFs;
      els.inkbar = h('div.pf-ink');
      root.append(els.scroll, nav, els.inkbar);
      sk = createSketch(els.pageEl, {
        load: () => blobs.get(id + ':ann:' + d.page),
        save: j => { const k = id + ':ann:' + sk.page; (j.ops.length ? blobs.put(k, j) : blobs.del(k)).catch(e => console.warn(e)); },
        onChange: s => { bar && bar.sync(); root.dataset.strokes = s.count; if (s.state.tool !== d.tool || s.state.color !== d.color || s.state.size !== d.size) { d.tool = s.state.tool; d.color = s.state.color; d.size = s.state.size; ctx.save(); } },
        tool: d.tool, color: d.color, size: d.size
      });
      sk.page = d.page;
      const done = h('button.sk-btn.sk-done', { type: 'button', 'data-act': 'pdf-annotate-done', text: 'Done', onclick: () => setAnnotate(false) });
      els.inkNav = h('div.sk-grp.pf-inknav');
      bar = sketchToolbar(sk, { extra: [done] });
      bar.insertBefore(els.inkNav, bar.lastChild);
      els.inkbar.append(bar);
      setAnnotate(!!d.annotate, true);
      render();
    }
    function setAnnotate(on, quiet) {
      d.annotate = on; if (!quiet) ctx.save();
      root.classList.toggle('annotating', on);
      els.ann.classList.toggle('on', on); els.ann.setAttribute('aria-pressed', String(on));
      // while drawing, the page arrows sit in the ink toolbar so the page keeps its room
      (on ? els.inkNav : els.navGrp).append(els.prev, els.ind, els.next);
      sk && sk.setEnabled(on);
      if (!quiet) requestAnimationFrame(render);
    }
    function zoomBy(f) { d.zoom = Math.min(4, Math.max(0.5, Math.round(d.zoom * f * 100) / 100)); ctx.save(); render(); }
    async function go(n) {
      if (!doc) return;
      n = Math.min(Math.max(1, n), doc.numPages); if (n === d.page) return;
      sk.flush(); d.page = n; ctx.save();
      els.scroll.scrollTop = 0;
      await render();
    }
    let lastW = 0, lastH = 0;
    async function render() {
      if (!doc || !alive) return;
      const seq = ++renderSeq;
      const n = d.page;
      els.ind.innerHTML = ''; els.ind.append(h('b', { text: String(n) }), h('span', { text: ' / ' + doc.numPages }));
      els.ind.dataset.page = n; els.ind.dataset.pages = doc.numPages;
      els.prev.disabled = n <= 1; els.next.disabled = n >= doc.numPages;
      els.fit.innerHTML = d.fit === 'page' ? SV.fitw : SV.fitp;
      els.fit.title = d.fit === 'page' ? 'Fit width' : 'Whole page';
      els.fit.setAttribute('aria-label', els.fit.title);
      els.zin.disabled = d.zoom >= 4; els.zout.disabled = d.zoom <= 0.5;
      let pg;
      try { pg = await doc.getPage(n); } catch (e) { console.warn(e); return; }
      if (seq !== renderSeq || !alive) return;
      const vp1 = pg.getViewport({ scale: 1 });
      const r = els.scroll.getBoundingClientRect(); lastW = r.width; lastH = r.height;
      const availW = Math.max(50, r.width - 16), availH = Math.max(50, r.height - 16);
      const fitScale = d.fit === 'width' ? availW / vp1.width : Math.min(availW / vp1.width, availH / vp1.height);
      const scale = fitScale * d.zoom;
      const cssW = Math.floor(vp1.width * scale), cssH = Math.floor(vp1.height * scale);
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      const maxPx = 12e6; if (cssW * cssH * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cssW * cssH)); // iPad canvas limit
      const vp = pg.getViewport({ scale: scale * dpr });
      const cv = document.createElement('canvas'); cv.className = 'pf-cv';
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      if (task) { try { task.cancel(); } catch (e) { } }
      task = pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, background: '#ffffff' });
      try { await task.promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; console.warn(e); return; }
      if (seq !== renderSeq || !alive) return;
      task = null;
      els.pageEl.style.width = cssW + 'px'; els.pageEl.style.height = cssH + 'px';
      els.canvas.replaceWith(cv); els.canvas = cv;
      els.scroll.classList.toggle('center', cssH < availH);
      if (sk.page !== n) { sk.flush(); sk.page = n; await sk.reload(); } else sk.resize();
      root.dataset.rendered = n;
      pg.cleanup && pg.cleanup();
    }
    function toggleFs() {
      const f = ctx.frame, fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl === f) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (f.classList.contains('max')) { f.classList.remove('max'); setTimeout(render, 60); return; }
      const req = f.requestFullscreen || f.webkitRequestFullscreen;
      let p = null;
      try { p = req ? req.call(f) : null; } catch (e) { p = null; }
      if (p && p.catch) p.catch(() => { f.classList.add('max'); setTimeout(render, 60); });
      else if (!req) { f.classList.add('max'); setTimeout(render, 60); }
    }
    const onFs = () => setTimeout(() => { if (!alive) return; els.fs && (els.fs.innerHTML = (document.fullscreenElement || document.webkitFullscreenElement) === ctx.frame ? ico.shrink : ico.expand); render(); }, 80);
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    const onKey = e => {
      if (!ctx.frame.classList.contains('sel') || !doc || e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(d.page + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(d.page - 1); }
      if (e.key === 'Escape' && ctx.frame.classList.contains('max')) { ctx.frame.classList.remove('max'); setTimeout(render, 60); }
    };
    window.addEventListener('keydown', onKey);
    // drop a PDF onto this widget
    root.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); root.classList.add('drop'); } });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', e => { e.preventDefault(); root.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

    let rT = 0;
    draw();
    return {
      loadFile,
      resize: () => { clearTimeout(rT); rT = setTimeout(() => { if (doc && els.scroll) { const r = els.scroll.getBoundingClientRect(); if (Math.abs(r.width - lastW) > 2 || Math.abs(r.height - lastH) > 2) render(); } }, 120); },
      destroy: () => {
        alive = false; clearTimeout(rT);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
        sk && sk.destroy(); if (task) try { task.cancel(); } catch (e) { }
        if (doc) doc.destroy();
      },
      settings: panel => {
        panel.append(section('PDF', d.name ? h('div.pf-file', null, h('img', { src: 'icons/pdf.svg', alt: '' }), h('div', null, h('b', { text: d.name }), h('small', { text: (d.pages ? d.pages + ' page' + (d.pages === 1 ? '' : 's') + ' · ' : '') + mb(d.bytes || 0) }))) : null,
          h('div.row', null, h('button.btn.primary', { type: 'button', 'data-act': 'pdf-replace', onclick: () => choose() }, icon('upload'), d.name ? 'Choose another PDF' : 'Choose a PDF')),
          h('small.hint', { text: 'The PDF is saved on this device only. Notes you draw are kept for each page.' })),
          d.name ? section('Notes', h('button.btn.ghost', { type: 'button', text: 'Erase notes on every page', onclick: async () => {
            if (!await confirmDialog('Erase all notes?', 'Drawings on every page of this PDF will be removed.', 'Erase')) return;
            for (const k of await blobs.keys()) if (String(k).startsWith(id + ':ann:')) await blobs.del(k);
            if (sk) await sk.reload();
          } })) : null);
      }
    };
  }
};
