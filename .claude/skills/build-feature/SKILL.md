---
name: build-feature
description: Use when building a new screen, feature, or component in the Expo/React Native app. Ensures accessibility, low-energy UI, offline behavior, types, and tests are designed in from the start rather than bolted on.
---

# Build a feature

Plan briefly, then implement. Bake in the app's requirements up front.

## Before coding — answer these
- **Data:** what tables? Does this need a migration/RLS change? If yes → use `/supabase-rls` first.
- **Offline:** must this render from cache with no network? (Meds, doses, emergency info, tasks = yes.)
  Define the cache read path and the empty/stale state. A failed sync must never blank the screen.
- **Safety:** does this touch medication math, dose logging, or scheduling? If yes → `/care-safety-review` before merge.
- **Accessibility:** what are the labels, roles, target sizes, contrast, reduce-motion behavior?

## Implement
- Types: explicit interfaces for data models, no `any` on health records.
- Data access via the typed layer in `src/lib/`, not raw Supabase calls in components.
- Every interactive element: `accessibilityLabel`, `accessibilityRole`, ≥44×44pt target.
- Gate animations on `AccessibilityInfo.isReduceMotionEnabled`; respect font scaling.
- Loading/error/empty states are explicit and accessible — no infinite spinners on critical data.
- No `console.log` of PHI. Never hardcode keys.

## Verify before done
- [ ] `tsc --noEmit` clean
- [ ] Jest + RNTL test for the core behavior (incl. an offline/cache path if relevant)
- [ ] Walked the screen reader path mentally; labels present
- [ ] Works with network off if it's survival data
- [ ] Summary of what's tested vs. what the owner should manually check
