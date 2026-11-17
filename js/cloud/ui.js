// Shared classroom screens: sign-in, create / join a classroom, the class
// panel (join code, members, sign out) and the account button in the top bar.
import { h, $, $$, toast, ico, confirmDialog } from '../util.js?v=5';
import * as C from './cloud.js?v=5';
const { cloud } = C;

const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
const CLOUD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5z"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
const REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.7-3.9L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.7 3.9L20 15"/><path d="M20 20v-5h-5"/></svg>';
const svg = (s, cls = 'i') => h('span.' + cls, { html: s, 'aria-hidden': 'true' });
const initials = n => String(n || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
const STATUS_TEXT = {
  synced: 'All changes are saved to the class', syncing: 'Saving changes to the class…', connecting: 'Connecting to the class…',
  offline: 'Offline – changes are saved here and will sync when you are back online', error: 'Having trouble reaching the class – will keep trying',
  'needs-signin': 'Signed out – sign in again to keep syncing'
};

const AUTH_ERR = {
  'auth/invalid-credential': 'That email and password do not match. Check them, or reset your password.',
  'auth/wrong-password': 'That email and password do not match. Check them, or reset your password.',
  'auth/user-not-found': 'There is no account with that email yet. Tap “Create an account”.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/missing-password': 'Type your password.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No internet connection. Connect and try again.',
  'auth/unauthorized-domain': 'Google sign-in is not turned on for this web address yet. Use email and password for now.',
  'auth/operation-not-allowed': 'This sign-in option is not turned on yet. Try the other one.',
  'auth/popup-blocked': 'The sign-in window was blocked. Allow pop-ups, or use email and password.',
  'auth/admin-restricted-operation': 'Your school account is not allowed to sign in here. Use email and password instead.',
  'cb/bad-code': 'That code does not match a classroom. Check the letters with your teacher.',
  unavailable: 'No internet connection. Connect and try again.',
  'permission-denied': 'That was not allowed. Check the code and try again.'
};
const errText = e => AUTH_ERR[e && e.code] || (e && /network|offline|unavailable/i.test(e.code + e.message) ? AUTH_ERR.unavailable : 'Something went wrong. Please try again.');

// ── a full-screen card, same look as the app ──
function screen(cls, { onClose } = {}) {
  closeScreen();
  const card = h('div.cl-card' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true' });
  const back = h('div.cl-back', { 'data-testid': 'cl-screen' }, card);
  back.addEventListener('pointerdown', e => { if (e.target === back && onClose) { closeScreen(); onClose(); } });
  document.body.append(back);
  current = { back, card, onClose };
  return card;
}
let current = null;
function closeScreen() { if (current) { current.back.remove(); current = null; } }
window.addEventListener('keydown', e => { if (e.key === 'Escape' && current && current.onClose) { const f = current.onClose; closeScreen(); f(); } }, true);
const logo = () => h('div.cl-logo', { 'aria-hidden': 'true' }, h('img', { src: 'icons/sparkles.svg', alt: '' }));
const closeBtn = fn => h('button.icon-btn.cl-x', { type: 'button', 'aria-label': 'Close', 'data-act': 'cl-close', html: ico.close, onclick: fn });
function busyBtn(b, on, text) { if (on) { b.dataset.label = b.textContent; b.disabled = true; b.textContent = text || 'One moment…'; } else { b.disabled = false; if (b.dataset.label) b.textContent = b.dataset.label; } }

// ── loading (first open of a class on this device) ──
export const loadingUI = {
  loading(cname) {
    const card = screen('cl-loading');
    card.append(logo(), h('h2', { text: 'Opening ' + (cname || 'your classroom') + '…' }), h('div.cl-spin', { 'aria-hidden': 'true' }), h('p.cl-sub', { text: 'Getting your class’s board and plans onto this device.' }));
    return {
      close: closeScreen,
      failed: kind => new Promise(res => {
        card.innerHTML = '';
        const done = v => { closeScreen(); res(v); };
        if (kind === 'removed') card.append(logo(), h('h2', { text: 'You are no longer in this classroom' }), h('p.cl-sub', { text: 'The class owner may have removed you. This device will use its own board.' }), h('button.btn.primary.full', { type: 'button', text: 'OK', 'data-act': 'cl-ok', onclick: () => done('leave') }));
        else if (kind === 'signed-out') card.append(logo(), h('h2', { text: 'Please sign in again' }), h('p.cl-sub', { text: 'Sign in to open ' + (cname || 'your classroom') + ' on this device.' }), h('button.btn.primary.full', { type: 'button', text: 'Sign in', 'data-act': 'cl-signin', onclick: () => done('signin') }), h('button.btn.ghost.full', { type: 'button', text: 'Use this device on its own', 'data-act': 'cl-local', onclick: () => done('leave') }));
        else card.append(logo(), h('h2', { text: 'Can’t reach your classroom' }), h('p.cl-sub', { text: 'This device needs the internet the first time it opens ' + (cname || 'the class') + '. Check the Wi-Fi and try again.' }),
          h('button.btn.primary.full', { type: 'button', text: 'Try again', 'data-act': 'cl-retry', onclick: () => done('retry') }), h('button.btn.ghost.full', { type: 'button', text: 'Use this device on its own for now', 'data-act': 'cl-local', onclick: () => done('local') }));
      })
    };
  }
};

// ── sign in ──
export function openSignIn(opts = {}) {
  let mode = 'signin';
  C.sdk().catch(() => {}); // load now so the Google pop-up can open straight from the tap
  const card = screen('cl-signin', { onClose: () => {} });
  const draw = () => {
    card.innerHTML = '';
    const err = h('p.cl-err', { role: 'alert', 'data-testid': 'signin-error' });
    const show = e => { err.textContent = typeof e === 'string' ? e : errText(e); };
    const g = h('button.cl-google', { type: 'button', 'data-testid': 'google-btn' }, h('span.cl-g', { html: G_LOGO }), h('span', { text: 'Continue with Google' }));
    g.onclick = async () => {
      show(''); busyBtn(g, true, 'Opening Google…');
      try { const u = await C.signInGoogle(); if (u) await afterSignIn(u); }
      catch (e) { busyBtn(g, false); if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(e.code)) { console.warn(e); show(e); } }
    };
    const name = h('input.input', { type: 'text', placeholder: 'Your name (your class sees it)', 'aria-label': 'Your name', autocomplete: 'name', maxlength: 60, 'data-testid': 'name' });
    const email = h('input.input', { type: 'email', placeholder: 'Email', 'aria-label': 'Email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false', 'data-testid': 'email' });
    const pass = h('input.input', { type: 'password', placeholder: mode === 'create' ? 'Make a password (6+ characters)' : 'Password', 'aria-label': 'Password', autocomplete: mode === 'create' ? 'new-password' : 'current-password', 'data-testid': 'password' });
    const go = h('button.btn.primary.full', { type: 'submit', text: mode === 'create' ? 'Create account' : 'Sign in', 'data-testid': 'email-submit' });
    const form = h('form.cl-form', { novalidate: true }, mode === 'create' ? name : null, email, pass, go);
    form.onsubmit = async e => {
      e.preventDefault(); show('');
      if (!email.value.trim()) return show('Type your email.');
      if (!pass.value) return show('Type your password.');
      busyBtn(go, true);
      try { const u = mode === 'create' ? await C.createEmail(name.value, email.value, pass.value) : await C.signInEmail(email.value, pass.value); await afterSignIn(u); }
      catch (er) { busyBtn(go, false); console.warn(er.code); show(er); }
    };
    const toggle = h('button.cl-link', { type: 'button', 'data-testid': 'toggle-create', text: mode === 'create' ? 'Have an account? Sign in' : 'New here? Create an account', onclick: () => { mode = mode === 'create' ? 'signin' : 'create'; draw(); } });
    const forgot = mode === 'signin' ? h('button.cl-link', { type: 'button', 'data-testid': 'forgot', text: 'Forgot password?', onclick: async () => {
      if (!email.value.trim()) return show('Type your email first, then tap “Forgot password?”.');
      try { await C.resetPassword(email.value); show(''); toast('Check your email for a link to reset your password.'); } catch (er) { show(er); }
    } }) : null;
    card.append(closeBtn(() => closeScreen()), logo(),
      h('h2', { text: opts.again ? 'Sign in again' : 'Share your board' }),
      h('p.cl-sub', { text: opts.again ? 'Sign in to keep your classroom in sync on this device.' : 'Sign in so you and your teacher can use the same board and Teacher side on any device.' }),
      g, h('div.cl-or', null, h('span', { text: 'or use email' })), form, err,
      h('div.cl-links', null, toggle, forgot),
      h('p.cl-fine', { text: 'School Google account not working? Your district may block it – use email and password instead.' }),
      h('button.btn.ghost.full.cl-later', { type: 'button', text: 'Not now – keep using this device', 'data-testid': 'not-now', onclick: () => closeScreen() }));
    if (matchMedia('(hover:hover)').matches) setTimeout(() => (mode === 'create' ? name : email).focus(), 40);
  };
  draw();
}

/** Signed in: open their classroom, or help them make / join one. */
async function afterSignIn(user) {
  cloud.user = user;
  const card = screen('cl-loading');
  card.append(logo(), h('h2', { text: 'Signed in!' }), h('div.cl-spin'), h('p.cl-sub', { text: 'Looking for your classroom…' }));
  let c = null;
  try { c = await Promise.race([C.myClass(), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('slow'), { code: 'timeout' })), 15000))]); }
  catch (e) { console.warn('class lookup', e && e.code); }
  if (cloud.mode === 'class' && cloud.mem && cloud.mem.uid === user.uid && (!c || c.cid === cloud.mem.cid)) { closeScreen(); C.resume(); toast('Signed in – syncing with ' + cloud.mem.cname); return; }
  if (cloud.mode === 'class') { C.writeMem(null); location.reload(); return; } // a different person on this device
  if (c && c.joined) return offerMigrate(c);
  openChooser();
}
function migrateLabel(s) {
  const bits = [];
  if (s.screens) bits.push(s.screens + ' screen' + (s.screens === 1 ? '' : 's'));
  if (s.lessons) bits.push(s.lessons + ' lesson' + (s.lessons === 1 ? '' : 's'));
  if (s.resources) bits.push(s.resources + ' library item' + (s.resources === 1 ? '' : 's'));
  if (s.students) bits.push(s.students + ' student' + (s.students === 1 ? '' : 's'));
  return bits.length ? bits.join(', ') : 'your screens and teacher plans';
}
function offerMigrate(c) {
  const s = C.localSummary();
  if (!s.any) return C.enterClass(c, false);
  const card = screen('cl-loading');
  card.append(logo(), h('h2', { text: 'Open ' + c.cname }),
    h('p.cl-sub', { text: 'This device also has its own board (' + migrateLabel(s) + '). Add them to the class too?' }),
    h('button.btn.primary.full', { type: 'button', text: 'Open the class only', 'data-testid': 'open-class', onclick: () => C.enterClass(c, false) }),
    h('button.btn.ghost.full', { type: 'button', text: 'Add this device’s board and plans to the class', 'data-testid': 'open-migrate', onclick: () => C.enterClass(c, true) }),
    h('p.cl-fine', { text: 'Either way, nothing is deleted: this device keeps its own board for when you are signed out.' }));
}

// ── create or join ──
export function openChooser() {
  const s = C.localSummary();
  const card = screen('cl-choose', { onClose: () => {} });
  const u = cloud.user || {};
  const mk = (title, sub, pic) => h('div.cl-opt', null, h('img.cl-opt-ico', { src: 'icons/' + pic + '.svg', alt: '' }), h('h3', { text: title }), h('p', { text: sub }));
  // create
  const cname = h('input.input', { type: 'text', placeholder: 'Name it (e.g. Pre-K Room 4)', 'aria-label': 'Classroom name', maxlength: 60, 'data-testid': 'class-name' });
  const mc = h('input', { type: 'checkbox', checked: s.any, 'data-testid': 'migrate-create' });
  const cErr = h('p.cl-err', { role: 'alert' });
  const cBtn = h('button.btn.primary.full', { type: 'button', text: 'Create classroom', 'data-testid': 'create-class' });
  cBtn.onclick = async () => {
    cErr.textContent = ''; busyBtn(cBtn, true, 'Creating…');
    try { const c = await C.createClass(cname.value); created(c, mc.checked); }
    catch (e) { console.warn(e); busyBtn(cBtn, false); cErr.textContent = errText(e); }
  };
  const create = mk('Create a classroom', 'You get a short code to give your teacher.', 'school');
  create.append(cname, s.any ? h('label.cl-check', null, mc, h('span', { text: 'Bring this device’s board and plans (' + migrateLabel(s) + ')' })) : null, cErr, cBtn);
  // join
  const code = h('input.input.cl-code-in', { type: 'text', placeholder: 'ABC123', 'aria-label': 'Join code', maxlength: 7, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', 'data-testid': 'join-code' });
  code.addEventListener('input', () => { const p = code.selectionStart; code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); try { code.setSelectionRange(p, p); } catch (e) { } });
  const mj = h('input', { type: 'checkbox', checked: false, 'data-testid': 'migrate-join' });
  const jErr = h('p.cl-err', { role: 'alert', 'data-testid': 'join-error' });
  const jBtn = h('button.btn.primary.full', { type: 'button', text: 'Join classroom', 'data-testid': 'join-class' });
  jBtn.onclick = async () => {
    jErr.textContent = ''; busyBtn(jBtn, true, 'Joining…');
    try { const c = await C.joinClass(code.value); C.enterClass(c, mj.checked); }
    catch (e) { console.warn(e); busyBtn(jBtn, false); jErr.textContent = errText(e); }
  };
  code.addEventListener('keydown', e => { if (e.key === 'Enter') jBtn.click(); });
  cname.addEventListener('keydown', e => { if (e.key === 'Enter') cBtn.click(); });
  const join = mk('Join a classroom', 'Type the 6-character code your teacher gave you.', 'teacher');
  join.append(code, s.any ? h('label.cl-check', null, mj, h('span', { text: 'Also add this device’s board and plans' })) : null, jErr, jBtn);
  card.append(closeBtn(() => closeScreen()), logo(), h('h2', { text: 'Set up your shared classroom' }),
    h('p.cl-sub', { text: 'Everyone in a classroom sees and edits the same board and Teacher side.' }),
    h('div.cl-opts', null, create, join),
    h('div.cl-foot', null, h('span', { text: 'Signed in as ' + (u.email || u.displayName || 'you') }),
      h('button.cl-link', { type: 'button', text: 'Sign out', 'data-testid': 'chooser-signout', onclick: () => C.signOutEverywhere() })));
}
function created(c, migrate) {
  const card = screen('cl-loading');
  const codeEl = h('div.cl-code', { 'data-testid': 'new-class-code', text: c.code });
  card.append(logo(), h('h2', { text: c.cname + ' is ready!' }),
    h('p.cl-sub', { text: 'Give this code to your teacher. They sign in, tap “Join a classroom” and type it.' }), codeEl,
    h('button.btn.ghost.full', { type: 'button', 'data-act': 'copy-code', onclick: () => copy(c.code) }, svg(COPY_SVG), 'Copy the code'),h('button.btn.primary.full', { type: 'button', text: 'Open my classroom', 'data-testid': 'open-new-class', onclick: () => C.enterClass(c, migrate) }),
    h('p.cl-fine', { text: 'You can find the code again any time in the class menu.' }));
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Code copied'); }
  catch (e) { toast('The code is ' + text); }
}

// ── account button in the top bars ──
const buttons = [];
export function accountButton() {
  const b = h('button.chrome-btn.acct-btn', { type: 'button', 'data-act': 'account', 'aria-haspopup': 'dialog' });
  b.onclick = e => { e.stopPropagation(); onAccount(b); };
  buttons.push(b); paint(b);
  return b;
}
function paint(b) {
  const st = C.status();
  b.hidden = st.state === 'none';
  b.dataset.state = st.state;
  b.innerHTML = '';
  if (st.state === 'signed-out') { b.title = 'Sign in to share this board with your class'; b.append(svg(CLOUD_SVG), h('span.lbl', { text: 'Sign in' })); return; }
  if (st.state === 'no-class') { b.title = 'Set up your shared classroom'; b.append(svg(CLOUD_SVG), h('span.lbl', { text: 'Classroom' })); return; }
  const m = cloud.mem || {};
  b.title = (m.cname || 'Classroom') + ' · ' + (STATUS_TEXT[st.state] || '');
  b.setAttribute('aria-label', 'Classroom: ' + (m.cname || '') + '. ' + (STATUS_TEXT[st.state] || ''));
  b.append(h('span.acct-av', { text: initials(m.name || m.email) }, h('i.acct-dot.' + st.state)), h('span.lbl.acct-name', { text: m.cname || 'Classroom' }));
}
let paintT = 0;
C.onCloud(() => { cancelAnimationFrame(paintT); paintT = requestAnimationFrame(() => { buttons.forEach(paint); if (panel && panel.isConnected) drawPanel(); }); });
function onAccount(b) {
  const st = C.status().state;
  if (st === 'signed-out') return openSignIn();
  if (st === 'needs-signin') return openSignIn({ again: true });
  if (st === 'no-class') { if (!cloud.user) return openSignIn(); return openChooser(); }
  togglePanel(b);
}

// ── class panel ──
let panel = null, anchor = null;
function togglePanel(b) {
  if (panel && panel.isConnected) { panel.remove(); panel = null; return; }
  anchor = b;
  panel = h('div.menu.cl-panel.open', { role: 'dialog', 'aria-label': 'Classroom', 'data-testid': 'class-panel' });
  document.body.append(panel);
  drawPanel();
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function outside(e) { if (panel && !panel.contains(e.target) && !e.target.closest('.acct-btn') && !e.target.closest('.modal-back')) { panel.remove(); panel = null; document.removeEventListener('pointerdown', outside, true); } }
window.addEventListener('keydown', e => { if (e.key === 'Escape' && panel) { panel.remove(); panel = null; } });
function place() {
  if (!panel || !anchor) return;
  const r = anchor.getBoundingClientRect(), w = Math.min(360, innerWidth - 20);
  panel.style.width = w + 'px'; panel.style.top = (r.bottom + 10) + 'px';
  panel.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.right - w)) + 'px';
  panel.style.maxHeight = (innerHeight - r.bottom - 24) + 'px';
}
function drawPanel() {
  const st = C.status(), m = cloud.mem || {}, cd = cloud.classDoc || {}, me = cloud.user && cloud.user.uid;
  const owner = cd.owner ? cd.owner === me : m.role === 'owner';
  panel.innerHTML = '';
  const head = h('div.clp-head', null, h('div.clp-title', null, h('b', { text: cd.name || m.cname || 'Classroom', 'data-testid': 'class-title' }), h('span.clp-role', { text: owner ? 'Owner' : 'Member' })),
    owner ? h('button.icon-btn.sm', { type: 'button', title: 'Rename the classroom', 'aria-label': 'Rename the classroom', 'data-act': 'rename-class', html: ico.pencil, onclick: () => rename() }) : null);
  const status = h('div.clp-status.' + st.state, { 'data-testid': 'sync-status' }, h('i.acct-dot.' + st.state), h('span', { text: STATUS_TEXT[st.state] || '' }));
  panel.append(head, status);
  if (owner) {
    const code = cd.code || '······';
    panel.append(h('div.clp-sect', null, h('div.menu-h', { text: 'Join code' }),
      h('div.clp-code-row', null, h('div.cl-code.sm', { text: code, 'data-testid': 'join-code-show' }),
        h('button.btn.sm.ghost', { type: 'button', 'data-testid': 'copy-code', onclick: () => copy(code) }, svg(COPY_SVG), 'Copy'),
        h('button.btn.sm.ghost', { type: 'button', 'data-testid': 'new-code', title: 'Make a new code (the old one stops working)', onclick: () => newCode() }, svg(REFRESH_SVG), 'New code')),
      h('p.clp-fine', { text: 'Give this code to your teacher. They sign in on their device and tap “Join a classroom”.' })));
  }
  const list = h('div.clp-members', { 'data-testid': 'members' });
  (cloud.members.length ? cloud.members : [{ uid: me, name: m.name, email: m.email, role: m.role }]).forEach(p => {
    const you = p.uid === me;
    list.append(h('div.clp-mem', { 'data-uid': p.uid }, h('span.acct-av.lg', { text: initials(p.name || p.email) }),
      h('div.clp-mem-t', null, h('b', { text: (p.name || 'Teacher') + (you ? ' (you)' : '') }), h('small', { text: p.email || '' })),
      p.role === 'owner' ? h('span.clp-role', { text: 'Owner' }) : null,
      owner && !you ? h('button.icon-btn.sm.danger', { type: 'button', title: 'Remove from the class', 'aria-label': 'Remove ' + (p.name || p.email), 'data-testid': 'remove-member', html: ico.close, onclick: () => remove(p) }) : null));
  });
  panel.append(h('div.clp-sect', null, h('div.menu-h', { text: 'People in this class' }), list));
  panel.append(h('div.clp-foot', null, h('small', { text: 'Signed in as ' + (m.email || (cloud.user && cloud.user.email) || '') }),
    h('div.row', null,
      !owner ? h('button.btn.sm.ghost', { type: 'button', text: 'Leave class', 'data-testid': 'leave-class', onclick: () => leave() }) : null,
      h('button.btn.sm.ghost', { type: 'button', text: 'Sign out', 'data-testid': 'sign-out', onclick: () => signOut() }))));
  place();
}
const confirmBox = (title, body, ok, danger) => confirmDialog(title, body, ok, danger);
async function newCode() {
  if (!await confirmBox('Make a new join code?', 'The old code stops working. People already in the class stay in.', 'New code', false)) return;
  try { await C.regenerateCode(); toast('New code made'); } catch (e) { console.warn(e); toast(errText(e), 'err'); }
}
async function remove(p) {
  if (!await confirmBox('Remove ' + (p.name || p.email) + '?', 'They will no longer see or change this class. To stop them joining again, make a new code too.', 'Remove', true)) return;
  try { await C.removeMember(p.uid); toast((p.name || 'They') + ' removed'); } catch (e) { console.warn(e); toast(errText(e), 'err'); }
}
async function rename() {
  const cur = (cloud.classDoc && cloud.classDoc.name) || cloud.mem.cname || '';
  const name = prompt('Classroom name', cur);
  if (name === null || !name.trim() || name.trim() === cur) return;
  try { await C.renameClass(name); toast('Classroom renamed'); } catch (e) { toast(errText(e), 'err'); }
}
function unsyncedWarning() {
  const n = C.pendingCount();
  if (!n) return null;
  return navigator.onLine ? 'A few changes are still being saved to the class. Wait a few seconds – if you sign out now they will be lost.' : 'You are offline, so your newest changes have not reached the class yet. If you sign out now they will be lost.';
}
async function signOut() {
  const warn = unsyncedWarning();
  if (warn && !await confirmBox('Sign out anyway?', warn, 'Sign out', true)) return;
  if (!warn && !await confirmBox('Sign out?', 'This device goes back to its own board. Your class stays saved – sign in again any time.', 'Sign out', false)) return;
  await C.signOutEverywhere();
}
async function leave() {
  if (!await confirmBox('Leave this classroom?', 'You will stop seeing its board and plans. You can join again with the code.', 'Leave', true)) return;
  try { await C.leaveClass(false); } catch (e) { toast(errText(e), 'err'); }
}

window.addEventListener('cb:removed', async e => {
  if (current) closeScreen();
  await confirmDialog('You are no longer in “' + ((e.detail && e.detail.cname) || 'this class') + '”', 'The class owner removed you, so this device goes back to its own board.', 'OK', false);
  C.leaveClass(true);
});
window.addEventListener('cb:signed-in', e => afterSignIn(e.detail));
window.addEventListener('cb:signin-error', e => { openSignIn(); setTimeout(() => { const el = $('[data-testid=signin-error]'); if (el) el.textContent = errText(e.detail); }, 50); });
export function maybeOpenSignIn() { if (sessionStorage.getItem('classboard.openSignin')) { sessionStorage.removeItem('classboard.openSignin'); openSignIn({ again: true }); } }
