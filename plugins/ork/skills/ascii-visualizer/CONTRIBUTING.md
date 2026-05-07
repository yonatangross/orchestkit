# Contributing to ascii-visualizer

Governance for the ASCII design system: char-sets, primitives, status glyph
vocabulary, lint rules, render patterns. See `designs/ascii-design-system.md`
for the full design.

## Principles (locked)

- **Anti-slop:** encode information into structure, not decoration. Every
  glyph in `primitives.json` must answer "what does this communicate?" —
  decoration alone is grounds for rejection.
- **Two tiers, not three:** `primitives.json` (raw Unicode, frozen) →
  `tokens.json` (semantic char-sets). No component-tier tokens.
- **Intent naming:** char-set names describe USE, not APPEARANCE
  (`default`/`emphasis`/`title`/`soft`/`portable` — not `light`/`heavy`).
- **Closed-set vocab:** the status glyph vocabulary in
  `rules/status-glyph-vocabulary.md` is closed at v1. Additions are MINOR
  bumps via the process below.

## Adding a glyph (status vocabulary or primitive)

1. Open an issue tagged `glyph-proposal` with:
   - The glyph itself (and its Unicode code point, e.g. `U+2713`)
   - Proposed semantic (`status.check` → "passed / completed")
   - Collision check vs the existing 11 status glyphs (or 80+ primitives)
   - Terminal-render screenshot (iTerm + VS Code minimum)
   - One real OrchestKit usage that needs it
2. ascii-visualizer skill owner reviews; one design-system-architect
   reviewer signs off; one Phase-1 user must voice support.
3. Append to `primitives.json` (never reorder existing entries).
4. If status glyph: append to `rules/status-glyph-vocabulary.md`.
5. Bump `tokens.json` version `1.x.y` → `1.x+1.0` (MINOR; additive).
6. Add a snapshot golden under `tests/fixtures/ascii/golden/`.
7. CHANGELOG entry under `### Design tokens`.

Removing or repurposing a glyph = MAJOR bump; see Versioning below.

## Adding a char-set

Threshold is high. A new set must express a distinct **intent**, not a
new visual style. Reviewers will reject sets that overlap the existing five.

1. Same issue process as above, tagged `char-set-proposal`.
2. State the intent in 1 sentence; map it to scenarios where existing sets
   are wrong (not just suboptimal).
3. Update `primitives.json` (if new code points needed) AND `tokens.json`
   (the semantic alias).
4. Update `tokens.schema.json` `properties.sets.required` to include the
   new name.
5. Run `scripts/validate-tokens.sh` and `npm run test:ascii`.
6. Bump tokens.json MINOR.

## Adding a render pattern (`scripts/render-ascii.sh`)

1. Implement the pattern function; follow the existing `render_box` style.
2. Add to the `case "$PATTERN"` dispatch.
3. Add 5 goldens (one per char-set) under
   `tests/fixtures/ascii/golden/<pattern>-<set>.golden.txt`.
4. Run `UPDATE_SNAPSHOTS=1 bash tests/unit/test-ascii-snapshots.sh` once,
   review the diff, commit.
5. No version bump needed — patterns are renderer features, not tokens.

## Adding a lint rule (`src/hooks/src/quality/ascii-lint.ts`)

1. Decide classification: NORMATIVE (correctness) vs ADVISORY (taste).
   See `designs/ascii-design-system.md` §A.3.
2. Default severity = `warn` (D3 locked). Only NORMATIVE rules are
   eligible to ratchet to `block` in a future PR after 30d of data.
3. Provide a per-rule disable comment (`// ascii-lint-disable: <name>`).
4. Add a unit test fixture in `tests/fixtures/ascii/` covering both
   pass and fail cases.
5. Update the lint table in `designs/ascii-design-system.md` §A.3.

## Versioning

`tokens.json` carries semver `MAJOR.MINOR.PATCH`:

| change                           | bump  | consumer action       |
|----------------------------------|-------|-----------------------|
| add char-set                     | MINOR | none                  |
| add glyph to vocabulary          | MINOR | none                  |
| widen density override           | MINOR | none                  |
| rename a char-set                | MAJOR | rewrite refs          |
| remove char-set                  | MAJOR | pick replacement      |
| repurpose a glyph semantic       | MAJOR | audit usages          |
| change `tokens.schema.json`      | MAJOR | re-validate           |
| fix typo / clarify description   | PATCH | none                  |

MAJOR releases ship as `vN-rc` (both names accepted, old name warns) for
at least one MINOR cycle before removal.

## Validators

```bash
scripts/validate-tokens.sh                 # schema + primitives membership
bash tests/unit/test-ascii-snapshots.sh    # golden diff (when implemented)
bash tests/unit/test-ascii-tokens.sh       # token-set usage in src/
bash tests/unit/test-ascii-density.sh      # info/decoration ratio
bash tests/unit/test-ascii-i18n.sh         # CJK/Devanagari alignment
```

All four (when shipped in C3) wired into `tests/run-all-tests.sh` under
the unit-test block.
