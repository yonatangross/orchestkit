---
title: Commit after each logical milestone — never batch all commits to session end
impact: HIGH
impactDescription: "Rate limits or crashes can kill a session at any time; uncommitted work across multiple phases is irrecoverably lost"
tags: [git, commit, milestone, resilience, rate-limit, session]
---

## Commit After Milestone

Commit working code after each logical unit of work completes. A "logical unit" is a phase that produces working, buildable output. Never accumulate changes across 3+ phases without committing.

### Problem

Claude batches all commits to the end of a session. If the session dies mid-implementation (rate limit, timeout, network), all work is lost. The implement skill runs 10 phases — losing phases 1-7 because the commit was planned for phase 10 is catastrophic.

### Commit Points

| After Phase | Commit? | Why |
|-------------|---------|-----|
| 2. Micro-Plan | Yes | Plan files are valuable context for resume |
| 4. Architecture | Yes | Architecture decisions should survive crashes |
| 5. Implementation | Yes | The bulk of new code — highest risk of loss |
| 6. Integration Verified | Yes | Tests pass, safe checkpoint |
| 8. E2E Verified | Yes | Full verification complete |
| 10. Reflection | Yes | Final commit with docs and lessons |

**Incorrect — one commit after all phases:**
```bash
# Phase 1-2: Discovery + Planning (no commit)
# Phase 4: Architecture decided (no commit)
# Phase 5: 15 files implemented (no commit)
# Phase 6: Integration tests pass (no commit)
# Phase 8: E2E tests pass (no commit)
# --- rate limit hits here ---
# All work lost. No commits exist.
```

**Correct — commit at each milestone:**
```bash
# After Phase 2:
git add .claude/chain/02-plan.json src/docs/plan.md
git commit -m "plan: user auth micro-plan and task breakdown"

# After Phase 5:
git add src/auth/ tests/auth/
git commit -m "feat: implement user auth endpoints and tests"

# After Phase 6:
git add tests/integration/
git commit -m "test: integration verification for user auth"

# After Phase 8:
git add tests/e2e/
git commit -m "test: e2e verification for user auth flow"

# After Phase 10:
git add docs/ .claude/chain/
git commit -m "docs: user auth reflection and lessons learned"
```

### Commit Message Format

```
<type>: <what was completed>

Phase: <N> (<phase-name>)
Tier: <detected-tier>

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Key Rules

- Never go more than 2 phases without a commit
- Commit even if tests are not yet written — partial progress beats total loss
- Use specific `git add <files>` instead of `git add -A` to avoid committing artifacts
- If a phase fails, commit the passing phases first, then address the failure
- Include phase number in commit messages for traceability during resume
- Handoff JSON files (`.claude/chain/*.json`) should be committed alongside code
