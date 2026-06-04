---
name: evidence-export
description: Use when building or reviewing features that export care data — reports for clinicians, benefits/insurance evidence, symptom or medication history (PDF/CSV). Ensures exports are user-initiated, minimal, accurate, and never leak or get committed.
---

# Evidence export

Exports take real PHI out of the app. Build them to be deliberate, minimal, and accurate.

## Rules
- **User-initiated only**, with an explicit confirm step naming what's included and the date range.
- **Minimize fields** to what the recipient needs. Don't dump whole tables by default.
- **Accuracy first:** numbers, dose units, and dates must match source records exactly. No rounding.
- **Destination:** write to a user-chosen / OS share sheet location. Never auto-upload, never commit,
  never write into the repo tree. (Hooks block committing exports.)
- **Provenance:** stamp each export with generation date and the date range covered.
- **No silent inclusion** of fields the user didn't expect (e.g. free-text notes) — list them in the confirm.

## Format guidance
- PDF for human/clinician reading; CSV for structured/benefits intake. Use a vetted library; don't
  reinvent PDF generation. Keep layout high-contrast and legible.
- Redact internal IDs the recipient doesn't need.

## Verify
- [ ] Export matches source data exactly (spot-check totals/units/dates)
- [ ] Confirm step lists every field category included + date range
- [ ] File goes to share/user location, not the repo
- [ ] No PHI logged during generation
