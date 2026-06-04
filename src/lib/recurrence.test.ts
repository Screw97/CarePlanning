import { CareTask, CareTaskLog } from './types';
import {
  isTaskDueOnDate,
  tasksDueOnDate,
  buildChecklist,
  activeLogFor,
} from './recurrence';

// 2026-06-04 is a Thursday (ISO weekday 4). Used throughout.
const THURSDAY = '2026-06-04';
const FRIDAY = '2026-06-05';

function task(p: Partial<CareTask>): CareTask {
  return {
    id: 't',
    user_id: 'u',
    title: 'Task',
    category: 'other',
    recurrence_type: 'daily',
    due_date: null,
    weekdays: null,
    time_of_day: null,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}

describe('isTaskDueOnDate', () => {
  it('daily: due every day on/after creation, never before', () => {
    const t = task({ recurrence_type: 'daily', created_at: '2026-06-04T08:00:00.000Z' });
    expect(isTaskDueOnDate(t, THURSDAY)).toBe(true);
    expect(isTaskDueOnDate(t, FRIDAY)).toBe(true);
    expect(isTaskDueOnDate(t, '2026-06-03')).toBe(false); // before creation
  });

  it('once: due only on its exact due_date', () => {
    const t = task({ recurrence_type: 'once', due_date: THURSDAY });
    expect(isTaskDueOnDate(t, THURSDAY)).toBe(true);
    expect(isTaskDueOnDate(t, FRIDAY)).toBe(false);
  });

  it('weekly: due only on listed ISO weekdays', () => {
    const t = task({ recurrence_type: 'weekly', weekdays: [4] }); // Thursdays
    expect(isTaskDueOnDate(t, THURSDAY)).toBe(true);
    expect(isTaskDueOnDate(t, FRIDAY)).toBe(false);
  });

  it('archived: drops off from the archive day forward, kept before', () => {
    const t = task({ recurrence_type: 'daily', archived_at: '2026-06-04T10:00:00.000Z' });
    expect(isTaskDueOnDate(t, '2026-06-03')).toBe(true);
    expect(isTaskDueOnDate(t, THURSDAY)).toBe(false);
    expect(isTaskDueOnDate(t, FRIDAY)).toBe(false);
  });

  it('unknown recurrence fails closed (no invented occurrence)', () => {
    const t = task({ recurrence_type: 'monthly' as unknown as CareTask['recurrence_type'] });
    expect(isTaskDueOnDate(t, THURSDAY)).toBe(false);
  });
});

describe('tasksDueOnDate ordering', () => {
  it('orders by time of day, then sort_order, then title', () => {
    const dinner = task({ id: 'd', title: 'Dinner', time_of_day: 'evening', sort_order: 60 });
    const breakfast = task({ id: 'b', title: 'Breakfast', time_of_day: 'morning', sort_order: 20 });
    const lunch = task({ id: 'l', title: 'Lunch', time_of_day: 'noon', sort_order: 40 });
    const order = tasksDueOnDate([dinner, lunch, breakfast], THURSDAY).map((t) => t.id);
    expect(order).toEqual(['b', 'l', 'd']);
  });
});

describe('activeLogFor / buildChecklist', () => {
  function log(p: Partial<CareTaskLog>): CareTaskLog {
    return {
      id: 'l',
      user_id: 'u',
      task_id: 't',
      scheduled_date: THURSDAY,
      status: 'done',
      note: null,
      completed_at: '2026-06-04T09:00:00.000Z',
      voided_at: null,
      ...p,
    };
  }

  it('ignores voided logs', () => {
    const logs = [log({ id: 'a', voided_at: '2026-06-04T10:00:00.000Z' })];
    expect(activeLogFor(logs, 't', THURSDAY)).toBeNull();
  });

  it('pairs each due task with its active log', () => {
    const t = task({ id: 't', recurrence_type: 'daily' });
    const logs = [log({ id: 'a', task_id: 't', status: 'skipped' })];
    const checklist = buildChecklist([t], logs, THURSDAY);
    expect(checklist).toHaveLength(1);
    expect(checklist[0].status).toBe('skipped');
  });

  it('leaves status null when there is no log', () => {
    const t = task({ id: 't', recurrence_type: 'daily' });
    const checklist = buildChecklist([t], [], THURSDAY);
    expect(checklist[0].status).toBeNull();
  });
});
