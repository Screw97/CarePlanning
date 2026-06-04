import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import Root from './index';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Signed in immediately.
jest.mock('@/lib/auth', () => ({
  subscribeAuth: (cb: (id: string | null) => void) => {
    cb('user-1');
    return () => {};
  },
  signOut: jest.fn(),
}));

jest.mock('@/lib/tracker', () => ({
  isSupabaseConfigured: true,
  syncFromServer: jest.fn(async () => ({ synced: false })),
  toggleMedTaken: jest.fn(async () => ({ synced: false })),
  setSymptom: jest.fn(async () => ({ synced: false })),
  clearSymptom: jest.fn(async () => ({ synced: false })),
  setDayNote: jest.fn(async () => ({ synced: false })),
  loadContacts: jest.fn(async () => []),
  loadReference: jest.fn(async () => ({ good: [], avoid: [], watch: [] })),
  loadDay: jest.fn(async () => ({
    medGroups: [
      {
        block: 'morning',
        label: 'Morning — with breakfast',
        items: [
          {
            med: {
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
            },
            status: null,
          },
        ],
      },
    ],
    progress: { done: 0, total: 1 },
    symptoms: [],
    note: '',
  })),
}));

import * as tracker from '@/lib/tracker';

it('shows a signed-in user their medication as an accessible checkbox', async () => {
  render(<Root />);
  expect(await screen.findByRole('checkbox', { name: /Med A 550mg/i })).toBeTruthy();
});

it('toggling a medication calls the data layer', async () => {
  render(<Root />);
  const cb = await screen.findByRole('checkbox', { name: /Med A 550mg/i });
  fireEvent.press(cb);
  await waitFor(() => expect(tracker.toggleMedTaken).toHaveBeenCalledWith('m1', expect.any(String)));
});
