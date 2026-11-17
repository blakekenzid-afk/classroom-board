// Dice: 1–6 big 3D dice with dot, number or picture faces (colors,
// shapes, animals, feelings, moves), a rattle sound and the total.
import { h, $, $$, pic, icon, ico, segmented, swatches, toggle, section, clamp } from '../util.js?v=3';
import { pickPicture } from '../picker.js?v=3';
import { playSound } from '../audio.js?v=3';

const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// cube rotation (x, y) that brings face n to the front
const TURN = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
export const DICE_SETS = [
  ['colors', 'Colors', ['circle-red', 'circle-orange', 'circle-yellow', 'circle-green', 'circle-blue', 'circle-purple']],
  ['shapes', 'Shapes', ['circle-red', 'square-blue', 'triangle-red', 'star', 'heart', 'diamond-orange']],
  ['animals', 'Animals', ['dog', 'cat', 'frog', 'lion', 'bear', 'penguin']],
  ['feelings', 'Feelings', ['happy', 'sad', 'angry', 'silly', 'tired', 'surprised']],
  ['moves', 'Moves', ['running', 'dancing', 'clap', 'cartwheel', 'raised-hand', 'lotus']]
];
const COLORS = [
  ['rainbow', 'linear-gradient(135deg,#FF8A80,#FFD54F 35%,#81C784 65%,#64B5F6)', 'Rainbow'],
  ['white', '#FFFFFF', 'White'], ['red', '#E9544A', 'Red'], ['blue', '#3B82E8', 'Blue'], ['green', '#34A85A', 'Green'], ['purple', '#8E5BD6', 'Purple'], ['yellow', '#FFCC33', 'Yellow']
];
const DIE = { white: ['#FFFFFF', '#23233F'], red: ['#E9544A', '#FFFFFF'], blue: ['#3B82E8', '#FFFFFF'], green: ['#34A85A', '#FFFFFF'], purple: ['#8E5BD6', '#FFFFFF'], yellow: ['#FFCC33', '#3A2A00'], orange: ['#F28C28', '#FFFFFF'], pink: ['#E2558E', '#FFFFFF'] };
const RAINBOW = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const rnd6 = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % 6); };

export const dice = {
  type: 'dice', label: 'Dice', icon: 'dice',
  size: { w: 520, h: 380 }, min: { w: 240, h: 220 },
  transient: ['values', 'rolls'],
  defaults: () => ({ count: 2, faces: 'dots', set: 'colors', pics: DICE_SETS[0][2].slice(), color: 'rainbow', sound: true, total: true, values: [], rolls: 0 }),
  mount(ctx) {
    const d = ctx.data;
    const tray = h('div.dc-tray');
    const total = h('div.dc-total', { 'aria-live': 'polite' });
    const rollBtn = h('button.btn.primary.dc-roll', { type: 'button', 'data-act': 'roll' }, h('img', { src: 'icons/dice.svg', alt: '' }), h('span', { text: 'Roll' }));
    const minus = h('button.tm-ctl.dc-n', { type: 'button', 'aria-label': 'One less die', title: 'One less die', 'data-act': 'dice-less', html: ico.minus });
    const plus = h('button.tm-ctl.dc-n', { type: 'button', 'aria-label': 'One more die', title: 'One more die', 'data-act': 'dice-more', html: ico.plus });
    const root = h('div.dc', null, total, tray, h('div.dc-bottom', null, minus, rollBtn, plus));
    ctx.body.append(root);
    let dies = [], rolling = 0, t1 = 0, t2 = 0;

    const pipColor = i => DIE[d.color === 'rainbow' ? RAINBOW[i % 6] : d.color] || DIE.white;
    function face(n, i) {
      const f = h('div.dc-face.f' + n);
      if (d.faces === 'numbers') f.append(h('span.dc-num', { text: String(n) }));
      else if (d.faces === 'pictures') f.append(h('div.dc-pic', null, pic(d.pics[n - 1] || 'star')));
      else { const g = h('div.dc-pips'); for (let k = 1; k <= 9; k++) g.append(h('i', { class: PIPS[n].includes(k) ? 'on' : '' })); f.append(g); }
      return f;
    }
    function build() {
      tray.innerHTML = ''; dies = [];
      if (!Array.isArray(d.values)) d.values = [];
      for (let i = 0; i < d.count; i++) {
        const v = d.values[i] || (i % 6) + 1;
        const [bg, fg] = pipColor(i);
        const cube = h('div.dc-cube');
        for (let n = 1; n <= 6; n++) cube.append(face(n, i));
        const die = h('div.dc-die', { 'data-value': v, style: { '--db': bg, '--dp': fg } }, cube);
        die.addEventListener('click', () => { if (!ctx.frame.dataset.justDragged) roll(); });
        tray.append(die);
        const rot = { x: TURN[v][0], y: TURN[v][1], z: 0 };
        cube.style.transform = `rotateZ(0deg) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
        dies.push({ die, cube, rot });
      }
      root.className = 'dc faces-' + d.faces;
      minus.disabled = d.count <= 1; plus.disabled = d.count >= 6;
      layout(); showTotal();
    }
    function layout() {
      const r = tray.getBoundingClientRect(); if (!r.width || !r.height) return;
      const n = d.count; let best = 0;
      for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols); best = Math.max(best, Math.min(r.width / cols, r.height / rows)); }
      tray.style.setProperty('--ds', Math.max(36, Math.min(220, best * 0.68)) + 'px');
    }
    function showTotal() {
      const vals = d.values.slice(0, d.count);
      const sum = vals.reduce((a, b) => a + b, 0);
      root.dataset.total = vals.length === d.count ? sum : '';
      const show = d.total && d.faces !== 'pictures' && d.count > 1 && vals.length === d.count && !rolling;
      total.innerHTML = '';
      if (show) total.append(h('span.dc-tl', { text: 'Total' }), h('b', { text: String(sum), 'data-testid': 'dice-total' }));
      total.classList.toggle('show', show);
    }
    function roll() {
      if (rolling) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      d.values = Array.from({ length: d.count }, rnd6); d.rolls = (d.rolls || 0) + 1;
      rolling = 1; root.classList.add('rolling'); showTotal();
      if (d.sound) playSound('rattle');
      dies.forEach((o, i) => {
        const v = d.values[i], [bx, by] = TURN[v];
        const spinX = 360 * (2 + Math.floor(Math.random() * 2)), spinY = 360 * (1 + Math.floor(Math.random() * 2));
        o.rot.x = bx + Math.ceil((o.rot.x - bx) / 360) * 360 + spinX;
        o.rot.y = by + Math.ceil((o.rot.y - by) / 360) * 360 + spinY;
        o.rot.z = Math.round((Math.random() - 0.5) * 24);
        o.cube.style.transitionDuration = reduce ? '0s' : (0.95 + i * 0.08) + 's';
        o.cube.style.transform = `rotateZ(${o.rot.z}deg) rotateX(${o.rot.x}deg) rotateY(${o.rot.y}deg)`;
        o.die.dataset.value = v;
        o.die.classList.remove('hop'); void o.die.offsetWidth; if (!reduce) o.die.classList.add('hop');
      });
      ctx.save();
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => { rolling = 0; root.classList.remove('rolling'); showTotal(); total.classList.add('pop'); t2 = setTimeout(() => total.classList.remove('pop'), 500); }, reduce ? 30 : 1050 + d.count * 80);
    }
    rollBtn.onclick = roll;
    minus.onclick = () => { d.count = clamp(d.count - 1, 1, 6); d.values = d.values.slice(0, d.count); ctx.save(); build(); };
    plus.onclick = () => { d.count = clamp(d.count + 1, 1, 6); d.values = d.values.slice(0, d.count); ctx.save(); build(); };
    build();
    return {
      roll, resize: layout,
      destroy: () => { clearTimeout(t1); clearTimeout(t2); },
      settings: panel => {
        const picsWrap = h('div');
        const drawPics = () => {
          picsWrap.innerHTML = '';
          if (d.faces !== 'pictures') return;
          const sets = h('div.chips');
          DICE_SETS.forEach(([k, l, arr]) => sets.append(h('button.chip' + (d.set === k ? '.on' : ''), { type: 'button', text: l, 'data-set': k, onclick: () => { d.set = k; d.pics = arr.slice(); ctx.save(); build(); drawPics(); } })));
          const grid = h('div.dc-picgrid');
          d.pics.forEach((p, i) => {
            const b = h('button.ed-pic', { type: 'button', title: 'Side ' + (i + 1), 'aria-label': 'Change side ' + (i + 1), 'data-side': i + 1 }, pic(p));
            b.onclick = async () => { const v = await pickPicture({ title: 'Picture for side ' + (i + 1), allowNone: false, current: p }); if (v) { d.pics = d.pics.slice(); d.pics[i] = v; d.set = 'custom'; ctx.save(); build(); drawPics(); } };
            grid.append(b);
          });
          picsWrap.append(section('Picture sides', sets, grid, h('small.hint', { text: 'Tap a side to choose your own picture.' })));
        };
        panel.append(
          section('How many dice', segmented([1, 2, 3, 4, 5, 6].map(n => [n, String(n)]), d.count, v => { d.count = v; d.values = d.values.slice(0, v); ctx.save(); build(); })),
          section('Sides show', segmented([['dots', 'Dots'], ['numbers', 'Numbers'], ['pictures', 'Pictures']], d.faces, v => { d.faces = v; ctx.save(); build(); drawPics(); })),
          picsWrap,
          section('Dice color', swatches(COLORS, d.color, v => { d.color = v; ctx.save(); build(); }, false)),
          section('Options', toggle('Rolling sound', d.sound, v => { d.sound = v; ctx.save(); }), toggle('Show the total', d.total, v => { d.total = v; ctx.save(); showTotal(); }, 'For dots and numbers with 2 or more dice')));
        drawPics();
      }
    };
  }
};
