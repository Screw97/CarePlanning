// Generic starter templates offered on first run so the checklist is usable
// immediately. These are ordinary daily-living activities — NOT real health
// data / PHI — so they're safe to ship in the repo.

import { CareTaskCategory, IsoWeekday, RecurrenceType } from './types';

export interface StarterTemplate {
  title: string;
  category: CareTaskCategory;
  recurrence_type: RecurrenceType;
  time_of_day?: string;
  sort_order: number;
  weekdays?: IsoWeekday[];
}

// ISO weekdays: 1=Mon … 6=Sat, 7=Sun.
export const STARTER_TEMPLATES: StarterTemplate[] = [
  { title: 'Brush teeth (morning)', category: 'hygiene', recurrence_type: 'daily', time_of_day: 'morning', sort_order: 10 },
  { title: 'Breakfast', category: 'meals', recurrence_type: 'daily', time_of_day: 'morning', sort_order: 20 },
  { title: 'Lunch', category: 'meals', recurrence_type: 'daily', time_of_day: 'noon', sort_order: 40 },
  { title: 'Dinner', category: 'meals', recurrence_type: 'daily', time_of_day: 'evening', sort_order: 60 },
  { title: 'Bath / shower', category: 'hygiene', recurrence_type: 'daily', time_of_day: 'evening', sort_order: 65 },
  { title: 'Brush teeth (night)', category: 'hygiene', recurrence_type: 'daily', time_of_day: 'evening', sort_order: 70 },
  { title: 'Grocery shopping', category: 'household', recurrence_type: 'weekly', weekdays: [6], sort_order: 30 },
  { title: 'Meal prep', category: 'household', recurrence_type: 'weekly', weekdays: [7], sort_order: 50 },
];
