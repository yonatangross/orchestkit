---
title: Storybook Testing Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Story Authoring (storybook) — HIGH/MEDIUM — 2 rules

Typesafe story creation and automated documentation generation.

- `storybook-csf3-factories.md` — Typesafe CSF3 story factories with `satisfies Meta<typeof Component>`
- `storybook-autodocs.md` — Auto-generated documentation from stories with `autodocs` tag

## 2. Interaction Testing (storybook) — CRITICAL/HIGH — 2 rules

User interaction simulation and story-as-test execution via Vitest.

- `storybook-play-functions.md` — Interaction testing with `play()` functions and `@storybook/test`
- `storybook-vitest-integration.md` — Run stories as Vitest tests via `@storybook/addon-vitest`

## 3. Visual Regression (storybook) — HIGH — 1 rule

Automated visual diff testing with optimized snapshot strategies.

- `storybook-chromatic-turbosnap.md` — TurboSnap reduces Chromatic snapshot usage by 60-90%

## 4. Isolation & Mocking (storybook) — HIGH — 1 rule

Story-level module mocking for deterministic tests.

- `storybook-sb-mock.md` — `sb.mock` for story-level module isolation replaces `vi.mock`

## 5. Accessibility (storybook) — CRITICAL — 1 rule

Automated accessibility validation integrated into the testing pipeline.

- `storybook-a11y-testing.md` — Accessibility testing with `@storybook/addon-a11y` and axe-core in CI
