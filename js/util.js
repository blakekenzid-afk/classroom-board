// Small DOM + UI helpers shared by the app and widgets.

export function h(tag, attrs, ...kids) {
  if (attrs && (attrs.nodeType || typeof attrs === 'string' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  const [t, ...cls] = tag.split('.');
  const e = document.createElement(t || 'div');
  if (cls.length) e.className = cls.join(' ');
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]); }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pad = n => String(n).padStart(2, '0');

/** Picture value → <img src>. Built-in icons are ids; uploads are data: URLs. */
export function picSrc(v) {
  if (!v) return '';
  if (v.startsWith('data:') || v.startsWith('http') || v.includes('/')) return v;
  return 'icons/' + v + '.svg';
}
export function pic(v, cls = 'pic') {
  if (!v) return h('span.' + cls + '.pic-empty');
  return h('img.' + cls, { src: picSrc(v), alt: '', draggable: 'false', decoding: 'async' });
}

/** Read an image File and shrink it in the browser. Returns a data URL. */
export function resizeImage(file, maxDim = 1600, { type = 'image/jpeg', quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose a picture file.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: hh } = img;
      const s = Math.min(1, maxDim / Math.max(w, hh));
      w = Math.max(1, Math.round(w * s)); hh = Math.max(1, Math.round(hh * s));
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const g = c.getContext('2d');
      if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); }
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, hh);
      URL.revokeObjectURL(url);
      let out = c.toDataURL(type, quality);
      if (type === 'image/webp' && !out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened.')); };
    img.src = url;
  });
}

export function pickFile(accept = 'image/*') {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: { position: 'fixed', left: '-999px' } });
    i.addEventListener('change', () => { res(i.files && i.files[0]); i.remove(); });
    document.body.append(i); i.click();
  });
}

// ── toast ──
let toastT;
export function toast(msg, kind = '') {
  let t = $('#toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.className = 'toast show ' + kind; t.textContent = msg;
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast ' + kind, 2600);
}

// ── confirm dialog ──
export function confirmDialog(title, body, okLabel = 'Delete', danger = true) {
  return new Promise(res => {
    const close = v => { back.remove(); res(v); };
    const back = h('div.modal-back', { onpointerdown: e => { if (e.target === back) close(false); } },
      h('div.modal.small', { role: 'dialog' },
        h('h3', { text: title }), body ? h('p.muted', { text: body }) : null,
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => close(false), text: 'Cancel' }),
          h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => close(true), text: okLabel, 'data-ok': '1' }))));
    document.body.append(back);
    setTimeout(() => back.querySelector('[data-ok]').focus(), 30);
  });
}

// ── form controls used in settings panels ──
export function segmented(options, value, onPick, cls = '') {
  const wrap = h('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup' });
  options.forEach(([v, label, icon]) => {
    const b = h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === value), class: v === value ? 'on' : '' },
      icon ? h('img', { src: picSrc(icon), alt: '' }) : null, h('span', { text: label }));
    b.onclick = () => { $$('button', wrap).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); onPick(v); };
    wrap.append(b);
  });
  return wrap;
}

export function toggle(label, checked, onChange, hint) {
  const inp = h('input', { type: 'checkbox', checked: !!checked });
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label.toggle', null, h('span.tgl-l', null, h('span', { text: label }), hint ? h('small', { text: hint }) : null), inp, h('span.sw'));
}

export function swatches(colors, value, onPick, round = true) {
  const wrap = h('div.swatches');
  colors.forEach(c => {
    const [key, css, title] = Array.isArray(c) ? c : [c, c, c];
    const b = h('button', { type: 'button', title, 'aria-label': title, class: 'sw-b' + (key === value ? ' on' : '') + (round ? '' : ' sq'), style: { background: css } });
    b.onclick = () => { $$('.sw-b', wrap).forEach(x => x.classList.toggle('on', x === b)); onPick(key); };
    wrap.append(b);
  });
  return wrap;
}

export function field(label, control, hint) {
  return h('div.field', null, h('label.flabel', { text: label }), control, hint ? h('small.hint', { text: hint }) : null);
}
export function section(title, ...kids) { return h('div.sect', null, title ? h('h4', { text: title }) : null, ...kids); }

export function fmtTime(hhmm, h24 = false) {
  if (!hhmm) return '';
  let [H, M] = hhmm.split(':').map(Number);
  if (h24) return pad(H) + ':' + pad(M);
  const hr = H % 12 || 12; return hr + ':' + pad(M);
}
export function minsOf(hhmm) { if (!hhmm) return null; const [H, M] = hhmm.split(':').map(Number); return H * 60 + M; }
export function hhmmOf(mins) { mins = ((mins % 1440) + 1440) % 1440; return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60); }

/** Simple pointer-driven sortable list (works with touch). handleSel inside each child. */
export function makeSortable(list, handleSel, onDone) {
  list.addEventListener('pointerdown', e => {
    const handle = e.target.closest(handleSel); if (!handle || !list.contains(handle)) return;
    const item = handle.closest('[data-sort]'); if (!item) return;
    e.preventDefault();
    const items = () => [...list.children].filter(c => c.hasAttribute('data-sort'));
    const r0 = item.getBoundingClientRect();
    const startY = e.clientY;
    item.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const ph = h('div.sort-ph', { style: { height: r0.height + 'px' } });
    item.after(ph);
    Object.assign(item.style, { position: 'fixed', left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', zIndex: 9999, pointerEvents: 'none' });
    const scroller = list.closest('.sheet-body') || list.parentElement;
    let lastEv = e, scrollT = 0, scrolled = 0;
    const s0 = scroller.scrollTop;
    const autoScroll = () => {
      const sr = scroller.getBoundingClientRect(), y = lastEv.clientY, edge = 56;
      let v = 0;
      if (y < sr.top + edge) v = -Math.ceil((sr.top + edge - y) / 4);
      else if (y > sr.bottom - edge) v = Math.ceil((y - (sr.bottom - edge)) / 4);
      if (v) { scroller.scrollTop += v; move(lastEv, true); }
    };
    scrollT = setInterval(autoScroll, 16);
    const move = (ev, fromScroll) => {
      if (!fromScroll) lastEv = ev;
      const dy = ev.clientY - startY;
      item.style.top = (r0.top + dy) + 'px';
      const mid = r0.top + dy + r0.height / 2;
      const others = items().filter(x => x !== item);
      let placed = false;
      for (const o of others) {
        const r = o.getBoundingClientRect();
        if (mid < r.top + r.height / 2) { o.before(ph); placed = true; break; }
      }
      if (!placed && others.length) others[others.length - 1].after(ph);
    };
    const up = () => {
      clearInterval(scrollT);
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      ph.replaceWith(item); item.removeAttribute('style'); item.classList.remove('dragging');
      onDone(items().map(x => x.getAttribute('data-sort')));
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
}

export const ico = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="M21 15l-5-5L5 21"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  dock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M8 9l4-4 4 4"/></svg>',
  bg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3.5-4 3.5h-1.8a1.7 1.7 0 0 0-1.2 2.9 1.7 1.7 0 0 1-1.2 2.9z"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.2" fill="currentColor"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/></svg>'
};
export const icon = (name, cls = 'i') => h('span.' + cls, { html: ico[name], 'aria-hidden': 'true' });
