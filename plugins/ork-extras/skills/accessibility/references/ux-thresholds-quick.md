# UI/UX Thresholds — Cognitive Science Quick Reference

## Contrast & Color
- Text on background: >= 4.5:1 (normal), >= 3:1 (large text >= 18pt)
- UI components: >= 3:1 against adjacent colors
- Focus indicators: >= 3:1 contrast, minimum 2px perimeter
- Never use color as sole information carrier

## Touch & Targets
- Touch devices: minimum 44x44px interactive targets
- Desktop: minimum 24x24px, no adjacent target within 24px
- Primary CTA in thumb zone (bottom 2/3 of mobile screen)
- Destructive actions: smaller targets or require confirmation (Fitts's Law)

## Cognitive Load
- Max 5-7 items in any list/menu before grouping (Miller's Law 4±1)
- Decision time doubles per doubling of options (Hick's Law) — use progressive disclosure
- Acknowledge interactions within 400ms (Doherty Threshold)
- Recognition over recall: show options, don't ask users to remember

## Typography & Readability
- Line length: 50-75 characters (use `max-width: 65ch`)
- Line-height: 1.4-1.6x for body text
- No true black (#000) on pure white (#fff) — temper contrast

## Forms & Errors
- Top-aligned labels (optimal for all contexts)
- Error messages: name the field + describe cause + suggest fix
- Blame the system, not the user ("We couldn't process..." not "Invalid input")
- Inline validation on blur, not on keystroke
- Mark optional fields, not required (invert the assumption)

## Dark Pattern Red Flags
Reject these 13 patterns: confirmshaming, roach motel, misdirection, hidden costs,
trick questions, disguised ads, forced continuity, friend spam, privacy zuckering,
bait-and-switch, false urgency, nagging, visual interference.
