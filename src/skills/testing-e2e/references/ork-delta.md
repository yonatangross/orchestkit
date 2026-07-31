# OrchestKit delta for Playwright E2E

House rules that are NOT in the vendor docs. Everything else about Playwright,
axe-core and jest-axe is upstream: see the "Upstream coverage" table in `SKILL.md`.

Provenance lines below name retired files. Those files were deleted in this change and
are recorded only to say where a rule came from; they are not live pointers.

## Pin accessibility unit tests to jest-axe, never vitest-axe

Why: the house a11y stack standardised on `jest-axe` because `vitest-axe` is frozen
at its first release while `jest-axe` keeps shipping (npm registry, checked
2026-07-31: `vitest-axe` 0.1.0, `jest-axe` 11.0.0). `jest-axe` works under Vitest via
`expect.extend(toHaveNoViolations)`, so the Vitest-named package buys nothing.
Distilled from the retired references/a11y-testing-tools.md; no traced incident.
Upstream: https://github.com/NickColley/jest-axe

## Initialize Playwright agents from the CLI, never from playwright.config.ts

Why: there is no `aiAgents` key (or any equivalent) in Playwright `TestOptions`. An
invented config key type-errors at best and silently does nothing at worst, and the
retired reference carried this correction explicitly because the plausible-looking
config block is a recurring model invention. Agents are CLI-only:
`npx playwright init-agents --loop=claude`.
Distilled from the retired references/playwright-1.59-api.md; no traced incident.
Upstream: https://playwright.dev/docs/test-agents

## Generate screenshot baselines in CI only

Why: a baseline captured on a macOS laptop fails on Linux CI from font hinting and
anti-aliasing alone, so a locally-written baseline is a guaranteed red PR. The house
default is `updateSnapshots: process.env.CI ? 'missing' : 'none'`, with refreshes done
by a manual `workflow_dispatch` job that commits the new PNGs, never by a local run.
Distilled from the retired references/visual-regression.md; no traced incident.
Upstream: https://playwright.dev/docs/api/class-testconfig

## Snapshot exactly one browser project

Why: the same rendering drift exists across engines, so cross-browser screenshots
produce three baselines that disagree for reasons no reviewer can act on. Chromium
owns the visual baselines; every other project keeps running the functional suite with
`ignoreSnapshots: true`.
Distilled from the retired references/visual-regression.md; no traced incident.
Upstream: https://playwright.dev/docs/api/class-testproject

## Mask the unstable region instead of raising the global diff threshold

Why: bumping `maxDiffPixelRatio` to silence one clock or avatar blinds every other
screenshot in the suite, which is how a real regression ships green. Scope the
tolerance to the element that actually moves: `mask`, `stylePath`, and
`animations: 'disabled'`.
Distilled from the retired references/visual-regression.md; no traced incident.
Upstream: https://playwright.dev/docs/api/class-pageassertions
