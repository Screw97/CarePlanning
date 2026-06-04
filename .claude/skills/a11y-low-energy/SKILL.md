---
name: a11y-low-energy
description: Use to audit a screen or component for accessibility, low-energy/low-stimulation usability, and emergency reachability. Trigger when reviewing UI, before shipping a screen, or when the owner mentions fatigue, pain, low vision, or "hard to use".
---

# Accessibility & low-energy audit

The owner may use this fatigued, in pain, one-handed, or low-vision. Audit against each.

## Accessibility (WCAG AA baseline)
- [ ] Every interactive element has `accessibilityLabel` + correct `accessibilityRole`.
- [ ] Touch targets ≥ 44×44pt with adequate spacing.
- [ ] Text contrast ≥ AA; check both light and dark.
- [ ] Respects Dynamic Type / font scaling — no fixed tiny or clipped text.
- [ ] State changes (loading, error, success) are announced / perceivable, not color-only.
- [ ] Logical focus order; screen-reader path reaches everything important.

## Low-energy / low-stimulation
- [ ] A true low-brightness / low-stimulation theme is supported and not punished.
- [ ] Honors "reduce motion" — animations gated on `AccessibilityInfo.isReduceMotionEnabled`.
- [ ] No flashing, no auto-playing motion, no surprise modals.
- [ ] Generous spacing, large readable defaults, minimal cognitive load per screen.

## Reachability (critical for care use)
- [ ] Today's meds/tasks reachable in ≤ 2 taps from launch.
- [ ] Emergency info (meds, allergies, conditions, contacts) renders from cache with the
      network off and without login friction for read.
- [ ] Destructive actions need confirmation; primary safe action is the easiest to hit.

## Output
List ✅ / ⚠️ / ❌ per item with the specific fix. Flag any emergency-reachability ❌ as high priority.
