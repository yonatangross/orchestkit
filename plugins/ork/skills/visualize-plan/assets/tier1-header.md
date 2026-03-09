# Tier 1 Header Template

Render this **always** as the first output. Fill placeholders from `scripts/detect-plan-context.sh` and `scripts/analyze-impact.sh`.

```
PLAN: {{PLAN_NAME}} ({{ISSUE_REF}})  |  {{PHASE_COUNT}} phases  |  {{FILE_COUNT}} files  |  +{{LINES_ADDED}} -{{LINES_REMOVED}} lines
Risk: {{RISK_LEVEL}}  |  Confidence: {{CONFIDENCE}}  |  Reversible until {{LAST_SAFE_PHASE}}
Branch: {{BRANCH}} -> {{BASE_BRANCH}}

[1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

## Field Definitions

**PLAN_NAME**: Derived from branch name (strip `feat/`, `fix/`, `chore/` prefix, convert hyphens to spaces, title case). If user provided a description, use that instead.

**ISSUE_REF**: `#NNN` if detected from branch name or commits. `--` if no issue linked.

**PHASE_COUNT**: Number of distinct execution phases identified. A phase is a group of changes that must happen together (e.g., "database migration", "API deployment", "frontend update").

**FILE_COUNT**: Total files affected (added + modified + deleted).

**LINES_ADDED / LINES_REMOVED**: From `git diff --stat`.

**RISK_LEVEL**: Highest risk across all phases.
- `LOW` — All changes are additive, fully reversible, well-tested paths
- `MEDIUM` — Some modifications to existing code, partial reversibility
- `HIGH` — Breaking changes, data migrations, or irreversible operations
- `CRITICAL` — Production data at risk, no rollback path for some phases

**CONFIDENCE**: Based on test coverage and code familiarity.
- `HIGH` — >70% of changed code has tests, well-understood modules
- `MEDIUM` — Mixed coverage, some unfamiliar code paths
- `LOW` — <30% coverage, significant unknowns, needs spike

**LAST_SAFE_PHASE**: The last phase name before an irreversible operation. If all phases are reversible, show "all phases".

**BRANCH / BASE_BRANCH**: Current branch and its merge target (usually `main`).
