// Drawing pad: pen, highlighter, eraser, colors, sizes, its own undo/redo,
// and practice papers (lined, grid, handwriting lines, chalkboard).
// The ink is saved per widget in IndexedDB (key "<widgetId>:draw").
import { h, $, $$, section } from '../util.js?v=5';
import { blobs } from '../store.js?v=5';
import { createSketch, sketchToolbar, SKETCH_SVG } from '../sketch.js?v=5';

export const PAPERS = [['blank', 'Blank'], ['lined', 'Lined'], ['grid', 'Grid'], ['hand', 'Handwriting'], ['chalk', 'Chalkboard']];

/** Paint a practice paper. Every measure is a fraction of the width so ink stays on its lines. */
export function paintPaper(cv, kind, W, H, dpr) {
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = kind === 'chalk' ? '#2E4A3B' : '#FFFFFF'; g.fillRect(0, 0, W, H);
  const line = (y, color, w, dash) => { g.beginPath(); g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = w; g.moveTo(0, Math.round(y) + .5); g.lineTo(W, Math.round(y) + .5); g.stroke(); };
  if (kind === 'lined') {
    const sp = Math.max(18, W * 0.062);
    for (let y = sp * 1.6; y < H; y += sp) line(y, '#BFD5F0', 1.5);
    g.beginPath(); g.setLineDash([]); g.strokeStyle = '#F2B3B3'; g.lineWidth = 2; const mx = Math.round(W * 0.085) + .5; g.moveTo(mx, 0); g.lineTo(mx, H); g.stroke();
  } else if (kind === 'grid') {
    const sp = Math.max(14, W * 0.05);
    g.strokeStyle = '#E0E6F2'; g.lineWidth = 1;
    for (let x = sp; x < W; x += sp) { g.beginPath(); g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, H); g.stroke(); }
    for (let y = sp; y < H; y += sp) line(y, '#E0E6F2', 1);
  } else if (kind === 'hand') {
    // top line (blue) · dashed midline · baseline (red), then a gap for tails
    const row = Math.max(40, W * 0.115), gap = row * 0.5, dash = [Math.max(6, W * 0.016), Math.max(5, W * 0.012)];
    for (let y = row * 0.45; y + row < H + 2; y += row + gap) {
      line(y, '#6E9BDB', 2.5);
      line(y + row / 2, '#9FB9E6', 2, dash);
      line(y + row, '#E06666', 3);
    }
  }
  g.setLineDash([]);
}

export const draw = {
  type: 'draw', label: 'Drawing', icon: 'crayon',
  size: { w: 760, h: 540 }, min: { w: 340, h: 300 },
  transient: ['tool', 'color', 'size'],
  defaults: () => ({ paper: 'blank', tool: 'pen', color: '#23233F', size: 'm' }),
  mount(ctx) {
    const d = ctx.data, key = ctx.w.id + ':draw';
    const root = h('div.dp', { 'data-testid': 'drawpad' });
    const surface = h('div.dp-surface');
    const paper = h('canvas.dp-paper', { 'aria-hidden': 'true' });
    surface.append(paper);
    let bar;
    const sk = createSketch(surface, {
      load: () => blobs.get(key),
      save: j => blobs.put(key, j).catch(e => { console.warn(e); window.dispatchEvent(new CustomEvent('cb:save-error', { detail: e })); }),
      onChange: s => { bar && bar.sync(); root.dataset.strokes = s.count; if (s.state.tool !== d.tool || s.state.color !== d.color || s.state.size !== d.size) { d.tool = s.state.tool; d.color = s.state.color; d.size = s.state.size; ctx.save(); } },
      tool: d.tool, color: d.color, size: d.size
    });
    const paperBtn = h('button.sk-btn', { type: 'button', title: 'Paper', 'aria-label': 'Paper', 'data-act': 'paper', html: SKETCH_SVG.paper });
    bar = sketchToolbar(sk, { extra: [paperBtn] });
    const paperGrid = (cls, after) => {
      const g = h('div.' + cls, { role: 'menu', 'aria-label': 'Paper' });
      PAPERS.forEach(([k, l]) => {
        const b = h('button.dp-paper-opt' + (k === d.paper ? '.on' : ''), { type: 'button', 'data-paper': k }, h('span.pp-prev.pp-' + k), h('span', { text: l }));
        b.onclick = () => { setPaper(k); after && after(); $$('.dp-paper-opt', g).forEach(x => x.classList.toggle('on', x === b)); };
        g.append(b);
      });
      return g;
    };
    const pop = paperGrid('dp-pop', () => pop.classList.remove('open'));
    paperBtn.onclick = e => { e.stopPropagation(); pop.classList.toggle('open'); syncPop(); };
    const closePop = e => { if (!pop.contains(e.target) && e.target !== paperBtn && !paperBtn.contains(e.target)) pop.classList.remove('open'); };
    document.addEventListener('pointerdown', closePop, true);
    root.append(bar, surface, pop);
    ctx.body.append(root);

    const syncPop = () => $$('.dp-paper-opt', pop).forEach(b => b.classList.toggle('on', b.dataset.paper === d.paper));
    function setPaper(k) { d.paper = k; ctx.save(); paintNow(); syncPop(); }
    let pw = 0, ph = 0;
    function paintNow(force = true) {
      const r = surface.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
      if (!force && W === pw && H === ph) return; pw = W; ph = H;
      if (W > 0 && H > 0) paintPaper(paper, d.paper, W, H, Math.min(2, devicePixelRatio || 1));
      root.dataset.paper = d.paper;
    }
    const ro = new ResizeObserver(() => paintNow(false)); ro.observe(surface);
    paintNow();
    root.dataset.strokes = 0;
    return {
      sketch: sk,
      resize: () => { paintNow(false); sk.resize(); },
      destroy: () => { ro.disconnect(); document.removeEventListener('pointerdown', closePop, true); sk.destroy(); },
      settings: panel => {
        panel.append(section('Paper', paperGrid('dp-paper-grid')),
          section(null, h('small.hint.box', { text: 'Tip: Handwriting paper has a top line, a dotted middle line and a red base line for letter practice. Your drawing is saved on this device.' })));
      }
    };
  }
};
