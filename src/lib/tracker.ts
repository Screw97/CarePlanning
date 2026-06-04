// Offline-first data layer for the medication/symptom tracker. The UI talks to
// THIS module, never to Supabase directly. Reads always come from the local
// cache (so the screen renders with no network); writes update the cache first
// and are pushed best-effort when signed in. A failed/absent sync never throws
// and never blanks the screen.
//
// Audit safety: a med check-off is never hard-deleted — "undo" voids the active
// log (sets voided_at), mirroring the DB. Symptom answers and notes are
// editable self-report, so they upsert/delete.

import { supabase, isSupabaseConfigured } from './supabase';
import { getSessionUserId } from './auth';
import { readCache, writeCache, clearCache } from './cache';
import {
  groupMedications,
  medProgress,
  MedGroup,
} from './trackerLogic';
import {
  Medication,
  MedicationLog,
  SymptomDef,
  SymptomLog,
  DayNote,
  ReferenceItem,
  CareContact,
} from './trackerTypes';

export { isSupabaseConfigured };

const K = {
  meds: 'cp.meds.v1',
  symDefs: 'cp.symDefs.v1',
  ref: 'cp.ref.v1',
  contacts: 'cp.contacts.v1',
  medLogs: 'cp.medLogs.v1',
  symLogs: 'cp.symLogs.v1',
  notes: 'cp.notes.v1',
};
const ALL_KEYS = Object.values(K);

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
const nowIso = () => new Date().toISOString();
const read = <T,>(k: string) => readCache<T[]>(k).then((v) => v ?? []);

// ── view models ──────────────────────────────────────────────────────────────
export interface SymptomRow {
  def: SymptomDef;
  value: number | null;
}
export interface DayData {
  medGroups: MedGroup[];
  progress: { done: number; total: number };
  symptoms: SymptomRow[];
  note: string;
}

export async function loadDay(dateStr: string): Promise<DayData> {
  const [meds, medLogs, defs, symLogs, notes] = await Promise.all([
    read<Medication>(K.meds),
    read<MedicationLog>(K.medLogs),
    read<SymptomDef>(K.symDefs),
    read<SymptomLog>(K.symLogs),
    read<DayNote>(K.notes),
  ]);
  const medGroups = groupMedications(meds, medLogs, dateStr);
  const symptoms: SymptomRow[] = defs
    .filter((d) => d.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((def) => ({
      def,
      value:
        symLogs.find((l) => l.symptom_key === def.key && l.log_date === dateStr)?.value ?? null,
    }));
  const note = notes.find((n) => n.log_date === dateStr)?.body ?? '';
  return { medGroups, progress: medProgress(medGroups), symptoms, note };
}

export async function loadReference(): Promise<{
  good: ReferenceItem[];
  avoid: ReferenceItem[];
  watch: ReferenceItem[];
}> {
  const items = (await read<ReferenceItem>(K.ref)).sort((a, b) => a.sort_order - b.sort_order);
  return {
    good: items.filter((i) => i.kind === 'diet_good'),
    avoid: items.filter((i) => i.kind === 'diet_avoid'),
    watch: items.filter((i) => i.kind === 'watch'),
  };
}

export async function loadContacts(): Promise<CareContact[]> {
  return (await read<CareContact>(K.contacts)).sort((a, b) => a.sort_order - b.sort_order);
}

export async function hasAnyData(): Promise<boolean> {
  return (await read<Medication>(K.meds)).length > 0;
}

// ── writes ───────────────────────────────────────────────────────────────────
/** Toggle a medication taken/undone for a day. Undo voids the active log
 *  (audit-safe); a status change voids the old log and writes a new one. */
export async function toggleMedTaken(
  medicationId: string,
  dateStr: string,
): Promise<{ synced: boolean }> {
  const uid = (await getSessionUserId()) ?? 'local';
  const logs = await read<MedicationLog>(K.medLogs);
  const active = logs.find(
    (l) => l.medication_id === medicationId && l.scheduled_date === dateStr && l.voided_at == null,
  );

  let next: MedicationLog[];
  if (active && active.status === 'taken') {
    next = logs.map((l) => (l.id === active.id ? { ...l, voided_at: nowIso(), _pending: true } : l));
  } else {
    const voided = active
      ? logs.map((l) => (l.id === active.id ? { ...l, voided_at: nowIso(), _pending: true } : l))
      : logs;
    next = [
      ...voided,
      {
        id: uuid(),
        user_id: uid,
        medication_id: medicationId,
        scheduled_date: dateStr,
        status: 'taken',
        completed_at: nowIso(),
        voided_at: null,
        _pending: true,
      },
    ];
  }
  await writeCache(K.medLogs, next);
  return { synced: await flushPending() };
}

export async function setSymptom(
  key: string,
  dateStr: string,
  value: number,
): Promise<{ synced: boolean }> {
  const uid = (await getSessionUserId()) ?? 'local';
  const logs = await read<SymptomLog>(K.symLogs);
  const existing = logs.find((l) => l.symptom_key === key && l.log_date === dateStr);
  const next = existing
    ? logs.map((l) =>
        l === existing ? { ...l, value, updated_at: nowIso(), _pending: true } : l,
      )
    : [
        ...logs,
        {
          id: uuid(),
          user_id: uid,
          symptom_key: key,
          log_date: dateStr,
          value,
          updated_at: nowIso(),
          _pending: true,
        },
      ];
  await writeCache(K.symLogs, next);
  return { synced: await flushPending() };
}

/** Deselect a symptom answer. Self-report, so this is a real delete. (Offline
 *  deselects aren't queued; a later pull may restore them — minor, by design.) */
export async function clearSymptom(
  key: string,
  dateStr: string,
): Promise<{ synced: boolean }> {
  const logs = await read<SymptomLog>(K.symLogs);
  const existing = logs.find((l) => l.symptom_key === key && l.log_date === dateStr);
  if (!existing) return { synced: true };
  await writeCache(
    K.symLogs,
    logs.filter((l) => l !== existing),
  );
  const uid = await getSessionUserId();
  if (supabase && uid && !existing._pending) {
    const { error } = await supabase.from('symptom_logs').delete().eq('id', existing.id);
    return { synced: !error };
  }
  return { synced: false };
}

export async function setDayNote(
  dateStr: string,
  body: string,
): Promise<{ synced: boolean }> {
  const uid = (await getSessionUserId()) ?? 'local';
  const notes = await read<DayNote>(K.notes);
  const existing = notes.find((n) => n.log_date === dateStr);
  const next = existing
    ? notes.map((n) => (n === existing ? { ...n, body, updated_at: nowIso(), _pending: true } : n))
    : [
        ...notes,
        { id: uuid(), user_id: uid, log_date: dateStr, body, updated_at: nowIso(), _pending: true },
      ];
  await writeCache(K.notes, next);
  return { synced: await flushPending() };
}

// ── sync ─────────────────────────────────────────────────────────────────────
export async function flushPending(): Promise<boolean> {
  const uid = await getSessionUserId();
  if (!supabase || !uid) return false;
  const a = await pushPending<MedicationLog>('medication_logs', K.medLogs, uid, 'id');
  const b = await pushPending<SymptomLog>('symptom_logs', K.symLogs, uid, 'user_id,symptom_key,log_date');
  const c = await pushPending<DayNote>('day_notes', K.notes, uid, 'user_id,log_date');
  return a && b && c;
}

async function pushPending<T extends { id: string; user_id: string; _pending?: boolean }>(
  table: string,
  key: string,
  uid: string,
  onConflict: string,
): Promise<boolean> {
  const rows = await read<T>(key);
  const pending = rows.filter((r) => r._pending);
  if (pending.length === 0) return true;
  let ok = true;
  let updated = rows;
  for (const r of pending) {
    const { _pending, ...rest } = r;
    const { error } = await supabase!
      .from(table)
      .upsert({ ...rest, user_id: uid } as Record<string, unknown>, { onConflict });
    if (error) {
      ok = false;
      continue;
    }
    updated = updated.map((x) => (x.id === r.id ? { ...x, _pending: false } : x));
  }
  await writeCache(key, updated);
  return ok;
}

/** Pull everything from the server into the cache. Config tables (meds, symptom
 *  defs, reference, contacts) are server-authoritative; logs/notes merge while
 *  preserving un-pushed local edits. No-op without a session. */
export async function syncFromServer(): Promise<{ synced: boolean }> {
  const uid = await getSessionUserId();
  if (!supabase || !uid) return { synced: false };
  await flushPending();

  const [meds, defs, ref, contacts, medLogs, symLogs, notes] = await Promise.all([
    supabase.from('medications').select('*'),
    supabase.from('symptom_defs').select('*'),
    supabase.from('reference_items').select('*'),
    supabase.from('care_contacts').select('*'),
    supabase.from('medication_logs').select('*'),
    supabase.from('symptom_logs').select('*'),
    supabase.from('day_notes').select('*'),
  ]);
  const errored = [meds, defs, ref, contacts, medLogs, symLogs, notes].some((r) => r.error);
  if (errored) return { synced: false };

  await writeCache(K.meds, meds.data ?? []);
  await writeCache(K.symDefs, defs.data ?? []);
  await writeCache(K.ref, ref.data ?? []);
  await writeCache(K.contacts, contacts.data ?? []);
  await writeCache(K.medLogs, mergeById((medLogs.data ?? []) as MedicationLog[], await read<MedicationLog>(K.medLogs)));
  await writeCache(K.symLogs, mergeById((symLogs.data ?? []) as SymptomLog[], await read<SymptomLog>(K.symLogs)));
  await writeCache(K.notes, mergeById((notes.data ?? []) as DayNote[], await read<DayNote>(K.notes)));
  return { synced: true };
}

function mergeById<T extends { id: string; _pending?: boolean }>(server: T[], local: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of server) byId.set(r.id, { ...r, _pending: false });
  for (const r of local) if (r._pending && !byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()];
}

/** Wipe the local cache (call on sign-out). */
export async function purgeTrackerCache(): Promise<void> {
  await clearCache(ALL_KEYS);
}
