// Types for the medication/symptom tracker. Mirror migration 0002. Explicit
// types on every health record; dose text is a string stored exactly as entered.

export type MedBlock = 'morning' | 'lunch' | 'dinner' | 'as_needed';
export type MedStatus = 'taken' | 'skipped';

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  block: MedBlock;
  tag: string | null;
  note: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  _pending?: boolean;
}

export interface MedicationLog {
  id: string;
  user_id: string;
  medication_id: string;
  scheduled_date: string;
  status: MedStatus;
  completed_at: string;
  voided_at: string | null;
  _pending?: boolean;
}

export interface SymptomDef {
  id: string;
  user_id: string;
  key: string;
  question: string;
  options: string[];
  ok_from: number | null;
  warn_from: number | null;
  red_from: number | null;
  red_msg: string | null;
  sort_order: number;
  active: boolean;
}

export interface SymptomLog {
  id: string;
  user_id: string;
  symptom_key: string;
  log_date: string;
  value: number;
  updated_at: string;
  _pending?: boolean;
}

export interface DayNote {
  id: string;
  user_id: string;
  log_date: string;
  body: string;
  updated_at: string;
  _pending?: boolean;
}

export interface ReferenceItem {
  id: string;
  user_id: string;
  kind: 'diet_good' | 'diet_avoid' | 'watch';
  title: string;
  body: string | null;
  sort_order: number;
}

export interface CareContact {
  id: string;
  user_id: string;
  label: string;
  name: string | null;
  phone: string | null;
  note: string | null;
  sort_order: number;
}
