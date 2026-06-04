// Safety-critical: decides whether a task appears on a given calendar day.
// Pure functions, no I/O — exhaustively unit-tested in recurrence.test.ts.
// A bug here means a missed or wrongly-shown care task, so the rules are
// explicit and conservative (when in doubt, do NOT invent an occurrence).

import { CareTask, ChecklistItem, CareTaskLog } from './types';
import { isoWeekday, localDateStr } from './dates';

/** The DEVICE-LOCAL calendar day ('YYYY-MM-DD') of an ISO timestamp such as
 *  created_at/archived_at. We deliberately convert to local — not slice the UTC
 *  string — so day comparisons line up with how "today" is computed elsewhere.
 *  Otherwise a task created late in the local evening (already "tomorrow" in
 *  UTC) would wrongly drop off today's checklist. */
function dayOf(timestamp: string): string {
  return localDateStr(new Date(timestamp));
}

/**
 * Is `task` scheduled to appear on the calendar day `dateStr` ('YYYY-MM-DD')?
 *
 * Rules:
 *  - A task never appears before the day it was created.
 *  - An archived task stops appearing from its archive day forward (history
 *    before that day is preserved).
 *  - once   → only on its exact due_date.
 *  - daily  → every day on/after creation.
 *  - weekly → on/after creation AND the ISO weekday is in `weekdays`.
 */
export function isTaskDueOnDate(task: CareTask, dateStr: string): boolean {
  if (dateStr < dayOf(task.created_at)) return false;
  if (task.archived_at && dateStr >= dayOf(task.archived_at)) return false;

  switch (task.recurrence_type) {
    case 'once':
      return task.due_date === dateStr;
    case 'daily':
      return true;
    case 'weekly':
      return (task.weekdays ?? []).includes(isoWeekday(dateStr));
    default:
      // Unknown recurrence: fail closed rather than guess an occurrence.
      return false;
  }
}

/** All tasks due on `dateStr`, in display order. */
export function tasksDueOnDate(tasks: CareTask[], dateStr: string): CareTask[] {
  return tasks
    .filter((t) => isTaskDueOnDate(t, dateStr))
    .sort(compareForDisplay);
}

const TIME_ORDER: Record<string, number> = {
  morning: 0,
  noon: 1,
  afternoon: 2,
  evening: 3,
  night: 4,
};

function timeRank(t: CareTask): number {
  if (!t.time_of_day) return 99;
  return TIME_ORDER[t.time_of_day.toLowerCase()] ?? 99;
}

/** Order: time of day, then sort_order, then title (stable, predictable). */
export function compareForDisplay(a: CareTask, b: CareTask): number {
  return (
    timeRank(a) - timeRank(b) ||
    a.sort_order - b.sort_order ||
    a.title.localeCompare(b.title)
  );
}

/** The active (non-voided) log for a task on a given day, if any. */
export function activeLogFor(
  logs: CareTaskLog[],
  taskId: string,
  dateStr: string,
): CareTaskLog | null {
  return (
    logs.find(
      (l) =>
        l.task_id === taskId &&
        l.scheduled_date === dateStr &&
        l.voided_at == null,
    ) ?? null
  );
}

/** Build the full checklist for a day: each due task paired with its log. */
export function buildChecklist(
  tasks: CareTask[],
  logs: CareTaskLog[],
  dateStr: string,
): ChecklistItem[] {
  return tasksDueOnDate(tasks, dateStr).map((task) => {
    const log = activeLogFor(logs, task.id, dateStr);
    return { task, log, status: log?.status ?? null };
  });
}
