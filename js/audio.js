// Generated WebAudio sounds – no audio files needed.
let ctx = null;
export function audio() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// Unlock on first touch/click (iPad needs a gesture).
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => audio(), { once: true, capture: true }));

export const SOUNDS = [
  ['chime', 'Soft chime'],
  ['xylophone', 'Xylophone'],
  ['bells', 'Bells'],
  ['birds', 'Birds'],
  ['gong', 'Gong'],
  ['alarm', 'Beep beep'],
  ['none', 'Silent']
];

function tone(c, t, freq, dur, { type = 'sine', gain = 0.25, attack = 0.01, glideTo } = {}) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master(c));
  o.start(t); o.stop(t + dur + 0.05);
}
let mg = null;
function master(c) { if (!mg) { mg = c.createGain(); mg.gain.value = 0.9; mg.connect(c.destination); } return mg; }

const play = {
  chime(c, t) { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { tone(c, t + i * 0.18, f, 1.6, { gain: 0.22 }); tone(c, t + i * 0.18, f * 2, 0.8, { gain: 0.05 }); }); },
  xylophone(c, t) { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => { tone(c, t + i * 0.13, f, 0.45, { type: 'triangle', gain: 0.35, attack: 0.004 }); tone(c, t + i * 0.13, f * 4, 0.12, { gain: 0.06, attack: 0.002 }); }); },
  bells(c, t) { for (let r = 0; r < 2; r++) [[784, 1], [988, 0.9]].forEach(([f], i) => { const s = t + r * 0.9 + i * 0.42; [1, 2.76, 5.4, 8.93].forEach((m, k) => tone(c, s, f * m, 2.2 / (k + 1), { gain: 0.18 / (k + 1), attack: 0.003 })); }); },
  birds(c, t) { for (let i = 0; i < 6; i++) { const s = t + i * 0.16 + (i > 2 ? 0.35 : 0); tone(c, s, 2400 + (i % 3) * 300, 0.12, { gain: 0.16, glideTo: 4200 + (i % 2) * 400 }); } },
  gong(c, t) { [110, 220.5, 331, 465, 612].forEach((f, k) => tone(c, t, f, 4 - k * 0.5, { gain: 0.28 / (k + 1), attack: 0.02 })); },
  alarm(c, t) { for (let i = 0; i < 6; i++) tone(c, t + i * 0.22 + Math.floor(i / 2) * 0.25, 880, 0.14, { type: 'square', gain: 0.12, attack: 0.005 }); }
};

window.__soundLog = [];
export function playSound(name) {
  if (!name || name === 'none') return;
  window.__soundLog.push({ name, at: Date.now() });
  const c = audio(); if (!c || !play[name]) return;
  try { play[name](c, c.currentTime + 0.03); } catch (e) { /* ignore audio failures */ }
}
