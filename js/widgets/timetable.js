// ⭐ Timetable / Schedule — Timed schedule, List, Checklist.
import { h, $, $$, pic, icon, ico, fmtTime, minsOf, hhmmOf, segmented, toggle, swatches, field, section, makeSortable, clamp } from '../util.js?v=4';
import { uid } from '../store.js?v=4';
import { pickPicture } from '../picker.js?v=4';
import { SOUNDS, playSound } from '../audio.js?v=4';

export const THEMES = [
  ['violet', '#5B5BD6', 'Violet', '#EEEEFD'], ['blue', '#2B7DE9', 'Blue', '#E6F0FD'], ['teal', '#0FA3A3', 'Teal', '#DFF5F5'],
  ['green', '#2FA55A', 'Green', '#E3F5E9'], ['orange', '#F08A24', 'Orange', '#FEF0E1'], ['pink', '#E2558E', 'Pink', '#FCE8F0'],
  ['red', '#E2483D', 'Red', '#FCE7E5'], ['ink', '#2D3047', 'Ink', '#ECECF2']
];
export function themeVars(key) { const t = THEMES.find(x => x[0] === key) || THEMES[0]; return { '--tc': t[1], '--tc-soft': t[3] }; }

const nowMins = now => { const d = new Date(now); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000; };

export const timetable = {
  type: 'timetable', label: 'Timetable', icon: 'calendar',
  size: { w: 440, h: 560 }, min: { w: 220, h: 200 },
  defaults: () => ({
    mode: 'timed', title: "Today's schedule", showTitle: true, theme: 'violet', focus: false, sound: 'chime', h24: false, showBreaks: true,
    items: [
      { id: uid('i'), icon: 'wave', title: 'Arrival', start: '08:00', end: '08:20' },
      { id: uid('i'), icon: 'group', title: 'Circle time', start: '08:20', end: '08:45' },
      { id: uid('i'), icon: 'blocks', title: 'Centers', start: '08:45', end: '09:30' }
    ]
  }),
  mount(ctx) {
    const d = ctx.data;
    let lastNow = nowMins(Date.now()), curId = null, userScrollAt = 0, lastAlarmKey = '';
    const root = h('div.tt');
    ctx.body.append(root);
    let rows = new Map();

    function itemsShown() { return d.items.filter(i => d.mode === 'timed' ? (d.showBreaks || !i.brk) : !i.brk); }

    function render() {
      const tv = themeVars(d.theme); for (const k in tv) root.style.setProperty(k, tv[k]);
      root.className = 'tt mode-' + d.mode + (d.focus && d.mode === 'timed' ? ' focus' : '');
      root.innerHTML = ''; rows.clear(); curId = null;
      if (d.showTitle && d.title) root.append(h('div.tt-title', { text: d.title }));
      if (d.mode === 'timed' && d.focus) { root.append(h('div.tt-focus')); paintFocus(Date.now()); return; }
      const list = h('div.tt-list');
      list.addEventListener('wheel', () => userScrollAt = Date.now(), { passive: true });
      list.addEventListener('touchmove', () => userScrollAt = Date.now(), { passive: true });
      const items = itemsShown();
      if (!items.length) list.append(h('div.tt-empty', null, h('p', { text: 'No activities yet.' }), h('button.btn.primary.sm', { text: 'Add activities', onclick: ctx.openSettings })));
      items.forEach(it => {
        let row;
        if (d.mode === 'timed') {
          if (it.brk) {
            row = h('div.tt-row.brk', { 'data-iid': it.id },
              h('div.brk-line', null, h('span.brk-tag', null, it.icon ? pic(it.icon, 'brk-pic') : null, h('span', { text: (it.title || 'Break') })), h('span.brk-time', { text: fmtTime(it.start, d.h24) + ' – ' + fmtTime(it.end, d.h24) })),
              h('div.bar.thin', null, h('i')));
          } else {
            row = h('div.tt-row', { 'data-iid': it.id },
              h('div.tt-pic', null, pic(it.icon)),
              h('div.tt-main', null,
                h('div.tt-name', null, h('span.tt-t', { text: it.title || 'Untitled' }), h('span.left-pill')),
                h('div.tt-time', null, h('span.t0', { text: fmtTime(it.start, d.h24) }), h('div.bar', null, h('i')), h('span.t1', { text: fmtTime(it.end, d.h24) }))),
              h('span.tt-check', { html: ico.check }));
          }
        } else if (d.mode === 'list') {
          row = h('div.tt-row', { 'data-iid': it.id }, h('div.tt-pic', null, pic(it.icon)), h('div.tt-main', null, h('div.tt-name', null, h('span.tt-t', { text: it.title || 'Untitled' }))));
        } else {
          row = h('button.tt-row.chk' + (it.done ? '.done' : ''), { type: 'button', 'data-iid': it.id, 'aria-pressed': String(!!it.done) },
            h('div.tt-pic', null, pic(it.icon)), h('div.tt-main', null, h('div.tt-name', null, h('span.tt-t', { text: it.title || 'Untitled' }))),
            h('span.tt-box', { html: ico.check }));
          row.addEventListener('click', () => {
            if (ctx.frame.dataset.justDragged) return;
            it.done = !it.done; row.classList.toggle('done', it.done); row.setAttribute('aria-pressed', String(it.done));
            if (it.done) { row.classList.add('pop'); setTimeout(() => row.classList.remove('pop'), 350); }
            ctx.save();
          });
        }
        rows.set(it.id, row); list.append(row);
      });
      root.append(list);
      if (d.mode === 'timed') paint(Date.now(), true);
    }

    function status(it, nm) {
      const s = minsOf(it.start), e0 = minsOf(it.end);
      if (s == null) return { st: 'none', pct: 0 };
      const e = (e0 == null || e0 <= s) ? s + 1 : e0;
      if (nm >= e) return { st: 'done', pct: 1, s, e };
      if (nm >= s) return { st: 'now', pct: (nm - s) / (e - s), s, e };
      return { st: 'next', pct: 0, s, e };
    }
    function leftText(mins) { const m = Math.ceil(mins); if (m >= 60) { const hh = Math.floor(m / 60), mm = m % 60; return hh + ' h ' + (mm ? mm + ' min ' : '') + 'left'; } return m + ' min left'; }

    function paint(now, force) {
      const nm = nowMins(now);
      let current = null;
      itemsShown().forEach(it => {
        const row = rows.get(it.id); if (!row) return;
        const s = status(it, nm);
        row.classList.toggle('done', s.st === 'done');
        row.classList.toggle('now', s.st === 'now');
        row.classList.toggle('next', s.st === 'next');
        const bar = $('.bar i', row); if (bar) bar.style.width = (s.pct * 100).toFixed(2) + '%';
        const lp = $('.left-pill', row); if (lp) lp.textContent = s.st === 'now' ? leftText(s.e - nm) : '';
        if (s.st === 'now' && !current) current = it;
      });
      const newCur = current ? current.id : null;
      if (newCur !== curId || force) {
        curId = newCur;
        const row = curId && rows.get(curId);
        if (row && Date.now() - userScrollAt > 6000) {
          const list = row.parentElement, prev = row.previousElementSibling;
          const anchor = prev && list.clientHeight > row.offsetHeight * 2.4 ? prev : row;
          const target = anchor.offsetTop - list.offsetTop - 2;
          list.scrollTo({ top: Math.max(0, target), behavior: force ? 'auto' : 'smooth' });
        }
      }
    }

    function paintFocus(now) {
      const box = $('.tt-focus', root); if (!box) return;
      const nm = nowMins(now);
      const items = itemsShown();
      let cur = null, nxt = null, curS = null;
      for (const it of items) { const s = status(it, nm); if (s.st === 'now' && !cur) { cur = it; curS = s; } }
      for (const it of items) { const s = status(it, nm); if (s.st === 'next' && it !== cur) { nxt = it; break; } }
      const key = (cur ? cur.id : '-') + '|' + (nxt ? nxt.id : '-');
      if (box.dataset.key !== key) {
        box.dataset.key = key; box.innerHTML = '';
        if (cur) {
          box.append(h('div.f-now', null,
            h('span.f-label', { text: cur.brk ? 'Break' : 'Now' }),
            h('div.f-pic', null, pic(cur.icon)),
            h('div.f-title', { text: cur.title || 'Untitled' }),
            h('div.tt-time.f-time', null, h('span.t0', { text: fmtTime(cur.start, d.h24) }), h('div.bar', null, h('i')), h('span.t1', { text: fmtTime(cur.end, d.h24) })),
            h('div.f-left')));
        } else if (nxt) {
          box.append(h('div.f-now.waiting', null, h('span.f-label', { text: 'Coming up' }), h('div.f-pic', null, pic(nxt.icon)), h('div.f-title', { text: nxt.title }), h('div.f-left')));
        } else {
          box.append(h('div.f-now.alldone', null, h('div.f-pic', null, pic('party')), h('div.f-title', { text: items.length ? 'All done!' : 'No activities yet' })));
        }
        if (cur && nxt) box.append(h('div.f-next', null, h('span.f-label.sm', { text: 'Next' }), h('div.f-npic', null, pic(nxt.icon)), h('div.f-ntitle', { text: nxt.title }), h('span.f-ntime', { text: fmtTime(nxt.start, d.h24) })));
      }
      if (cur) { $('.bar i', box).style.width = (curS.pct * 100).toFixed(2) + '%'; $('.f-left', box).textContent = leftText(curS.e - nm); }
      else if (nxt) { const s = status(nxt, nm); $('.f-left', box).textContent = 'Starts at ' + fmtTime(nxt.start, d.h24) + ' · in ' + leftText(s.s - nm).replace(' left', ''); }
    }

    render();
    return {
      tick(now) {
        if (d.mode !== 'timed') return;
        const nm = nowMins(now);
        // End-of-activity alarm: fire once when the clock crosses an end time.
        if (nm > lastNow && nm - lastNow < 5) {
          const crossed = itemsShown().filter(it => { const s = status(it, nm); return s.e != null && lastNow < s.e && nm >= s.e; });
          if (crossed.length) { const k = crossed.map(c => c.id).join(); if (k !== lastAlarmKey) { lastAlarmKey = k; playSound(d.sound); ctx.frame.classList.add('ring'); setTimeout(() => ctx.frame.classList.remove('ring'), 2400); } }
        }
        lastNow = nm;
        if (d.focus) paintFocus(now); else paint(now);
      },
      settings: panel => settingsUI(panel, ctx, render),
      rerender: render
    };
  }
};

function settingsUI(panel, ctx, render) {
  const d = ctx.data;
  const commit = () => { ctx.save(); render(); };
  const draw = () => {
    panel.innerHTML = '';
    panel.append(section(null,
      segmented([['timed', 'Timed', 'alarm-clock'], ['list', 'List', 'memo'], ['check', 'Checklist', 'check']], d.mode, v => { d.mode = v; commit(); draw(); }, 'big')));
    const title = h('input.input', { value: d.title || '', placeholder: 'Title', maxlength: 60, 'aria-label': 'Title' });
    title.addEventListener('input', () => { d.title = title.value; commit(); });
    panel.append(section('Title', title, toggle('Show title', d.showTitle, v => { d.showTitle = v; commit(); })));

    // items
    const list = h('div.ed-list', { 'data-testid': 'tt-items' });
    d.items.forEach(it => {
      if (it.brk && d.mode !== 'timed') return;
      const picBtn = h('button.ed-pic', { type: 'button', title: 'Change picture', 'aria-label': 'Change picture' }, pic(it.icon));
      picBtn.onclick = async () => { const v = await pickPicture({ current: it.icon }); if (v !== undefined) { it.icon = v; commit(); draw(); } };
      const name = h('input.input.ed-name', { value: it.title || '', placeholder: it.brk ? 'Break' : 'Activity name', maxlength: 50, 'aria-label': 'Activity name' });
      name.addEventListener('input', () => { it.title = name.value; commit(); });
      const del = h('button.icon-btn.ed-del', { type: 'button', title: 'Delete', 'aria-label': 'Delete activity', html: ico.trash });
      del.onclick = () => { d.items = d.items.filter(x => x !== it); commit(); draw(); };
      const row = h('div.ed-row' + (it.brk ? '.brk' : ''), { 'data-sort': it.id },
        h('span.ed-grip', { title: 'Drag to reorder', html: ico.grip }), picBtn,
        h('div.ed-fields', null, name,
          d.mode === 'timed' ? h('div.ed-times', null,
            timeInput(it, 'start', commit), h('span.dash', { text: '–' }), timeInput(it, 'end', commit),
            it.brk ? h('span.tag', { text: 'Break' }) : null) : null),
        del);
      list.append(row);
    });
    makeSortable(list, '.ed-grip', ids => { d.items.sort((a, b) => { const ia = ids.indexOf(a.id), ib = ids.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); }); commit(); });
    const lastEnd = () => { const t = [...d.items].reverse().find(i => i.end); return t ? t.end : '08:00'; };
    const addAct = h('button.btn.primary', { type: 'button', 'data-act': 'add-item' }, icon('plus'), 'Add activity');
    addAct.onclick = () => { const s = lastEnd(); d.items.push({ id: uid('i'), icon: '', title: '', start: s, end: hhmmOf(minsOf(s) + 30) }); commit(); draw(); const ins = $$('.ed-name', panel); ins[ins.length - 1].focus(); };
    const addBrk = d.mode === 'timed' ? h('button.btn.ghost', { type: 'button', 'data-act': 'add-break' }, icon('plus'), 'Add break') : null;
    if (addBrk) addBrk.onclick = () => { const s = lastEnd(); d.items.push({ id: uid('i'), icon: 'juice', title: 'Break', start: s, end: hhmmOf(minsOf(s) + 5), brk: true }); commit(); draw(); };
    panel.append(section(d.mode === 'timed' ? 'Activities & times' : 'Items', list, h('div.row.wrap', null, addAct, addBrk)));
    if (d.mode === 'timed') {
      const sortBtn = h('button.btn.ghost.sm', { type: 'button', text: 'Sort by start time' });
      sortBtn.onclick = () => { d.items.sort((a, b) => (minsOf(a.start) ?? 0) - (minsOf(b.start) ?? 0)); commit(); draw(); };
      list.after(h('div.row.end', null, sortBtn));
    }
    if (d.mode === 'check') {
      const rs = h('button.btn.ghost.sm', { type: 'button', text: 'Uncheck all' });
      rs.onclick = () => { d.items.forEach(i => i.done = false); commit(); };
      list.after(h('div.row.end', null, rs));
    }

    if (d.mode === 'timed') {
      const snd = h('select.input', { 'aria-label': 'End of activity sound' }, SOUNDS.map(([k, l]) => h('option', { value: k, text: l, selected: k === d.sound })));
      snd.addEventListener('change', () => { d.sound = snd.value; ctx.save(); playSound(d.sound); });
      const prev = h('button.icon-btn.soft', { type: 'button', title: 'Play sound', 'aria-label': 'Play sound', html: ico.volume, onclick: () => playSound(d.sound) });
      panel.append(section('Display',
        toggle('Big “Now & Next” view', d.focus, v => { d.focus = v; commit(); }, 'Shows only the current and next activity – great for little ones'),
        toggle('Show breaks', d.showBreaks, v => { d.showBreaks = v; commit(); }),
        toggle('24-hour times', d.h24, v => { d.h24 = v; commit(); })),
        section('End of activity sound', h('div.row', null, snd, prev)));
    }
    panel.append(section('Color', swatches(THEMES.map(t => [t[0], t[1], t[2]]), d.theme, v => { d.theme = v; commit(); })));
  };
  draw();
}

function timeInput(it, key, commit) {
  const i = h('input.input.time', { type: 'time', value: it[key] || '', 'aria-label': key === 'start' ? 'Start time' : 'End time', step: 60 });
  i.addEventListener('change', () => { it[key] = i.value; if (key === 'start' && it.end && minsOf(it.end) <= minsOf(it.start)) { it.end = hhmmOf(minsOf(it.start) + 15); const e = i.parentElement.querySelectorAll('input.time')[1]; if (e) e.value = it.end; } commit(); });
  return i;
}
