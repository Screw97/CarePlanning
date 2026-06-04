---
name: supabase-rls
description: Use when creating or changing Supabase tables, migrations, or Row Level Security policies, or when reviewing whether health data is properly access-controlled. Trigger on schema changes, new tables, RLS policy work, or "is this table secure".
---

# Supabase RLS & migrations

Health data must be deny-by-default. Follow this every time schema or policy changes.

## Procedure
1. **Locate or create the migration.** SQL lives in `supabase/migrations/`. Never hand-edit prod.
2. **For every new table holding user data, in the SAME migration:**
   - `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`
   - Add a `user_id uuid not null references auth.users(id)` (or equivalent ownership column).
   - Add explicit policies — never rely on "no policy" by accident; write them:
     ```sql
     create policy "<t>_select_own" on <t> for select using (auth.uid() = user_id);
     create policy "<t>_insert_own" on <t> for insert with check (auth.uid() = user_id);
     create policy "<t>_update_own" on <t> for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
     create policy "<t>_delete_own" on <t> for delete using (auth.uid() = user_id);
     ```
   - For audit-style tables (dose logs, completed tasks), consider **omitting delete** or
     replacing it with a `voided_at` soft-delete column. Confirm with the owner.
3. **Storage buckets with PHI:** create as private; access via signed URLs only.
4. **Keys:** confirm only `EXPO_PUBLIC_SUPABASE_ANON_KEY` is used in app code. Flag any
   `service_role` usage as a blocker.

## Audit checklist (run before declaring done)
- [ ] RLS enabled on every user-data table (`select tablename from pg_tables` ↔ policies exist)
- [ ] Every policy scoped to `auth.uid()`, both `using` and `with check` where relevant
- [ ] No public Storage bucket holds PHI
- [ ] No `service_role` key anywhere client-reachable
- [ ] Migration is reversible or its risk is called out
- [ ] Tested: a second user cannot read/write the first user's rows

## Output
Show the migration SQL, the audit checklist result, and a one-line Decision Card if the
change drops/alters an existing column or policy (potential data loss).
