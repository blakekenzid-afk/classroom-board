// Resource library: links, videos and uploaded files (PDF / pictures, kept in
// IndexedDB), with folders, labels and search. A PDF opens in the board's PDF
// widget, a picture in an Image widget, a YouTube link in the YouTube widget.
import { h, $$, toast, confirmDialog, pickFile, resizeImage, ico } from '../util.js?v=5';
import { blobs, env, IDBBlobAdapter } from '../store.js?v=5';
import { CLOUD_FILE_MAX } from '../cloud/config.js?v=5';
import { ytId } from '../widgets/media.js?v=5';
import * as TS from './tstore.js?v=5';
import { sv, fl, empty, modal, popMenu, tagInput, fmtShort } from './ui.js?v=5';

const mb = n => n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
export const isPdfRes = r => r.kind === 'file' && r.file && /pdf/i.test(r.file.mime || r.file.name);
export const isImgRes = r => r.kind === 'file' && r.file && /^image\//.test(r.file.mime || '');
export function resIcon(r) {
  if (r.kind === 'video') return 'tv';
  if (r.kind === 'link') return 'globe';
  return isPdfRes(r) ? 'pdf' : isImgRes(r) ? 'picture' : 'memo';
}
const kindLabel = r => r.kind === 'video' ? 'Video' : r.kind === 'link' ? 'Link' : isPdfRes(r) ? 'PDF' : isImgRes(r) ? 'Picture' : 'File';
function normUrl(raw) {
  let u = String(raw || '').trim(); if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
}
async function fileOf(r) {
  const buf = await blobs.get(TS.blobKey(r.id));
  if (!buf) throw new Error('missing');
  return new File([buf], r.file.name || 'file', { type: r.file.mime || '' });
}

/** Open a resource the most useful way. where: 'board' | 'tab' */
export async function openResource(r, app, where = 'default') {
  try {
    if (r.kind === 'file') {
      const f = await fileOf(r);
      if (where === 'tab') { const url = URL.createObjectURL(f); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
      if (isPdfRes(r)) { app.toBoard(() => { app.board().dropFile(f); toast('Opened “' + r.title + '” on the board'); }); return; }
      if (isImgRes(r)) { const src = await resizeImage(f, 1600, { type: 'image/jpeg', quality: 0.85 }); app.toBoard(() => { app.board().addWidget('image', { src }); toast('“' + r.title + '” is on the board'); }); return; }
      const url = URL.createObjectURL(f); window.open(url, '_blank', 'noopener'); return;
    }
    const yid = r.kind === 'video' && ytId(r.url);
    if (where === 'board' || (where === 'default' && yid)) {
      if (yid) app.toBoard(() => { app.board().addWidget('youtube', { playing: { id: yid, title: r.title, channel: '', thumb: `https://i.ytimg.com/vi/${yid}/mqdefault.jpg` } }); toast('Playing on the board'); });
      else app.toBoard(() => { app.board().addWidget('embed', { url: r.url }); toast('“' + r.title + '” is on the board'); });
      return;
    }
    window.open(r.url, '_blank', 'noopener');
  } catch (e) {
    console.warn('open resource', e);
    toast(e.message === 'missing' ? 'That file is not saved on this device any more.' : 'That could not be opened.', 'err');
  }
}

/** Add or edit a resource. kind: link | video | file. Resolves with the saved resource. */
export async function editResource(existing, kind = 'link', file = null) {
  const r = existing || { kind, title: file ? file.name.replace(/\.[a-z0-9]+$/i, '') : '', url: '', folder: '', labels: [], file: null };
  let labels = r.labels.slice(), chosen = file;
  return modal(existing ? 'Edit resource' : r.kind === 'file' ? 'Add a file' : r.kind === 'video' ? 'Add a video' : 'Add a link', (body, done) => {
    const title = h('input.input', { type: 'text', value: r.title, maxlength: 120, placeholder: 'Name it (e.g. Apple counting song)', 'aria-label': 'Title', 'data-testid': 'res-title', autofocus: true });
    const url = h('input.input', { type: 'url', value: r.url, placeholder: r.kind === 'video' ? 'YouTube or video link' : 'https://…', 'aria-label': 'Link', 'data-testid': 'res-url', inputmode: 'url', autocapitalize: 'off', spellcheck: 'false' });
    const folder = h('input.input', { type: 'text', value: r.folder, maxlength: 40, placeholder: 'e.g. Math, Songs, Fall', 'aria-label': 'Folder', list: 'dlFolders', 'data-testid': 'res-folder' });
    const fileLine = h('div.t-file-line');
    const drawFile = () => {
      fileLine.innerHTML = '';
      const f = chosen || r.file;
      fileLine.append(fl(f ? (/pdf/i.test(f.type || f.mime || f.name) ? 'pdf' : 'picture') : 'memo', 't-file-ico'),
        h('span', { text: f ? (f.name + ' · ' + mb(f.size || f.bytes || 0)) : 'No file chosen' }),
        existing ? null : h('button.btn.sm.ghost', { type: 'button', text: f ? 'Change' : 'Choose file', 'data-act': 'res-choose', onclick: async () => { const nf = await pickFile('application/pdf,.pdf,image/*'); if (nf && checkFile(nf)) { chosen = nf; if (!title.value.trim()) title.value = nf.name.replace(/\.[a-z0-9]+$/i, ''); drawFile(); } } }));
    };
    const fields = [h('div.field', null, h('label.flabel', { text: 'Title' }), title)];
    if (r.kind === 'file') { drawFile(); fields.push(h('div.field', null, h('label.flabel', { text: 'File' }), fileLine)); }
    else fields.push(h('div.field', null, h('label.flabel', { text: r.kind === 'video' ? 'Video link' : 'Link' }), url));
    fields.push(h('div.field', null, h('label.flabel', { text: 'Folder' }), folder, h('datalist', { id: 'dlFolders' }, TS.allFolders().map(f => h('option', { value: f })))),
      h('div.field', null, h('label.flabel', { text: 'Labels' }), tagInput(labels, v => { labels = v; }, { placeholder: 'Add a label…', suggestions: TS.allLabels(), testid: 'res-labels' })));
    const err = h('p.t-err', { role: 'alert' });
    const save = async () => {
      const t = title.value.trim();
      const pending = $$('.t-tag-in', body)[0]; if (pending && pending.value.trim()) pending.dispatchEvent(new Event('blur'));
      const o = { title: t, folder: folder.value.trim().replace(/\s+/g, ' ').slice(0, 40), labels };
      if (r.kind !== 'file') {
        o.url = normUrl(url.value); if (!o.url) { err.textContent = 'Please paste a web link that starts with https://'; url.focus(); return; }
        if (!o.title) { try { o.title = new URL(o.url).hostname.replace(/^www\./, ''); } catch (e) { o.title = 'Link'; } }
      } else {
        if (!chosen && !r.file) { err.textContent = 'Please choose a PDF or a picture.'; return; }
        if (!o.title) o.title = (chosen || r.file).name.replace(/\.[a-z0-9]+$/i, '');
      }
      if (existing) { done(TS.updateResource(existing.id, o)); return; }
      if (r.kind === 'file') {
        const res = TS.addResource(Object.assign(o, { kind: 'file', file: { name: chosen.name.slice(0, 120), mime: chosen.type || (/\.pdf$/i.test(chosen.name) ? 'application/pdf' : ''), bytes: chosen.size } }));
        try { await TS.saveFileFor(res.id, chosen); } catch (e) {
          await TS.removeResource(res.id);
          err.textContent = /quota/i.test(e && (e.name + e.message)) ? 'There is no room left on this device for that file.' : 'That file could not be saved.'; return;
        }
        done(res); return;
      }
      done(TS.addResource(Object.assign(o, { kind: r.kind })));
    };
    body.append(...fields, err, h('div.row.end', null, h('button.btn.ghost', { type: 'button', text: 'Cancel', onclick: () => done() }), h('button.btn.primary', { type: 'button', text: existing ? 'Save' : 'Add to library', 'data-act': 'res-save', onclick: save })));
    body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input.input')) { e.preventDefault(); save(); } });
  }, { icon: r.kind === 'video' ? 'tv' : r.kind === 'file' ? 'pdf' : 'globe', cls: 'res-modal' });
}
/** In a shared classroom, files over 10 MB stay on the device that added them. */
function onlyHere(r) {
  if (!env.cloud || !r.file || (r.file.bytes || 0) <= CLOUD_FILE_MAX) return null;
  const b = h('span.only-here', { 'data-testid': 'only-here', title: 'Over 10 MB, so it is not copied to your class. It stays on the device that added it.', text: 'Only on this device' });
  IDBBlobAdapter.get(TS.blobKey(r.id)).then(v => { if (!v) b.textContent = 'On another device'; }).catch(() => {});
  return [' ', b];
}
export function checkFile(f) {
  const ok = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name) || /^image\//.test(f.type);
  if (!ok) { toast('Please choose a PDF or a picture.', 'err'); return false; }
  if (f.size > TS.FILE_MAX) { toast('That file is ' + mb(f.size) + '. Files up to 25 MB fit in the library.', 'err'); return false; }
  if (env.cloud && f.size > CLOUD_FILE_MAX) toast('Files over 10 MB stay on this device only – your class will not see this one.');
  return true;
}

/** A small card for a resource (used in the library grid and on lessons). */
export function resCard(r, app, { compact, onRemove } = {}) {
  const thumb = h('div.rc-thumb');
  const yid = r.kind === 'video' && ytId(r.url);
  if (yid && !compact) { const im = h('img.rc-img', { src: `https://i.ytimg.com/vi/${yid}/mqdefault.jpg`, alt: '', loading: 'lazy', draggable: 'false' }); im.onerror = () => im.replaceWith(fl('tv', 'rc-ico')); thumb.append(im); }
  else if (isImgRes(r) && !compact) { thumb.append(fl('picture', 'rc-ico')); blobs.get(TS.blobKey(r.id)).then(buf => { if (!buf) return; const u = URL.createObjectURL(new Blob([buf], { type: r.file.mime })); const im = h('img.rc-img', { src: u, alt: '', draggable: 'false' }); im.onload = () => setTimeout(() => URL.revokeObjectURL(u), 1000); thumb.innerHTML = ''; thumb.append(im); }).catch(() => {}); }
  else thumb.append(fl(resIcon(r), 'rc-ico'));
  const meta = [kindLabel(r)];
  if (r.file) meta.push(mb(r.file.bytes || 0)); else if (r.url) { try { meta.push(new URL(r.url).hostname.replace(/^www\./, '')); } catch (e) { } }
  const primary = r.kind === 'file' ? (isPdfRes(r) || isImgRes(r) ? 'Show on board' : 'Open') : (yid ? 'Play on board' : 'Open link');
  const more = h('button.icon-btn.sm', { type: 'button', 'aria-label': 'More for ' + r.title, title: 'More', 'data-act': 'res-more', html: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' });
  more.onclick = e => {
    e.stopPropagation();
    popMenu(more, [
      r.kind === 'file' ? { label: isPdfRes(r) ? 'Open PDF in a new tab' : 'Open in a new tab', icon: 'ext', act: 'res-tab', fn: () => openResource(r, app, 'tab') }
        : yid ? { label: 'Open on YouTube', icon: 'ext', act: 'res-tab', fn: () => openResource(r, app, 'tab') }
        : { label: 'Show on the board', icon: 'board', act: 'res-board', fn: () => openResource(r, app, 'board') },
      onRemove ? { label: 'Remove from lesson', icon: 'close', act: 'res-unattach', danger: true, fn: onRemove } : null,
      onRemove ? null : { label: 'Edit', icon: 'pencil', act: 'res-edit', fn: async () => { if (await editResource(r)) app.go('library', { keep: true }); } },
      onRemove ? null : { label: 'Delete', icon: 'trash', act: 'res-delete', danger: true, fn: async () => {
        const used = TS.T().lessons.filter(l => l.resources.includes(r.id)).length;
        if (await confirmDialog('Delete “' + r.title + '”?', used ? `It is attached to ${used} lesson${used > 1 ? 's' : ''}; it will be taken off ${used > 1 ? 'them' : 'it'}.` : 'It will be removed from your library.')) { await TS.removeResource(r.id); toast('Removed from the library'); app.go('library', { keep: true }); }
      } }
    ]);
  };
  const go = h('button.btn.sm' + (compact ? '.ghost' : '.primary'), { type: 'button', 'data-act': 'res-open', onclick: e => { e.stopPropagation(); openResource(r, app); } }, sv(r.kind === 'link' ? 'ext' : 'board'), h('span', { text: primary }));
  return h('div.rc' + (compact ? '.compact' : ''), { 'data-res': r.id, 'data-kind': r.kind },
    thumb,
    h('div.rc-main', null,
      h('b.rc-title', { text: r.title, title: r.title }),
      h('small.rc-meta', { text: meta.join(' · ') }, onlyHere(r)),
      !compact && (r.folder || r.labels.length) ? h('div.rc-labels', null, r.folder ? h('span.rc-folder', null, sv('folder'), h('span', { text: r.folder })) : null, r.labels.map(l => h('span.rc-label', { text: l }))) : null),
    h('div.rc-acts', null, go, more));
}

export function renderLibrary(root, app, opts) {
  const st = renderLibrary.st || (renderLibrary.st = { q: '', folder: '' });
  if (!opts.keep) { st.q = ''; st.folder = ''; }
  const head = h('header.tp-head', null,
    h('div.tp-title', null, fl('books', 'tp-ico'), h('div', null, h('h1', { text: 'Library' }), h('p', { text: 'Links, videos, PDFs and pictures you use in class' }))),
    h('div.tp-actions', null,
      h('button.btn', { type: 'button', 'data-act': 'add-link', onclick: () => add('link') }, sv('link'), 'Link'),
      h('button.btn', { type: 'button', 'data-act': 'add-video', onclick: () => add('video') }, fl('tv', 'btn-fl'), 'Video'),
      h('button.btn.primary', { type: 'button', 'data-act': 'add-file', onclick: () => add('file') }, sv('upload'), 'Upload file')));
  const search = h('input.input.t-search', { type: 'search', placeholder: 'Search the library', 'aria-label': 'Search the library', value: st.q, 'data-testid': 'lib-search' });
  const chips = h('div.t-chips', { 'data-testid': 'lib-folders' });
  const grid = h('div.rc-grid', { 'data-testid': 'lib-grid' });
  const drop = h('div.t-dropzone', null, sv('upload'), h('span', { text: 'Drop PDFs or pictures here to add them' }));
  root.append(head, h('div.t-toolbar', null, h('label.t-search-wrap', null, sv('search', 'i t-mag'), search), chips), grid, drop);
  search.addEventListener('input', () => { st.q = search.value; draw(); });

  async function add(kind) {
    let f = null;
    if (kind === 'file') { f = await pickFile('application/pdf,.pdf,image/*'); if (!f || !checkFile(f)) return; }
    const r = await editResource(null, kind, f);
    if (r) { toast('Added to the library'); st.q = ''; search.value = ''; st.folder = r.folder && st.folder ? r.folder : st.folder; draw(); }
  }
  function draw() {
    const folders = TS.allFolders(); if (st.folder && st.folder !== '-' && !folders.includes(st.folder)) st.folder = '';
    chips.innerHTML = '';
    const chip = (v, label) => h('button.chip' + (st.folder === v ? '.on' : ''), { type: 'button', 'data-folder': v, onclick: () => { st.folder = v; draw(); } }, v && v !== '-' ? sv('folder') : null, h('span', { text: label }));
    chips.append(chip('', 'All'), ...folders.map(f => chip(f, f)));
    if (folders.length && TS.T().resources.some(r => !r.folder)) chips.append(chip('-', 'No folder'));
    const q = st.q.trim().toLowerCase();
    const list = TS.T().resources.filter(r => (!st.folder || (st.folder === '-' ? !r.folder : r.folder === st.folder)) &&
      (!q || [r.title, r.url, r.folder, r.file && r.file.name, ...r.labels].some(x => x && x.toLowerCase().includes(q))));
    grid.innerHTML = '';
    if (!TS.T().resources.length) { grid.append(empty('books', 'Your library is empty', 'Add links, YouTube videos, PDFs and pictures. Then attach them to lessons or show them on the board.')); return; }
    if (!list.length) { grid.append(empty('magnifier', 'Nothing matches', q ? 'Try another word.' : 'This folder is empty.')); return; }
    list.forEach(r => grid.append(resCard(r, app)));
  }
  // drop files onto the page
  root.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); root.classList.add('drop'); } });
  root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('drop'); });
  root.addEventListener('drop', async e => {
    root.classList.remove('drop'); if (!e.dataTransfer.files.length) return; e.preventDefault();
    const f = e.dataTransfer.files[0]; if (!checkFile(f)) return;
    const r = await editResource(null, 'file', f); if (r) { toast('Added to the library'); draw(); }
  });
  draw();
}
