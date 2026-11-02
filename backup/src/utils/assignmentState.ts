// Where an assignment stands for the student, worked out from its dates and real
// progress. Past the deadline, unfinished work is closed: the backend no longer
// lets the student start it, and calls it "Ended".

export type AssignmentState = 'due-soon' | 'in-progress' | 'not-started' | 'opens' | 'closed' | 'done';

export interface AssignmentTiming {
  start: string | null;
  end: string | null;
  progress: number;
  apiStatus?: string;
}

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const DUE_SOON = 2 * DAY;

export const STATE_LABEL: Record<AssignmentState, string> = {
  'due-soon': 'Due soon',
  'in-progress': 'In progress',
  'not-started': 'Not started',
  opens: 'Opens soon',
  closed: 'Closed',
  done: 'Done',
};

const ORDER: AssignmentState[] = ['due-soon', 'in-progress', 'not-started', 'opens', 'closed', 'done'];

// The server stores UTC and some endpoints send it without a zone, which a
// browser would otherwise read as local time (5.5 hours off in India).
export function serverTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/(\.\d{3})\d+/, '$1');
  const zoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed) || !trimmed.includes('T') ? trimmed : `${trimmed}Z`;
  const parsed = Date.parse(zoned);
  return Number.isNaN(parsed) ? null : parsed;
}

const time = serverTime;

export function assignmentState(item: AssignmentTiming, now = new Date()): AssignmentState {
  if (item.progress >= 100) return 'done';
  const start = time(item.start);
  const end = time(item.end);
  const at = now.getTime();
  if (start !== null && at < start) return 'opens';
  if (end !== null && at > end) return 'closed';
  if (end !== null && end - at <= DUE_SOON) return 'due-soon';
  return item.progress > 0 ? 'in-progress' : 'not-started';
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Days are counted on the calendar: Tuesday to Thursday is two days, whatever the hour.
const calendarDays = (from: number, to: number) => {
  const day = (value: number) => {
    const date = new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return Math.round((day(to) - day(from)) / DAY);
};

function inWords(from: number, to: number, ahead: boolean) {
  const days = calendarDays(from, to);
  if (days >= 2) return plural(days, 'day');
  if (days === 1) return ahead ? 'tomorrow' : plural(1, 'day');
  const hours = Math.max(1, Math.round((to - from) / HOUR));
  return plural(hours, 'hour');
}

export function dueText(item: AssignmentTiming, now = new Date()): string {
  const state = assignmentState(item, now);
  if (state === 'done') return 'Done';
  const at = now.getTime();
  if (state === 'opens') {
    const words = inWords(at, time(item.start) ?? at, true);
    return words === 'tomorrow' ? 'Opens tomorrow' : `Opens in ${words}`;
  }
  const end = time(item.end);
  if (end === null) return 'No deadline';
  if (state === 'closed') return `Closed ${inWords(end, at, false)} ago`;
  const words = inWords(at, end, true);
  return words === 'tomorrow' ? 'Due tomorrow' : `Due in ${words}`;
}

export function sortByUrgency<T extends AssignmentTiming>(items: T[], now = new Date()): T[] {
  const rank = (item: T) => ORDER.indexOf(assignmentState(item, now));
  const deadline = (item: T) => time(item.end) ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => rank(a) - rank(b) || deadline(a) - deadline(b));
}
