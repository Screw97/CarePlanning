import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import CalendarChecklistScreen from './index';

// Make safe-area-context a no-op wrapper (no provider needed in tests).
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

// Drive the screen from a controlled data layer.
jest.mock('@/lib/careTasks', () => {
  const item = {
    task: {
      id: 't1',
      user_id: 'u',
      title: 'Brush teeth',
      category: 'hygiene',
      recurrence_type: 'daily',
      due_date: null,
      weekdays: null,
      time_of_day: 'morning',
      sort_order: 10,
      archived_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    log: null,
    status: null,
  };
  return {
    __item: item,
    isSupabaseConfigured: false,
    loadChecklist: jest.fn(async () => [item]),
    hasAnyTasks: jest.fn(async () => true),
    syncFromServer: jest.fn(async () => ({ synced: false })),
    toggleStatus: jest.fn(async () => ({ synced: false })),
    addTask: jest.fn(async () => item.task),
    addStarterTasks: jest.fn(async () => undefined),
  };
});

import * as careTasks from '@/lib/careTasks';

it('renders due tasks as accessible checkboxes', async () => {
  render(<CalendarChecklistScreen />);
  expect(await screen.findByRole('checkbox', { name: /Brush teeth/i })).toBeTruthy();
});

it('shows the on-device banner when Supabase is not configured', async () => {
  render(<CalendarChecklistScreen />);
  expect(await screen.findByText(/Saved on this device/i)).toBeTruthy();
});

it('toggling a task calls the data layer', async () => {
  render(<CalendarChecklistScreen />);
  const checkbox = await screen.findByRole('checkbox', { name: /Brush teeth/i });
  fireEvent.press(checkbox);
  await waitFor(() => expect(careTasks.toggleStatus).toHaveBeenCalled());
});
