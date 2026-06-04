// Date helpers. The app's "day" is the DEVICE-LOCAL calendar day — we never
// guess or infer a timezone (health-data rule #4: schedules are timezone-
// explicit). All date strings are 'YYYY-MM-DD' and compare lexicographically,
// which for this format is the same as chronological order.

import { IsoWeekday } from './types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Today's date as 'YYYY-MM-DD' in the device's local timezone. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse 'YYYY-MM-DD' to a Date at LOCAL midnight (not UTC — avoids day shifts). */
export function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Add (or subtract) whole days to a 'YYYY-MM-DD' string. */
export function addDays(dateStr: string, n: number): string {
  const dt = parseLocal(dateStr);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

/** ISO weekday (1=Mon … 7=Sun) for a 'YYYY-MM-DD' string. */
export function isoWeekday(dateStr: string): IsoWeekday {
  const js = parseLocal(dateStr).getDay(); // 0=Sun..6=Sat
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** The 7 dates of the Monday-first week containing `dateStr`. */
export function weekDates(dateStr: string): string[] {
  const monday = addDays(dateStr, -(isoWeekday(dateStr) - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isToday(dateStr: string, now: Date = new Date()): boolean {
  return dateStr === localDateStr(now);
}

/** Is `dateStr` strictly before today (device-local)? Used to derive "missed". */
export function isPast(dateStr: string, now: Date = new Date()): boolean {
  return dateStr < localDateStr(now);
}

/** Human label like "Thu, Jun 4" — deterministic, locale-independent. */
export function formatHuman(dateStr: string): string {
  const dt = parseLocal(dateStr);
  return `${WEEKDAY_SHORT[dt.getDay()]}, ${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}`;
}

/** Short weekday label like "Thu" (for the week strip). */
export function weekdayShort(dateStr: string): string {
  return WEEKDAY_SHORT[parseLocal(dateStr).getDay()];
}

/** Day-of-month number, e.g. 4 (for the week strip). */
export function dayOfMonth(dateStr: string): number {
  return parseLocal(dateStr).getDate();
}
