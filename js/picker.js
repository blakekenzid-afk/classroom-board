// Pictogram picker: big colorful built-in pictures + "upload my own".
import { ICONS } from './icon-list.js';
import * as S from './store.js';
import { h, $$, picSrc, pickFile, resizeImage, toast, icon, ico } from './util.js';

const CATS = [['all', 'All'], ['mine', 'My pictures'], ['routine', 'Routines'], ['school', 'Learning'], ['play', 'Play'], ['people', 'People'], ['feelings', 'Feelings'], ['nature', 'Nature'], ['fun', 'Fun']];

export function pickPicture({ title = 'Choose a picture', allowNone = true, current } = {}) {
  return new Promise(resolve => {
    let cat = 'all', q = '';
    const done = v => { back.remove(); document.removeEventListener('keydown', esc); resolve(v); };
    const esc = e => { if (e.key === 'Escape') done(undefined); };
    document.addEventListener('keydown', esc);
    const grid = h('div.pp-grid', { 'data-testid': 'picker-grid' });
    const search = h('input.input.pp-search', { type: 'search', placeholder: 'Search pictures (snack, nap, art…)', 'aria-label': 'Search pictures' });
    const chips = h('div.pp-chips');
    CATS.forEach(([k, label]) => {
      const c = h('button.chip' + (k === cat ? '.on' : ''), { type: 'button', text: label, 'data-cat': k });
      c.onclick = () => { cat = k; $$('.chip', chips).forEach(x => x.classList.toggle('on', x === c)); draw(); };
      chips.append(c);
    });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); if (q && cat !== 'all') { cat = 'all'; $$('.chip', chips).forEach(x => x.classList.toggle('on', x.dataset.cat === 'all')); } draw(); });

    const upload = async () => {
      const f = await pickFile(); if (!f) return;
      try {
        const url = await resizeImage(f, 360, { type: 'image/webp', quality: 0.85 });
        const st = S.getState();
        st.myPictures = [url, ...st.myPictures.filter(x => x !== url)].slice(0, 40);
        S.save(); done(url);
      } catch (e) { toast(e.message, 'err'); }
    };

    function tile(v, label, extraCls = '') {
      const t = h('button.pp-tile' + extraCls + (v && v === current ? '.on' : ''), { type: 'button', title: label, 'data-pic': v || '' },
        h('img', { src: picSrc(v), alt: '', loading: 'lazy', draggable: 'false' }), h('span', { text: label }));
      t.onclick = () => done(v);
      return t;
    }
    function draw() {
      grid.innerHTML = '';
      if (!q) {
        grid.append(h('button.pp-tile.pp-upload', { type: 'button', onclick: upload, 'data-act': 'upload' }, icon('upload', 'up-i'), h('span', { text: 'Upload my own' })));
        if (allowNone && cat === 'all') grid.append(h('button.pp-tile.pp-none', { type: 'button', onclick: () => done('') }, h('span.none-i'), h('span', { text: 'No picture' })));
      }
      const mine = S.getState().myPictures;
      if (cat === 'mine' || (cat === 'all' && !q)) mine.forEach(u => grid.append(tile(u, 'My picture')));
      if (cat === 'mine') { if (!mine.length) grid.append(h('p.pp-empty', { text: 'Pictures you upload will be saved here so you can use them again.' })); return; }
      const list = ICONS.filter(i => (cat === 'all' || i.cat === cat) && (!q || i.label.toLowerCase().includes(q) || i.id.includes(q)));
      list.forEach(i => grid.append(tile(i.id, i.label)));
      if (q && !list.length) grid.append(h('p.pp-empty', { text: 'No pictures match “' + q + '”. Try another word, or upload your own.' }));
    }
    const back = h('div.modal-back.pp-back', { onpointerdown: e => { if (e.target === back) done(undefined); } },
      h('div.modal.picker', { role: 'dialog', 'aria-label': title },
        h('div.pp-head', null, h('h3', { text: title }), h('button.icon-btn', { 'aria-label': 'Close', html: ico.close, onclick: () => done(undefined) })),
        search, chips, grid));
    document.body.append(back);
    draw();
    setTimeout(() => { if (matchMedia('(hover:hover)').matches) search.focus(); }, 50);
  });
}
