# Classroom Board (prototype)

A ClassroomScreen-style whiteboard for a pre-K classroom: full-screen "screens" with free-floating widgets
(Timetable, Timer, Visual timer, Clock, Text, Image, Traffic light, Work symbols, Sound level, Name picker, Groups, Stickers).

Static site – no build step. Open `index.html` through any web server (GitHub Pages).

## Code map
- `js/store.js` – **the only data module.** Boards and widgets are plain JSON, loaded/saved through an adapter
  (`LocalAdapter` = localStorage). To add cloud sync, write a Firestore adapter with the same `load()` / `save(json)`
  shape and call `setAdapter()` (e.g. one doc per board under `users/{uid}/boards/{boardId}`).
- `js/board.js` – widget frames: drag (header), resize (corner), bring-to-front, close, settings sheet.
  Positions are stored as fractions of the board, so a board scales to any screen/projector.
- `js/widgets/*.js` – one module per widget family. Each exports `{type,label,icon,size,min,defaults(),mount(ctx)}`.
- `js/picker.js` – pictogram picker (bundled icons + upload your own, resized in the browser).
- `js/audio.js` – generated WebAudio chimes (no audio files).

Class lists are **initials only**. Pictures: Microsoft Fluent UI Emoji (MIT), bundled in `/icons`.
