# UI Components Skill: OrchestKit Delta

Ork-specific floors, scars, and house decisions for `src/skills/ui-components`.
Vendor mechanics (shadcn/ui install and customization walkthroughs, Radix
primitive API tours, CVA and tailwind-merge tutorials, next-themes setup,
TanStack Table wiring, OKLCH variable listings) are deliberately not restated
here. See the section "Upstream coverage (do not restate)" in SKILL.md for the
first-party source that owns each removed topic.

## Wrap shadcn components; never edit the generated files under components/ui
Why: House convention carried since the v2.0 consolidation of shadcn-patterns
and radix-primitives into src/skills/ui-components (metadata.json, Feb 2026).
Upstream treats generated component files as yours to edit; ork forbids it
(this SKILL.md's FORBIDDEN list) because edited generated files silently lose
every fix the next `npx shadcn@latest add` or `apply <style>` would bring, the
same generated-file-drift class this repo guards against in plugins/. The
convention was asserted by the test-cases.json case `shadcn-customization`
until the 2026-07-31 wrap-plus-delta thinning removed the rule file it traced
to. A working wrapper (loading-state Button extension with ref forwarding)
survives in `scripts/extended-button.tsx`.
Upstream: vercel:shadcn (marketplace skill), https://ui.shadcn.com/docs

## Reach for the scripts/ templates before re-deriving wrapper code
Why: House decision from the 2026-07-31 thinning of src/skills/ui-components.
The five deleted reference files (cva-variant-system, component-extension,
aschild-composition, dialog-modal-patterns, dropdown-menu-patterns) each
restated the same Button, Dialog, and DropdownMenu wrappers that already exist
as runnable templates in this skill: `scripts/cva-component.tsx`,
`scripts/extended-button.tsx`, `scripts/custom-dialog.tsx`,
`scripts/custom-dropdown.tsx`, `scripts/composed-trigger.tsx`, and
`scripts/custom-theme.css`. The prose copies had already diverged from the
templates in class lists and ref handling. Keep exactly one copy: the
templates. Use them first, then the upstream docs; never a fresh derivation.
Upstream: context7 /radix-ui/website and https://ui.shadcn.com/docs/components

## Use AlertDialog, never plain Dialog, for destructive confirmations
Why: House test contract since skill v2.0. The test-cases.json case
`radix-dialog` asserted "Uses AlertDialog (not Dialog) for destructive
confirmations" until the 2026-07-31 thinning removed the case with the rule
file it traced to; the decision now lives in this file and in the SKILL.md
Key Decisions table. The scar behind it: Dialog closes on overlay click, so a
stray click confirms nothing but dismisses the guard, while AlertDialog forces
an explicit Cancel or Action choice.
Upstream: https://www.radix-ui.com/primitives/docs/components/alert-dialog

## Keep the skill eval's graded assertions satisfiable from SKILL.md alone
Why: `tests/evals/skills/ui-components.eval.yaml` grades sessions on CVA
variants, cn() merging, asChild composition, Dialog.Title presence, portal
rendering, data-state styling, and OKLCH theming. The 2026-07-31 thinning
deleted the reference files that restated those topics, but the graded
contract did not move: SKILL.md's Quick Start, Key Decisions, and
Anti-Patterns sections must keep carrying enough signal to pass. If this eval
regresses after a future trim, restore signal to SKILL.md; do not resurrect
vendor tutorials.
Upstream: per-topic first-party sources in the SKILL.md section "Upstream coverage (do not restate)"
