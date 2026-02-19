---
title: Phase Ordering Priority
impact: CRITICAL
impactDescription: "Ordering file-heavy phases first means GitHub issues/commits—the highest-value, hardest-to-reconstruct work—are lost when a rate limit hits"
tags: ordering, priority, rate-limit, phases
---

## Phase Ordering Priority

When a rate limit hits, work done in the current session is lost. Order phases so the hardest-to-reconstruct work finishes first.

**Priority order (highest → lowest value if lost):**

1. GitHub issue creation (lost = no tracking, no auto-close links)
2. Git commits with code changes (lost = untracked work)
3. File creation / large edits (recoverable from context)
4. Documentation / reference updates (lowest risk to lose last)

**Incorrect — file-heavy phases scheduled before issue creation:**
```json
{
  "phases": [
    { "id": "write-files", "name": "Write all source files" },
    { "id": "create-issues", "name": "Create GitHub issues" },
    { "id": "commit", "name": "Commit changes" }
  ]
}
```

**Correct — issues and commits scheduled first:**
```json
{
  "phases": [
    { "id": "create-issues", "name": "Create GitHub issues" },
    { "id": "commit-scaffold", "name": "Commit initial scaffold" },
    { "id": "write-files", "name": "Write all source files" },
    { "id": "commit-final", "name": "Commit completed work" }
  ]
}
```

**Key rules:**
- Always schedule `gh issue create` calls in the first phase
- Commits with `Closes #N` references come second — they link issues
- Independent phases with no shared dependencies run in parallel via Task sub-agents
- Never defer issue creation to "after the code is done"
