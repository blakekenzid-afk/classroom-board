// Ink engine shared by the Drawing pad and PDF notes.
// Strokes are vectors stored in "width units": 10000 = the full width of
// the surface (y uses the same unit), so a drawing scales cleanly when the
// widget is resized and PDF notes stay on the page at any zoom.
// Works with mouse, finger and Apple Pencil (pointer events, pressure for pens).
import { h, $$, confirmDialog } from './util.js?v=5';

export const INK = [
  ['#23233F', 'Black'], ['#E2483D', 'Red'], ['#F08A24', 'Orange'], ['#F5C400', 'Yellow'], ['#2FA55A', 'Green'],
  ['#2B7DE9', 'Blue'], ['#8E5BD6', 'Purple'], ['#E2558E', 'Pink'], ['#8B5A2B', 'Brown'], ['#FFFFFF', 'White']
];
export const SIZES = [['s', 'Thin', 45], ['m', 'Medium', 95], ['l', 'Thick', 200]];
const U = 10000;
const sizeOf = k => (SIZES.find(s => s[0] === k) || SIZES[1])[2];

export const SKETCH_SVG = {
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4.5 1.5L5 15z"/><path d="M14.5 5.5l3 3"/></svg>',
  marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l-4 4h5l2-2"/><path d="M9 15l7.6-9.6a2 2 0 0 1 2.9-.2l.3.3a2 2 0 0 1-.2 2.9L10 16z"/><path d="M4 21h16" stroke-width="3" opacity=".45"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 20h12"/><path d="M4.4 13.6l8.2-8.2a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19.1a3 3 0 0 1-4.2 0l-2.4-2.4a2.2 2.2 0 0 1 0-3.1z"/><path d="M9 9l6 6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8"/><path d="M8 12h8" stroke-dasharray="2 2"/><path d="M8 16h8"/></svg>'
};

/** Draw one stroke onto a 2D context whose units are CSS px; W = surface width in px. */
export function drawStroke(g, st, W) {
  const k = W / U, p = st.p, step = st.pr ? 3 : 2, n = p.length / step;
  if (!n) return;
  const base = Math.max(1.2, st.s * k);
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (st.t === 'er') { g.globalCompositeOperation = 'destination-out'; g.strokeStyle = g.fillStyle = '#000'; }
  else { g.strokeStyle = g.fillStyle = st.c; if (st.t === 'hl') g.globalAlpha = 0.36; }
  const X = i => p[i * step] * k, Y = i => p[i * step + 1] * k, P = i => st.pr ? 0.35 + 1.1 * (p[i * step + 2] / 100) : 1;
  if (n === 1) { g.beginPath(); g.arc(X(0), Y(0), base * P(0) / 2, 0, Math.PI * 2); g.fill(); g.restore(); return; }
  if (!st.pr) {
    g.lineWidth = base; g.beginPath(); g.moveTo(X(0), Y(0));
    for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    g.lineTo(X(n - 1), Y(n - 1)); g.stroke();
  } else {
    // pressure: short curved segments, each with its own width
    let mx = X(0), my = Y(0);
    for (let i = 1; i < n; i++) {
      const ex = i < n - 1 ? (X(i) + X(i + 1)) / 2 : X(i), ey = i < n - 1 ? (Y(i) + Y(i + 1)) / 2 : Y(i);
      g.lineWidth = base * (P(i - 1) + P(i)) / 2;
      g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(X(i), Y(i), ex, ey); g.stroke();
      mx = ex; my = ey;
    }
  }
  g.restore();
}

/**
 * createSketch(host, { load, save, onChange })
 *   host  – element the ink canvas fills (position: relative)
 *   load  – async () => saved { v, ops } or null
 *   save  – (json) => void, called (debounced) after every change
 */
export function createSketch(host, { load, save, onChange, tool = 'pen', color = INK[0][0], size = 'm' } = {}) {
  const wrap = h('div.sk', { 'data-testid': 'sketch' });
  const base = h('canvas.sk-cv'), live = h('canvas.sk-cv.sk-live');
  wrap.append(base, live); host.append(wrap);
  const gb = base.getContext('2d'), gl = live.getContext('2d');
  let ops = [], redo = [], cur = null, active = null, penAt = 0, Wpx = 0, Hpx = 0, dpr = 1, saveT = 0, dirty = false, raf = 0, enabled = true;
  const st = { tool, color, size };

  const visible = () => { let i = ops.length - 1; while (i >= 0 && ops[i].t !== 'clear') i--; return ops.slice(i + 1); };
  const emit = () => onChange && onChange(api);
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(flush, 350); };
  function flush() { clearTimeout(saveT); saveT = 0; save && save({ v: 1, ops: visible() }); }

  function size2() {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (w === Wpx && hh === Hpx && d === dpr) return false;
    Wpx = w; Hpx = hh; dpr = d;
    [base, live].forEach(c => { c.width = Math.round(w * d); c.height = Math.round(hh * d); });
    return true;
  }
  function renderAll() {
    gb.setTransform(1, 0, 0, 1, 0, 0); gb.clearRect(0, 0, base.width, base.height); gb.setTransform(dpr, 0, 0, dpr, 0, 0);
    visible().forEach(s => drawStroke(gb, s, Wpx));
  }
  function renderLive() {
    raf = 0; if (!dirty) return; dirty = false;
    gl.setTransform(1, 0, 0, 1, 0, 0); gl.clearRect(0, 0, live.width, live.height); gl.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cur && cur.t !== 'er') drawStroke(gl, cur, Wpx);
  }
  const queue = () => { dirty = true; if (!raf) raf = requestAnimationFrame(renderLive); };

  const toPt = e => { const r = wrap.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * U), Math.round((e.clientY - r.top) / r.width * U)]; };
  function addPoint(e) {
    const [x, y] = toPt(e), p = cur.p, step = cur.pr ? 3 : 2;
    const lx = p[p.length - step], ly = p[p.length - step + 1];
    if (p.length && Math.abs(x - lx) + Math.abs(y - ly) < 6) return;
    if (cur.pr) p.push(x, y, Math.round(Math.max(0.05, e.pressure || 0.5) * 100)); else p.push(x, y);
    if (cur.t === 'er' && p.length >= step * 2) {
      // erase straight onto the committed layer as the finger moves
      const k = Wpx / U; gb.save(); gb.setTransform(dpr, 0, 0, dpr, 0, 0); gb.globalCompositeOperation = 'destination-out';
      gb.lineCap = 'round'; gb.lineWidth = Math.max(1.2, cur.s * k); gb.beginPath(); gb.moveTo(lx * k, ly * k); gb.lineTo(x * k, y * k); gb.stroke(); gb.restore();
    }
    queue();
  }
  function down(e) {
    if (!enabled || active !== null || e.button > 0) return;
    if (e.pointerType === 'pen') penAt = Date.now();
    else if (e.pointerType === 'touch' && Date.now() - penAt < 3000) return; // palm resting while using Apple Pencil
    e.preventDefault();
    size2();
    active = e.pointerId;
    try { live.setPointerCapture(e.pointerId); } catch (err) { }
    const t = st.tool === 'eraser' ? 'er' : st.tool === 'marker' ? 'hl' : 'pen';
    const s = sizeOf(st.size) * (t === 'hl' ? 2.6 : t === 'er' ? 3 : 1);
    cur = { t, c: st.color, s, p: [] };
    if (e.pointerType === 'pen' && t === 'pen' && e.pressure > 0) cur.pr = 1;
    addPoint(e);
  }
  function move(e) {
    if (e.pointerId !== active || !cur) return;
    e.preventDefault();
    if (e.pointerType === 'pen') penAt = Date.now();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    (list && list.length ? list : [e]).forEach(addPoint);
  }
  function up(e) {
    if (e.pointerId !== active) return;
    active = null;
    if (!cur) return;
    const s = cur; cur = null;
    if (s.p.length) { ops.push(s); redo = []; if (s.t !== 'er') { gb.setTransform(dpr, 0, 0, dpr, 0, 0); drawStroke(gb, s, Wpx); } else renderAll(); }
    dirty = true; renderLive(); persist(); emit();
  }
  live.addEventListener('pointerdown', down);
  live.addEventListener('pointermove', move);
  live.addEventListener('pointerup', up);
  live.addEventListener('pointercancel', up);
  live.addEventListener('lostpointercapture', up);
  // iOS: never let a touch on the ink start a scroll, zoom or text selection
  const stopTouch = e => { if (enabled) e.preventDefault(); };
  live.addEventListener('touchstart', stopTouch, { passive: false });
  live.addEventListener('touchmove', stopTouch, { passive: false });
  live.addEventListener('contextmenu', e => e.preventDefault());

  const ro = new ResizeObserver(() => { if (size2()) renderAll(); });
  ro.observe(wrap);

  const api = {
    el: wrap,
    get state() { return st; },
    get count() { return visible().length; },
    set(k, v) { st[k] = v; emit(); },
    canUndo: () => ops.length > 0,
    canRedo: () => redo.length > 0,
    undo() { if (!ops.length) return; redo.push(ops.pop()); renderAll(); persist(); emit(); },
    redo() { if (!redo.length) return; ops.push(redo.pop()); renderAll(); persist(); emit(); },
    clear() { if (!visible().length) return; ops.push({ t: 'clear' }); redo = []; renderAll(); persist(); emit(); },
    async askClear() { if (visible().length && await confirmDialog('Clear the drawing?', 'Everything on this page will be wiped. You can still press Undo.', 'Clear')) api.clear(); },
    setEnabled(v) { enabled = v; wrap.classList.toggle('off', !v); },
    resize() { if (size2()) renderAll(); },
    flush() { if (saveT) flush(); },
    /** Draw the ink onto another context (used to export / screenshots). */
    paint(g, W) { visible().forEach(s => drawStroke(g, s, W)); },
    async reload() {
      ops = []; redo = [];
      try { const d = load && await load(); if (d && Array.isArray(d.ops)) ops = d.ops.filter(o => o && (o.t === 'clear' || Array.isArray(o.p))); }
      catch (e) { console.warn('ink load failed', e); }
      size2(); renderAll(); emit();
    },
    destroy() { if (saveT) flush(); ro.disconnect(); cancelAnimationFrame(raf); wrap.remove(); }
  };
  size2();
  api.ready = api.reload();
  return api;
}

const svgBtn = (k, label, act, cls = '') => h('button.sk-btn' + cls, { type: 'button', title: label, 'aria-label': label, 'data-act': act, html: SKETCH_SVG[k] });

/** Big, touch-friendly toolbar for a sketch. `extra` = more buttons placed at the end. */
export function sketchToolbar(sk, { extra = [], onPick } = {}) {
  const bar = h('div.sk-bar', { 'data-testid': 'sketch-bar' });
  const tools = h('div.sk-grp.sk-tools', { role: 'radiogroup', 'aria-label': 'Tool' },
    svgBtn('pen', 'Pen', 'tool-pen'), svgBtn('marker', 'Highlighter', 'tool-marker'), svgBtn('eraser', 'Eraser', 'tool-eraser'));
  const colors = h('div.sk-grp.sk-colors', { role: 'radiogroup', 'aria-label': 'Color' },
    INK.map(([c, l]) => h('button.sk-sw', { type: 'button', title: l, 'aria-label': l, 'data-color': c, style: { '--c': c } })));
  const sizes = h('div.sk-grp.sk-sizes', { role: 'radiogroup', 'aria-label': 'Size' },
    SIZES.map(([k, l]) => h('button.sk-size', { type: 'button', title: l, 'aria-label': l, 'data-size': k }, h('i.sz-' + k))));
  const undoB = svgBtn('undo', 'Undo', 'ink-undo'), redoB = svgBtn('redo', 'Redo', 'ink-redo'), clearB = svgBtn('clear', 'Clear all', 'ink-clear', '.danger');
  const acts = h('div.sk-grp.sk-acts', null, undoB, redoB, clearB, ...extra);
  bar.append(tools, colors, sizes, acts);
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !bar.contains(b)) return;
    const a = b.dataset.act;
    if (a && a.startsWith('tool-')) {
      const t = a.slice(5); sk.set('tool', t);
      if (t === 'marker' && ['#23233F', '#8B5A2B', '#FFFFFF'].includes(sk.state.color)) sk.set('color', '#F5C400');
    }
    else if (b.dataset.color) { sk.set('color', b.dataset.color); if (sk.state.tool === 'eraser') sk.set('tool', 'pen'); }
    else if (b.dataset.size) sk.set('size', b.dataset.size);
    else if (a === 'ink-undo') sk.undo();
    else if (a === 'ink-redo') sk.redo();
    else if (a === 'ink-clear') sk.askClear();
    else return;
    onPick && onPick(sk.state);
  });
  const sync = () => {
    const s = sk.state;
    $$('.sk-tools .sk-btn', bar).forEach(b => { const on = b.dataset.act === 'tool-' + s.tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('.sk-sw', bar).forEach(b => { const on = b.dataset.color === s.color; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('.sk-size', bar).forEach(b => { const on = b.dataset.size === s.size; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    bar.style.setProperty('--pen', s.color);
    undoB.disabled = !sk.canUndo(); redoB.disabled = !sk.canRedo(); clearB.disabled = !sk.count;
  };
  bar.sync = sync; sync();
  return bar;
}
