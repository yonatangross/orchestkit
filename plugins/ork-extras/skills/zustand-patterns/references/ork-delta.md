# OrchestKit delta for Zustand

Everything else about Zustand lives upstream (see the "Upstream coverage" table in
`SKILL.md`). This file holds only what this repo learned or decided on top of it.

## Do not re-label `zustand/shallow` as a deprecated import path

Why: an earlier revision of `checklists/zustand-checklist.md` told readers that
`zustand/shallow` was deprecated in favour of `zustand/react/shallow`. PR #2143 (merge commit
e4854df83) corrected it as a "Zustand backwards-label fix" during the 2026-05-31 library-currency
audit. Both module paths export `useShallow` in v5; the actual v5 removal is the equality-function
argument to `create()`, which moved to `createWithEqualityFn` in `zustand/traditional`. Repeat the
old label and this skill regresses to the state the audit already fixed.
Upstream: https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md

## Keep the `targets: zustand >= 5.0.0` floor in frontmatter, never in prose

Why: house decision from the repo skill-authoring rule under `.claude` ("a requirement claim goes
in frontmatter, not prose"), and the floor is load-bearing here: every selector instruction in this
skill assumes the v5 surface (the `useShallow` hook, React 18 minimum, no equality-fn overload on
`create()`). A v4 reader following v5 selector guidance gets silent stale renders. Distilled from
the retired core-patterns.md; no traced incident.
Upstream: https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md

## Keep secrets out of persisted state and out of the devtools timeline

Why: house security convention, still enforced by the Security section of
`checklists/zustand-checklist.md` ("No sensitive data in persisted state", "DevTools sanitizes
sensitive fields"). The two worked examples that carried it (a devtools `serialize.replacer`
redacting `password` and `token`, and a form-wizard `partialize` that deliberately omits payment
fields) lived only in the deleted files, so the convention is restated here rather than lost.
Distilled from the retired middleware-composition.md and zustand-examples.md;
no traced incident.
Upstream: https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md

## Type each slice with the store's middleware mutator tuple

Why: `rules/zustand-slice-pattern.md` and the `zustand-slice-pattern` case in `test-cases.json`
both grade on `StateCreator<Store, [['zustand/immer', never]], [], Slice>`, so the mutator tuple is
a graded house convention here, not an optional stylistic choice. Its only worked example lived in
the retired middleware-composition.md, so the pointer is recorded here instead. Distilled from the
retired middleware-composition.md; no traced incident.
Upstream: https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/advanced-typescript.md
