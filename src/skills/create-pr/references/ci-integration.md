---
title: CI Integration Patterns
version: 1.0.0
---

# CI Integration Patterns

## Auto PR Linking (CC 2.1.27+)

Sessions created via `gh pr create` are automatically linked to the PR. Resume linked sessions with:

```bash
claude --from-pr 123          # Resume session linked to PR #123
claude --from-pr https://github.com/org/repo/pull/123
```

PR context (diff, comments, review status) is available when resuming.

## Task Metrics (CC 2.1.30+)

Task tool results include `token_count`, `tool_uses`, and `duration_ms`. Report validation efficiency in PR comments:

```markdown
## Pre-PR Validation Metrics
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| security-auditor | 520 | 10 | 15s |
| test-generator | 380 | 6 | 12s |
| code-quality-reviewer | 450 | 8 | 10s |

**Total:** 1,350 tokens in 37s
```

## Session Resume Hints (CC 2.1.31+)

Before ending PR creation sessions, store context for future sessions:

```bash
/ork:remember PR #123 created: [brief description], pending review from [team]
```

## Post-Creation Verification

After `gh pr create`, always verify:

```bash
PR_URL=$(gh pr view --json url -q .url)
echo "PR created: $PR_URL"

# Check CI status (wait a moment for checks to start)
gh pr checks
```

## Issue Auto-Close

Using `Closes #N` in the PR body auto-closes the issue when the PR merges to the default branch. This is handled by GitHub, not CI — but only works when merging to `main`/`dev` (the repository's default branch).
