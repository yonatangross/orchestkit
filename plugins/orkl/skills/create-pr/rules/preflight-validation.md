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

**Key rules:**
- Run checks locally, not via agents (faster, no token cost)
- Fail fast: stop at first blocking error
- For "Quick" PR type, skip validation steps 4-7 but always check 1-3
- Report failures clearly with actionable fix instructions

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
