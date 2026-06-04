import {
  groupMedications,
  medProgress,
  symptomSeverity,
  redFlagMessage,
  activeMedLog,
} from './trackerLogic';
import { Medication, MedicationLog, SymptomDef } from './trackerTypes';

const DATE = '2026-06-04';

function med(p: Partial<Medication>): Medication {
  return {
    id: 'm',
    user_id: 'u',
    name: 'Med',
    dose: null,
    block: 'morning',
    tag: null,
    note: null,
    sort_order: 0,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}
function log(p: Partial<MedicationLog>): MedicationLog {
  return {
    id: 'l',
    user_id: 'u',
    medication_id: 'm',
    scheduled_date: DATE,
    status: 'taken',
    completed_at: '2026-06-04T08:00:00.000Z',
    voided_at: null,
    ...p,
  };
}
function sym(p: Partial<SymptomDef>): SymptomDef {
  return {
    id: 's',
    user_id: 'u',
    key: 'k',
    question: 'Q',
    options: ['No', 'Yes'],
    ok_from: null,
    warn_from: null,
    red_from: null,
    red_msg: null,
    sort_order: 0,
    active: true,
    ...p,
  };
}

describe('groupMedications', () => {
  it('groups by block in fixed order, sorts within block, attaches status', () => {
    const meds = [
      med({ id: 'd', name: 'Dinner med', block: 'dinner', sort_order: 10 }),
      med({ id: 'm2', name: 'Morning B', block: 'morning', sort_order: 20 }),
      med({ id: 'm1', name: 'Morning A', block: 'morning', sort_order: 10 }),
    ];
    const logs = [log({ id: 'x', medication_id: 'm1', status: 'taken' })];
    const groups = groupMedications(meds, logs, DATE);

    expect(groups.map((g) => g.block)).toEqual(['morning', 'dinner']);
    expect(groups[0].items.map((i) => i.med.id)).toEqual(['m1', 'm2']);
    expect(groups[0].items[0].status).toBe('taken');
    expect(groups[0].items[1].status).toBeNull();
  });

  it('excludes inactive (retired) meds', () => {
    const groups = groupMedications([med({ id: 'r', active: false })], [], DATE);
    expect(groups).toHaveLength(0);
  });

  it('ignores voided logs when attaching status', () => {
    const logs = [log({ id: 'v', voided_at: '2026-06-04T10:00:00.000Z' })];
    expect(activeMedLog(logs, 'm', DATE)).toBeNull();
  });
});

describe('medProgress', () => {
  it('counts scheduled taken / total and ignores as-needed entirely', () => {
    const meds = [
      med({ id: 'a', block: 'morning', sort_order: 1 }),
      med({ id: 'b', block: 'morning', sort_order: 2 }),
      med({ id: 'c', block: 'as_needed', sort_order: 1 }),
    ];
    const logs = [
      log({ id: 'la', medication_id: 'a', status: 'taken' }),
      log({ id: 'lc', medication_id: 'c', status: 'taken' }), // must NOT count
    ];
    expect(medProgress(groupMedications(meds, logs, DATE))).toEqual({ done: 1, total: 2 });
  });
});

describe('symptomSeverity / redFlagMessage', () => {
  it('hearing "Yes" is red and surfaces the stop-medicine message', () => {
    const hearing = sym({
      key: 'hearing',
      red_from: 1,
      red_msg: 'If yes: stop the Neomycin and contact the doctor.',
    });
    expect(symptomSeverity(hearing, 1)).toBe('red');
    expect(redFlagMessage(hearing, 1)).toMatch(/stop the Neomycin/);
    expect(symptomSeverity(hearing, 0)).toBe('none');
    expect(redFlagMessage(hearing, 0)).toBeNull();
  });

  it('severe diarrhoea is a warning', () => {
    const bowel = sym({ key: 'bowel', options: ['None', 'Mild', 'Moderate', 'Severe'], warn_from: 3 });
    expect(symptomSeverity(bowel, 3)).toBe('warn');
    expect(symptomSeverity(bowel, 1)).toBe('none');
  });

  it('"good" energy reads as ok; unanswered is none', () => {
    const energy = sym({ key: 'energy', options: ['Low', 'OK', 'Good'], ok_from: 2 });
    expect(symptomSeverity(energy, 2)).toBe('ok');
    expect(symptomSeverity(energy, null)).toBe('none');
  });
});
