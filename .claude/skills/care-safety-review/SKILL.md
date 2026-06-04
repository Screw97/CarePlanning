---
name: care-safety-review
description: Use before merging any change to medication logic, dose calculations, schedules/reminders, dose or task logging, or health-record deletion. Reviews for safety-critical correctness and privacy. Trigger on anything touching meds, doses, scheduling, or care-task state.
---

# Care safety review

Treat this code like it can cause a missed or wrong dose. Review against each item.

## Medication & dosing
- [ ] Doses stored/displayed exactly as entered — no silent rounding, no unit conversion.
- [ ] Units are explicit and never inferred (mg vs ml vs tablets).
- [ ] No floating-point drift in dose math; use integers/decimals deliberately.

## Scheduling & reminders
- [ ] Timezone is explicit and stored; no `new Date()` guesswork for "when is the dose due".
- [ ] DST / date-boundary cases considered for daily/interval schedules.
- [ ] A failed/blocked notification surfaces visibly — never fails silently.

## Logging & history (audit integrity)
- [ ] Taken/skipped/missed states are not auto-mutated by sync conflicts without surfacing.
- [ ] Historical dose/task records are soft-deleted/voided, not hard-deleted (or owner confirmed).
- [ ] Edits to a past log preserve an audit trail (who/when/old value) where feasible.

## Privacy
- [ ] No PHI in logs, errors, or analytics from this path.
- [ ] No real data added to tests/fixtures.

## Output
List findings as ✅ / ⚠️ / ❌. Any ❌ on dosing, scheduling, or history is a **merge blocker** —
raise it as a Decision Card and stop, don't auto-"fix" by guessing intended behavior.
