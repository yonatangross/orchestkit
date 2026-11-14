# Accessibility Skill: OrchestKit Delta

Ork-specific floors, scars, and house decisions for `src/skills/accessibility`.
Vendor mechanics (WCAG 2.2 criterion walkthroughs, ARIA Authoring Practices
widget patterns, React Aria hook APIs, generic focus-trap algorithms) are
deliberately not restated here. See the section "Upstream coverage (do not
restate)" in SKILL.md for the first-party source that owns each removed topic.

## Enforce the house cognitive-load ceilings, not just WCAG normative text
Why: House decision carried in this skill since v2.1 and asserted by the test-cases.json case `wcag-cognitive-inclusion` until the 2026-07-31 wrap-plus-delta thinning removed the rule file it traced to (the case was retired with the rule file because `bin/validate-test-case-rules.sh` requires the pair to exist together): at most 1 visible notification at a time (queue the rest, expose the overflow count in an sr-only element), 7 or fewer primary navigation items, paragraphs of 2 to 4 sentences, sentences under 25 words, grade 8 reading level for general content, multi-step wizards with progress indicators instead of long single-page forms, and session-timeout warnings with an extend option. WCAG 2.2 AA has no normative thresholds for any of these; without the numbers, reviews regress to vague "reduce cognitive load" advice. The companion cognitive-science numbers (Miller 4 plus or minus 1, Hick, 400ms Doherty) live in `references/ux-thresholds-quick.md`.
Upstream: W3C "Making Content Usable for People with Cognitive and Learning Disabilities", https://www.w3.org/TR/coga-usable/

## Build overlays as React Aria hooks inside FocusScope, animated with the shared motion presets
Why: House recipe, recorded 2026-07-31 when the aria-overlays rule and the examples restating it were thinned: pair `useModalOverlay` + `useDialog` + `useOverlayTriggerState` with `<FocusScope contain restoreFocus autoFocus>`, and wrap the overlay in `AnimatePresence` using the shared `modalBackdrop` / `modalContent` / `fadeIn` presets from `@/lib/animations` (the animation-motion-design skill's convention), so exit animations and focus restoration do not fight each other. React Aria's docs do not cover the motion/react integration, and hand-rolled `useEffect` + `ref.focus()` modal focus is on this SKILL.md's forbidden list. Working code survives in `scripts/focus-trap-template.tsx` under src/skills/accessibility.
Upstream: https://react-spectrum.adobe.com/react-aria/useModalOverlay.html

## Reach for scripts/focus-trap-template.tsx before re-deriving trap or restoration logic
Why: House decision from the 2026-07-31 thinning of src/skills/accessibility: keep exactly one hand-rolled implementation of the focusable-element selector and the Tab/Shift+Tab wrap plus trigger-restore logic, in `scripts/focus-trap-template.tsx`, for the rare case React Aria is unavailable. Before the thinning the same selector was quadruplicated (the template plus three now-deleted files: focus-examples, focus-patterns, and the focus-trap rule), and copies drift: the modal example in the surviving `examples/wcag-examples.md` still uses a shorter selector (`a[href], button, textarea, input, select`) that misses `[contenteditable]` and `[tabindex]` elements, so its trap skips focusables the canonical selector catches. Use FocusScope first, the template second, and never a fresh derivation.
Upstream: https://react-spectrum.adobe.com/react-aria/FocusScope.html
