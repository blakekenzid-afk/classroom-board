// Sound level meter, Name picker and Group maker (class list = INITIALS ONLY).
import { h, $, $$, icon, ico, segmented, swatches, toggle, section, field, clamp, toast } from '../util.js?v=6';
import * as S from '../store.js?v=6';
import { SOUNDS, playSound, audio } from '../audio.js?v=6';

// ───────── Sound level ─────────
export const sound = {
  type: 'sound', label: 'Sound level', icon: 'loudspeaker',
  size: { w: 420, h: 300 }, min: { w: 220, h: 170 },
  defaults: () => ({ threshold: 0.6, sensitivity: 1, style: 'balls', alert: 'gong' }),
  mount(ctx) {
    const d = ctx.data;
    const cv = h('canvas.sm-cv');
    const meter = h('div.sm-meter', null, h('i.sm-fill'), h('span.sm-th'));
    const startBtn = h('button.btn.primary.sm-start', { type: 'button', 'data-act': 'mic' }, icon('mic'), 'Start listening');
    const msg = h('div.sm-msg');
    const over = h('div.sm-over', null, h('img', { src: 'icons/shush.svg', alt: '' }), h('b', { text: 'Too loud!' }));
    const root = h('div.snd', null, h('div.sm-stage', null, cv, over, h('div.sm-idle', null, startBtn, msg)), meter);
    ctx.body.append(root);
    let stream = null, analyser = null, buf = null, raf = 0, level = 0, loudScore = 0, lastT = 0, alerting = false, lastAlert = -1e9;
    const balls = Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: 1, vy: 0, r: 0.035 + Math.random() * 0.03, c: ['#5B5BD6', '#2B7DE9', '#0FA3A3', '#2FA55A', '#F2A541', '#E2558E', '#F25F5C'][i % 7] }));

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'This browser can’t use the microphone.'; return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const c = audio(); const src = c.createMediaStreamSource(stream);
        analyser = c.createAnalyser(); analyser.fftSize = 1024; buf = new Float32Array(analyser.fftSize);
        src.connect(analyser);
        root.classList.add('on'); msg.textContent = '';
        loop();
      } catch (e) { msg.textContent = 'Microphone is blocked. Allow it in the browser’s address bar, then try again.'; }
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; loudScore = 0; alerting = false; level = 0; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; analyser = null; root.classList.remove('on', 'loud'); }
    startBtn.onclick = start;
    const stopBtn = h('button.sm-stop', { type: 'button', title: 'Stop listening', 'aria-label': 'Stop listening', 'data-act': 'mic-stop', html: ico.pause, onclick: stop });
    root.append(stopBtn);

    function loop() {
      raf = requestAnimationFrame(loop);
      if (!analyser) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const db = 20 * Math.log10(rms + 1e-8);               // ~ -70 (quiet) … 0 (very loud)
      const target = clamp((db + 62) / 52 * d.sensitivity, 0, 1);
      level += (target - level) * (target > level ? 0.35 : 0.035);
      draw();
    }
    function draw() {
      $('.sm-fill', meter).style.width = (level * 100) + '%';
      $('.sm-th', meter).style.left = (d.threshold * 100) + '%';
      const loud = level >= d.threshold;
      const now = performance.now(), dt = Math.min(100, now - (lastT || now)); lastT = now;
      // "too loud" score: builds while loud, drains half as fast when quiet, so short gaps don't reset it
      loudScore = Math.max(0, Math.min(1500, loudScore + (loud ? dt : -dt * 0.5)));
      if (loudScore > 700) alerting = true; else if (loudScore < 200) alerting = false;
      root.classList.toggle('loud', !!alerting);
      if (alerting && now - lastAlert > 4000) { lastAlert = now; playSound(d.alert); }
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
      if (d.style === 'balls') {
        const m = Math.min(W, H);
        balls.forEach(b => {
          b.vy += 0.0016; b.y += b.vy;
          const floor = 1 - b.r * m / H;
          if (b.y > floor) { b.y = floor; b.vy = -(0.004 + level * 0.06 * (0.6 + Math.random() * 0.8)); }
          const R = b.r * m; g.beginPath(); g.fillStyle = b.c; g.arc(b.x * (W - 2 * R) + R, b.y * H, R, 0, Math.PI * 2); g.fill();
        });
      } else {
        const n = 24, gap = W * 0.012, bw = (W - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++) {
          const f = (i + 1) / n; const on = f <= level + 0.001;
          g.fillStyle = on ? (f > d.threshold ? '#F25F5C' : f > d.threshold * 0.75 ? '#F2A541' : '#2FA55A') : 'rgba(35,35,63,.07)';
          const bh = H * (0.25 + 0.7 * f);
          roundRect(g, gap + i * (bw + gap), H - bh, bw, bh, Math.min(bw / 2, 10 * dpr)); g.fill();
        }
      }
    }
    return {
      destroy: stop,
      settings: panel => {
        const th = h('input.range', { type: 'range', min: 0.15, max: 0.95, step: 0.01, value: d.threshold, 'aria-label': 'Too loud level' });
        th.addEventListener('input', () => { d.threshold = +th.value; ctx.save(); if (!analyser) draw(); });
        const se = h('input.range', { type: 'range', min: 0.5, max: 2, step: 0.05, value: d.sensitivity, 'aria-label': 'Sensitivity' });
        se.addEventListener('input', () => { d.sensitivity = +se.value; ctx.save(); });
        const snd = h('select.input', { 'aria-label': 'Alert sound' }, SOUNDS.map(([k, l]) => h('option', { value: k, text: l, selected: k === d.alert })));
        snd.addEventListener('change', () => { d.alert = snd.value; ctx.save(); playSound(d.alert); });
        panel.append(section(null, segmented([['balls', 'Bouncing balls'], ['bars', 'Bars']], d.style, v => { d.style = v; ctx.save(); if (!analyser) draw(); }, 'big')),
          section('“Too loud” level', th, h('small.hint', { text: 'Move left to be stricter. The widget turns red past this line.' })),
          section('Microphone sensitivity', se),
          section('Alert sound', snd),
          h('p.hint.box', { text: 'Sound is only measured here on this device; nothing is recorded or sent anywhere.' }));
      },
      resize() { if (!analyser) draw(); }
    };
    function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  }
};

// ───────── class list editor (shared) ─────────
function classListEditor(onChange) {
  const st = S.getState();
  const ta = h('textarea.input.cl-ta', { rows: 6, placeholder: 'A.B.\nC.D.\nE.F.', 'aria-label': 'Class list (initials only)', spellcheck: 'false' });
  ta.value = st.classList.join('\n');
  const count = h('small.hint');
  const upd = () => { const l = S.sanitizeInitials(ta.value); count.textContent = l.length + ' student' + (l.length === 1 ? '' : 's') + ' · initials only, one per line (letters, max 5)'; };
  ta.addEventListener('input', upd);
  ta.addEventListener('change', () => { const l = S.sanitizeInitials(ta.value); ta.value = l.join('\n'); S.setClassList(l); upd(); onChange(); });
  upd();
  return section('Class list', ta, count, h('p.hint.box', { text: 'For privacy, use initials only (like “J.M.”) – never full names. This list is shared by Name picker and Groups.' }));
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const CHIP_COLORS = ['#5B5BD6', '#2B7DE9', '#0FA3A3', '#2FA55A', '#F08A24', '#E2558E', '#E2483D', '#8E5BD6'];

// ───────── Name picker ─────────
export const picker = {
  type: 'picker', label: 'Name picker', icon: 'magic-wand', transient: ['current', 'used'],
  size: { w: 360, h: 300 }, min: { w: 190, h: 170 },
  defaults: () => ({ current: '', used: [], noRepeat: true, sound: true }),
  mount(ctx) {
    const d = ctx.data;
    const big = h('div.np-name', { 'data-testid': 'picked' });
    const sub = h('div.np-sub');
    const go = h('button.btn.primary.np-go', { type: 'button', 'data-act': 'pick' }, icon('shuffle'), 'Pick');
    const root = h('div.np', null, h('div.np-card', null, big), sub, go);
    ctx.body.append(root);
    let spinning = false;
    function list() { return S.getState().classList; }
    function show() {
      const l = list();
      if (!l.length) { big.textContent = ''; root.classList.add('empty'); sub.innerHTML = ''; sub.append(h('button.link', { type: 'button', text: 'Add your class (initials) in settings', onclick: ctx.openSettings })); go.disabled = true; return; }
      root.classList.remove('empty'); go.disabled = false;
      big.textContent = d.current || '?';
      const left = l.filter(x => !d.used.includes(x)).length;
      sub.textContent = d.noRepeat ? (left ? left + ' of ' + l.length + ' left' : 'Everyone had a turn!') : l.length + ' students';
    }
    go.onclick = () => {
      if (spinning) return; const l = list(); if (!l.length) return;
      let pool = d.noRepeat ? l.filter(x => !d.used.includes(x)) : l;
      if (!pool.length) { d.used = []; pool = l; }
      const winner = pool[Math.floor(Math.random() * pool.length)];
      spinning = true; root.classList.add('spin'); let n = 0; const steps = 14;
      const step = () => {
        big.textContent = l[Math.floor(Math.random() * l.length)];
        big.style.setProperty('--npc', CHIP_COLORS[n % CHIP_COLORS.length]);
        if (++n < steps) setTimeout(step, 40 + n * 9);
        else {
          d.current = winner; if (d.noRepeat) d.used.push(winner); ctx.save(); spinning = false;
          root.classList.remove('spin'); root.classList.add('won'); setTimeout(() => root.classList.remove('won'), 700);
          if (d.sound) playSound('chime'); show();
        }
      };
      step();
    };
    show();
    return {
      onClassList: () => { d.used = d.used.filter(x => list().includes(x)); show(); },
      settings: panel => {
        panel.append(classListEditor(() => { d.used = d.used.filter(x => list().includes(x)); ctx.save(); show(); }),
          section('Options', toggle('Everyone gets a turn before repeats', d.noRepeat, v => { d.noRepeat = v; ctx.save(); show(); }), toggle('Chime on pick', d.sound, v => { d.sound = v; ctx.save(); })),
          section(null, h('button.btn.ghost', { type: 'button', text: 'Start over', onclick: () => { d.used = []; d.current = ''; ctx.save(); show(); } })));
      }
    };
  }
};

// ───────── Group maker ─────────
export const groups = {
  type: 'groups', label: 'Groups', icon: 'group',
  size: { w: 520, h: 360 }, min: { w: 240, h: 180 },
  defaults: () => ({ by: 'count', n: 4, groups: [] }),
  mount(ctx) {
    const d = ctx.data;
    const grid = h('div.gm-grid');
    const go = h('button.btn.primary.sm', { type: 'button', 'data-act': 'make-groups' }, icon('shuffle'), 'Make groups');
    const label = h('span.gm-lbl');
    const root = h('div.gm', null, h('div.gm-top', null, label, go), grid);
    ctx.body.append(root);
    function make() {
      const l = S.getState().classList; if (!l.length) return;
      const s = shuffle(l);
      const k = d.by === 'count' ? clamp(d.n, 1, l.length) : Math.max(1, Math.ceil(l.length / clamp(d.n, 1, l.length)));
      const out = Array.from({ length: k }, () => []);
      s.forEach((x, i) => out[i % k].push(x));
      d.groups = out; ctx.save(); draw(true);
    }
    function draw(anim) {
      const l = S.getState().classList;
      label.textContent = d.by === 'count' ? d.n + ' groups' : 'Groups of ' + d.n;
      grid.innerHTML = '';
      if (!l.length) { grid.append(h('div.gm-empty', null, h('img', { src: 'icons/group.svg', alt: '' }), h('button.link', { type: 'button', text: 'Add your class (initials) in settings', onclick: ctx.openSettings }))); go.disabled = true; return; }
      go.disabled = false;
      if (!d.groups.length) { grid.append(h('div.gm-empty', null, h('img', { src: 'icons/group.svg', alt: '' }), h('span', { text: 'Tap “Make groups” to mix the class.' }))); return; }
      d.groups.forEach((g, i) => grid.append(h('div.gm-card' + (anim ? '.pop' : ''), { style: { '--gc': CHIP_COLORS[i % CHIP_COLORS.length], animationDelay: (i * 60) + 'ms' } },
        h('div.gm-h', { text: 'Group ' + (i + 1) }), h('div.gm-names', null, g.map(x => h('span.gm-n', { text: x }))))));
    }
    go.onclick = make;
    draw();
    return {
      onClassList: () => { d.groups = []; ctx.save(); draw(); },
      settings: panel => {
        const n = h('input.input.num', { type: 'number', min: 1, max: 30, value: d.n, 'aria-label': 'Number' });
        n.addEventListener('change', () => { d.n = clamp(+n.value || 1, 1, 30); n.value = d.n; ctx.save(); draw(); });
        panel.append(classListEditor(() => { d.groups = []; ctx.save(); draw(); }),
          section('Make', segmented([['count', 'Number of groups'], ['size', 'Students per group']], d.by, v => { d.by = v; ctx.save(); draw(); }), h('div.row', null, n)));
      }
    };
  }
};
