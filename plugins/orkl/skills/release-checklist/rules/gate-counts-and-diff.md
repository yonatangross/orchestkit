---
title: Validate counts and review diffs before release to catch manifest errors and stale edits
impact: HIGH
impactDescription: "Inconsistent counts produce manifest errors at install time; stale or no-op edits in a release commit indicate an unfinished or incorrectly-scoped change"
tags: validate-counts, diff-review, release-gate, hygiene
---

## Count Validation and Diff Review

### Validate Counts

Run `/validate-counts` — verifies that hook/skill/agent counts in manifests match actual files across all three plugins.

- Pass: counts consistent in `ork`, `orkl`, `ork-creative`
- Fail: update manifests or re-run `npm run build`, then retry

### Diff Review

```bash
git diff
```

Scan the full diff before staging anything. Verify:

**Correct:**
```
src/hooks/src/my-hook.ts          ← intended source edit
src/hooks/dist/hooks.mjs          ← regenerated dist
plugins/ork/hooks/dist/hooks.mjs  ← regenerated plugin dist
CHANGELOG.md                      ← new entry
package.json                      ← version bump
CLAUDE.md                         ← version bump
```

**Incorrect:**
```
src/hooks/src/my-hook.ts          ← whitespace-only edit (no-op)
.env                              ← secret accidentally staged
plugins/ork/something.md          ← direct edit to plugins/ (forbidden)
```

**Key rules:**
- No edits directly to `plugins/` — it is generated; changes there indicate an accidental direct edit
- No secrets, credentials, or `.env` files in the diff
- No no-op whitespace-only edits — revert them before committing
- `plugins/` dist files are expected if `npm run build` was run
