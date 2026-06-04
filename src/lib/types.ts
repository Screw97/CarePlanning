// Care-planning data models. These mirror the Supabase schema in
// supabase/migrations/0001_init_care_tasks.sql. Health records get explicit
// types — no `any`.

export type RecurrenceType = 'once' | 'daily' | 'weekly';

/** ISO weekday: 1 = Monday … 7 = Sunday. (JS `Date.getDay()` is 0=Sun..6=Sat;
 *  we convert at the boundary so the rest of the app speaks ISO.) */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CareTaskCategory =
  | 'hygiene'
  | 'meals'
  | 'household'
  | 'health'
  | 'other';

export const CARE_TASK_CATEGORIES: CareTaskCategory[] = [
  'hygiene',
  'meals',
  'household',
  'health',
  'other',
];

/** A task template — the *definition* of a recurring or one-off thing to do. */
export interface CareTask {
  id: string;
  user_id: string;
  title: string;
  category: CareTaskCategory;
  recurrence_type: RecurrenceType;
  /** For `once`: the calendar day (YYYY-MM-DD). Null otherwise. */
  due_date: string | null;
  /** For `weekly`: the ISO weekdays it recurs on. Null/empty otherwise. */
  weekdays: IsoWeekday[] | null;
  /** Optional label, e.g. 'morning' | 'noon' | 'evening'. */
  time_of_day: string | null;
  /** Ordering within a day (breakfast < lunch < dinner). */
  sort_order: number;
  /** Soft-retire: once set, the task stops appearing from this day forward. */
  archived_at: string | null;
  created_at: string;
  /** Client-only: true when this row has not yet been pushed to Supabase.
   *  Stripped before any server write; never persisted in the DB. */
  _pending?: boolean;
}

export type CareTaskStatus = 'done' | 'skipped';

/** An audit record: a single check-off of a task for a specific day. */
export interface CareTaskLog {
  id: string;
  user_id: string;
  task_id: string;
  /** The device-local calendar day this completion is for (YYYY-MM-DD). */
  scheduled_date: string;
  status: CareTaskStatus;
  note: string | null;
  completed_at: string;
  /** Soft-delete: set instead of hard-deleting an audit row. */
  voided_at: string | null;
  /** Client-only sync flag; see CareTask._pending. */
  _pending?: boolean;
}

/** A row in the day's checklist: a due task plus its active log (if any). */
export interface ChecklistItem {
  task: CareTask;
  /** The active (non-voided) log for this task on the selected day, or null. */
  log: CareTaskLog | null;
  /** Convenience: log?.status ?? null. Null means "not acted on yet". */
  status: CareTaskStatus | null;
}
