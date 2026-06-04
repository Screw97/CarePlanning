// Pure, safety-critical tracker logic — no I/O, exhaustively unit-tested.
// Decides how meds group/show per day, day progress, and symptom severity
// incl. the RED-FLAG that tells the carer to stop a medicine and call the
// doctor. Wrong output here = a missed dose or a missed warning, so the rules
// are explicit and fail safe.

import {
  Medication,
  MedicationLog,
  MedBlock,
  MedStatus,
  SymptomDef,
} from './trackerTypes';

export const MED_BLOCK_ORDER: MedBlock[] = ['morning', 'lunch', 'dinner', 'as_needed'];

export const MED_BLOCK_LABEL: Record<MedBlock, string> = {
  morning: 'Morning — with breakfast',
  lunch: 'Lunch — with food',
  dinner: 'Dinner / main meal — with food',
  as_needed: 'As needed',
};

export interface MedItem {
  med: Medication;
  status: MedStatus | null;
}
export interface MedGroup {
  block: MedBlock;
  label: string;
  items: MedItem[];
}

/** The active (non-voided) log for a medication on a given day, if any. */
export function activeMedLog(
  logs: MedicationLog[],
  medicationId: string,
  dateStr: string,
): MedicationLog | null {
  return (
    logs.find(
      (l) =>
        l.medication_id === medicationId &&
        l.scheduled_date === dateStr &&
        l.voided_at == null,
    ) ?? null
  );
}

/** Group active meds by block (in fixed order), each paired with its status. */
export function groupMedications(
  meds: Medication[],
  logs: MedicationLog[],
  dateStr: string,
): MedGroup[] {
  const active = meds
    .filter((m) => m.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return MED_BLOCK_ORDER.map((block) => ({
    block,
    label: MED_BLOCK_LABEL[block],
    items: active
      .filter((m) => m.block === block)
      .map((med) => ({ med, status: activeMedLog(logs, med.id, dateStr)?.status ?? null })),
  })).filter((g) => g.items.length > 0);
}

/** Progress counts SCHEDULED meds only (as-needed never counts toward "done"
 *  and is never "missed"). */
export function medProgress(groups: MedGroup[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const g of groups) {
    if (g.block === 'as_needed') continue;
    for (const it of g.items) {
      total++;
      if (it.status === 'taken') done++;
    }
  }
  return { done, total };
}

export type Severity = 'none' | 'ok' | 'warn' | 'red';

/** Severity of a selected symptom value. Red beats warn beats ok; an
 *  unanswered question is 'none'. Thresholds that aren't set don't apply. */
export function symptomSeverity(def: SymptomDef, value: number | null): Severity {
  if (value == null) return 'none';
  if (def.red_from != null && value >= def.red_from) return 'red';
  if (def.warn_from != null && value >= def.warn_from) return 'warn';
  if (def.ok_from != null && value >= def.ok_from) return 'ok';
  return 'none';
}

/** The red-flag message to surface (e.g. "stop the Neomycin and call the
 *  doctor"), or null when the answer isn't in the red zone. */
export function redFlagMessage(def: SymptomDef, value: number | null): string | null {
  if (value != null && def.red_from != null && value >= def.red_from) {
    return def.red_msg ?? null;
  }
  return null;
}
