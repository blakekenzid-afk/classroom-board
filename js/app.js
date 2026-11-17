import * as S from './store.js?v=5';
import { h, $, $$, icon, ico, picSrc, toast, confirmDialog, pickFile, resizeImage, swatches } from './util.js?v=5';
import { initBoard, renderBoard, syncBoard, syncRemote, addWidget, closeSettings, liveWidgets, dropFile } from './board.js?v=5';
import { initTeacher, setMode } from './teacher/teacher.js?v=5';
import { REGISTRY, DOCK } from './widgets/index.js?v=5';
import { pickPicture } from './picker.js?v=5';
import { uid } from './store.js?v=5';
import * as C from './cloud/cloud.js?v=5';
import { loadingUI, accountButton, maybeOpenSignIn } from './cloud/ui.js?v=5';

// ── backgrounds ──
export const BGS = {
  grid: [['paper', 'Grid paper'], ['dots', 'Dots'], ['plain', 'Soft white']],
  color: [['#F4EFE6', 'Cream'], ['#E4F1FF', 'Sky'], ['#E3F5EA', 'Mint'], ['#FFEADB', 'Peach'], ['#ECE6FF', 'Lavender'], ['#FFF4C7', 'Sunshine'], ['#2E4A3B', 'Chalkboard'], ['#1E2348', 'Night']],
  gradient: [['linear-gradient(135deg,#FFE29F 0%,#FFA99F 100%)', 'Sunrise'], ['linear-gradient(135deg,#A1C4FD 0%,#C2E9FB 100%)', 'Ocean'], ['linear-gradient(135deg,#FBC2EB 0%,#A6C1EE 100%)', 'Cotton candy'],
    ['linear-gradient(135deg,#D4FC79 0%,#96E6A1 100%)', 'Meadow'], ['linear-gradient(135deg,#FDFCFB 0%,#E2D1C3 100%)', 'Sand'], ['linear-gradient(135deg,#667EEA 0%,#764BA2 100%)', 'Dusk'],
    ['linear-gradient(160deg,#89F7FE 0%,#66A6FF 100%)', 'Pool'], ['linear-gradient(135deg,#F6D365 0%,#FDA085 100%)', 'Mango']]
};
function bgCss(bg) {
  if (!bg) return { cls: 'bg-paper', style: '' };
  if (bg.type === 'grid') return { cls: 'bg-' + bg.value, style: '' };
  if (bg.type === 'image') return { cls: 'bg-image', style: `url("${bg.value}") center/cover no-repeat` };
  return { cls: 'bg-' + bg.type, style: bg.value };
}
const isDark = bg => bg && ((bg.type === 'color' && ['#2E4A3B', '#1E2348'].includes(bg.value)) || (bg.type === 'gradient' && bg.value.includes('#667EEA')) || bg.type === 'image');

function seed(state) {
  const it = (icon, title, start, end, brk) => ({ id: uid('i'), icon, title, start, end, ...(brk ? { brk: true } : {}) });
  const b1 = S.newBoard('Pre-K Morning');
  b1.widgets.push(
    S.newWidget('timetable', { x: 0.025, y: 0.04, w: 0.31, h: 0.9, z: 2 }, Object.assign(REGISTRY.timetable.defaults(), {
      title: "Today's schedule", items: [
        it('wave', 'Arrival & breakfast', '07:50', '08:15'), it('group', 'Circle time', '08:15', '08:35'), it('puzzle', 'Centers', '08:35', '09:20'),
        it('broom', 'Clean up', '09:20', '09:30'), it('apple', 'Snack', '09:30', '09:45'), it('slide', 'Recess', '09:45', '10:15'),
        it('soap', 'Wash hands', '10:15', '10:20', true), it('open-book', 'Story time', '10:20', '10:40'), it('palette', 'Art', '10:40', '11:05'),
        it('plate', 'Lunch', '11:05', '11:35'), it('bed', 'Rest time', '11:35', '12:15'), it('music', 'Music & movement', '12:15', '12:45'),
        it('kite', 'Outside time', '12:45', '13:15'), it('backpack', 'Pack up', '13:15', '13:30'), it('bus', 'Go home', '13:30', '13:40')]
    })),
    S.newWidget('text', { x: 0.36, y: 0.04, w: 0.36, h: 0.2, z: 3 }, Object.assign(REGISTRY.text.defaults(), { html: 'Good morning, friends! ☀️', size: 'l', color: '#5B5BD6' })),
    S.newWidget('clock', { x: 0.75, y: 0.04, w: 0.225, h: 0.24, z: 4 }, REGISTRY.clock.defaults()),
    S.newWidget('work', { x: 0.75, y: 0.33, w: 0.225, h: 0.42, z: 5 }, REGISTRY.work.defaults()),
    S.newWidget('vtimer', { x: 0.36, y: 0.29, w: 0.24, h: 0.46, z: 6 }, REGISTRY.vtimer.defaults())
  );
  const b2 = S.newBoard('Centers');
  b2.bg = { type: 'gradient', value: BGS.gradient[1][0] };
  b2.widgets.push(
    S.newWidget('timer', { x: 0.04, y: 0.06, w: 0.3, h: 0.36, z: 2 }, REGISTRY.timer.defaults()),
    S.newWidget('traffic', { x: 0.38, y: 0.06, w: 0.14, h: 0.6, z: 3 }, REGISTRY.traffic.defaults()),
    S.newWidget('timetable', { x: 0.56, y: 0.06, w: 0.38, h: 0.7, z: 4 }, Object.assign(REGISTRY.timetable.defaults(), {
      mode: 'check', title: 'Clean-up checklist', theme: 'green', items: [
        it('blocks', 'Blocks on the shelf'), it('crayon', 'Crayons in the box'), it('books', 'Books in the basket'), it('chair', 'Push in chairs'), it('soap', 'Wash hands')]
    }))
  );
  state.boards.push(b1, b2);
}

// ── chrome ──
function buildChrome() {
  const app = $('#app');
  const stage = h('main.stage', { id: 'stage', 'aria-label': 'Board' });
  const bgLayer = h('div.bg-layer', { id: 'bgLayer' });

  // Top-left: screens
  const nameBtn = h('button.scr-btn', { type: 'button', 'data-act': 'screens', 'aria-haspopup': 'menu' }, h('span.scr-name'), icon('chevron', 'chev'));
  // Board | Teacher switch
  const modeBtn = (m, label, pic) => h('button.mode-b' + (m === 'board' ? '.on' : ''), { type: 'button', 'data-mode': m, 'data-act': 'mode-' + m, 'aria-pressed': String(m === 'board'), title: m === 'board' ? 'Classroom board' : 'Teacher planner, lessons and library',
    onclick: () => { if (m === 'teacher') closeSettings(true); setMode(m); } }, h('img', { src: picSrc(pic), alt: '', draggable: 'false' }), h('span', { text: label }));
  const modeSeg = h('div.mode-seg', { role: 'group', 'aria-label': 'Board or Teacher' }, modeBtn('board', 'Board', 'school'), modeBtn('teacher', 'Teacher', 'teacher'));
  const tl = h('div.chrome.tl-pill', null, h('div.logo', { 'aria-hidden': 'true' }, h('img', { src: 'icons/sparkles.svg', alt: '' })), modeSeg, nameBtn);
  nameBtn.onclick = e => { e.stopPropagation(); toggleMenu(screensMenu, nameBtn); };

  // Top-right
  const bgBtn = h('button.chrome-btn', { type: 'button', title: 'Background', 'data-act': 'bg' }, icon('bg'), h('span.lbl', { text: 'Background' }));
  const fsBtn = h('button.chrome-btn', { type: 'button', title: 'Present (full screen)', 'data-act': 'present' }, icon('expand'), h('span.lbl', { text: 'Present' }));
  const undoBtn = h('button.chrome-btn.hist', { type: 'button', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', 'data-act': 'undo', html: UNDO_SVG, disabled: true, onclick: () => { S.undo(); } });
  const redoBtn = h('button.chrome-btn.hist', { type: 'button', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', 'data-act': 'redo', html: REDO_SVG, disabled: true, onclick: () => { S.redo(); } });
  const acct = C.cloud.cfg ? accountButton() : null;
  const tr = h('div.chrome.tr-pill', null, acct, acct ? h('span.chrome-sep.acct-sep') : null, undoBtn, redoBtn, h('span.chrome-sep'), bgBtn, fsBtn);
  bgBtn.onclick = e => { e.stopPropagation(); toggleMenu(bgMenu, bgBtn); };
  fsBtn.onclick = togglePresent;

  // Dock
  const dock = h('nav.dock', { 'aria-label': 'Widgets' });
  const dockInner = h('div.dock-inner');
  const items = DOCK.map(t => {
    const def = t === 'stickers' ? { label: 'Stickers', icon: 'glowing-star' } : REGISTRY[t];
    const b = h('button.dock-item', { type: 'button', 'data-add': t, title: 'Add ' + def.label },
      h('span.dk-ico', null, h('img', { src: picSrc(def.icon), alt: '', draggable: 'false' })), h('span.dk-lbl', { text: def.label }));
    b.onclick = async () => {
      moreMenu.classList.remove('open'); moreBtn.classList.remove('on');
      if (t === 'stickers') { const v = await pickPicture({ title: 'Choose a sticker', allowNone: false }); if (v) addWidget('sticker', { pic: v }); return; }
      addWidget(t);
    };
    return b;
  });
  // "More" drawer: widgets that do not fit in one row (iPad portrait) live here.
  const moreBtn = h('button.dock-item.dock-more', { type: 'button', 'data-act': 'dock-more', title: 'More widgets', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    h('span.dk-ico.dk-dots', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')), h('span.dk-lbl', { text: 'More' }));
  const moreGrid = h('div.more-grid');
  const moreMenu = h('div.menu.more-menu', { role: 'menu', 'aria-label': 'More widgets' }, h('div.menu-h', { text: 'More widgets' }), moreGrid);
  moreBtn.onclick = e => { e.stopPropagation(); const open = !moreMenu.classList.contains('open'); [screensMenu, bgMenu].forEach(m => m.classList.remove('open')); if (open) placeMore(); moreMenu.classList.toggle('open', open); moreBtn.classList.toggle('on', open); moreBtn.setAttribute('aria-expanded', String(open)); };
  dockInner.append(...items, moreBtn);
  dock.append(dockInner);
  function layoutDock() {
    items.forEach(b => dockInner.insertBefore(b, moreBtn));
    moreBtn.hidden = true;
    const avail = innerWidth - 24 - 14;
    const ws = items.map(b => b.getBoundingClientRect().width + 2);
    if (!ws[0]) return;
    if (ws.reduce((a, b) => a + b, 0) <= avail) { closeMore(); return; }
    moreBtn.hidden = false;
    let used = moreBtn.getBoundingClientRect().width + 2, fit = 0;
    while (fit < items.length && used + ws[fit] <= avail) used += ws[fit++];
    items.slice(Math.max(4, fit)).forEach(b => moreGrid.append(b));
  }
  function placeMore() {
    const r = moreBtn.getBoundingClientRect(), mw = Math.min(360, innerWidth - 20);
    moreMenu.style.width = mw + 'px';
    moreMenu.style.left = Math.max(10, Math.min(innerWidth - mw - 10, r.left + r.width / 2 - mw / 2)) + 'px';
    moreMenu.style.bottom = (innerHeight - r.top + 14) + 'px'; moreMenu.style.top = 'auto';
  }
  const peek = h('button.peek', { type: 'button', title: 'Show tools', 'aria-label': 'Show tools', 'data-act': 'exit-present', html: ico.shrink, onclick: togglePresent });

  app.append(bgLayer, stage, tl, tr, dock, peek);
  const screensMenu = h('div.menu.screens-menu', { role: 'menu' });
  const bgMenu = h('div.menu.bg-menu', { role: 'dialog', 'aria-label': 'Background' });
  document.body.append(screensMenu, bgMenu, moreMenu);
  const closeMore = () => { moreMenu.classList.remove('open'); moreBtn.classList.remove('on'); moreBtn.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('pointerdown', e => {
    [screensMenu, bgMenu].forEach(m => { if (m.classList.contains('open') && !m.contains(e.target) && !e.target.closest('[data-act="screens"],[data-act="bg"]')) m.classList.remove('open'); });
    if (moreMenu.classList.contains('open') && !moreMenu.contains(e.target) && !e.target.closest('[data-act="dock-more"]')) closeMore();
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { [screensMenu, bgMenu].forEach(m => m.classList.remove('open')); closeMore(); } });
  window.addEventListener('resize', () => { closeMore(); layoutDock(); });
  requestAnimationFrame(layoutDock);
  document.fonts && document.fonts.ready.then(layoutDock);

  function toggleMenu(menu, anchor) {
    const open = !menu.classList.contains('open');
    [screensMenu, bgMenu].forEach(m => m.classList.remove('open')); closeMore();
    if (!open) return;
    if (menu === screensMenu) drawScreens(); else drawBg();
    const r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 10) + 'px';
    if (menu === bgMenu) { menu.style.right = (innerWidth - r.right) + 'px'; menu.style.left = 'auto'; } else { menu.style.left = Math.max(10, r.left - 50) + 'px'; menu.style.right = 'auto'; }
    menu.classList.add('open');
  }

  function drawScreens() {
    const st = S.getState(); screensMenu.innerHTML = '';
    screensMenu.append(h('div.menu-h', { text: 'Your screens' }));
    const list = h('div.scr-list');
    st.boards.forEach(b => {
      const active = b.id === st.activeBoardId;
      const row = h('div.scr-row' + (active ? '.on' : ''), { 'data-board': b.id });
      const name = h('button.scr-go', { type: 'button', 'data-act': 'switch' }, h('span.dot'), h('span.nm', { text: b.name }), h('small', { text: b.widgets.length + ' widget' + (b.widgets.length === 1 ? '' : 's') }));
      name.onclick = () => { if (!active) { S.setActiveBoard(b.id); } screensMenu.classList.remove('open'); };
      const ren = h('button.icon-btn.sm', { type: 'button', title: 'Rename', 'aria-label': 'Rename', 'data-act': 'rename', html: ico.pencil });
      ren.onclick = () => {
        const inp = h('input.input.scr-input', { value: b.name, maxlength: 40, 'aria-label': 'Screen name' });
        name.replaceWith(inp); inp.focus(); inp.select();
        const fin = ok => { if (ok) S.renameBoard(b.id, inp.value); drawScreens(); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') { e.stopPropagation(); fin(false); } });
        inp.addEventListener('blur', () => fin(true));
      };
      const dup = h('button.icon-btn.sm', { type: 'button', title: 'Duplicate', 'aria-label': 'Duplicate', 'data-act': 'duplicate', html: ico.copy, onclick: () => { S.duplicateBoard(b.id); screensMenu.classList.remove('open'); toast('Screen duplicated'); } });
      const del = h('button.icon-btn.sm.danger', { type: 'button', title: 'Delete', 'aria-label': 'Delete', 'data-act': 'delete', html: ico.trash, disabled: st.boards.length <= 1 });
      del.onclick = async () => { screensMenu.classList.remove('open'); if (await confirmDialog('Delete “' + b.name + '”?', 'This screen and its widgets will be removed.')) { S.deleteBoard(b.id); toast('Screen deleted'); } };
      row.append(name, h('div.scr-acts', null, ren, dup, del));
      list.append(row);
    });
    screensMenu.append(list, h('button.btn.primary.full', { type: 'button', 'data-act': 'new-screen', onclick: () => { S.addBoard(); screensMenu.classList.remove('open'); } }, icon('plus'), 'New screen'));
  }

  function drawBg() {
    const cur = S.activeBoard().bg || {};
    bgMenu.innerHTML = '';
    const tile = (type, value, label) => {
      const css = bgCss({ type, value });
      const t = h('button.bg-tile.' + css.cls + (cur.type === type && cur.value === value ? '.on' : ''), { type: 'button', title: label, 'aria-label': label, 'data-bg': type + ':' + label });
      if (css.style) t.style.background = css.style;
      t.onclick = () => { S.setBackground({ type, value }); drawBg(); };
      return t;
    };
    const grp = (title, type, arr) => h('div.bg-grp', null, h('div.menu-h', { text: title }), h('div.bg-grid', null, arr.map(([v, l]) => tile(type, v, l))));
    const up = h('button.btn.ghost.full', { type: 'button', 'data-act': 'bg-upload' }, icon('upload'), 'Upload my own picture');
    up.onclick = async () => {
      const f = await pickFile(); if (!f) return;
      try { const url = await resizeImage(f, 1920, { type: 'image/jpeg', quality: 0.82 }); S.setBackground({ type: 'image', value: url }); drawBg(); }
      catch (e) { toast(e.message, 'err'); }
    };
    bgMenu.append(grp('Patterns', 'grid', BGS.grid), grp('Colors', 'color', BGS.color), grp('Gradients', 'gradient', BGS.gradient));
    if (cur.type === 'image') bgMenu.append(h('div.bg-grp', null, h('div.menu-h', { text: 'Your picture' }), h('div.bg-grid', null, tile('image', cur.value, 'My picture'))));
    bgMenu.append(up);
  }

  return { stage, bgLayer, layoutDock, undoBtn, redoBtn };
}

function applyBg() {
  const b = S.activeBoard(); const layer = $('#bgLayer'); const css = bgCss(b.bg);
  layer.className = 'bg-layer ' + css.cls; layer.style.background = css.style || '';
  document.body.classList.toggle('dark-bg', !!isDark(b.bg));
  $('.scr-name').textContent = b.name;
  document.title = b.name + ' · Classroom Board';
}

function togglePresent() {
  const on = !document.body.classList.contains('present');
  const de = document.documentElement;
  if (on) {
    document.body.classList.add('present');
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (req) try { const p = req.call(de); p && p.catch && p.catch(() => {}); } catch (e) { }
  } else {
    document.body.classList.remove('present');
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && ex) try { const p = ex.call(document); p && p.catch && p.catch(() => {}); } catch (e) { }
  }
  closeSettings();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('present'); });

const UNDO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const REDO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';

// ── boot ──
// In a shared classroom the class's data is picked (and, the first time on a device, fetched) before loading.
await C.prepare(loadingUI);
S.load(seed);
const { stage, undoBtn, redoBtn } = buildChrome();
initBoard(stage);
applyBg(); renderBoard();
const syncHist = () => { undoBtn.disabled = !S.canUndo(); redoBtn.disabled = !S.canRedo(); };
S.onChange((reason, info) => {
  if (reason === 'board') { applyBg(); renderBoard(); }
  else if (reason === 'bg' || reason === 'rename') applyBg();
  else if (reason === 'history-apply') { applyBg(); syncBoard(); }
  else if (reason === 'remote') { // a change from someone else in the class
    if (info && info.activeGone) { applyBg(); renderBoard(); }
    else if (info && info.boards && info.boards.has(S.getState().activeBoardId)) { applyBg(); syncRemote(); }
    else applyBg();
  }
  if (reason === 'history' || reason === 'board' || reason === 'remote') syncHist();
});
syncHist();
setInterval(syncHist, 400); // debounced saves become undo steps a moment later
// Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo (typing fields keep their own undo)
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (document.body.classList.contains('teacher-mode')) return; // board undo only on the board
  const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
  const t = e.target; if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('.modal-back')) return;
  e.preventDefault();
  if (k === 'y' || e.shiftKey) S.redo(); else S.undo();
});
// a file dropped outside the board must never replace the page
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); }));
window.addEventListener('cb:blob-fallback', () => toast('This browser is not letting the board save big files, so PDFs and drawings last until you close it.', 'err'));
setTimeout(() => S.blobs.gc(), 4000);
window.addEventListener('cb:save-error', () => toast('Storage is full – try a smaller picture.', 'err'));
// Class list is shared: refresh every widget that shows it.
S.onChange(r => { if (r === 'classlist') liveWidgets().forEach(l => l.inst.onClassList && l.inst.onClassList()); });
initTeacher({ addWidget, dropFile, accountButton: C.cloud.cfg ? accountButton : null });
window.CB = { S, addWidget, renderBoard, cloud: C };
C.start().catch(e => console.warn('cloud start', e));
maybeOpenSignIn();
