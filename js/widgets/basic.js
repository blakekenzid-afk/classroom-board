// Clock, Text, Image, Traffic light, Work symbols, Sticker.
import { h, $, $$, pad, pic, picSrc, icon, ico, segmented, swatches, toggle, section, field, pickFile, resizeImage, toast } from '../util.js?v=4';
import { pickPicture } from '../picker.js?v=4';

// ───────── Clock ─────────
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const clock = {
  type: 'clock', label: 'Clock', icon: 'alarm-clock',
  size: { w: 340, h: 200 }, min: { w: 170, h: 110 },
  defaults: () => ({ mode: 'digital', h24: false, seconds: false, date: true }),
  mount(ctx) {
    const d = ctx.data; const root = h('div.ck'); ctx.body.append(root);
    let hands = null, last = '';
    function build() {
      root.innerHTML = ''; root.className = 'ck ' + d.mode + (d.seconds ? ' secs' : '') + (d.h24 ? ' h24' : '') + (d.date ? ' wdate' : ''); hands = null; last = '';
      if (d.mode === 'analog') {
        const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-110 -110 220 220'); svg.classList.add('ck-svg');
        let s = '<circle r="104" class="ck-rim"/><circle r="98" class="ck-face"/>';
        for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 90 : 84; s += `<line class="${i % 5 ? 'mn' : 'mj'}" x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * 94).toFixed(2)}" y2="${(-Math.cos(a) * 94).toFixed(2)}"/>`; }
        for (let n = 1; n <= 12; n++) { const a = n * 30 * Math.PI / 180; s += `<text x="${(Math.sin(a) * 70).toFixed(2)}" y="${(-Math.cos(a) * 70 + 7.5).toFixed(2)}" class="ck-n">${n}</text>`; }
        s += '<line class="hh" x1="0" y1="12" x2="0" y2="-48"/><line class="mh" x1="0" y1="14" x2="0" y2="-74"/><line class="sh" x1="0" y1="18" x2="0" y2="-82"/><circle r="6" class="ck-hub"/>';
        svg.innerHTML = s; root.append(h('div.ck-dial', null, svg));
        hands = { h: $('.hh', svg), m: $('.mh', svg), s: $('.sh', svg) };
        if (!d.seconds) hands.s.style.display = 'none';
        if (d.date) root.append(h('div.ck-date'));
      } else {
        root.append(h('div.ck-time', null, h('span.hm'), h('span.ss'), h('span.ap')));
        if (d.date) root.append(h('div.ck-date'));
      }
      paint(Date.now());
    }
    function paint(now) {
      const t = new Date(now);
      const key = t.getHours() + ':' + t.getMinutes() + ':' + (d.seconds || d.mode === 'analog' ? t.getSeconds() : '');
      if (key === last) return; last = key;
      const dt = $('.ck-date', root); if (dt) dt.textContent = DAYS[t.getDay()] + ', ' + MONTHS[t.getMonth()] + ' ' + t.getDate();
      if (hands) {
        const s = t.getSeconds(), m = t.getMinutes() + s / 60, hr = (t.getHours() % 12) + m / 60;
        hands.h.setAttribute('transform', `rotate(${hr * 30})`); hands.m.setAttribute('transform', `rotate(${m * 6})`); hands.s.setAttribute('transform', `rotate(${s * 6})`);
      } else {
        const H = t.getHours();
        $('.hm', root).textContent = (d.h24 ? pad(H) : (H % 12 || 12)) + ':' + pad(t.getMinutes());
        $('.ss', root).textContent = d.seconds ? ':' + pad(t.getSeconds()) : '';
        $('.ap', root).textContent = d.h24 ? '' : (H < 12 ? 'AM' : 'PM');
      }
    }
    build();
    return {
      tick: paint,
      settings: panel => {
        panel.append(section(null, segmented([['digital', 'Digital'], ['analog', 'Analog']], d.mode, v => { d.mode = v; ctx.save(); build(); }, 'big')),
          section('Options', toggle('Show date', d.date, v => { d.date = v; ctx.save(); build(); }), toggle('Show seconds', d.seconds, v => { d.seconds = v; ctx.save(); build(); }), toggle('24-hour clock', d.h24, v => { d.h24 = v; ctx.save(); build(); })));
      }
    };
  }
};

// ───────── Text ─────────
const TEXT_COLORS = [['#23233F', '#23233F', 'Ink'], ['#5B5BD6', '#5B5BD6', 'Violet'], ['#2B7DE9', '#2B7DE9', 'Blue'], ['#2FA55A', '#2FA55A', 'Green'], ['#F08A24', '#F08A24', 'Orange'], ['#E2483D', '#E2483D', 'Red'], ['#E2558E', '#E2558E', 'Pink']];
const NOTE_BG = [['#FFFFFF', '#FFFFFF', 'White'], ['#FFF6C9', '#FFF6C9', 'Yellow'], ['#FFE3EC', '#FFE3EC', 'Pink'], ['#E2F0FF', '#E2F0FF', 'Blue'], ['#E1F6E7', '#E1F6E7', 'Green'], ['#EFE8FF', '#EFE8FF', 'Purple']];
export const text = {
  type: 'text', label: 'Text', icon: 'memo',
  size: { w: 420, h: 220 }, min: { w: 160, h: 90 },
  defaults: () => ({ html: '', size: 'm', color: '#23233F', align: 'center', bg: '#FFFFFF', bold: true }),
  mount(ctx) {
    const d = ctx.data;
    const ed = h('div.tx-ed', { contenteditable: 'true', spellcheck: 'true', 'data-placeholder': 'Type here…', 'aria-label': 'Text' });
    ed.innerHTML = sanitize(d.html);
    let t;
    ed.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { d.html = sanitize(ed.innerHTML); ctx.save(); }, 300); });
    ed.addEventListener('blur', () => { d.html = sanitize(ed.innerHTML); ctx.save(); });
    ed.addEventListener('paste', e => { e.preventDefault(); const txt = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, txt); });
    const root = h('div.tx', null, ed); ctx.body.append(root);
    function style() {
      root.dataset.size = d.size; root.style.setProperty('--txc', d.color); root.style.textAlign = d.align;
      ctx.frame.style.setProperty('--card', d.bg); root.classList.toggle('bold', !!d.bold);
    }
    style();
    return {
      settings: panel => {
        panel.append(
          section('Size', segmented([['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Huge']], d.size, v => { d.size = v; ctx.save(); style(); })),
          section('Text color', swatches(TEXT_COLORS, d.color, v => { d.color = v; ctx.save(); style(); })),
          section('Align', segmented([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], d.align, v => { d.align = v; ctx.save(); style(); })),
          section('Note color', swatches(NOTE_BG, d.bg, v => { d.bg = v; ctx.save(); style(); }, false)),
          section('Style', toggle('Bold', d.bold, v => { d.bold = v; ctx.save(); style(); })));
      }
    };
  }
};
function sanitize(html) {
  const tmp = document.createElement('div'); tmp.innerHTML = html || '';
  tmp.querySelectorAll('script,style,iframe,object,img').forEach(n => n.remove());
  tmp.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => n.removeAttribute(a.name)));
  return tmp.innerHTML.slice(0, 4000);
}

// ───────── Image ─────────
export const image = {
  type: 'image', label: 'Image', icon: 'picture',
  size: { w: 420, h: 320 }, min: { w: 140, h: 110 },
  defaults: () => ({ src: '', fit: 'contain' }),
  mount(ctx) {
    const d = ctx.data; const root = h('div.im'); ctx.body.append(root);
    async function choose(file) {
      file = file || await pickFile('image/*,application/pdf,.pdf'); if (!file) return;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
        // a PDF gets its own PDF widget (taking this spot if the picture box is still empty)
        window.dispatchEvent(new CustomEvent('cb:drop-file', { detail: { file, replace: d.src ? null : ctx.w.id } })); return;
      }
      try { d.src = await resizeImage(file, 1600, { type: 'image/jpeg', quality: 0.85 }); ctx.save(); draw(); }
      catch (e) { toast(e.message, 'err'); }
    }
    function draw() {
      root.innerHTML = ''; root.className = 'im fit-' + d.fit;
      if (d.src) root.append(h('img', { src: d.src, alt: '', draggable: 'false' }));
      else root.append(h('button.im-empty', { type: 'button', 'data-act': 'upload', onclick: () => choose() }, h('span.im-ico', { html: ico.image }), h('b', { text: 'Add a picture' }), h('small', { text: 'Click to upload, or drop a picture or PDF here' })));
    }
    root.addEventListener('dragover', e => { e.preventDefault(); root.classList.add('drop'); });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); root.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) choose(f); });
    draw();
    return {
      settings: panel => {
        panel.append(section('Picture', h('div.row', null, h('button.btn.primary', { type: 'button', onclick: () => choose() }, icon('upload'), d.src ? 'Replace picture' : 'Upload picture'),
          d.src ? h('button.btn.ghost', { type: 'button', text: 'Remove', onclick: () => { d.src = ''; ctx.save(); draw(); } }) : null)),
          section('Fit', segmented([['contain', 'Show whole picture'], ['cover', 'Fill the box']], d.fit, v => { d.fit = v; ctx.save(); draw(); })));
      }
    };
  }
};

// ───────── Traffic light ─────────
export const traffic = {
  type: 'traffic', label: 'Traffic light', icon: 'traffic',
  size: { w: 190, h: 400 }, min: { w: 110, h: 220 },
  defaults: () => ({ on: 'green', labels: { red: 'Stop', yellow: 'Get ready', green: 'Go' }, showLabel: true, horizontal: false }),
  mount(ctx) {
    const d = ctx.data; const root = h('div.trl'); ctx.body.append(root);
    function draw() {
      root.innerHTML = ''; root.className = 'trl' + (d.horizontal ? ' horiz' : '');
      const house = h('div.trl-house');
      ['red', 'yellow', 'green'].forEach(c => {
        const b = h('button.trl-lamp.' + c + (d.on === c ? '.on' : ''), { type: 'button', 'aria-label': d.labels[c] || c, 'aria-pressed': String(d.on === c), 'data-lamp': c });
        b.onclick = () => { if (ctx.frame.dataset.justDragged) return; d.on = d.on === c ? '' : c; ctx.save(); draw(); };
        house.append(b);
      });
      root.append(house);
      if (d.showLabel) root.append(h('div.trl-label.' + (d.on || 'off'), { text: d.on ? (d.labels[d.on] || '') : ' ' }));
    }
    draw();
    return {
      settings: panel => {
        const ins = ['red', 'yellow', 'green'].map(c => { const i = h('input.input', { value: d.labels[c] || '', maxlength: 24, 'aria-label': c + ' label' }); i.addEventListener('input', () => { d.labels[c] = i.value; ctx.save(); draw(); }); return field(c[0].toUpperCase() + c.slice(1) + ' light says', i); });
        panel.append(section('Labels', toggle('Show label', d.showLabel, v => { d.showLabel = v; ctx.save(); draw(); }), ...ins),
          section('Layout', toggle('Sideways', d.horizontal, v => { d.horizontal = v; ctx.save(); draw(); }, 'Lights in a row instead of stacked')));
      }
    };
  }
};

// ───────── Work symbols ─────────
export const WORK = [
  ['quiet', 'Quiet', 'zipper', '#5B5BD6'], ['whisper', 'Whisper', 'shush', '#2B7DE9'], ['partner', 'Partner', 'handshake', '#2FA55A'],
  ['group', 'Group work', 'group', '#F08A24'], ['raise', 'Raise your hand', 'raised-hand', '#E2558E'], ['listen', 'Listen', 'ear', '#0FA3A3'], ['look', 'Eyes on me', 'eyes', '#8E5BD6']
];
export const work = {
  type: 'work', label: 'Work symbols', icon: 'raised-hand',
  size: { w: 330, h: 330 }, min: { w: 170, h: 170 },
  defaults: () => ({ sel: 'quiet', show: WORK.map(w => w[0]) }),
  mount(ctx) {
    const d = ctx.data; const root = h('div.ws'); ctx.body.append(root);
    function draw() {
      const cur = WORK.find(w => w[0] === d.sel) || WORK[0];
      root.innerHTML = ''; root.style.setProperty('--wc', cur[3]);
      const big = h('div.ws-big', { title: 'Tap for the next symbol' }, h('div.ws-pic', null, pic(cur[2])), h('div.ws-label', { text: cur[1] }));
      big.addEventListener('click', () => {
        if (ctx.frame.dataset.justDragged) return;
        const opts = WORK.filter(w => d.show.includes(w[0])); const i = opts.findIndex(w => w[0] === d.sel);
        d.sel = opts[(i + 1) % opts.length][0]; ctx.save(); draw();
      });
      root.append(big);
      const bar = h('div.ws-bar');
      WORK.filter(w => d.show.includes(w[0])).forEach(w => {
        const b = h('button.ws-opt' + (w[0] === d.sel ? '.on' : ''), { type: 'button', title: w[1], 'aria-label': w[1], 'data-sym': w[0] }, pic(w[2])); b.style.setProperty('--wc', w[3]);
        b.onclick = () => { if (ctx.frame.dataset.justDragged) return; d.sel = w[0]; ctx.save(); draw(); };
        bar.append(b);
      });
      root.append(bar);
    }
    draw();
    return {
      settings: panel => {
        const cur = h('div.ws-pickgrid');
        WORK.forEach(w => { const b = h('button.ws-pick' + (w[0] === d.sel ? '.on' : ''), { type: 'button', 'data-sym': w[0] }, pic(w[2]), h('span', { text: w[1] })); b.style.setProperty('--wc', w[3]); b.onclick = () => { d.sel = w[0]; if (!d.show.includes(w[0])) d.show.push(w[0]); ctx.save(); draw(); $$('.ws-pick', cur).forEach(x => x.classList.toggle('on', x === b)); }; cur.append(b); });
        panel.append(section('Showing now', cur, h('small.hint', { text: 'Tip: tap the big picture on the board to switch to the next symbol.' })));
        panel.append(section('Symbols to offer', ...WORK.map(w => toggle(w[1], d.show.includes(w[0]), v => { d.show = v ? [...new Set([...d.show, w[0]])] : d.show.filter(x => x !== w[0]); if (!d.show.length) d.show = [w[0]]; ctx.save(); draw(); }))));
      }
    };
  }
};

// ───────── Sticker (frameless) ─────────
export const sticker = {
  type: 'sticker', label: 'Sticker', icon: 'glowing-star', frameless: true, dragAnywhere: true, keepRatio: true,
  size: { w: 150, h: 150 }, min: { w: 56, h: 56 },
  defaults: () => ({ pic: 'star' }),
  mount(ctx) {
    const d = ctx.data; ctx.body.append(h('div.st', null, pic(d.pic)));
    return {
      settings: async panel => {
        panel.append(section('Sticker', h('button.btn.primary', { type: 'button', text: 'Change sticker', onclick: async () => { const v = await pickPicture({ title: 'Choose a sticker', allowNone: false, current: d.pic }); if (v) { d.pic = v; ctx.save(); ctx.body.innerHTML = ''; ctx.body.append(h('div.st', null, pic(d.pic))); } } })));
      }
    };
  }
};
