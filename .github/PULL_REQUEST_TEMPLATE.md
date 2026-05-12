<!--
  Issue close-out hygiene (per CLAUDE.md + #1554):
  If this PR ships work for a tracked issue, include `Closes #NNN`
  on its own line so GitHub auto-closes the issue when the PR merges.
  Multiple issues: one `Closes #N` line per issue, OR
  `Closes #1, #2, #3` on a single line.
-->

## Summary

<!-- What does this PR ship and why? 1-3 bullets. -->

-
-

## Consumer

- [ ] **Every new field/flag/manifest entry in this PR has a documented consumer** (test, hook, skill, or downstream feature). If intentionally emit-only, add the `emit-only` label and link the follow-up issue.

## Test plan

<!-- How did you verify? Check what applies. -->

- [ ] `npm run build` clean
- [ ] `npm run test:skills` (if skills changed)
- [ ] `npm run test:agents` (if agents changed)
- [ ] `npm run test:manifests` (if hooks/skills/agents added or removed)
- [ ] `cd src/hooks && npm test` (if hook code changed — runs the same vitest suite as CI)
- [ ] Smoke tests for any new scripts (see `tests/skills/test-*.sh`)

## Issue close-out

<!-- Replace the placeholder with real issue numbers, or delete the section if this PR doesn't close any. -->

Closes #

## Interactive Playground

<!-- For non-trivial changes: link to docs/<branch-slug>/<name>.html. CI requires this for most PRs. -->

**[Open Playground](https://htmlpreview.github.io/?https://github.com/yonatangross/orchestkit/blob/BRANCH-NAME/docs/BRANCH-DIR/FILE.html)**
