// Website (embed) and YouTube widgets.
import { h, $, $$, icon, ico, section, field, toggle, toast } from '../util.js?v=6';

// ───────── shared helpers ─────────
const SVG = {
  reload: ico.reset,
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  yt: '<svg viewBox="0 0 28 20"><rect width="28" height="20" rx="6" fill="#FF0033"/><path d="M11.2 5.8v8.4l7.3-4.2z" fill="#fff"/></svg>'
};
const sv = (k, cls = 'i') => h('span.' + cls, { html: SVG[k], 'aria-hidden': 'true' });

/** Open a URL in a sized pop-up window (falls back to a new tab). */
export function popOut(url, name = 'cb_pop') {
  const W = Math.min(1280, Math.round(screen.availWidth * 0.86)), H = Math.min(900, Math.round(screen.availHeight * 0.86));
  const L = Math.round((screen.availWidth - W) / 2 + (screen.availLeft || 0)), T = Math.round((screen.availHeight - H) / 2 + (screen.availTop || 0));
  const w = window.open(url, name, `popup=yes,width=${W},height=${H},left=${L},top=${T}`);
  if (w) { try { w.opener = null; w.focus(); } catch (e) { } } else toast('Your browser blocked the pop-up window.', 'err');
  return w;
}

function parseUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/<iframe[^>]+src=["']([^"']+)["']/i); if (m) s = m[1]; // pasted embed code
  if (s.startsWith('//')) s = 'https:' + s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) { if (!/^[^\s/]+\.[^\s/]{2,}/.test(s)) return null; s = 'https://' + s; }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u : null; } catch (e) { return null; }
}
const bareHost = u => u.hostname.replace(/^(www|m)\./, '');
const hostIs = (host, d) => host === d || host.endsWith('.' + d);

/** YouTube video id from a link or a bare 11-character id. */
export function ytId(raw) {
  const s = String(raw || '').trim();
  if (/^[\w-]{11}$/.test(s) && /\d|[A-Z_-]/.test(s)) return s;
  const u = parseUrl(s); if (!u) return null;
  const host = bareHost(u);
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (hostIs(host, 'youtube.com') || hostIs(host, 'youtube-nocookie.com')) {
    id = u.searchParams.get('v');
    const p = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (!id && p) id = p[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
function ytStart(u) {
  const t = u.searchParams.get('t') || u.searchParams.get('start'); if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}
export const ytEmbed = (id, start = 0, autoplay = true) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3${autoplay ? '&autoplay=1' : ''}${start ? '&start=' + start : ''}`;

// Sites that refuse to be shown inside another page (checked: X-Frame-Options / CSP frame-ancestors).
const BLOCKED = {
  'classroomscreen.com': 'ClassroomScreen', 'pbskids.org': 'PBS KIDS', 'starfall.com': 'Starfall', 'abcya.com': 'ABCya', 'gonoodle.com': 'GoNoodle',
  'storylineonline.net': 'Storyline Online', 'getepic.com': 'Epic', 'abcmouse.com': 'ABCmouse', 'education.com': 'Education.com', 'splashlearn.com': 'SplashLearn',
  'seesaw.me': 'Seesaw', 'teacherspayteachers.com': 'TPT', 'quizlet.com': 'Quizlet', 'nearpod.com': 'Nearpod', 'duolingo.com': 'Duolingo', 'timeanddate.com': 'timeanddate',
  'pinterest.com': 'Pinterest', 'facebook.com': 'Facebook', 'instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'x.com': 'X', 'twitter.com': 'X', 'reddit.com': 'Reddit',
  'netflix.com': 'Netflix', 'github.com': 'GitHub', 'bing.com': 'Bing', 'youtube.com': 'YouTube', 'google.com': 'Google', 'canva.com': 'Canva', 'wordwall.net': 'Wordwall', 'spotify.com': 'Spotify'
};
const NAMES = { 'youtube-nocookie.com': 'YouTube', 'vimeo.com': 'Vimeo', 'wikipedia.org': 'Wikipedia', 'kahoot.it': 'Kahoot!', 'scholastic.com': 'Scholastic', 'toytheater.com': 'Toy Theater', 'pbs.org': 'PBS', 'khanacademy.org': 'Khan Academy' };
const GOOGLE_APPS = { presentation: 'Google Slides', document: 'Google Docs', spreadsheets: 'Google Sheets', forms: 'Google Forms', drawings: 'Google Drawings' };

/**
 * Turn any pasted link into what we show: {src, open, name, host, blocked}
 * src: what goes in the iframe (embeddable form), open: what the pop-out opens.
 */
export function resolveEmbed(raw) {
  const u = parseUrl(raw); if (!u) return null;
  const host = bareHost(u), open = u.href;
  let src = u.href, name = null, blocked = false;
  const nice = d => { for (const k in d) if (hostIs(host, k)) return d[k]; return null; };
  const yid = ytId(u.href);
  if (yid) { src = ytEmbed(yid, ytStart(u), false); name = 'YouTube'; }
  else if ((hostIs(host, 'youtube.com')) && u.searchParams.get('list')) { src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(u.searchParams.get('list'))}&rel=0`; name = 'YouTube'; }
  else if (host === 'vimeo.com' && /^\/(\d+)/.test(u.pathname)) { src = 'https://player.vimeo.com/video/' + u.pathname.match(/^\/(\d+)/)[1]; name = 'Vimeo'; }
  else if (host === 'docs.google.com') {
    const p = u.pathname.match(/^\/(presentation|document|spreadsheets|forms|drawings)\/d\/(e\/)?([\w-]+)/);
    if (p) {
      const [, kind, pub, id] = p, base = `https://docs.google.com/${kind}/d/${pub || ''}${id}`;
      name = GOOGLE_APPS[kind];
      if (kind === 'presentation') src = base + '/embed?start=false&loop=false&delayms=5000';
      else if (kind === 'forms') src = base + '/viewform?embedded=true';
      else if (kind === 'drawings') src = base + (pub ? '/pub?w=1200' : '/preview');
      else if (pub) src = base + (kind === 'spreadsheets' ? '/pubhtml?widget=true&headers=false' : '/pub?embedded=true');
      else src = base + '/preview';
    } else { blocked = true; name = 'Google Docs'; }
  }
  else if (host === 'drive.google.com' && /\/file\/d\/([\w-]+)/.test(u.pathname)) { src = `https://drive.google.com/file/d/${u.pathname.match(/\/file\/d\/([\w-]+)/)[1]}/preview`; name = 'Google Drive'; }
  else if (hostIs(host, 'canva.com') && /\/design\/[\w-]+\/[\w-]+\/view/.test(u.pathname)) { const c = new URL(u.href); c.search = '?embed'; src = c.href; name = 'Canva'; }
  else if (host === 'open.spotify.com' && /^\/(track|album|playlist|episode|show)\//.test(u.pathname)) { src = 'https://open.spotify.com/embed' + u.pathname; name = 'Spotify'; }
  else if (host === 'wordwall.net' && /^\/(\w+\/)?embed\//.test(u.pathname)) { name = 'Wordwall'; }
  else if (host === 'google.com' && u.pathname.startsWith('/maps/embed')) { name = 'Google Maps'; }
  else { const b = nice(BLOCKED); if (b) { blocked = true; name = b; } }
  if (u.protocol === 'http:' && location.protocol === 'https:' && !blocked) blocked = 'insecure';
  if (!name) name = nice(NAMES) || host;
  return { src, open, name, host, blocked };
}
const favicon = host => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
function siteIcon(host, cls) {
  const img = h('img.' + cls, { src: favicon(host), alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
  img.onerror = () => { img.onerror = null; img.src = 'icons/globe.svg'; };
  return img;
}
// When someone taps inside an iframe the board never sees a pointerdown, so select the widget on window blur.
function selectOnFrameFocus(ctx, getFrame) {
  const onBlur = () => setTimeout(() => { const f = getFrame(); if (f && document.activeElement === f) ctx.frame.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false })); }, 0);
  window.addEventListener('blur', onBlur);
  return () => window.removeEventListener('blur', onBlur);
}
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads';
const ALLOW = 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share';

// ───────── Website (embed) ─────────
const SUGGEST = [['Wikipedia', 'https://en.m.wikipedia.org/wiki/School_bus'], ['Toy Theater', 'https://toytheater.com/'], ['ClassroomScreen', 'https://classroomscreen.com/']];
export const embed = {
  type: 'embed', label: 'Website', icon: 'globe', transient: ['recent'],
  size: { w: 640, h: 440 }, min: { w: 240, h: 180 },
  defaults: () => ({ url: '', recent: [] }),
  mount(ctx) {
    const d = ctx.data; d.recent = d.recent || [];
    const root = h('div.em'); ctx.body.append(root);
    let frame = null, loadT = 0;
    const unBlur = selectOnFrameFocus(ctx, () => frame);
    function setUrl(raw) {
      const r = resolveEmbed(raw);
      if (!r) { toast('That doesn’t look like a web link.', 'err'); return false; }
      d.url = r.open; d.recent = [r.open, ...d.recent.filter(x => x !== r.open)].slice(0, 6); ctx.save(); draw(); ctx.refreshSettings(); return true;
    }
    function linkForm(big) {
      const inp = h('input.input.em-input', { type: 'url', inputmode: 'url', placeholder: 'Paste a link, like a Google Slides or video link', 'aria-label': 'Website link', autocomplete: 'off', spellcheck: 'false' });
      const go = h('button.btn.primary', { type: 'button', 'data-act': 'embed-go' }, big ? 'Show it' : 'Show');
      const sub = () => { if (inp.value.trim()) setUrl(inp.value); else inp.focus(); };
      go.onclick = sub; inp.addEventListener('keydown', e => { if (e.key === 'Enter') sub(); });
      return { el: h('div.em-form', null, inp, go), inp };
    }
    function draw() {
      clearTimeout(loadT); frame = null; root.innerHTML = '';
      const r = d.url ? resolveEmbed(d.url) : null;
      if (!r) {
        const f = linkForm(true);
        const chips = (d.recent.length ? d.recent.map(u => { const x = resolveEmbed(u); return x && [x.name, u, x.host]; }).filter(Boolean) : SUGGEST.map(([n, u]) => [n, u, bareHost(new URL(u))]));
        root.append(h('div.em-empty', null,
          h('img.em-hero', { src: 'icons/globe.svg', alt: '' }),
          h('b.em-h', { text: 'Show a website' }),
          h('small.em-sub', { text: 'Slides, Docs, YouTube, Vimeo and most web pages' }),
          f.el,
          h('div.em-chips', null, h('span.em-chips-l', { text: d.recent.length ? 'Recent' : 'Try' }),
            ...chips.slice(0, 4).map(([n, u, host]) => h('button.em-chip', { type: 'button', title: u, onclick: () => setUrl(u) }, siteIcon(host, 'em-chip-ico'), h('span', { text: n }))))));
        return;
      }
      const bar = h('div.em-bar', null,
        siteIcon(r.host, 'em-fav'),
        h('span.em-name', { text: r.name, title: r.open }),
        h('button.em-tb', { type: 'button', title: 'Reload', 'aria-label': 'Reload', 'data-act': 'reload', onclick: () => draw() }, sv('reload')),
        h('button.em-tb', { type: 'button', title: 'Change link', 'aria-label': 'Change link', 'data-act': 'change', onclick: () => { d.url = ''; ctx.save(); draw(); setTimeout(() => { const i = $('.em-input', root); i && i.focus(); }, 30); } }, sv('link')),
        h('button.em-tb.em-open', { type: 'button', title: 'Open in its own window', 'data-act': 'popout', onclick: () => popOut(r.open, 'cb_' + ctx.w.id) }, sv('open'), h('span', { text: 'Open' })));
      root.append(bar);
      if (r.blocked) {
        root.append(h('div.em-card', { 'data-blocked': '1' },
          h('div.em-card-ico', null, siteIcon(r.host, 'em-card-img')),
          h('b.em-card-t', { text: r.name }),
          h('small.em-card-s', { text: r.blocked === 'insecure' ? 'This link isn’t secure (http), so it opens in its own window.' : r.name + ' opens in its own window. It doesn’t allow being shown inside other pages.' }),
          h('button.btn.primary.em-card-btn', { type: 'button', 'data-act': 'popout-big', onclick: () => popOut(r.open, 'cb_' + ctx.w.id) }, sv('open'), 'Open ' + r.name)));
        return;
      }
      const wrap = h('div.em-frame.loading');
      frame = h('iframe', { src: r.src, title: r.name, allow: ALLOW, allowfullscreen: 'true', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: SANDBOX, loading: 'eager' });
      const spin = h('div.em-spin', null, h('i'));
      const hint = h('div.em-hint', null, h('span', { text: 'Not showing? Some sites only open in their own window.' }), h('button.btn.sm.primary', { type: 'button', onclick: () => popOut(r.open, 'cb_' + ctx.w.id) }, 'Open'));
      frame.addEventListener('load', () => { wrap.classList.remove('loading'); clearTimeout(loadT); });
      loadT = setTimeout(() => wrap.classList.add('slow'), 9000);
      wrap.append(frame, spin, hint); root.append(wrap);
    }
    draw();
    return {
      destroy: () => { clearTimeout(loadT); unBlur(); },
      settings: panel => {
        const f = linkForm(false); f.inp.value = d.url || '';
        panel.append(section('Website link', f.el, h('small.hint', { text: 'Tip: for Google Slides, use Share → anyone with the link, or File → Publish to the web.' })));
        if (d.url) panel.append(section(null, h('div.row', null,
          h('button.btn.ghost', { type: 'button', onclick: () => popOut(d.url, 'cb_' + ctx.w.id) }, sv('open'), 'Open in a window'),
          h('button.btn.ghost', { type: 'button', text: 'Clear', onclick: () => { d.url = ''; ctx.save(); draw(); ctx.refreshSettings(); } }))));
      }
    };
  }
};

// ───────── YouTube ─────────
// Search goes through a tiny Google Apps Script web app (owned by the board's
// Google account) so no YouTube API key lives in this public site.
// It always uses safeSearch=strict, embeddable videos only.
export const YT_API = 'https://script.google.com/macros/s/AKfycbxVdCWc9eGNMrK_-qjJRM7Bcg_ELzAb6wjwH1TH56b2RY41zctL2Tbs8taFzq3KksFR/exec';
const CACHE_KEY = 'classboard.ytcache', CACHE_TTL = 24 * 3600e3, CACHE_MAX = 40;
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
function fmtDur(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m || !iso) return '';
  const H = (+m[1] || 0) * 24 + (+m[2] || 0), M = +m[3] || 0, S = +m[4] || 0;
  if (!H && !M && !S) return '';
  return (H ? H + ':' + String(M).padStart(2, '0') : M) + ':' + String(S).padStart(2, '0');
}
function cacheGet(k) {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'), e = c[k]; return e && Date.now() - e.t < CACHE_TTL ? e.v : null; } catch (e) { return null; }
}
function cachePut(k, v) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); c[k] = { t: Date.now(), v };
    const keys = Object.keys(c).sort((a, b) => c[b].t - c[a].t); keys.slice(CACHE_MAX).forEach(x => delete c[x]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch (e) { }
}
export async function ytSearch(q, pageToken) {
  const k = q.toLowerCase().trim() + '|' + (pageToken || '');
  const hit = cacheGet(k); if (hit) return hit;
  const url = YT_API + '?q=' + encodeURIComponent(q.trim()) + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    const v = { items: (j.items || []).map(x => ({ id: x.videoId, title: decode(x.title), channel: decode(x.channel), thumb: x.thumb, dur: fmtDur(x.duration) })), next: j.next || null };
    cachePut(k, v); return v;
  } finally { clearTimeout(t); }
}
const ytSearchPage = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q || '') + '&sp=EgIQAQ%253D%253D';
const KID_IDEAS = ['Wheels on the bus', 'Freeze dance', 'Clean up song', 'ABC song', 'Count to 20', 'Brain break'];

export const youtube = {
  type: 'youtube', label: 'YouTube', icon: 'tv', transient: ['playing', 'q', 'recent'],
  size: { w: 700, h: 500 }, min: { w: 280, h: 240 },
  defaults: () => ({ q: '', playing: null, recent: [], favs: [] }),
  mount(ctx) {
    const d = ctx.data; d.recent = d.recent || []; d.favs = d.favs || [];
    const root = h('div.yt'); ctx.body.append(root);
    let view = d.playing ? 'player' : 'home', results = null, next = null, busy = false, err = '', tab = 'results', player = null, reqN = 0;
    const unBlur = selectOnFrameFocus(ctx, () => player);
    if (!d.playing && d.q) { const c = cacheGet(d.q.toLowerCase().trim() + '|'); if (c) { results = c.items; next = c.next; } }
    const isFav = id => d.favs.some(v => v.id === id);
    function toggleFav(v) {
      if (isFav(v.id)) d.favs = d.favs.filter(x => x.id !== v.id); else d.favs = [slim(v), ...d.favs].slice(0, 60);
      ctx.save();
    }
    const slim = v => ({ id: v.id, title: (v.title || '').slice(0, 140), channel: (v.channel || '').slice(0, 80), thumb: v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, dur: v.dur || '' });
    function play(v) {
      v = slim(v); d.playing = v; d.recent = [v, ...d.recent.filter(x => x.id !== v.id)].slice(0, 24); ctx.save();
      view = 'player'; draw();
    }
    async function search(q, more) {
      q = (q || '').trim(); if (!q) return;
      const id = ytId(q);
      if (id) { play({ id, title: 'YouTube video', channel: '' }); return; }
      if (!more) { d.q = q; ctx.save(); results = null; next = null; }
      busy = true; err = ''; view = 'home'; tab = 'results'; draw();
      const n = ++reqN;
      try {
        const r = await ytSearch(q, more ? next : null);
        if (n !== reqN) return;
        results = more ? [...(results || []), ...r.items.filter(x => !(results || []).some(y => y.id === x.id))] : r.items; next = r.next;
      } catch (e) {
        if (n !== reqN) return;
        console.warn('YouTube search failed', e); err = 'Search isn’t working right now.';
        if (!more) results = null;
      }
      busy = false; draw();
    }
    function card(v, i) {
      const fav = h('button.yt-fav' + (isFav(v.id) ? '.on' : ''), { type: 'button', title: isFav(v.id) ? 'Remove from favorites' : 'Add to favorites', 'aria-label': 'Favorite', 'data-act': 'fav' }, sv('star'));
      fav.onclick = e => { e.stopPropagation(); toggleFav(v); fav.classList.toggle('on', isFav(v.id)); if (tab === 'favs') draw(); };
      const c = h('div.yt-card', { role: 'button', tabindex: '0', 'data-vid': v.id, style: { '--i': Math.min(i, 12) } },
        h('div.yt-thumb', null, h('img', { src: v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, alt: '', loading: 'lazy', draggable: 'false' }), v.dur ? h('span.yt-dur', { text: v.dur }) : null, h('span.yt-playbadge', { html: ico.play }), fav),
        h('div.yt-meta', null, h('b.yt-title', { text: v.title, title: v.title }), v.channel ? h('small.yt-ch', { text: v.channel }) : null));
      c.onclick = () => play(v); c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(v); } };
      return c;
    }
    function searchBar(compact) {
      const inp = h('input.yt-q', { type: 'search', placeholder: 'Search YouTube or paste a link', 'aria-label': 'Search YouTube', value: d.q || '', enterkeyhint: 'search', autocomplete: 'off' });
      const go = h('button.yt-go', { type: 'button', 'aria-label': 'Search', 'data-act': 'yt-search' }, sv('search'), h('span', { text: 'Search' }));
      go.onclick = () => search(inp.value); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); search(inp.value); } });
      return h('div.yt-bar' + (compact ? '.compact' : ''), null, h('span.yt-logo', { html: SVG.yt }), h('label.yt-field', null, sv('search', 'i yt-mag'), inp), go);
    }
    function draw() {
      root.innerHTML = ''; player = null; root.className = 'yt v-' + view;
      if (view === 'player' && d.playing) {
        const v = d.playing;
        const fav = h('button.yt-tb' + (isFav(v.id) ? '.on' : ''), { type: 'button', title: 'Favorite', 'aria-label': 'Favorite', 'data-act': 'fav-playing' }, sv('star'));
        fav.onclick = () => { toggleFav(v); fav.classList.toggle('on', isFav(v.id)); };
        root.append(h('div.yt-pbar', null,
          h('button.yt-back', { type: 'button', 'data-act': 'yt-back', onclick: () => { d.playing = null; ctx.save(); view = 'home'; if (!results && d.q) search(d.q); else draw(); } }, sv('back'), h('span', { text: 'Videos' })),
          h('span.yt-ptitle', { text: v.title, title: v.title }), fav));
        player = h('iframe.yt-player', { src: ytEmbed(v.id), title: v.title || 'YouTube video', allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: 'true', referrerpolicy: 'strict-origin-when-cross-origin' });
        root.append(h('div.yt-stage', null, player));
        return;
      }
      root.append(searchBar());
      const hasLists = d.recent.length || d.favs.length, hasRes = !!(results || busy || err);
      if (tab === 'results' && !hasRes) tab = d.recent.length ? 'recent' : d.favs.length ? 'favs' : 'results';
      if ((tab === 'recent' && !d.recent.length) || (tab === 'favs' && !d.favs.length)) tab = hasRes ? 'results' : d.recent.length ? 'recent' : d.favs.length ? 'favs' : 'results';
      if (hasRes || hasLists) {
        const tabs = h('div.yt-tabs', { role: 'tablist' });
        [['results', d.q ? '“' + d.q + '”' : 'Results', results || busy || err], ['recent', 'Recent', d.recent.length], ['favs', 'Favorites', d.favs.length]].forEach(([k, label, show]) => {
          if (!show) return; const b = h('button.yt-tab' + (tab === k ? '.on' : ''), { type: 'button', 'data-tab': k, text: label });
          b.onclick = () => { tab = k; draw(); }; tabs.append(b);
        });
        root.append(tabs);
      }
      const list = h('div.yt-list');
      if (tab === 'results' && busy && !results) list.append(...Array.from({ length: 6 }, () => h('div.yt-card.skel', null, h('div.yt-thumb'), h('div.yt-meta', null, h('i'), h('i')))));
      else if (tab === 'results' && err) list.append(h('div.yt-msg', null, h('b', { text: err }), h('small', { text: 'You can still paste a YouTube link above, or look on YouTube in a window.' }),
        h('div.row', null, h('button.btn.primary', { type: 'button', 'data-act': 'yt-retry', onclick: () => search(d.q) }, 'Try again'), h('button.btn.ghost', { type: 'button', 'data-act': 'yt-popsearch', onclick: () => popOut(ytSearchPage(d.q), 'cb_yt') }, sv('open'), 'Search on YouTube'))));
      else if (tab === 'results' && results) {
        if (!results.length) list.append(h('div.yt-msg', null, h('b', { text: 'No videos found' }), h('small', { text: 'Try different words.' })));
        results.forEach((v, i) => list.append(card(v, i)));
        if (next && results.length) { const more = h('button.btn.ghost.yt-more', { type: 'button', 'data-act': 'yt-more', text: busy ? 'Loading…' : 'More videos', disabled: busy }); more.onclick = () => search(d.q, true); list.append(more); }
      }
      else if (tab === 'recent' && d.recent.length) d.recent.forEach((v, i) => list.append(card(v, i)));
      else if (tab === 'favs' && d.favs.length) d.favs.forEach((v, i) => list.append(card(v, i)));
      else list.append(h('div.yt-ideas', null, h('img.yt-hero', { src: 'icons/tv.svg', alt: '' }), h('b', { text: 'Find a video' }), h('small', { text: 'Kid-safe search. Ideas:' }),
        h('div.em-chips', null, ...KID_IDEAS.map(q => h('button.em-chip', { type: 'button', 'data-idea': q, text: q, onclick: () => search(q) })))));
      root.append(list);
    }
    draw();
    return {
      destroy: unBlur,
      settings: panel => {
        panel.append(
          section('Search', h('small.hint', { text: 'Search always uses YouTube’s strict SafeSearch and only shows videos that can play here. Paste any YouTube link or video ID to play it.' }),
            h('div.row', null, h('button.btn.ghost', { type: 'button', onclick: () => popOut(ytSearchPage(d.q), 'cb_yt') }, sv('open'), 'Search on YouTube in a window'))),
          section('Saved', h('div.row', null,
            h('button.btn.ghost', { type: 'button', 'data-act': 'clear-recent', text: 'Clear recent (' + d.recent.length + ')', disabled: !d.recent.length, onclick: () => { d.recent = []; ctx.save(); draw(); ctx.refreshSettings(); } }),
            h('button.btn.ghost', { type: 'button', 'data-act': 'clear-favs', text: 'Clear favorites (' + d.favs.length + ')', disabled: !d.favs.length, onclick: () => { d.favs = []; ctx.save(); draw(); ctx.refreshSettings(); } }))));
      }
    };
  }
};
