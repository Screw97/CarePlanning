// Offline behaviour + audit safety for the tracker data layer, with Supabase
// unconfigured (no env in tests). AsyncStorage is mocked in jest-setup.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadDay,
  toggleMedTaken,
  setSymptom,
  clearSymptom,
  setDayNote,
} from './tracker';
import { Medication, MedicationLog, SymptomDef } from './trackerTypes';

const DATE = '2026-06-04';

const MED: Medication = {
  id: 'm1',
  user_id: 'u',
  name: 'Med A 550mg',
  dose: 'antibiotic',
  block: 'morning',
  tag: null,
  note: null,
  sort_order: 10,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
const HEARING: SymptomDef = {
  id: 's1',
  user_id: 'u',
  key: 'hearing',
  question: 'Hearing change?',
  options: ['No', 'Yes'],
  ok_from: null,
  warn_from: null,
  red_from: 1,
  red_msg: 'stop the medicine',
  sort_order: 10,
  active: true,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('cp.meds.v1', JSON.stringify([MED]));
  await AsyncStorage.setItem('cp.symDefs.v1', JSON.stringify([HEARING]));
});

async function rawMedLogs(): Promise<MedicationLog[]> {
  const r = await AsyncStorage.getItem('cp.medLogs.v1');
  return r ? (JSON.parse(r) as MedicationLog[]) : [];
}

it('marks a med taken (saved locally, not synced offline) and counts progress', async () => {
  const res = await toggleMedTaken('m1', DATE);
  expect(res.synced).toBe(false);
  const day = await loadDay(DATE);
  expect(day.medGroups[0].items[0].status).toBe('taken');
  expect(day.progress).toEqual({ done: 1, total: 1 });
});

it('undo voids the active log instead of deleting it (audit-safe)', async () => {
  await toggleMedTaken('m1', DATE); // taken
  await toggleMedTaken('m1', DATE); // undo
  const logs = await rawMedLogs();
  expect(logs).toHaveLength(1);
  expect(logs[0].voided_at).not.toBeNull();
  const day = await loadDay(DATE);
  expect(day.medGroups[0].items[0].status).toBeNull();
  expect(day.progress).toEqual({ done: 0, total: 1 });
});

it('records and clears a symptom answer', async () => {
  await setSymptom('hearing', DATE, 1);
  let day = await loadDay(DATE);
  expect(day.symptoms[0].value).toBe(1);

  await clearSymptom('hearing', DATE);
  day = await loadDay(DATE);
  expect(day.symptoms[0].value).toBeNull();
});

it('saves a day note', async () => {
  await setDayNote(DATE, 'Felt tired but ate well');
  const day = await loadDay(DATE);
  expect(day.note).toBe('Felt tired but ate well');
});
