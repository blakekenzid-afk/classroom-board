import { timetable } from './timetable.js?v=6';
import { timer, vtimer } from './timer.js?v=6';
import { clock, text, image, traffic, work, sticker } from './basic.js?v=6';
import { sound, picker, groups } from './classroom.js?v=6';
import { embed, youtube } from './media.js?v=6';
import { draw } from './draw.js?v=6';
import { dice } from './dice.js?v=6';
import { calendar } from './calendar.js?v=6';
import { pdf } from './pdf.js?v=6';

export const REGISTRY = Object.fromEntries([timetable, timer, vtimer, clock, calendar, text, draw, image, pdf, traffic, work, sound, picker, groups, dice, sticker, embed, youtube].map(w => [w.type, w]));
// Order in the bottom dock. When the screen is too narrow, the last ones move into "More".
export const DOCK = ['timetable', 'timer', 'vtimer', 'clock', 'calendar', 'text', 'draw', 'image', 'pdf', 'dice', 'traffic', 'work', 'sound', 'picker', 'groups', 'youtube', 'embed', 'stickers'];
