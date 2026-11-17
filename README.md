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

Class lists and the student roster are **initials only**.

Cache tags: every CSS/JS URL carries `?v=N` (now `v=4`); bump it everywhere on each release so iPads don't keep old files.
 Pictures: Microsoft Fluent UI Emoji (MIT), bundled in `/icons`.
