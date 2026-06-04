// Local-first behavior + audit safety, with Supabase unconfigured (offline).
// AsyncStorage is mocked in jest-setup.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTask,
  setStatus,
  clearStatus,
  loadChecklist,
} from './careTasks';
import { CareTaskLog } from './types';
import { localDateStr } from './dates';

const LOGS_KEY = 'careplanning.logs.v1';
const today = localDateStr();

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function rawLogs(): Promise<CareTaskLog[]> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  return raw ? (JSON.parse(raw) as CareTaskLog[]) : [];
}

it('a new task appears on today\'s checklist', async () => {
  await addTask({ title: 'Drink water', recurrence_type: 'daily' });
  const items = await loadChecklist(today);
  expect(items.map((i) => i.task.title)).toContain('Drink water');
});

it('setStatus is saved locally and reported as not synced when offline', async () => {
  const t = await addTask({ title: 'Brush teeth', recurrence_type: 'daily' });
  const res = await setStatus(t.id, today, 'done');
  expect(res.synced).toBe(false); // no Supabase configured in tests
  const items = await loadChecklist(today);
  expect(items.find((i) => i.task.id === t.id)?.status).toBe('done');
});

it('changing status voids the old log but keeps it for audit', async () => {
  const t = await addTask({ title: 'Lunch', recurrence_type: 'daily' });
  await setStatus(t.id, today, 'done');
  await setStatus(t.id, today, 'skipped');

  const logs = await rawLogs();
  expect(logs).toHaveLength(2); // nothing hard-deleted
  expect(logs.filter((l) => l.voided_at == null)).toHaveLength(1);
  const active = logs.find((l) => l.voided_at == null);
  expect(active?.status).toBe('skipped');

  const items = await loadChecklist(today);
  expect(items.find((i) => i.task.id === t.id)?.status).toBe('skipped');
});

it('clearStatus (undo) voids the active log rather than deleting it', async () => {
  const t = await addTask({ title: 'Bath', recurrence_type: 'daily' });
  await setStatus(t.id, today, 'done');
  await clearStatus(t.id, today);

  const logs = await rawLogs();
  expect(logs).toHaveLength(1);
  expect(logs[0].voided_at).not.toBeNull(); // soft-deleted, still present

  const items = await loadChecklist(today);
  expect(items.find((i) => i.task.id === t.id)?.status).toBeNull();
});

it('re-setting the same status is a no-op (no duplicate logs)', async () => {
  const t = await addTask({ title: 'Dinner', recurrence_type: 'daily' });
  await setStatus(t.id, today, 'done');
  await setStatus(t.id, today, 'done');
  expect(await rawLogs()).toHaveLength(1);
});
