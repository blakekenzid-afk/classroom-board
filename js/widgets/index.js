import { timetable } from './timetable.js';
import { timer, vtimer } from './timer.js';
import { clock, text, image, traffic, work, sticker } from './basic.js';
import { sound, picker, groups } from './classroom.js';

export const REGISTRY = Object.fromEntries([timetable, timer, vtimer, clock, text, image, traffic, work, sound, picker, groups, sticker].map(w => [w.type, w]));
// Order in the bottom dock
export const DOCK = ['timetable', 'timer', 'vtimer', 'clock', 'text', 'image', 'traffic', 'work', 'sound', 'picker', 'groups', 'stickers'];
