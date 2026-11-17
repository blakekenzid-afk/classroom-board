// Circle-time calendar: big month, "Today is / Yesterday was / Tomorrow will be",
// days-of-school counter (skips weekends and days marked off), tap-to-pick
// weather and the season. Uses the device's own date (Indiana time in class).
import { h, $, $$, pic, icon, ico, toggle, section, field } from '../util.js?v=3';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_C = ['#E2483D', '#F08A24', '#C98F00', '#2FA55A', '#2B7DE9', '#8E5BD6', '#E2558E'];
export const WEATHER = [['sunny', 'Sunny', 'sun'], ['partly', 'Partly cloudy', 'sun-cloud'], ['cloudy', 'Cloudy', 'cloud'], ['rainy', 'Rainy', 'rain'], ['snowy', 'Snowy', 'snow-cloud'], ['windy', 'Windy', 'windy']];
const SEASONS = { spring: ['Spring', 'tulip'], summer: ['Summer', 'sun'], fall: ['Fall', 'leaf'], winter: ['Winter', 'snowman'] };

const pad2 = n => String(n).padStart(2, '0');
export const ymd = t => t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
export const parseYmd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (t, n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
export function seasonOf(t) {
  const md = (t.getMonth() + 1) * 100 + t.getDate();
  return md >= 1221 || md < 320 ? 'winter' : md < 621 ? 'spring' : md < 922 ? 'summer' : 'fall';
}
/** School days from start through today (inclusive), skipping weekends (unless counted) and days off. */
export function schoolDays(startYmd, today, off = [], weekends = false) {
  const s = parseYmd(startYmd); if (!s) return null;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (s > end) return 0;
  const offs = new Set(off); let n = 0;
  for (let t = s; t <= end; t = addDays(t, 1)) {
    const wd = t.getDay();
    if (!weekends && (wd === 0 || wd === 6)) continue;
    if (offs.has(ymd(t))) continue;
    n++;
  }
  return n;
}

export const calendar = {
  type: 'calendar', label: 'Calendar', icon: 'calendar-day',
  size: { w: 860, h: 560 }, min: { w: 400, h: 340 },
  defaults: () => ({ sentences: true, showWeather: true, counter: true, season: true, start: '', off: [], weekends: false, goal: true, weather: null }),
  mount(ctx) {
    const d = ctx.data; d.off = d.off || [];
    const root = h('div.cal', { 'data-testid': 'calendar' }); ctx.body.append(root);
    let view = null, shown = '';

    function cellsFor(y, m, today, opts = {}) {
      const first = new Date(y, m, 1), startWd = first.getDay(), days = new Date(y, m + 1, 0).getDate();
      const out = [];
      for (let i = 0; i < startWd; i++) out.push(null);
      for (let n = 1; n <= days; n++) out.push(new Date(y, m, n));
      while (out.length % 7) out.push(null);
      return out;
    }
    function build(now) {
      const today = new Date(now); shown = ymd(today);
      if (!view) view = { y: today.getFullYear(), m: today.getMonth() };
      const wd = today.getDay(), yd = addDays(today, -1).getDay(), td = addDays(today, 1).getDay();
      root.innerHTML = '';
      // ── left/top: today ──
      const info = h('div.cal-info');
      info.append(h('div.cal-head', null,
        h('div.cal-dow', { text: DAYS[wd], style: { '--dc': DAY_C[wd] }, 'data-testid': 'cal-dow' }),
        h('div.cal-date', { text: MONTHS[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear(), 'data-testid': 'cal-date' })));
      if (d.sentences) {
        const line = (pre, i, extra) => h('div.cal-s' + (extra || ''), null, h('span', { text: pre + ' ' }), h('b', { text: DAYS[i], style: { '--dc': DAY_C[i] } }), h('span', { text: '.' }));
        info.append(h('div.cal-sent', { 'data-testid': 'cal-sentences' }, line('Today is', wd, '.now'), line('Yesterday was', yd), line('Tomorrow will be', td)));
      }
      const cards = h('div.cal-cards');
      if (d.showWeather) {
        const cur = d.weather && d.weather.date === shown ? d.weather.w : '';
        const wx = WEATHER.find(w => w[0] === cur);
        const row = h('div.cal-wx', { role: 'radiogroup', 'aria-label': 'Weather' });
        WEATHER.forEach(([k, l, ic]) => {
          const b = h('button.cal-wb' + (k === cur ? '.on' : ''), { type: 'button', title: l, 'aria-label': l, 'aria-pressed': String(k === cur), 'data-weather': k }, pic(ic));
          b.onclick = () => { if (ctx.frame.dataset.justDragged) return; d.weather = k === cur ? null : { date: shown, w: k }; ctx.save(); build(Date.now()); };
          row.append(b);
        });
        cards.append(h('div.cal-card.cal-wcard', null, h('div.cal-ct', { text: wx ? 'Today it is ' + wx[1].toLowerCase() + '!' : 'What is the weather?' }), row));
      }
      if (d.counter) {
        const n = schoolDays(d.start, today, d.off, d.weekends);
        const card = h('div.cal-card.cal-count', { 'data-testid': 'cal-counter' });
        if (n == null) card.append(h('button.cal-setstart', { type: 'button', 'data-act': 'cal-setup', onclick: () => ctx.openSettings() }, h('b', { text: 'Days of school' }), h('small', { text: 'Tap to set the first day' })));
        else {
          card.append(h('div.cal-num', { text: String(n), 'data-days': n }), h('div.cal-cl', null, h('b', { text: n === 1 ? 'day of school' : 'days of school' }),
            d.goal && n < 100 ? h('small', { text: (100 - n) + ' more to the 100th day!' }) : d.goal && n === 100 ? h('small', { text: 'Happy 100th day! 🎉' }) : null));
        }
        cards.append(card);
      }
      if (d.season) {
        const [sl, si] = SEASONS[seasonOf(today)];
        cards.append(h('div.cal-card.cal-season', { 'data-testid': 'cal-season' }, h('div.cal-spic', null, pic(si)), h('div.cal-cl', null, h('small', { text: 'Season' }), h('b', { text: sl }))));
      }
      if (cards.children.length) info.append(cards);
      // ── month ──
      const isCur = view.y === today.getFullYear() && view.m === today.getMonth();
      const month = h('div.cal-month');
      const prev = h('button.cal-nav', { type: 'button', 'aria-label': 'Previous month', 'data-act': 'cal-prev', html: ico.chevron });
      const next = h('button.cal-nav.nx', { type: 'button', 'aria-label': 'Next month', 'data-act': 'cal-next', html: ico.chevron });
      prev.onclick = () => { view.m--; if (view.m < 0) { view.m = 11; view.y--; } build(Date.now()); };
      next.onclick = () => { view.m++; if (view.m > 11) { view.m = 0; view.y++; } build(Date.now()); };
      month.append(h('div.cal-mhead', null, prev, h('div.cal-mname', { text: MONTHS[view.m] + ' ' + view.y }), next,
        isCur ? null : h('button.chip.cal-back', { type: 'button', text: 'Today', 'data-act': 'cal-today', onclick: () => { view = null; build(Date.now()); } })));
      const grid = h('div.cal-grid', { 'data-testid': 'cal-grid' });
      DAYS.forEach((n, i) => grid.append(h('div.cal-wd' + (i === 0 || i === 6 ? '.we' : ''), null, h('span.l', { text: n.slice(0, 3) }), h('span.s', { text: n[0] }))));
      const cells = cellsFor(view.y, view.m, today);
      grid.style.setProperty('--rows', cells.length / 7);
      cells.forEach(t => {
        if (!t) { grid.append(h('div.cal-c.empty')); return; }
        const k = ymd(t), cls = ['cal-c'];
        if (t.getDay() === 0 || t.getDay() === 6) cls.push('we');
        if (d.off.includes(k)) cls.push('off');
        if (k === shown) cls.push('today'); else if (k < shown) cls.push('past');
        grid.append(h('div.' + cls.join('.'), { 'data-day': k, title: d.off.includes(k) ? 'No school' : '' }, h('span', { text: String(t.getDate()) })));
      });
      month.append(grid);
      root.append(month, info);
      layout();
    }
    // Pick side-by-side or stacked, then shrink the type until everything fits.
    function layout() {
      const r = ctx.body.getBoundingClientRect(); if (!r.width || !r.height) return;
      root.classList.toggle('wide', r.width > r.height * 1.2);
      let k = 1; root.style.setProperty('--k', k);
      const info = $('.cal-info', root), grid = $('.cal-grid', root);
      const rows = +(grid && grid.style.getPropertyValue('--rows')) || 5;
      root.classList.toggle('narrow', grid && grid.getBoundingClientRect().width < 7 * 62);
      const over = () => (info && info.scrollHeight > info.clientHeight + 1) || root.scrollHeight > root.clientHeight + 1 ||
        (grid && grid.getBoundingClientRect().height < rows * 30 + 18) || (info && info.scrollWidth > info.clientWidth + 1);
      while (over() && k > 0.56) { k = Math.round((k - 0.06) * 100) / 100; root.style.setProperty('--k', k); }
    }
    build(Date.now());

    // settings: mini calendar to mark no-school days
    function offPicker() {
      const wrap = h('div.cal-off'); let v = null;
      const draw = () => {
        const today = new Date(); if (!v) v = { y: today.getFullYear(), m: today.getMonth() };
        wrap.innerHTML = '';
        const head = h('div.cal-offh', null,
          h('button.icon-btn.sm.cal-l', { type: 'button', 'aria-label': 'Previous month', html: ico.chevron, onclick: () => { v.m--; if (v.m < 0) { v.m = 11; v.y--; } draw(); } }),
          h('b', { text: MONTHS[v.m] + ' ' + v.y }),
          h('button.icon-btn.sm.cal-r', { type: 'button', 'aria-label': 'Next month', html: ico.chevron, onclick: () => { v.m++; if (v.m > 11) { v.m = 0; v.y++; } draw(); } }));
        const g = h('div.cal-offg');
        DAYS.forEach(n => g.append(h('span.cal-offw', { text: n[0] })));
        cellsFor(v.y, v.m, today).forEach(t => {
          if (!t) { g.append(h('span')); return; }
          const k = ymd(t), we = !d.weekends && (t.getDay() === 0 || t.getDay() === 6);
          const b = h('button.cal-offd' + (d.off.includes(k) ? '.on' : '') + (we ? '.we' : ''), { type: 'button', text: String(t.getDate()), disabled: we, 'data-off': k, 'aria-pressed': String(d.off.includes(k)) });
          b.onclick = () => { d.off = d.off.includes(k) ? d.off.filter(x => x !== k) : [...d.off, k].sort(); ctx.save(); build(Date.now()); draw(); };
          g.append(b);
        });
        wrap.append(head, g, h('small.hint', { text: d.off.length ? d.off.length + ' day' + (d.off.length === 1 ? '' : 's') + ' marked off. Tap a day again to undo.' : 'Tap holidays and snow days so they are not counted.' }));
      };
      draw(); return wrap;
    }
    return {
      tick(now) { if (ymd(new Date(now)) !== shown) { view = null; build(now); } },
      resize: layout,
      settings: panel => {
        const start = h('input.input', { type: 'date', value: d.start || '', 'aria-label': 'First day of school', 'data-act': 'cal-start' });
        start.addEventListener('change', () => { d.start = start.value; ctx.save(); build(Date.now()); });
        panel.append(
          section('Show', toggle('Today / Yesterday / Tomorrow', d.sentences, v => { d.sentences = v; ctx.save(); build(Date.now()); }),
            toggle('Weather', d.showWeather, v => { d.showWeather = v; ctx.save(); build(Date.now()); }, 'Tap the weather pictures during circle time'),
            toggle('Days of school', d.counter, v => { d.counter = v; ctx.save(); build(Date.now()); }),
            toggle('Season', d.season, v => { d.season = v; ctx.save(); build(Date.now()); })),
          section('Days of school', field('First day of school', start),
            toggle('Count to the 100th day', d.goal, v => { d.goal = v; ctx.save(); build(Date.now()); }),
            toggle('Count weekends', d.weekends, v => { d.weekends = v; ctx.save(); build(Date.now()); ctx.refreshSettings(); })),
          section('No-school days', offPicker()));
      }
    };
  }
};
