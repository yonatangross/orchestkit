---
title: Checkpoint Mini-Commit
impact: HIGH
impactDescription: "Without periodic mini-commits, a rate-limit hit leaves all pipeline work uncommitted — git history has no recovery point"
tags: checkpoint, git, commit, cadence
---

## Checkpoint Mini-Commit

Every 3 completed phases, create a mini-commit that captures work in progress. This provides a git recovery point even if later phases fail.

**When to commit:**

```
Phase 1 done → state write only
Phase 2 done → state write only
Phase 3 done → state write + mini-commit  ← checkpoint
Phase 4 done → state write only
Phase 5 done → state write only
Phase 6 done → state write + mini-commit  ← checkpoint
```

**Mini-commit format:**
```bash
git add -A
git commit -m "checkpoint: phases N-M complete

Completed:
- Phase N: <name>
- Phase N+1: <name>
- Phase N+2: <name>

Remaining: <count> phases

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Incorrect — one giant commit at the end:**
```bash
# Do 12 phases of work...
git add -A
git commit -m "feat: complete all pipeline work"
# If phases 10-12 fail, no checkpoint exists
```

**Correct — checkpoint every 3 phases:**
```bash
# After phase 3
git commit -m "checkpoint: phases 1-3 complete\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
# After phase 6
git commit -m "checkpoint: phases 4-6 complete\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
```

**Key rules:**
- Count is based on completed phases in the current pipeline run, not total commits
- Stage everything (`git add -A`) — the checkpoint captures full work-in-progress state
- Never skip a checkpoint because "almost done" — rate limits don't warn first
- Include Co-Authored-By attribution in every checkpoint commit
