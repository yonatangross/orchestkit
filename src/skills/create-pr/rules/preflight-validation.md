---
title: "Pre-Flight Validation"
impact: "CRITICAL"
impactDescription: "Skipping pre-flight creates PRs that fail CI and waste reviewer time"
tags: [pr, validation, preflight, ci]
---

## Pre-Flight Validation

Every PR creation must pass these checks before the `gh pr create` command runs.

**Checklist (all must pass):**

1. **Branch check** — Not on `main` or `dev`. Create a feature branch first.
2. **Clean working tree** — No uncommitted changes (`git status --porcelain` is empty). Commit or stash first.
3. **Remote push** — Branch exists on remote. Push with `-u` if needed.
4. **Tests pass** — Run the project's test suite. At minimum: unit tests with `-x` (fail fast).
5. **Lint clean** — No linting errors from the project's linter (ruff, eslint, etc.).
6. **Type check clean** — No type errors (mypy, tsc, pyright) if project uses type checking.
7. **No secrets** — No API keys, tokens, or credentials in the diff. Check with `git diff --cached` patterns.
8. **Visual-style clean** — PR title + body pass the Visual-Style lint (the CI check that has bitten non-bot PRs repeatedly). The body must use only the 12-glyph vocabulary; the classic trap is `✓`/`✗` (U+2713/U+2717) — use the white-check / red-X instead. Run the SAME engine CI runs, against your drafted title + body file, BEFORE `gh pr create`:
   ```bash
   bin/check-pr-visual-style.sh --title "<your title>" --body-file /tmp/pr-body.md
   ```
   Clean here == clean in CI (both call `bin/validate-visual-style.py`), so it kills the red-CI round-trip.

**Key rules:**
- Run checks locally, not via agents (faster, no token cost)
- Fail fast: stop at first blocking error
- For "Quick" PR type, skip validation steps 4-7 but always check 1-3
- Report failures clearly with actionable fix instructions

**Incorrect:**
```bash
# Skip checks, create PR directly from main with uncommitted changes
gh pr create --title "fix: login bug"
# Result: PR from main branch, dirty working tree, CI fails
```

**Correct:**
```bash
# Run full preflight before creating PR
git status --porcelain                    # Must be empty
git branch --show-current                 # Must not be main/dev
npm run lint && npm run typecheck         # Must pass
npm test -- --bail                        # Must pass
bin/check-pr-visual-style.sh --title "fix: login bug" --body-file /tmp/pr-body.md  # Must pass
gh pr create --title "fix: login bug"     # Now safe to create
```

**Validation commands (adapt to project):**
```bash
# Universal checks
git status --porcelain              # Must be empty
git branch --show-current           # Must not be main/dev

# Python projects
ruff format --check . && ruff check .
pytest tests/unit/ -v --tb=short -x

# Node projects
npm run lint && npm run typecheck
npm test -- --bail
```

**Blocking vs warning:**
- Steps 1-3: **BLOCK** — Cannot proceed
- Steps 4-6: **BLOCK** for Feature/Bug fix, **WARN** for Quick
- Step 7 (secrets): **ALWAYS BLOCK** — No exceptions
- Step 8 (visual-style): **ALWAYS BLOCK** — it is a hard CI gate (bypass only via the `visual-style-override` label, used sparingly)
