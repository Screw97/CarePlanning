# CLAUDE.md — CarePlanning

Personal, cloud-backed **care-planning app**. Single primary user (the owner), managing
their own health: medications, care tasks, symptoms, appointments, and evidence for
clinicians/benefits. This is **real health data about a real person**. Treat every
decision as if a mistake could cause a missed dose, a wrong dose, or a privacy breach.

## Stack
- **App:** Expo (React Native) + TypeScript. Expo Router. React Native Reanimated for motion.
- **Backend:** Supabase (Postgres + Auth + RLS + Storage). Access via `@supabase/supabase-js`.
- **State/offline:** local-first cache (e.g. AsyncStorage / SQLite / MMKV) so core care data
  is readable **with no network**. Sync is best-effort, never a precondition for viewing meds.
- **Tests:** Jest + React Native Testing Library. Type-check with `tsc --noEmit`.

## Non-negotiable rules (read before any data work)
See `.claude/rules/health-data-privacy.md` for the full version. The short list:
1. **RLS is deny-by-default.** Every table with user data has RLS enabled and a policy scoped
   to `auth.uid()`. No table ships without a policy. Never use the `service_role` key in the app.
2. **No PHI in logs, errors, analytics, or commits.** No real meds/symptoms/names in seeds,
   fixtures, screenshots, or test data. Use obviously-fake data (`Test Patient`, `Med A`).
3. **Medication & care-task logic is safety-critical.** No silent rounding of doses, no
   timezone guesswork on schedules, no auto-deleting logged doses. When unsure, surface, don't assume.
4. **Offline-first for survival data.** Meds list, doses, emergency info, and care tasks must
   render from local cache with zero network. A failed sync must never blank the screen.
5. **Accessibility & low-energy are requirements, not polish.** The owner may be fatigued,
   in pain, or low-vision when using this. See the a11y rules below.

## Routing — classify the request, then act
- **Quick** — small, obvious, reversible (typo, copy tweak, one-line fix). Just do it.
- **Build** — a feature/screen/migration. Use `/build-feature`. Plan briefly, then implement
  with tests + a11y + offline considered up front.
- **Debug** — something's broken. Reproduce first, find root cause, fix the cause not the symptom.
- **Research** — unknown API/library/best-practice. Gather, cite, summarize, *then* recommend.
- **Schema / RLS / migration** — always `/supabase-rls`. Never edit prod schema casually.

## Decision framework
**Just do it (autonomous)** only when ALL are true:
- Two-way door (trivially reversible)
- Within the current task's approved direction
- No PHI leaves the device/repo, no schema/RLS change, no medication-math change
- No external publish (no push to a service, no real-data export)

**Ask first (Decision Card)** if ANY trigger is hit — RLS/policy change, schema migration,
medication or scheduling logic, deleting/altering historical health records, anything
user-facing in an emergency flow, exporting real data, or genuine uncertainty. Use:

> **[DECISION]** one-line summary · **Rec:** what I'd do · **Risk:** what breaks if wrong · **Reversible?** Yes/No

## Conventions
- TypeScript strict; no `any` on data models. Health records get explicit types.
- Supabase calls go through a typed data layer (`src/lib/`), not scattered in components.
- Never hardcode keys. `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from env only.
- Migrations are SQL files in `supabase/migrations/`, reviewed via `/supabase-rls`, never hand-applied to prod blind.
- Commits: small, descriptive, present tense. Never commit `.env`, dumps, exports, or real data.

## Accessibility & low-energy UI (every screen)
- Every interactive element has an `accessibilityLabel` / `accessibilityRole`; tested with screen reader in mind.
- Targets ≥ 44×44pt. Respect Dynamic Type / font scaling — no fixed tiny fonts.
- WCAG AA contrast minimum. Support dark + a true low-stimulation/low-brightness mode.
- Honor "reduce motion" — gate Reanimated animations on `AccessibilityInfo.isReduceMotionEnabled`.
- Minimize taps to reach today's meds and emergency info. Critical actions reachable in ≤2 taps.
- No flashing, no auto-playing motion, generous spacing, large readable defaults.

## Emergency & offline
- An **Emergency** view (meds, allergies, conditions, contacts) renders from cache, no login wall
  for read where feasible, no spinner-of-death. Build and test it with the network off.

## Skills & hooks
Skills in `.claude/skills/`: `/build-feature`, `/supabase-rls`, `/care-safety-review`,
`/evidence-export`, `/a11y-low-energy`. Safety hooks (`.claude/hooks/`) block destructive
shell commands, secrets, and committing real health data — don't try to work around them.

## Session wrap-up
End with a one-line summary of what changed and what's untested. Note any Decision Cards I
deferred to the owner. Never leave RLS disabled or a migration half-applied.
