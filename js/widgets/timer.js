// Timer (big digits) and Visual timer (shrinking disc). Shared engine:
// running state is stored as an absolute endAt, so a reload keeps counting.
import { h, $, $$, icon, ico, pad, segmented, swatches, section, field, toggle, clamp } from '../util.js?v=5';
import { SOUNDS, playSound } from '../audio.js?v=5';

function engine(ctx, onUpdate) {
  const d = ctx.data;
  const remaining = now => d.running ? Math.max(0, d.endAt - now) : d.left;
  const api = {
    remaining,
    start() { if (d.running) return; if (d.left <= 0) d.left = d.duration; d.endAt = Date.now() + d.left; d.running = true; d.fired = false; ctx.save(); onUpdate(); },
    pause() { if (!d.running) return; d.left = Math.max(0, d.endAt - Date.now()); d.running = false; ctx.save(); onUpdate(); },
    reset() { d.running = false; d.left = d.duration; d.fired = false; ctx.save(); onUpdate(); },
    set(ms) { d.duration = clamp(Math.round(ms / 1000) * 1000, 1000, 24 * 3600e3); d.running = false; d.left = d.duration; d.fired = false; ctx.save(); onUpdate(); },
    add(ms) { if (d.running) { d.endAt = Math.max(Date.now() + 1000, d.endAt + ms); } else { d.left = clamp(d.left + ms, 1000, 24 * 3600e3); if (d.left > d.duration) d.duration = d.left; } d.fired = false; ctx.save(); onUpdate(); },
    tick(now) {
      if (d.running && now >= d.endAt) {
        d.running = false; d.left = 0;
        if (!d.fired) { d.fired = true; playSound(d.sound); ctx.frame.classList.add('ring'); setTimeout(() => ctx.frame.classList.remove('ring'), 3000); }
        ctx.save(); onUpdate();
      }
    }
  };
  return api;
}
export function fmtMs(ms) {
  const s = Math.ceil(ms / 1000), hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  return hh ? hh + ':' + pad(m) + ':' + pad(ss) : pad(m) + ':' + pad(ss);
}
const PRESETS = [1, 2, 3, 5, 10, 15];

function durationEditor(ctx, eng, after) {
  const d = ctx.data;
  const total = Math.round(d.duration / 1000);
  const mi = h('input.input.num', { type: 'number', min: 0, max: 600, value: Math.floor(total / 60), 'aria-label': 'Minutes' });
  const si = h('input.input.num', { type: 'number', min: 0, max: 59, value: total % 60, 'aria-label': 'Seconds' });
  const apply = () => { const ms = ((+mi.value || 0) * 60 + clamp(+si.value || 0, 0, 59)) * 1000; if (ms >= 1000) { eng.set(ms); after && after(); } };
  mi.addEventListener('change', apply); si.addEventListener('change', apply);
  const pre = h('div.chips');
  PRESETS.forEach(m => pre.append(h('button.chip', { type: 'button', text: m + ' min', onclick: () => { mi.value = m; si.value = 0; apply(); } })));
  return section('Time', h('div.row.dur', null, mi, h('span.unit', { text: 'min' }), si, h('span.unit', { text: 'sec' })), pre);
}
function soundEditor(d, ctx) {
  const snd = h('select.input', { 'aria-label': 'Sound' }, SOUNDS.map(([k, l]) => h('option', { value: k, text: l, selected: k === d.sound })));
  snd.addEventListener('change', () => { d.sound = snd.value; ctx.save(); playSound(d.sound); });
  return section('Sound when time is up', h('div.row', null, snd, h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Play sound', html: ico.volume, onclick: () => playSound(d.sound) })));
}

export const timer = {
  type: 'timer', label: 'Timer', icon: 'stopwatch', transient: ['running', 'endAt', 'left', 'fired'],
  size: { w: 380, h: 260 }, min: { w: 200, h: 150 },
  defaults: () => ({ duration: 5 * 60e3, left: 5 * 60e3, running: false, endAt: 0, sound: 'xylophone', fired: false }),
  mount(ctx) {
    const d = ctx.data;
    const digits = h('div.tm-digits', { 'data-testid': 'timer-digits', role: 'timer' });
    const playBtn = h('button.tm-play', { type: 'button', 'data-act': 'start' });
    const resetBtn = h('button.tm-ctl', { type: 'button', 'data-act': 'reset', 'aria-label': 'Reset', html: ico.reset });
    const minus = h('button.tm-ctl', { type: 'button', 'aria-label': 'Minus one minute', title: '−1 min', html: ico.minus });
    const plus = h('button.tm-ctl', { type: 'button', 'aria-label': 'Plus one minute', title: '+1 min', html: ico.plus });
    const presets = h('div.tm-presets');
    PRESETS.slice(0, 5).forEach(m => presets.append(h('button.tm-pre', { type: 'button', text: m + 'm', 'data-preset': m, onclick: () => eng.set(m * 60e3) })));
    const root = h('div.tm', null, h('div.tm-face', null, digits), h('div.tm-ctrls', null, minus, resetBtn, playBtn, plus), presets);
    ctx.body.append(root);
    const eng = engine(ctx, update);
    playBtn.onclick = () => d.running ? eng.pause() : eng.start();
    resetBtn.onclick = () => eng.reset();
    minus.onclick = () => eng.add(-60e3); plus.onclick = () => eng.add(60e3);
    function update() {
      const now = Date.now(), r = eng.remaining(now);
      digits.textContent = fmtMs(r);
      root.classList.toggle('running', d.running); root.classList.toggle('up', !d.running && r <= 0);
      root.classList.toggle('long', r >= 3600e3);
      playBtn.innerHTML = d.running ? ico.pause : ico.play;
      playBtn.setAttribute('aria-label', d.running ? 'Pause' : 'Start');
      playBtn.dataset.act = d.running ? 'pause' : 'start';
    }
    update();
    return {
      tick(now) { eng.tick(now); if (d.running) update(); },
      settings: panel => { panel.append(durationEditor(ctx, eng), soundEditor(d, ctx)); }
    };
  }
};

const VCOLORS = [['#F25F5C', '#F25F5C', 'Red'], ['#5B5BD6', '#5B5BD6', 'Violet'], ['#2B7DE9', '#2B7DE9', 'Blue'], ['#2FA55A', '#2FA55A', 'Green'], ['#F2A541', '#F2A541', 'Orange'], ['#E2558E', '#E2558E', 'Pink']];

export const vtimer = {
  type: 'vtimer', label: 'Visual timer', icon: 'hourglass', transient: ['running', 'endAt', 'left', 'fired'],
  size: { w: 330, h: 380 }, min: { w: 180, h: 200 },
  defaults: () => ({ duration: 5 * 60e3, left: 5 * 60e3, running: false, endAt: 0, sound: 'chime', fired: false, color: '#F25F5C', showDigits: true, scale: 'auto' }),
  mount(ctx) {
    const d = ctx.data;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-110 -110 220 220'); svg.classList.add('vt-svg');
    const face = document.createElementNS(NS, 'circle'); face.setAttribute('r', 100); face.setAttribute('class', 'vt-face');
    const wedge = document.createElementNS(NS, 'path'); wedge.setAttribute('class', 'vt-wedge');
    const ticks = document.createElementNS(NS, 'g'); ticks.setAttribute('class', 'vt-ticks');
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = i % 5 ? 95 : 90; const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', Math.sin(a) * r1); l.setAttribute('y1', -Math.cos(a) * r1); l.setAttribute('x2', Math.sin(a) * 99); l.setAttribute('y2', -Math.cos(a) * 99); if (!(i % 5)) l.setAttribute('class', 'maj'); ticks.append(l); }
    const hub = document.createElementNS(NS, 'circle'); hub.setAttribute('r', 9); hub.setAttribute('class', 'vt-hub');
    svg.append(face, wedge, ticks, hub);
    const digits = h('div.vt-digits', { 'data-testid': 'vtimer-digits' });
    const playBtn = h('button.tm-play.sm', { type: 'button', 'data-act': 'start' });
    const resetBtn = h('button.tm-ctl.sm', { type: 'button', 'aria-label': 'Reset', 'data-act': 'reset', html: ico.reset });
    const root = h('div.vt', null, h('div.vt-dial', null, svg), h('div.vt-bottom', null, digits, h('div.vt-ctrls', null, resetBtn, playBtn)));
    ctx.body.append(root);
    const eng = engine(ctx, update);
    playBtn.onclick = () => d.running ? eng.pause() : eng.start();
    resetBtn.onclick = () => eng.reset();
    function update() {
      const r = eng.remaining(Date.now());
      // dial scale: the full disc represents 60 min (like a Time Timer) unless the duration is shorter
      const full = d.duration <= 5 * 60e3 ? 5 * 60e3 : d.duration <= 15 * 60e3 ? 15 * 60e3 : d.duration <= 30 * 60e3 ? 30 * 60e3 : 60 * 60e3;
      const frac = clamp(r / full, 0, 0.99999);
      const a = frac * Math.PI * 2;
      // counter-clockwise remaining wedge from 12 o'clock
      const x = -Math.sin(a) * 100, y = -Math.cos(a) * 100;
      wedge.setAttribute('d', frac <= 0 ? '' : `M0 0 L0 -100 A100 100 0 ${frac > 0.5 ? 1 : 0} 0 ${x.toFixed(3)} ${y.toFixed(3)} Z`);
      wedge.style.fill = d.color;
      digits.textContent = fmtMs(r);
      digits.style.display = d.showDigits ? '' : 'none';
      root.classList.toggle('running', d.running); root.classList.toggle('up', !d.running && r <= 0);
      playBtn.innerHTML = d.running ? ico.pause : ico.play; playBtn.setAttribute('aria-label', d.running ? 'Pause' : 'Start'); playBtn.dataset.act = d.running ? 'pause' : 'start';
    }
    update();
    return {
      tick(now) { eng.tick(now); if (d.running) update(); },
      settings: panel => {
        panel.append(durationEditor(ctx, eng),
          section('Color', swatches(VCOLORS, d.color, v => { d.color = v; ctx.save(); update(); })),
          section('Display', toggle('Show numbers', d.showDigits, v => { d.showDigits = v; ctx.save(); update(); })),
          soundEditor(d, ctx));
      }
    };
  }
};
