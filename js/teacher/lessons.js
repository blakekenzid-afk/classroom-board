// Lessons: list with search + tag filter, and a rich-text lesson editor
// (bold / italic / underline / headings / lists), objectives, materials and
// attached library resources. Lessons can be duplicated and put on the planner.
import { h, $, $$, toast, confirmDialog } from '../util.js?v=6';
import * as TS from './tstore.js?v=6';
import { sv, fl, empty, modal, tagInput, tint, cleanHtml, tidyHtml, htmlText, fmtShort, fmtLong, fmtRange, fmtDow } from './ui.js?v=6';
import { resCard, editResource, resIcon } from './library.js?v=6';

/** Choose a day + block for a lesson. Resolves {date, blockId} or undefined. */
export function pickSlot(lessonTitle, start) {
  let date = start || (TS.isSchoolDay(TS.todayYmd()) ? TS.todayYmd() : TS.nextSchoolDay(TS.todayYmd()));
  return modal('Put on the planner', (body, done) => {
    const dIn = h('input.input', { type: 'date', value: date, 'aria-label': 'Day', 'data-testid': 'slot-date' });
    const sel = h('select.input', { 'aria-label': 'Block', 'data-testid': 'slot-block' });
    const note = h('p.hint');
    const fill = () => {
      sel.innerHTML = '';
      TS.blocksFor(date).forEach(b => sel.append(h('option', { value: b.id, text: b.title + ' · ' + fmtRange(b.start, b.end) })));
      sel.append(h('option', { value: '', text: 'Anytime that day' }));
      note.textContent = TS.isDayOff(date) ? 'That day is marked ' + TS.T().daysOff[date].reason.toLowerCase() + '.' : TS.isWeekend(date) ? 'That is a weekend day.' : '';
    };
    dIn.addEventListener('change', () => { if (dIn.value) { date = dIn.value; fill(); } });
    fill();
    body.append(h('p.muted.tm-sub', { text: lessonTitle }), h('div.field', null, h('label.flabel', { text: 'Day' }), dIn), h('div.field', null, h('label.flabel', { text: 'Block' }), sel), note,
      h('div.row.end', null, h('button.btn.ghost', { type: 'button', text: 'Cancel', onclick: () => done() }), h('button.btn.primary', { type: 'button', text: 'Add to planner', 'data-act': 'slot-save', onclick: () => done({ date, blockId: sel.value || null }) })));
  }, { icon: 'calendar' });
}

const RTE_TOOLS = [['bold', 'Bold', 'bold'], ['italic', 'Italic', 'italic'], ['underline', 'Underline', 'underline'], ['|'], ['h2', 'Heading', null, 'H'], ['h3', 'Small heading', null, 'h'], ['|'], ['ul', 'Bulleted list', 'insertUnorderedList'], ['ol', 'Numbered list', 'insertOrderedList'], ['|'], ['clear', 'Clear formatting', 'removeFormat']];
function richEditor(html, onChange) {
  const ed = h('div.rte-body', { contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Lesson plan', 'data-placeholder': 'Write the plan: warm-up, activity, wrap-up…', spellcheck: 'true', 'data-testid': 'rte' });
  ed.innerHTML = cleanHtml(html);
  const bar = h('div.rte-bar', { role: 'toolbar', 'aria-label': 'Formatting' });
  const blockOf = () => { let n = getSelection().anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && /^H[23]$/.test(n.tagName)) return n.tagName.toLowerCase(); n = n.parentNode; } return ''; };
  const btns = RTE_TOOLS.map(([k, label, cmd, txt]) => {
    if (k === '|') return h('span.rte-sep');
    const b = h('button.rte-btn', { type: 'button', title: label, 'aria-label': label, 'data-cmd': k, 'aria-pressed': 'false' }, txt ? h('b.rte-h' + (k === 'h3' ? '.sm' : ''), { text: txt }) : sv(k));
    b.addEventListener('pointerdown', e => e.preventDefault()); // keep the text selection
    b.addEventListener('mousedown', e => e.preventDefault());
    b.onclick = () => {
      if (document.activeElement !== ed) { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      if (k === 'h2' || k === 'h3') document.execCommand('formatBlock', false, blockOf() === k ? '<p>' : '<' + k + '>');
      else if (k === 'clear') { document.execCommand('removeFormat'); if (blockOf()) document.execCommand('formatBlock', false, '<p>'); }
      else document.execCommand(cmd);
      changed(); sync();
    };
    return b;
  });
  bar.append(...btns);
  const sync = () => {
    if (!ed.contains(getSelection().anchorNode)) return;
    const blk = blockOf();
    btns.forEach(b => { const k = b.dataset && b.dataset.cmd; if (!k) return;
      let on = false;
      try { on = k === 'h2' || k === 'h3' ? blk === k : ['bold', 'italic', 'underline'].includes(k) ? document.queryCommandState(k) : k === 'ul' ? document.queryCommandState('insertUnorderedList') : k === 'ol' ? document.queryCommandState('insertOrderedList') : false; } catch (e) { }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  let t = 0;
  const changed = () => {
    if (!ed.textContent.trim() && !ed.querySelector('li')) ed.innerHTML = '';
    clearTimeout(t); t = setTimeout(() => { t = 0; onChange(ed.innerHTML); }, 350);
  };
  ed.addEventListener('input', changed);
  ed.addEventListener('blur', () => { clearTimeout(t); t = 0; onChange(ed.innerHTML); });
  ed.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) { const k = e.key.toLowerCase(); if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); document.execCommand(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'); changed(); sync(); } }
  });
  ed.addEventListener('paste', e => { e.preventDefault(); const txt = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, txt); });
  ed.addEventListener('drop', e => e.preventDefault());
  const onSel = () => sync(); document.addEventListener('selectionchange', onSel);
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
  return { el: h('div.rte', null, bar, ed), ed, destroy: () => { document.removeEventListener('selectionchange', onSel); if (t) { clearTimeout(t); onChange(ed.innerHTML); } } };
}

export function renderLessons(root, app, opts) {
  const st = renderLessons.st || (renderLessons.st = { q: '', tag: '', sel: null });
  if (opts.lessonId) st.sel = opts.lessonId;
  if (opts.fresh) { st.q = ''; st.tag = ''; }
  if (st.sel && !TS.getLesson(st.sel)) st.sel = null;
  let rte = null;
  const wrap = h('div.ls' + (st.sel ? '.editing' : ''));
  const listPane = h('section.ls-list.tcard');
  const edPane = h('section.ls-ed.tcard');
  wrap.append(listPane, edPane);
  root.append(h('header.tp-head', null,
    h('div.tp-title', null, fl('notebook', 'tp-ico'), h('div', null, h('h1', { text: 'Lessons' }), h('p', { text: 'Plan once, reuse every year' }))),
    h('div.tp-actions', null, h('button.btn.primary', { type: 'button', 'data-act': 'new-lesson', onclick: () => { const l = TS.addLesson({}); st.sel = l.id; st.q = ''; st.tag = ''; drawList(); drawEditor(true); } }, sv('plus'), 'New lesson'))), wrap);

  const search = h('input.input.t-search', { type: 'search', placeholder: 'Search lessons', 'aria-label': 'Search lessons', value: st.q, 'data-testid': 'lesson-search' });
  const chips = h('div.t-chips.ls-tags', { 'data-testid': 'lesson-tags' });
  const items = h('div.ls-items', { 'data-testid': 'lesson-list' });
  listPane.append(h('label.t-search-wrap', null, sv('search', 'i t-mag'), search), chips, items);
  search.addEventListener('input', () => { st.q = search.value; drawList(); });

  const nextPlanned = id => { const today = TS.todayYmd(); const ds = TS.T().placements.filter(p => p.lessonId === id && p.date >= today).map(p => p.date).sort(); return ds[0]; };
  function drawList() {
    const tags = TS.allTags(); if (st.tag && !tags.includes(st.tag)) st.tag = '';
    chips.innerHTML = '';
    if (tags.length) chips.append(...[['', 'All'], ...tags.map(t => [t, t])].map(([v, l]) => h('button.chip' + (st.tag === v ? '.on' : ''), { type: 'button', 'data-tag': v, text: l, onclick: () => { st.tag = v; drawList(); } })));
    const q = st.q.trim().toLowerCase();
    const list = TS.T().lessons.filter(l => (!st.tag || l.tags.includes(st.tag)) && (!q || [l.title, l.objectives, l.materials, htmlText(l.html), ...l.tags].some(x => x && x.toLowerCase().includes(q))));
    items.innerHTML = '';
    if (!TS.T().lessons.length) { items.append(empty('notebook', 'No lessons yet', 'Tap “New lesson” to write your first plan.')); return; }
    if (!list.length) { items.append(empty('magnifier', 'No lessons match', 'Try another word or tag.')); return; }
    list.forEach(l => {
      const np = nextPlanned(l.id);
      const c = h('button.ls-item' + (l.id === st.sel ? '.on' : ''), { type: 'button', 'data-lesson': l.id, onclick: () => { st.sel = l.id; drawList(); drawEditor(); } },
        h('b.ls-it-title', { text: l.title || 'Untitled lesson' }),
        h('span.ls-it-snip', { text: htmlText(l.html).slice(0, 90) || l.objectives.slice(0, 90) || 'No plan written yet' }),
        h('span.ls-it-meta', null, l.tags.slice(0, 3).map(t => { const [bg, fg] = tint(t); return h('span.t-pill', { text: t, style: { background: bg, color: fg } }); }),
          np ? h('span.ls-it-when', null, fl('calendar', 'fl-xs'), h('span', { text: fmtDow(np) + ' ' + fmtShort(np) })) : null));
      items.append(c);
    });
  }

  function drawEditor(focusTitle) {
    if (rte) { rte.destroy(); rte = null; }
    edPane.innerHTML = ''; wrap.classList.toggle('editing', !!st.sel);
    const l = st.sel && TS.getLesson(st.sel);
    if (!l) { edPane.append(empty('open-book', TS.T().lessons.length ? 'Pick a lesson to open it' : 'Write your first lesson', 'Lesson plans keep the activity, objectives, materials and the links or PDFs you need.',
      TS.T().lessons.length ? null : h('button.btn.primary', { type: 'button', 'data-act': 'new-lesson-empty', onclick: () => { const nl = TS.addLesson({}); st.sel = nl.id; drawList(); drawEditor(true); } }, sv('plus'), 'New lesson'))); return; }
    const status = h('span.ls-saved', { text: 'Saved', 'data-testid': 'lesson-saved' });
    let stT = 0; const saved = () => { status.textContent = 'Saving…'; clearTimeout(stT); stT = setTimeout(() => status.textContent = 'Saved', 500); };
    const upd = (patch, list) => { TS.updateLesson(l.id, patch, true); saved(); if (list) drawList(); else { const c = $(`.ls-item[data-lesson="${l.id}"] .ls-it-title`, items); if (c && patch.title !== undefined) c.textContent = patch.title || 'Untitled lesson'; } };
    const title = h('input.ls-title-in', { type: 'text', value: l.title, maxlength: 120, placeholder: 'Lesson title', 'aria-label': 'Lesson title', 'data-testid': 'lesson-title' });
    title.addEventListener('input', () => upd({ title: title.value.trim() }));
    title.addEventListener('change', () => drawList());
    title.addEventListener('focus', () => { if (title.value === 'Untitled lesson') title.select(); });
    const back = h('button.btn.sm.ghost.ls-back', { type: 'button', 'data-act': 'lesson-back', onclick: () => { st.sel = null; drawList(); drawEditor(); } }, sv('left'), 'All lessons');
    const planBtn = h('button.btn.sm.primary', { type: 'button', 'data-act': 'lesson-plan', onclick: async () => { const s = await pickSlot(l.title); if (s) { TS.placeLesson(l.id, s.date, s.blockId); toast('Planned for ' + fmtLong(s.date)); drawList(); drawPlanned(); } } }, sv('calPlus'), h('span', { text: 'Plan it' }));
    const dupBtn = h('button.btn.sm.ghost', { type: 'button', 'data-act': 'lesson-dup', onclick: () => { const c = TS.duplicateLesson(l.id); st.sel = c.id; drawList(); drawEditor(); toast('Lesson duplicated'); } }, sv('copy'), h('span', { text: 'Duplicate' }));
    const delBtn = h('button.icon-btn.sm.danger', { type: 'button', title: 'Delete lesson', 'aria-label': 'Delete lesson', 'data-act': 'lesson-delete', onclick: async () => {
      const n = TS.T().placements.filter(p => p.lessonId === l.id).length;
      if (await confirmDialog('Delete “' + (l.title || 'Untitled lesson') + '”?', n ? `It is on the planner ${n} time${n > 1 ? 's' : ''}; those will be removed too.` : 'This lesson plan will be removed.')) { TS.removeLesson(l.id); st.sel = null; drawList(); drawEditor(); toast('Lesson deleted'); }
    } }, sv('trash'));
    rte = richEditor(l.html, raw => { const html = tidyHtml(raw); const cur = TS.getLesson(l.id); if (cur && html !== cur.html) upd({ html }); });
    const ta = (k, ph, label) => { const t = h('textarea.input.ls-ta', { placeholder: ph, 'aria-label': label, 'data-testid': 'lesson-' + k, rows: 3 }); t.value = l[k]; t.addEventListener('input', () => upd({ [k]: t.value })); return t; };
    const resBox = h('div.ls-res', { 'data-testid': 'lesson-res' });
    const planned = h('div.ls-planned', { 'data-testid': 'lesson-planned' });
    function drawRes() {
      resBox.innerHTML = '';
      const L = TS.getLesson(l.id); const rs = L.resources.map(TS.getResource).filter(Boolean);
      rs.forEach(r => resBox.append(resCard(r, app, { compact: true, onRemove: () => { TS.updateLesson(l.id, { resources: TS.getLesson(l.id).resources.filter(x => x !== r.id) }, true); saved(); drawRes(); } })));
      resBox.append(h('div.row.wrap.ls-res-acts', null,
        h('button.btn.sm', { type: 'button', 'data-act': 'attach-res', onclick: attach }, sv('paperclip'), 'Attach from library'),
        h('button.btn.sm.ghost', { type: 'button', 'data-act': 'attach-new-link', onclick: async () => { const r = await editResource(null, 'link'); if (r) { TS.updateLesson(l.id, { resources: [...TS.getLesson(l.id).resources, r.id] }, true); saved(); drawRes(); } } }, sv('plus'), 'New link')));
    }
    async function attach() {
      const cur = new Set(TS.getLesson(l.id).resources);
      const res = await modal('Attach from the library', (body, done) => {
        const q = h('input.input.t-search', { type: 'search', placeholder: 'Search the library', 'aria-label': 'Search the library', autofocus: true });
        const list = h('div.att-list', { 'data-testid': 'attach-list' });
        const draw = () => {
          list.innerHTML = ''; const s = q.value.trim().toLowerCase();
          const all = TS.T().resources.filter(r => !s || [r.title, r.folder, ...r.labels].some(x => x && x.toLowerCase().includes(s)));
          if (!TS.T().resources.length) { list.append(empty('books', 'The library is empty', 'Add links, videos and files in the Library first.')); return; }
          all.forEach(r => { const on = cur.has(r.id);
            list.append(h('button.att-row' + (on ? '.on' : ''), { type: 'button', 'data-res': r.id, 'aria-pressed': String(on), onclick: e => { cur.has(r.id) ? cur.delete(r.id) : cur.add(r.id); draw(); } },
              fl(resIcon(r), 'att-ico'), h('span.att-t', null, h('b', { text: r.title }), h('small', { text: [r.folder, ...r.labels].filter(Boolean).join(' · ') })), h('span.att-check', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>' }))); });
        };
        q.addEventListener('input', draw); draw();
        body.append(q, list, h('div.row.end', null, h('button.btn.ghost', { type: 'button', text: 'Cancel', onclick: () => done() }), h('button.btn.primary', { type: 'button', text: 'Done', 'data-act': 'attach-done', onclick: () => done([...cur]) })));
      }, { icon: 'books', cls: 'att-modal' });
      if (res) { const keep = TS.getLesson(l.id).resources.filter(id => res.includes(id)); res.forEach(id => { if (!keep.includes(id)) keep.push(id); }); TS.updateLesson(l.id, { resources: keep }, true); saved(); drawRes(); }
    }
    function drawPlanned() {
      planned.innerHTML = '';
      const ps = TS.T().placements.filter(p => p.lessonId === l.id).sort((a, b) => a.date.localeCompare(b.date));
      if (!ps.length) { planned.append(h('small.muted', { text: 'Not on the planner yet.' })); return; }
      ps.forEach(p => { const b = p.blockId && TS.T().blocks.find(x => x.id === p.blockId);
        planned.append(h('button.t-pill.ls-when', { type: 'button', 'data-act': 'goto-plan', onclick: () => app.go('planner', { week: TS.weekStart(p.date) }) }, fl('calendar', 'fl-xs'), h('span', { text: fmtDow(p.date) + ' ' + fmtShort(p.date) + (b ? ' · ' + b.title : '') }))); });
    }
    drawRes(); drawPlanned();
    edPane.append(
      h('div.ls-ed-top', null, back, h('span.ls-gap'), status, planBtn, dupBtn, delBtn),
      title,
      h('div.ls-field', null, h('label.flabel', { text: 'Subjects & units' }), tagInput(l.tags, v => upd({ tags: v }, true), { placeholder: 'Add a subject or unit (Math, Apples)…', suggestions: TS.allTags(), testid: 'lesson-tagin' })),
      h('div.ls-field', null, h('label.flabel', { text: 'Lesson plan' }), rte.el),
      h('div.ls-two', null,
        h('div.ls-field', null, h('label.flabel', { text: 'Objectives' }), ta('objectives', 'Friends will be able to…', 'Objectives')),
        h('div.ls-field', null, h('label.flabel', { text: 'Materials' }), ta('materials', 'Apples, counting mats, crayons…', 'Materials'))),
      h('div.ls-field', null, h('label.flabel', { text: 'Resources' }), resBox),
      h('div.ls-field', null, h('label.flabel', { text: 'On the planner' }), planned));
    if (focusTitle) setTimeout(() => { title.focus(); title.select(); }, 30);
  }
  drawList(); drawEditor();
  return { destroy: () => { if (rte) rte.destroy(); } };
}
