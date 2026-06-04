# Health & Care Data — Privacy & Safety Rules

This app holds **PHI (protected health information)** about a real person. These rules are
binding for all code, tests, commits, and exports.

## 1. Row Level Security (Supabase)
- **Deny-by-default.** `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` on every table with user data.
- Every table has explicit policies scoped to the owner, e.g.
  `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)` for insert/update.
- A table with RLS enabled but **no policy** is fully locked — that's the safe default; add policies deliberately.
- The **`service_role` key never ships in the app** and never appears in client code or `EXPO_PUBLIC_*`.
- New migrations that create a table MUST enable RLS in the same migration. No table merges without it.
- Storage buckets holding PHI are **private**, accessed via signed URLs, never public.

## 2. PHI never leaks
- **No PHI in logs.** No `console.log` of meds, doses, symptoms, names, DOB, conditions, or notes.
  Strip PHI from error reports and crash logs before they leave the device.
- **No third-party analytics/ads on PHI screens.** If analytics exist, send event names only, never values.
- **No real data in the repo.** Seeds, fixtures, tests, and screenshots use obviously fake data
  (`Test Patient`, `Med A 10mg`). No real patient identifiers, ever.
- **No committing** `.env`, database dumps, `*.sqlite`, or exported reports. (Enforced by `.gitignore` + hooks.)

## 3. Data at rest & in transit
- All Supabase traffic is HTTPS (default). Never disable cert validation.
- Local cache of PHI uses secure storage where available (Expo SecureStore for tokens/keys;
  encrypted SQLite/MMKV for cached records). Auth tokens live in SecureStore, not AsyncStorage.
- On sign-out, purge the local PHI cache.

## 4. Medication & care-task safety
- Doses are stored and displayed exactly as entered — **no silent rounding or unit conversion.**
- Schedules are timezone-explicit. Don't infer a timezone; store the user's and compute against it.
- A logged dose / completed task is an **audit record**: prefer soft-delete or "mark voided" over hard delete.
- "Taken / skipped / missed" states are never auto-changed by sync conflicts without surfacing it.
- Reminders/notifications failing must fail loud (visible state), never silently.

## 5. Exports & sharing (evidence)
- Real-data exports happen **only on explicit user action**, with a confirm step.
- Export files are written to a user-chosen/share location, never committed, never auto-uploaded.
- Exports state what they contain and the date range; minimize fields to what's needed.

## 6. Auth & access
- Require auth for all non-emergency PHI. Emergency read view may bypass *login friction* for
  pre-cached survival info, but never bypasses RLS for server reads.
- Sessions expire; re-auth on sensitive actions (changing meds, exporting).
