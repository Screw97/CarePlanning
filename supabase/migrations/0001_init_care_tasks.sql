-- CarePlanning — initial schema: recurring/one-off care tasks + completion logs.
--
-- Health data: RLS is DENY-BY-DEFAULT. Both tables enable RLS in this same
-- migration and every policy is scoped to the owning user via auth.uid().
-- See .claude/rules/health-data-privacy.md.

-- ── care_tasks ───────────────────────────────────────────────────────────────
-- The *template* for a thing to do: a recurring daily/weekly habit (brush teeth,
-- meals) or a one-off dated to-do (a specific grocery run). Completing a task on
-- a given day is recorded separately, in care_task_logs.
create table if not exists public.care_tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade
                    default auth.uid(),
  title           text not null check (length(btrim(title)) > 0),
  category        text not null default 'other'
                    check (category in ('hygiene','meals','household','health','other')),
  recurrence_type text not null
                    check (recurrence_type in ('once','daily','weekly')),
  due_date        date,            -- required when recurrence_type = 'once'
  weekdays        smallint[],      -- ISO weekdays 1..7 (Mon..Sun); used for 'weekly'
  time_of_day     text,            -- optional label, e.g. 'morning' | 'noon' | 'evening'
  sort_order      integer not null default 0,
  archived_at     timestamptz,     -- soft-retire; past history is preserved
  created_at      timestamptz not null default now(),

  -- Shape integrity: the right fields are present for each recurrence type.
  constraint care_tasks_once_has_date
    check (recurrence_type <> 'once' or due_date is not null),
  constraint care_tasks_weekly_has_days
    check (recurrence_type <> 'weekly'
           or (weekdays is not null and array_length(weekdays, 1) >= 1)),
  -- Every weekday entry must be a valid ISO weekday (1..7). `<@` = "contained by".
  constraint care_tasks_weekdays_range
    check (weekdays is null or weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);

alter table public.care_tasks enable row level security;

create policy "care_tasks_select_own" on public.care_tasks
  for select using (auth.uid() = user_id);
create policy "care_tasks_insert_own" on public.care_tasks
  for insert with check (auth.uid() = user_id);
create policy "care_tasks_update_own" on public.care_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "care_tasks_delete_own" on public.care_tasks
  for delete using (auth.uid() = user_id);

create index care_tasks_user_idx on public.care_tasks (user_id);
create index care_tasks_user_active_idx
  on public.care_tasks (user_id) where archived_at is null;

-- ── care_task_logs ───────────────────────────────────────────────────────────
-- An AUDIT record: one row each time a task is marked done/skipped for a day.
-- These are never hard-deleted — "undo" sets voided_at (soft-delete) instead.
-- "missed" is NOT stored; it is derived in the app (a past day with no log).
create table if not exists public.care_task_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade
                   default auth.uid(),
  task_id        uuid not null references public.care_tasks (id) on delete restrict,
  scheduled_date date not null,    -- the device-local calendar day this is for
  status         text not null check (status in ('done','skipped')),
  note           text,
  completed_at   timestamptz not null default now(),
  voided_at      timestamptz       -- soft-delete; audit rows are never removed
);

alter table public.care_task_logs enable row level security;

-- At most one *active* (non-voided) log per task per day.
create unique index care_task_logs_one_active_per_day
  on public.care_task_logs (task_id, scheduled_date)
  where voided_at is null;

create index care_task_logs_user_date_idx
  on public.care_task_logs (user_id, scheduled_date);

create policy "care_task_logs_select_own" on public.care_task_logs
  for select using (auth.uid() = user_id);
create policy "care_task_logs_insert_own" on public.care_task_logs
  for insert with check (auth.uid() = user_id);
create policy "care_task_logs_update_own" on public.care_task_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- NOTE: intentionally NO delete policy. Logs are audit records; deny-by-default
-- means deletes are blocked. To remove a completion, set voided_at via update.

-- Reversal (manual, dev only): the FK above uses ON DELETE RESTRICT so a task
-- cannot be hard-deleted while it still has logs — this protects history.
-- To roll this migration back in a dev project:
--   drop table public.care_task_logs;
--   drop table public.care_tasks;
