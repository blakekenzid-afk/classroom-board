// Board ("screen") rendering: free-floating widget frames with drag,
// resize, z-order, close and settings. Frames are stored as FRACTIONS of
// the stage, rendered as CSS percentages, so a board scales to any screen.
import * as S from './store.js';
import { h, $, $$, clamp, icon, ico, picSrc } from './util.js';
import { REGISTRY } from './widgets/index.js';

let stage, live = new Map(); // widgetId -> {frame, inst, def}
let sheet = null, sheetFor = null;

export function initBoard(stageEl) {
  stage = stageEl;
  stage.addEventListener('pointerdown', e => { if (e.target === stage) select(null); });
  // one shared ticker for clocks / timers / timetable
  const tick = () => { const now = Date.now(); live.forEach(l => { try { l.inst.tick && l.inst.tick(now); } catch (err) { console.error(err); } }); };
  setInterval(tick, 250);
  new ResizeObserver(() => live.forEach(l => l.inst.resize && l.inst.resize())).observe(stage);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
}

export function renderBoard() {
  closeSettings();
  live.forEach(l => l.inst.destroy && l.inst.destroy());
  live.clear();
  $$('.wg', stage).forEach(n => n.remove());
  const b = S.activeBoard();
  b.widgets.forEach(w => mount(w));
}

function stageRect() { return stage.getBoundingClientRect(); }

function applyFrame(el, w) {
  el.style.left = (w.x * 100) + '%';
  el.style.top = (w.y * 100) + '%';
  el.style.width = (w.w * 100) + '%';
  el.style.height = (w.h * 100) + '%';
  el.style.zIndex = w.z || 1;
}

function mount(w) {
  const def = REGISTRY[w.type];
  if (!def) { console.warn('unknown widget', w.type); return; }
  const frame = h('div.wg.wg-' + w.type + (def.frameless ? '.frameless' : ''), { 'data-id': w.id, 'data-type': w.type });
  frame.style.minWidth = def.min.w + 'px'; frame.style.minHeight = def.min.h + 'px';
  const tools = h('div.wg-tools', null,
    def.settings !== false ? h('button.wg-btn', { title: 'Settings', 'aria-label': 'Settings', 'data-act': 'settings', html: ico.gear, onclick: () => openSettings(w.id) }) : null,
    h('button.wg-btn', { title: 'Remove', 'aria-label': 'Remove widget', 'data-act': 'close', html: ico.close, onclick: () => closeWidget(w.id) }));
  const head = h('div.wg-head', null, h('span.wg-grip'), tools);
  const body = h('div.wg-body');
  const rz = h('div.wg-resize', { title: 'Resize', 'aria-label': 'Resize' });
  frame.append(head, body, rz);
  applyFrame(frame, w);
  stage.append(frame);

  frame.addEventListener('pointerdown', () => { const z = S.bringToFront(w.id); frame.style.zIndex = z; select(w.id); }, true);
  enableDrag(frame, head, w, def);
  if (def.dragAnywhere) enableDrag(frame, body, w, def, true);
  enableResize(frame, rz, w, def);

  const ctx = {
    w, data: w.data, body, frame, def,
    save: () => S.save(),
    openSettings: () => openSettings(w.id),
    refreshSettings: () => { if (sheetFor === w.id) openSettings(w.id); }
  };
  const inst = def.mount(ctx) || {};
  live.set(w.id, { frame, inst, def, ctx });
  return frame;
}

function select(id) {
  $$('.wg.sel', stage).forEach(n => { if (n.dataset.id !== id) n.classList.remove('sel'); });
  if (id) { const l = live.get(id); l && l.frame.classList.add('sel'); }
}

function enableDrag(frame, handle, w, def, fromBody = false) {
  handle.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (e.target.closest('button, input, textarea, select, [contenteditable="true"], a, .no-drag')) return;
    e.preventDefault();
    const sr = stageRect(), fr = frame.getBoundingClientRect();
    const ox = e.clientX - fr.left, oy = e.clientY - fr.top;
    let moved = false;
    handle.setPointerCapture(e.pointerId);
    frame.classList.add('dragging');
    const move = ev => {
      const x = clamp(ev.clientX - sr.left - ox, 0, Math.max(0, sr.width - fr.width));
      const y = clamp(ev.clientY - sr.top - oy, 0, Math.max(0, sr.height - fr.height));
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
      moved = true;
      frame.style.left = (x / sr.width * 100) + '%';
      frame.style.top = (y / sr.height * 100) + '%';
    };
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      frame.classList.remove('dragging');
      if (moved) {
        w.x = parseFloat(frame.style.left) / 100; w.y = parseFloat(frame.style.top) / 100; S.save();
        if (fromBody) frame.dataset.justDragged = '1', setTimeout(() => delete frame.dataset.justDragged, 50);
      }
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
}

function enableResize(frame, handle, w, def) {
  handle.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    const sr = stageRect(), fr = frame.getBoundingClientRect();
    handle.setPointerCapture(e.pointerId);
    frame.classList.add('resizing');
    const ratio = fr.width / fr.height;
    const move = ev => {
      let nw = clamp(fr.width + ev.clientX - e.clientX, def.min.w, sr.right - fr.left);
      let nh = clamp(fr.height + ev.clientY - e.clientY, def.min.h, sr.bottom - fr.top);
      if (def.keepRatio) { nh = nw / ratio; if (fr.top + nh > sr.bottom) { nh = sr.bottom - fr.top; nw = nh * ratio; } }
      frame.style.width = (nw / sr.width * 100) + '%';
      frame.style.height = (nh / sr.height * 100) + '%';
    };
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      frame.classList.remove('resizing');
      w.w = parseFloat(frame.style.width) / 100; w.h = parseFloat(frame.style.height) / 100; S.save();
      const l = live.get(w.id); l && l.inst.resize && l.inst.resize();
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
}

export function closeWidget(id) {
  const l = live.get(id); if (!l) return;
  if (sheetFor === id) closeSettings();
  l.inst.destroy && l.inst.destroy();
  l.frame.classList.add('leaving');
  live.delete(id); S.removeWidget(id);
  setTimeout(() => l.frame.remove(), 180);
}

/** Add a widget of `type` in the emptiest spot near the middle. */
export function addWidget(type, data) {
  const def = REGISTRY[type]; const sr = stageRect();
  const pw = Math.min(def.size.w, sr.width * 0.9), ph = Math.min(def.size.h, sr.height * 0.9);
  const fw = pw / sr.width, fh = ph / sr.height;
  const others = S.activeBoard().widgets;
  let best = null;
  const steps = 14;
  for (let iy = 0; iy <= steps; iy++) for (let ix = 0; ix <= steps; ix++) {
    const x = ix / steps * (1 - fw), y = iy / steps * (1 - fh);
    let overlap = 0;
    for (const o of others) {
      const ox = Math.max(0, Math.min(x + fw, o.x + o.w) - Math.max(x, o.x));
      const oy = Math.max(0, Math.min(y + fh, o.y + o.h) - Math.max(y, o.y));
      overlap += ox * oy;
    }
    const dist = Math.hypot(x + fw / 2 - 0.5, y + fh / 2 - 0.45);
    const score = overlap * 10 + dist * 0.05;
    if (!best || score < best.score - 1e-9) best = { x, y, score };
  }
  const w = S.newWidget(type, { x: best.x, y: best.y, w: fw, h: fh }, Object.assign(def.defaults(), data || {}));
  S.addWidget(w);
  const frame = mount(w);
  frame.classList.add('entering');
  setTimeout(() => frame.classList.remove('entering'), 400);
  select(w.id);
  return w;
}

// ── settings sheet ──
export function openSettings(id) {
  const l = live.get(id); if (!l || !l.inst.settings) return;
  closeSettings(true);
  sheetFor = id;
  const body = h('div.sheet-body');
  sheet = h('aside.sheet', { role: 'dialog', 'aria-label': l.def.label + ' settings' },
    h('div.sheet-head', null,
      h('img.sheet-ico', { src: picSrc(l.def.icon), alt: '' }),
      h('h3', { text: l.def.label }),
      h('button.icon-btn', { 'aria-label': 'Close settings', 'data-act': 'close-settings', html: ico.close, onclick: () => closeSettings() })),
    body);
  document.body.append(sheet);
  l.frame.classList.add('editing');
  l.inst.settings(body);
  requestAnimationFrame(() => sheet && sheet.classList.add('open'));
}
export function closeSettings(instant) {
  if (!sheet) return;
  const s = sheet; sheet = null;
  const l = live.get(sheetFor); l && l.frame.classList.remove('editing');
  sheetFor = null;
  if (instant) s.remove(); else { s.classList.remove('open'); setTimeout(() => s.remove(), 200); }
}
export function liveWidgets() { return live; }
