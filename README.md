# Classroom Board (prototype)

A ClassroomScreen-style whiteboard for a pre-K classroom: full-screen "screens" with free-floating widgets
(Timetable, Timer, Visual timer, Clock, Calendar, Text, Drawing, Image, PDF, Dice, Traffic light, Work symbols, Sound level,
Name picker, Groups, YouTube, Website, Stickers). Board-wide Undo/Redo (toolbar, Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).

**Teacher side** (the *Board | Teacher* switch in the top bar, or `#teacher/<page>` in the URL): a separate planning view in
the same look, with its own tab bar – Today, Planner, Lessons, Library, To-dos, Students – plus *Back up* / *Restore*.
- **Today** – today's schedule blocks (what is on now / next), today's lessons with their resources, to-dos, reminders, attendance.
- **Planner** – weekly repeating schedule (blocks per weekday, e.g. Circle time 8:15–8:35), week navigation, drag lessons from the tray
  onto blocks (touch: drag by the dots) or tap +, move/remove planned lessons, mark a snow / no-school day and *bump* every lesson
  from that day on forward one school day (weekends and days off skipped; a lesson keeps its block when the new day has it, else "Anytime").
  The schedule editor can copy blocks from a board Timetable.
- **Lessons** – rich-text plan (bold / italic / underline / headings / lists; pasting is plain text), subject & unit tags, objectives,
  materials, attached library resources, tag filter + search, duplicate, "Plan it".
- **Library** – links, YouTube/video links, PDFs and pictures (uploaded to IndexedDB, 25 MB max per file), folders, labels, search.
  A PDF opens in the board's PDF widget, a picture in an Image widget, a YouTube link in the YouTube widget, a link in a new tab.
- **To-dos & reminders** – to-dos with optional due date; reminders (day + time) pop up as an in-app notice with a chime when due
  while the board is open (on either side), with Snooze 10 min / Done.
- **Students** – roster by **initials only** (names are refused), daily attendance (present / tardy / absent) and a 10-school-day
  history grid. "Use on the board" sends the roster to the Name picker & Groups. No profile fields yet: `PROFILE_FIELDS` in
  `js/teacher/students.js` is the seam for adding them once what they hold (and the privacy rules) is decided.
- **Back up / Restore** – one JSON file with all teacher data and the library files (base64), for moving to another device.

Static site – no build step. Open `index.html` through any web server (GitHub Pages).

## Code map
- `js/store.js` – **the board data module.** Boards and widgets are plain JSON, loaded/saved through an adapter
  (`LocalAdapter` = localStorage). To add cloud sync, write a Firestore adapter with the same `load()` / `save(json)`
  shape and call `setAdapter()` (e.g. one doc per board under `users/{uid}/boards/{boardId}`).
- `js/board.js` – widget frames: drag (header), resize (corner), bring-to-front, close, settings sheet.
  Positions are stored as fractions of the board, so a board scales to any screen/projector.
- `js/widgets/*.js` – one module per widget family. Each exports `{type,label,icon,size,min,defaults(),mount(ctx)}`.
- **Undo/redo** lives in `store.js`: every save compares the screen with its last snapshot (50 steps per screen,
  in memory). Widget types list `transient` data keys (a running timer, the dice showing) that never make a step.
- **Big files** (PDFs, drawings, PDF notes) go to IndexedDB through the swappable blob adapter in `store.js`
  (`blobs.get/put/del`, keys `<widgetId>:<name>`), not localStorage. `setBlobAdapter()` can point it at cloud storage.
- `js/teacher/tstore.js` – **teacher data module**, same pattern as `store.js`: plain JSON in localStorage
  (`classboard.teacher.v1`) through a swappable adapter (`setTeacherAdapter()`), library files in the shared blob store under
  `teacher/<resourceId>:file` (the board's blob clean-up skips these). Sync-ready: every record has a string id and `updated`
  time, deletions leave tombstones in `deleted`, and each array maps to a Firestore collection
  (`users/{uid}/teacher/{lessons|placements|blocks|resources|todos|reminders|students}/{id}`); `daysOff` and `attendance` are keyed by date.
- `js/teacher/teacher.js` – view shell, tab bar, hash routing, reminder notices, backup. Pages: `today.js`, `planner.js`,
  `lessons.js`, `library.js`, `tasks.js`, `students.js`; shared bits (modal, popover, tag input, touch drag, HTML clean-up) in `ui.js`.
- `js/sketch.js` – ink engine shared by the Drawing pad and PDF notes (pointer events, Apple Pencil pressure,
  palm rejection, vector strokes stored in width units so drawings scale with the widget).
- PDF rendering uses pdf.js 4.10.38 (legacy build) from jsDelivr, loaded only when a PDF widget is used.
- `js/picker.js` – pictogram picker (bundled icons + upload your own, resized in the browser).
- `js/audio.js` – generated WebAudio chimes (no audio files).

## Shared classroom (sign-in + sync) – free Firebase Spark plan only
- **Turned on by `js/cloud/config.js`.** While `FIREBASE_CONFIG` is `null` the app shows no sign-in and works on one device as before.
  The web config is public by design; the data is protected by `firestore.rules` (deploy them to the project) and sign-in.
- **Sign in** (top bar *Sign in* / class button, Board and Teacher side): Google (pop-up, full-page redirect if a pop-up is blocked) or
  email + password (create account, forgot password). School Google accounts may be blocked by the district → email works.
- **Classroom:** after sign-in, *Create a classroom* (name, optional "bring this device's board and plans") or *Join with a code*
  (6 characters, no 0/O/1/I/L). The class menu shows sync status, members, and for the owner the join code (copy / new code),
  remove member, rename. Members can leave. Everyone in a class can edit everything.
- **Data model** (`classrooms/{cid}`): `members/{uid}`, `items/{key}` = one record each (a screen `bd.<id>`, a widget `wg.<id>`,
  class list `cl`, pictures `pics`, teacher records `t.<array>.<id>`, `t.off.<date>`, `t.att.<date>`) holding canonical JSON,
  hash and change time; records over ~900 KB are split into `parts`. Files (PDFs, library files, drawings, PDF notes) go in
  `files` (info) + `fileparts` (≤750 KB pieces); over 10 MB they stay on the device that added them ("Only on this device").
  `joinCodes/{code}` → classroom; `users/{uid}` → the class this person last used. No Firebase Storage, no Cloud Functions.
- **Sync** (`js/cloud/sync.js`): the class's data is kept on the device in `classboard.v1@<cid>` / `classboard.teacher.v1@<cid>`
  (the signed-out keys are never touched), so it opens instantly and works offline; every save is diffed per record against
  what the class last agreed on, changes are pushed ~1 s later, and live snapshots bring the other person's changes in.
  Conflicts: last write wins per record. A widget being dragged/typed in, or a Teacher page with a field focused or a window
  open, waits for the other person's change until it is free. Per-device: the screen being shown, the Teacher tab.
  Remote changes clear that screen's undo history (undo would revert the other person's edit).
- **Offline:** Firestore offline cache + the local copy; `sw.js` (network-first app shell, registered only on devices in a class)
  lets the board reopen without internet. Regenerate it with `tools/mksw.py` after adding files or bumping `?v=`.
- **Sign out** removes the class's copy from the device (warns if changes have not reached the class) and returns to the
  device's own board. Removal by the owner does the same on the removed person's device.
- Tests: `test/cloud.py` (flow / ui / rules) against the Firebase emulators (`firebase.json`); never a real account.


Class lists and the student roster are **initials only**.

Cache tags: every CSS/JS URL carries `?v=N` (now `v=5`); bump it everywhere on each release so iPads don't keep old files.
 Pictures: Microsoft Fluent UI Emoji (MIT), bundled in `/icons`.
