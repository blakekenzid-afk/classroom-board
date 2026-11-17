// Small UI pieces shared by the teacher pages.
import { h, $$, ico, picSrc } from '../util.js?v=4';
import { parseYmd } from './tstore.js?v=4';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const fmtLong = s => { const d = parseYmd(s); return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); };
export const fmtShort = s => { const d = parseYmd(s); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
export const fmtDow = s => DAYS[parseYmd(s).getDay()].slice(0, 3);
export function fmtT(hhmm) { if (!hhmm) return ''; const [H, M] = hhmm.split(':').map(Number); return (H % 12 || 12) + ':' + String(M).padStart(2, '0') + (H < 12 ? ' AM' : ' PM'); }
export const fmtRange = (a, b) => fmtT(a).replace(/ (AM|PM)$/, (m, x) => fmtT(b).endsWith(x) ? '' : m) + ' – ' + fmtT(b);

export const SV = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20l4-4 4 4"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v20M4 6.5l16 11M20 6.5l-16 11"/></svg>',
  bump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h13M13 7l5 5-5 5"/><path d="M21 5v14"/></svg>',
  bold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>',
  italic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M10 5h8M6 19h8M14.5 5l-5 14"/></svg>',
  underline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/></svg>',
  ul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="18" r="1.4" fill="currentColor"/></svg>',
  ol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.2a1.5 1.5 0 0 1 2.8.8L3.5 18h3"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h12M12 5l-4 14M4 20l16-16"/></svg>',
  calPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15 7.2"/></svg>'
};
export const sv = (n, cls = 'i') => h('span.' + cls, { html: SV[n] || ico[n], 'aria-hidden': 'true' });
export const fl = (name, cls = 'fl') => h('img.' + cls, { src: picSrc(name), alt: '', draggable: 'false' });

/** A big friendly empty state. */
export const empty = (icon, title, sub, action) => h('div.t-empty', null, fl(icon, 't-empty-ico'), h('b', { text: title }), sub ? h('small', { text: sub }) : null, action || null);

/** Modal with custom body. Resolves with whatever `done(v)` was called with (undefined when dismissed). */
export function modal(title, build, { cls = '', icon } = {}) {
  return new Promise(res => {
    let closed = false;
    const done = v => { if (closed) return; closed = true; document.removeEventListener('keydown', esc, true); back.remove(); res(v); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); done(undefined); } };
    const body = h('div.tm-body');
    const back = h('div.modal-back.t-modal-back', { onpointerdown: e => { if (e.target === back) done(undefined); } },
      h('div.modal.t-modal' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-label': title },
        h('div.tm-head', null, icon ? fl(icon, 'tm-ico') : null, h('h3', { text: title }), h('button.icon-btn', { type: 'button', 'aria-label': 'Close', 'data-act': 'modal-close', html: ico.close, onclick: () => done(undefined) })),
        body));
    document.addEventListener('keydown', esc, true);
    document.body.append(back);
    build(body, done);
    setTimeout(() => { const f = body.querySelector('[autofocus]'); if (f && matchMedia('(hover:hover)').matches) f.focus(); }, 40);
  });
}

/** Little popover menu anchored to a button. items: [{label, icon(svg name), act, danger, fn}] */
let openPop = null;
export function popMenu(anchor, items) {
  closePop();
  const m = h('div.menu.t-pop.open', { role: 'menu' });
  items.filter(Boolean).forEach(it => m.append(h('button.t-pop-item' + (it.danger ? '.danger' : ''), { type: 'button', role: 'menuitem', 'data-act': it.act || '', onclick: () => { closePop(); it.fn(); } }, it.icon ? sv(it.icon) : null, h('span', { text: it.label }))));
  document.body.append(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let top = r.bottom + 8; if (top + mh > innerHeight - 10) top = Math.max(10, r.top - mh - 8);
  m.style.top = top + 'px'; m.style.left = Math.max(10, Math.min(innerWidth - mw - 10, r.right - mw)) + 'px';
  openPop = m;
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  return m;
}
function outside(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
export function closePop() { if (openPop) { openPop.remove(); openPop = null; document.removeEventListener('pointerdown', outside, true); } }
window.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

/** Chip input for tags/labels. */
export function tagInput(values, onChange, { placeholder = 'Add a tag…', suggestions = [], testid = 'tags' } = {}) {
  let vals = values.slice();
  const wrap = h('div.t-tags', { 'data-testid': testid });
  const listId = 'dl_' + Math.random().toString(36).slice(2, 8);
  const inp = h('input.t-tag-in', { type: 'text', placeholder, 'aria-label': placeholder, list: listId, maxlength: 30, enterkeyhint: 'done' });
  const dl = h('datalist', { id: listId }, suggestions.map(s => h('option', { value: s })));
  const draw = () => {
    $$('.t-tag', wrap).forEach(n => n.remove());
    vals.forEach(v => inp.before(h('span.t-tag', null, h('span', { text: v }), h('button', { type: 'button', 'aria-label': 'Remove ' + v, 'data-act': 'tag-remove', html: ico.close, onclick: () => { vals = vals.filter(x => x !== v); draw(); onChange(vals); } }))));
  };
  const commit = () => {
    const parts = inp.value.split(',').map(s => s.trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean);
    let ch = false; parts.forEach(p => { if (!vals.some(v => v.toLowerCase() === p.toLowerCase())) { vals.push(p); ch = true; } });
    inp.value = ''; if (ch) { draw(); onChange(vals); }
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !inp.value && vals.length) { vals.pop(); draw(); onChange(vals); }
  });
  inp.addEventListener('change', () => { if (suggestions.includes(inp.value.trim())) commit(); });
  inp.addEventListener('blur', commit);
  wrap.append(inp, dl); wrap.addEventListener('click', e => { if (e.target === wrap) inp.focus(); });
  draw();
  return wrap;
}

/** Stable pastel colour for a tag / initials. */
const PALETTE = [['#EEEEFD', '#4A4AC4'], ['#E3F5EA', '#1D7A45'], ['#FFEADB', '#B4521A'], ['#E4F1FF', '#1F63B5'], ['#FCE7F3', '#A61E67'], ['#FFF4C7', '#8A6100'], ['#E6F7F7', '#11726F'], ['#F1E9FF', '#6B3FC0']];
export function tint(s) { let n = 0; for (const c of String(s || '')) n = (n * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[n % PALETTE.length]; }

/**
 * Pointer drag that works with mouse, pen and touch. `src` starts the drag
 * (touch only from `.t-grip` inside it so lists still scroll on an iPad).
 * Drop targets carry [data-drop]; onDrop(targetEl) is called on release.
 */
export function dragSource(src, { ghostText, onDrop, onStart, onEnd, scroller }) {
  src.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (e.target.closest('button:not(.t-grip), input, a')) return;
    if (e.pointerType !== 'mouse' && !e.target.closest('.t-grip')) return;
    const x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null, lastEv = e, scrollT = 0;
    const cap = e.target.closest('.t-grip') || src;
    try { cap.setPointerCapture(e.pointerId); } catch (er) { }
    if (e.pointerType !== 'mouse') e.preventDefault();
    const find = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('[data-drop]'); };
    const move = ev => {
      lastEv = ev;
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        ghost = h('div.t-ghost', { text: ghostText() }); document.body.append(ghost);
        src.classList.add('t-dragging'); document.body.classList.add('t-is-dragging'); onStart && onStart();
        const sc = scroller && scroller();
        if (sc) scrollT = setInterval(() => {
          const r = sc.getBoundingClientRect(), y = lastEv.clientY, x = lastEv.clientX, edge = 60;
          if (y < r.top + edge) sc.scrollTop -= Math.ceil((r.top + edge - y) / 5); else if (y > r.bottom - edge) sc.scrollTop += Math.ceil((y - (r.bottom - edge)) / 5);
          if (x > r.right - edge) sc.scrollLeft += Math.ceil((x - (r.right - edge)) / 5); else if (x < r.left + edge) sc.scrollLeft -= Math.ceil((r.left + edge - x) / 5);
        }, 16);
      }
      ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
      const t = find(ev.clientX, ev.clientY);
      if (t !== over) { over && over.classList.remove('t-over'); over = t; over && over.classList.add('t-over'); }
    };
    const up = ev => {
      cap.removeEventListener('pointermove', move); cap.removeEventListener('pointerup', up); cap.removeEventListener('pointercancel', up);
      clearInterval(scrollT);
      if (!ghost) return;
      ghost.remove(); src.classList.remove('t-dragging'); document.body.classList.remove('t-is-dragging');
      over && over.classList.remove('t-over');
      const t = ev.type === 'pointerup' ? find(ev.clientX, ev.clientY) : null;
      src.dataset.justDragged = '1'; setTimeout(() => delete src.dataset.justDragged, 60);
      onEnd && onEnd();
      if (t) onDrop(t);
    };
    cap.addEventListener('pointermove', move); cap.addEventListener('pointerup', up); cap.addEventListener('pointercancel', up);
  });
}

/** Allow-list HTML for lesson plans (also used on anything that came from a backup file). */
const OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'SPAN']);
export function cleanHtml(html) {
  const t = document.createElement('template'); t.innerHTML = String(html || '');
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1 || !OK.has(n.tagName)) {
        if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'TEMPLATE'].includes(n.tagName)) { walk(n); n.replaceWith(...n.childNodes); } else n.remove();
        return;
      }
      [...n.attributes].forEach(a => n.removeAttribute(a.name));
      walk(n);
    });
  };
  walk(t.content);
  return t.innerHTML.slice(0, 200000);
}
/** What gets stored: cleaned, with the stray empty paragraphs some browsers leave around lists removed. */
export const tidyHtml = html => cleanHtml(html).replace(/<p><\/p>/g, '');
export const htmlText = html => { const t = document.createElement('template'); t.innerHTML = cleanHtml(html).replace(/<(\/?(h2|h3|p|div|li|ul|ol)|br)>/g, ' $&'); return (t.content.textContent || '').replace(/\s+/g, ' ').trim(); };

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name, style: { display: 'none' } }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
