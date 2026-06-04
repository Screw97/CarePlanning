-- CarePlanning — medication tracker, symptom check-ins, reference & contacts.
--
-- Single-user app with NO login screen: the app signs in ANONYMOUSLY, which
-- still yields a real auth.uid(), so RLS stays deny-by-default and every row is
-- owner-scoped. No table holds another person's data.
--
-- IMPORTANT: this migration creates STRUCTURE ONLY. No real medication names,
-- doses, names, or contacts live here (privacy rule: no PHI in the repo). The
-- owner's actual plan is loaded separately by a private seed kept out of git.

-- ── medications ──────────────────────────────────────────────────────────────
-- One row per scheduled (or as-needed) medication/supplement. Dose text is
-- stored EXACTLY as entered — never rounded, converted, or paraphrased.
create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null check (length(btrim(name)) > 0), -- e.g. "Med A 550mg"
  dose        text,                                           -- e.g. "1, with food"
  block       text not null default 'as_needed'
                check (block in ('morning','lunch','dinner','as_needed')),
  tag         text,        -- short chip, e.g. "dose to confirm"
  note        text,        -- longer guidance, e.g. binder timing
  sort_order  integer not null default 0,
  active      boolean not null default true,  -- false = retired (history kept)
  created_at  timestamptz not null default now()
);
alter table public.medications enable row level security;

-- ── medication_logs ──────────────────────────────────────────────────────────
-- Audit record of each med check-off per day. Never hard-deleted: "undo" sets
-- voided_at. "missed" is derived (a scheduled past day with no taken log).
create table if not exists public.medication_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  medication_id  uuid not null references public.medications (id) on delete restrict,
  scheduled_date date not null,
  status         text not null check (status in ('taken','skipped')),
  completed_at   timestamptz not null default now(),
  voided_at      timestamptz
);
alter table public.medication_logs enable row level security;
create unique index medication_logs_one_active_per_day
  on public.medication_logs (medication_id, scheduled_date) where voided_at is null;
create index medication_logs_user_date_idx
  on public.medication_logs (user_id, scheduled_date);

-- ── symptom_defs ─────────────────────────────────────────────────────────────
-- Configurable daily check-in questions + the option scale + thresholds that
-- drive colour and the safety RED-FLAG message (e.g. a value that means
-- "stop a medicine and call the doctor").
create table if not exists public.symptom_defs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  key         text not null,                 -- stable id, e.g. 'bowel'
  question    text not null,
  options     text[] not null check (array_length(options, 1) >= 2),
  ok_from     integer,   -- value >= ok_from renders as "good"
  warn_from   integer,   -- value >= warn_from renders as "warning"
  red_from    integer,   -- value >= red_from triggers the red-flag message
  red_msg     text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.symptom_defs enable row level security;

-- ── symptom_logs ─────────────────────────────────────────────────────────────
-- One selected value per question per day. Self-reported and editable, so
-- deselect is a real delete (not an audit record like a med dose).
create table if not exists public.symptom_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symptom_key text not null,
  log_date    date not null,
  value       integer not null,        -- index into symptom_defs.options
  updated_at  timestamptz not null default now(),
  unique (user_id, symptom_key, log_date)
);
alter table public.symptom_logs enable row level security;
create index symptom_logs_user_date_idx on public.symptom_logs (user_id, log_date);

-- ── day_notes ────────────────────────────────────────────────────────────────
create table if not exists public.day_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  log_date   date not null,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
alter table public.day_notes enable row level security;

-- ── reference_items ──────────────────────────────────────────────────────────
-- Static reference content (diet "good"/"avoid" lists, "watch for" notes).
create table if not exists public.reference_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind       text not null check (kind in ('diet_good','diet_avoid','watch')),
  title      text not null,
  body       text,                       -- optional detail (used by 'watch')
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reference_items enable row level security;
create index reference_items_user_kind_idx on public.reference_items (user_id, kind);

-- ── care_contacts ────────────────────────────────────────────────────────────
-- Clinician/emergency contacts for the (offline) emergency view.
create table if not exists public.care_contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  label      text not null,              -- e.g. "Specialist", "GP", "Emergency"
  name       text,
  phone      text,
  note       text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.care_contacts enable row level security;

-- ── policies (deny-by-default; every policy scoped to auth.uid()) ─────────────
-- Config + reference + self-report tables: full owner CRUD.
do $$
declare t text;
begin
  foreach t in array array[
    'medications','symptom_defs','symptom_logs','day_notes',
    'reference_items','care_contacts'
  ] loop
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id);', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id);', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id);', t||'_delete_own', t);
  end loop;
end $$;

-- medication_logs: audit table — select/insert/update only. NO delete policy;
-- removing a dose record means setting voided_at (soft-delete).
create policy "medication_logs_select_own" on public.medication_logs
  for select using (auth.uid() = user_id);
create policy "medication_logs_insert_own" on public.medication_logs
  for insert with check (auth.uid() = user_id);
create policy "medication_logs_update_own" on public.medication_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reversal (dev only): drop the seven tables created above.
