# CarePlanning

A personal, cloud-backed care-planning app. This first slice is a **calendar-based
daily checklist**: recurring care tasks (brush teeth, meals, bath) and weekly/one-off
to-dos (grocery, meal prep), checked off per day and stored as audit records.

- **App:** Expo (React Native) + TypeScript, Expo Router.
- **Backend:** Supabase (Postgres + Auth + RLS). Offline-first: the checklist renders
  from a local cache with no network.

## Run it locally

```bash
npm install
npm start        # then press i / a / w, or scan the QR with Expo Go
```

The app works immediately in **on-device mode** (tasks saved locally) before any
backend is set up. To enable cloud backup & sync, connect Supabase below.

## Connect the database (Supabase)

You do this once, in your browser + a local `.env`.

1. **Create a project** at <https://supabase.com> → *New project*. Pick a region and
   set a database password.
2. **Get your keys:** Project Settings → **API**. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ Never copy the **service_role** key into this app (see privacy rules).
3. **Create your `.env`:**
   ```bash
   cp .env.example .env
   # paste the two values into .env
   ```
4. **Apply the schema** (`supabase/migrations/0001_init_care_tasks.sql`). Either:
   - **SQL Editor:** open it in the Supabase dashboard, paste the file's contents, Run. **or**
   - **Supabase CLI:**
     ```bash
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
5. **Restart** the dev server (`npm start`) so the new env vars are picked up.

After this, the "Saved on this device" banner clears once you're signed in and data
round-trips to your Supabase project.

## Data model

| Table | Purpose |
| --- | --- |
| `care_tasks` | Task *templates*: title, category, recurrence (`once`/`daily`/`weekly`), `due_date`/`weekdays`, `archived_at` (soft-retire). |
| `care_task_logs` | *Audit records*: one row per check-off per day (`done`/`skipped`), `voided_at` soft-delete. **No hard delete.** |

Both tables have **Row Level Security enabled, deny-by-default**, with every policy
scoped to `auth.uid()`. See `.claude/rules/health-data-privacy.md`.

## Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest
```

## Known limitations (next slices)

- **Auth UI not built yet.** The Supabase client and schema are wired, but cloud
  round-trip needs a signed-in session — a sign-in screen is the immediate next step.
  Until then the app runs fully on-device.
- **Local cache is AsyncStorage (not encrypted at rest).** It currently holds only
  routine task data; moving PHI caches to encrypted storage (MMKV/SQLCipher) is a
  follow-up before storing sensitive health data.
- **Day boundary is device-local.** "Today" uses the device timezone; a stored
  per-user timezone is a follow-up if you switch devices across zones.
- **Calendar is a week strip.** A full month grid is a later enhancement.
- **Sync is push/pull, not a durable offline queue.** Pending writes are retried on
  the next action/sync; conflict handling is minimal and untested against a live DB.
