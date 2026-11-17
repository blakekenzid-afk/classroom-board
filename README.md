# Classroom Board (prototype)

A ClassroomScreen-style whiteboard for a pre-K classroom: full-screen "screens" with free-floating widgets
(Timetable, Timer, Visual timer, Clock, Calendar, Text, Drawing, Image, PDF, Dice, Traffic light, Work symbols, Sound level,
Name picker, Groups, YouTube, Website, Stickers). Board-wide Undo/Redo (toolbar, Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).

Static site – no build step. Open `index.html` through any web server (GitHub Pages).

## Code map
- `js/store.js` – **the only data module.** Boards and widgets are plain JSON, loaded/saved through an adapter
  (`LocalAdapter` = localStorage). To add cloud sync, write a Firestore adapter with the same `load()` / `save(json)`
  shape and call `setAdapter()` (e.g. one doc per board under `users/{uid}/boards/{boardId}`).
- `js/board.js` – widget frames: drag (header), resize (corner), bring-to-front, close, settings sheet.
  Positions are stored as fractions of the board, so a board scales to any screen/projector.
- `js/widgets/*.js` – one module per widget family. Each exports `{type,label,icon,size,min,defaults(),mount(ctx)}`.
- **Undo/redo** lives in `store.js`: every save compares the screen with its last snapshot (50 steps per screen,
  in memory). Widget types list `transient` data keys (a running timer, the dice showing) that never make a step.
- **Big files** (PDFs, drawings, PDF notes) go to IndexedDB through the swappable blob adapter in `store.js`
  (`blobs.get/put/del`, keys `<widgetId>:<name>`), not localStorage. `setBlobAdapter()` can point it at cloud storage.
- `js/sketch.js` – ink engine shared by the Drawing pad and PDF notes (pointer events, Apple Pencil pressure,
  palm rejection, vector strokes stored in width units so drawings scale with the widget).
- PDF rendering uses pdf.js 4.10.38 (legacy build) from jsDelivr, loaded only when a PDF widget is used.
- `js/picker.js` – pictogram picker (bundled icons + upload your own, resized in the browser).
- `js/audio.js` – generated WebAudio chimes (no audio files).

Class lists are **initials only**. Pictures: Microsoft Fluent UI Emoji (MIT), bundled in `/icons`.
