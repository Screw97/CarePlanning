// Care-tasks data layer. The UI talks to THIS module, never to Supabase
// directly (CLAUDE.md convention). It is local-first:
//   - Reads always come from the local cache → screen renders with no network.
//   - Writes update the cache immediately and are flagged `_pending`, then
//     pushed to Supabase best-effort when a session exists.
//   - A failed/absent sync never throws and never blanks the screen; callers
//     get a { synced } flag so the UI can show "saved on this device".
//
// Audit safety: a completion is never hard-deleted. "Undo" voids the active log
// (sets voided_at) and the prior row is preserved — mirroring the DB schema.

import { supabase, isSupabaseConfigured } from './supabase';
import { readCache, writeCache, clearCache } from './cache';
import { buildChecklist, activeLogFor } from './recurrence';
import { STARTER_TEMPLATES } from './starterTasks';
import {
  CareTask,
  CareTaskLog,
  CareTaskStatus,
  CareTaskCategory,
  ChecklistItem,
  IsoWeekday,
  RecurrenceType,
} from './types';

const TASKS_KEY = 'careplanning.tasks.v1';
const LOGS_KEY = 'careplanning.logs.v1';

/** Sentinel owner id for rows created before the user has signed in. They are
 *  re-owned to the real auth uid when first pushed to the server. */
const LOCAL_USER = 'local';

export { isSupabaseConfigured };

// ── small utilities ──────────────────────────────────────────────────────────
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function nowIso(): string {
  return new Date().toISOString();
}

async function readTasks(): Promise<CareTask[]> {
  return (await readCache<CareTask[]>(TASKS_KEY)) ?? [];
}
async function readLogs(): Promise<CareTaskLog[]> {
  return (await readCache<CareTaskLog[]>(LOGS_KEY)) ?? [];
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── reads (always local; offline-first) ──────────────────────────────────────
export async function loadChecklist(dateStr: string): Promise<ChecklistItem[]> {
  const [tasks, logs] = await Promise.all([readTasks(), readLogs()]);
  return buildChecklist(tasks, logs, dateStr);
}

export async function hasAnyTasks(): Promise<boolean> {
  return (await readTasks()).length > 0;
}

// ── writes (local first, then best-effort push) ──────────────────────────────
export interface NewTaskInput {
  title: string;
  category?: CareTaskCategory;
  recurrence_type?: RecurrenceType;
  due_date?: string | null;
  weekdays?: IsoWeekday[] | null;
  time_of_day?: string | null;
  sort_order?: number;
}

export async function addTask(input: NewTaskInput): Promise<CareTask> {
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required');

  const ownerId = (await currentUserId()) ?? LOCAL_USER;
  const task: CareTask = {
    id: uuid(),
    user_id: ownerId,
    title,
    category: input.category ?? 'other',
    recurrence_type: input.recurrence_type ?? 'daily',
    due_date: input.due_date ?? null,
    weekdays: input.weekdays ?? null,
    time_of_day: input.time_of_day ?? null,
    sort_order: input.sort_order ?? 0,
    archived_at: null,
    created_at: nowIso(),
    _pending: true,
  };
  await writeCache(TASKS_KEY, [...(await readTasks()), task]);
  await flushPending();
  return task;
}

/** Add the generic starter templates as real tasks (first-run convenience). */
export async function addStarterTasks(): Promise<void> {
  const existing = await readTasks();
  const ownerId = (await currentUserId()) ?? LOCAL_USER;
  const created: CareTask[] = STARTER_TEMPLATES.map((t) => ({
    id: uuid(),
    user_id: ownerId,
    title: t.title,
    category: t.category,
    recurrence_type: t.recurrence_type,
    due_date: null,
    weekdays: t.weekdays ?? null,
    time_of_day: t.time_of_day ?? null,
    sort_order: t.sort_order,
    archived_at: null,
    created_at: nowIso(),
    _pending: true,
  }));
  await writeCache(TASKS_KEY, [...existing, ...created]);
  await flushPending();
}

/**
 * Set the status of a task for a day. If an active log already exists with a
 * different status, it is voided (preserved for audit) and a new one written.
 * Re-setting the same status is a no-op.
 */
export async function setStatus(
  taskId: string,
  dateStr: string,
  status: CareTaskStatus,
): Promise<{ synced: boolean }> {
  const logs = await readLogs();
  const existing = activeLogFor(logs, taskId, dateStr);
  if (existing && existing.status === status) {
    return { synced: !existing._pending };
  }

  const voided = existing
    ? logs.map((l) =>
        l.id === existing.id ? { ...l, voided_at: nowIso(), _pending: true } : l,
      )
    : logs;

  const ownerId = (await currentUserId()) ?? LOCAL_USER;
  const log: CareTaskLog = {
    id: uuid(),
    user_id: ownerId,
    task_id: taskId,
    scheduled_date: dateStr,
    status,
    note: null,
    completed_at: nowIso(),
    voided_at: null,
    _pending: true,
  };
  await writeCache(LOGS_KEY, [...voided, log]);
  return { synced: await flushPending() };
}

/** Undo a day's status by voiding the active log (soft-delete; audit-safe). */
export async function clearStatus(
  taskId: string,
  dateStr: string,
): Promise<{ synced: boolean }> {
  const logs = await readLogs();
  const existing = activeLogFor(logs, taskId, dateStr);
  if (!existing) return { synced: true };
  const next = logs.map((l) =>
    l.id === existing.id ? { ...l, voided_at: nowIso(), _pending: true } : l,
  );
  await writeCache(LOGS_KEY, next);
  return { synced: await flushPending() };
}

/** Toggle: tapping the current status clears it, otherwise sets `target`. */
export async function toggleStatus(
  item: ChecklistItem,
  dateStr: string,
  target: CareTaskStatus,
): Promise<{ synced: boolean }> {
  return item.status === target
    ? clearStatus(item.task.id, dateStr)
    : setStatus(item.task.id, dateStr, target);
}

// ── sync (best-effort; never throws) ─────────────────────────────────────────
/** Push any `_pending` rows to Supabase. Returns true only if everything that
 *  needed syncing succeeded (and a session exists). */
export async function flushPending(): Promise<boolean> {
  const uid = await currentUserId();
  if (!supabase || !uid) return false;
  const okTasks = await pushPending<CareTask>('care_tasks', TASKS_KEY, uid);
  const okLogs = await pushPending<CareTaskLog>('care_task_logs', LOGS_KEY, uid);
  return okTasks && okLogs;
}

async function pushPending<
  T extends { id: string; user_id: string; _pending?: boolean },
>(table: string, key: string, uid: string): Promise<boolean> {
  const rows = (await readCache<T[]>(key)) ?? [];
  const pending = rows.filter((r) => r._pending);
  if (pending.length === 0) return true;

  let allOk = true;
  let updated = rows;
  for (const r of pending) {
    const { _pending, ...rest } = r;
    const row = { ...rest, user_id: uid } as Record<string, unknown>;
    const { error } = await supabase!.from(table).upsert(row, { onConflict: 'id' });
    if (error) {
      allOk = false; // leave _pending set so a later flush retries
      continue;
    }
    updated = updated.map((x) => (x.id === r.id ? { ...x, _pending: false } : x));
  }
  await writeCache(key, updated);
  return allOk;
}

/** Pull server rows and merge into the cache. Local `_pending` rows that the
 *  server doesn't have yet are preserved. No-op (synced:false) without a
 *  session — the cache remains the source of truth. */
export async function syncFromServer(): Promise<{ synced: boolean }> {
  const uid = await currentUserId();
  if (!supabase || !uid) return { synced: false };

  await flushPending(); // don't let a pull clobber un-pushed local edits

  const [tasksRes, logsRes] = await Promise.all([
    supabase.from('care_tasks').select('*'),
    supabase.from('care_task_logs').select('*'),
  ]);
  if (tasksRes.error || logsRes.error) return { synced: false };

  const mergedTasks = mergeById<CareTask>(
    (tasksRes.data ?? []) as CareTask[],
    await readTasks(),
  );
  const mergedLogs = mergeById<CareTaskLog>(
    (logsRes.data ?? []) as CareTaskLog[],
    await readLogs(),
  );
  await writeCache(TASKS_KEY, mergedTasks);
  await writeCache(LOGS_KEY, mergedLogs);
  return { synced: true };
}

function mergeById<T extends { id: string; _pending?: boolean }>(
  server: T[],
  local: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const r of server) byId.set(r.id, { ...r, _pending: false });
  for (const r of local) {
    if (r._pending && !byId.has(r.id)) byId.set(r.id, r); // keep un-pushed locals
  }
  return [...byId.values()];
}

/** Wipe the local PHI cache. Call on sign-out (privacy rule #3). */
export async function purgeLocalCache(): Promise<void> {
  await clearCache([TASKS_KEY, LOGS_KEY]);
}
