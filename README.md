# CarePlanning

A personal, cloud-backed **daily care tracker** for one person: a day-by-day
medication checklist (morning / lunch / dinner / as-needed, with exact doses),
a symptom check-in with safety red-flags, and Diet + "Watch for" reference.

- **App:** Expo (React Native) + TypeScript, Expo Router.
- **Backend:** Supabase (Postgres + Auth + RLS). **Offline-first** — once synced,
  the screens render from a local cache with no network.
- **Single user, one-time sign-in.** No public sign-up; you sign in once to your
  own account and the session persists on the device.

## Run it locally

```bash
npm install
cp .env.example .env     # then fill in your Supabase URL + anon key
npm start                # press i / a / w, or scan the QR with Expo Go
```

## First-time setup (once)

1. **Create a Supabase project** at <https://supabase.com>.
2. **Keys:** Project Settings → API → copy the **Project URL** and **anon** key
   into `.env`. ⚠️ Never use the service_role key in the app.
3. **Create the tables:** SQL Editor → run `supabase/migrations/0001_*.sql`, then
   `0002_*.sql`.
4. **Create your account:** Authentication → Users → **Add user** (email +
   password). This is the single account the app signs in to.
5. **Load your data:** run your private seed SQL (kept out of this repo) in the
   SQL Editor. It attaches everything to your account.
6. **Run the app** and sign in with that email + password.

> Real medical data never lives in this repo. Migrations are structure only; the
> actual meds/doses/contacts come from a private seed you keep yourself.

## Data model (migration 0002)

| Table | Purpose |
| --- | --- |
| `medications` | Schedule items: name, **exact dose text**, block, tag, note, as-needed. |
| `medication_logs` | Audit record of each check-off (`taken`/`skipped`), `voided_at` soft-delete — never hard-deleted. |
| `symptom_defs` | Daily check-in questions, option scales, and red-flag thresholds. |
| `symptom_logs` | One answer per question per day (editable self-report). |
| `day_notes` | Free-text note per day. |
| `reference_items` | Diet "good"/"avoid" lists and "watch for" notes. |
| `care_contacts` | Clinician / emergency contacts. |

All tables have **RLS enabled, deny-by-default**, every policy scoped to
`auth.uid()`. (`0001` adds a separate generic `care_tasks` checklist feature
that isn't wired into the current UI.)

## Safety notes baked in

- **Doses are shown exactly as entered** — no rounding or unit conversion.
- **Progress counts scheduled doses only**; as-needed meds never count and are
  never "missed".
- **Red-flags surface loudly** (e.g. a hearing change → "stop the Neomycin and
  contact the doctor").
- **Undo never deletes history** — it voids the log.

## Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest
```

## Known limitations / next

- **Offline symptom *deselect* isn't queued** — a later server pull may restore
  it (meds, the critical path, are handled audit-safely).
- **Day boundary is device-local** (no stored per-user timezone yet).
- The calendar is day-by-day (prev/next/today); a month grid is a later add.
- Sync is push/pull, not a durable offline write-queue.
