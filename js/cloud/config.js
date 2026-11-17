// Firebase web config for the shared classroom (free Spark plan).
// These values are PUBLIC by design (they only name the project);
// what protects the data is firestore.rules + sign-in.
// null = cloud features hidden; the board works on this device only.
export const FIREBASE_CONFIG = null;

// Automated tests only: on localhost, `localStorage['classboard.emulator'] = '1'`
// points the app at the local Firebase emulators with a demo project.
export const EMULATOR = {
  config: { apiKey: 'demo-key', authDomain: 'demo-classroom-board.firebaseapp.com', projectId: 'demo-classroom-board', appId: '1:000000000000:web:0000000000000000000000' },
  auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080]
};
export function activeConfig() {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let emu = false; try { emu = local && localStorage.getItem('classboard.emulator') === '1'; } catch (e) { }
  if (emu) return { config: EMULATOR.config, emulator: EMULATOR };
  return FIREBASE_CONFIG ? { config: FIREBASE_CONFIG, emulator: null } : null;
}

// Shared files (PDFs, pictures, drawings) are copied into the classroom up to this size.
// Bigger files stay on the device that added them (marked "Only on this device").
export const CLOUD_FILE_MAX = 10 * 1024 * 1024;
