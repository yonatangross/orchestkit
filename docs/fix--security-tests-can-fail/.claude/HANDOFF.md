# Session Handoff

**Branch**: fix/security-tests-can-fail
**When**: 2026-08-05 09:00:09 UTC
**Session**: 06f74fba-7dfc-4587-a4eb-c2882887c75c

## Summary
Open in your browser at **http://localhost:8742/external-bugs.html** — sections expand, charts have table twins.

```
╔═══════════════════════════════════════════════════════════════════╗
║  TWO EXTERNAL REPORTS — BOTH VERIFIED, NEITHER ANSWERED           ║
╚═══════════════════════════════════════════════════════════════════╝
```

**#3083 is worse than the reporter thought.** They said "the variable is never set." The truth:

```
CC's plugins reference documents exactly 3 path substitutions:
    ${CLAUDE_PLUGIN_ROOT}    18 mentions
    ${CLAUDE_PLUGIN_DATA}     8
    ${CLAUDE_PROJECT_DIR}     3
    ${CLAUDE_SKILL_DIR}       0   ← never existed
```

So it isn't a CC regression — it's a placeholder **OrchestKit invented** and then used **442 times across 68 skills**.

## Patterns Noted
- **#3083 is worse than the reporter thought.** They said "the variable is never set." The truth:
- ${CLAUDE_SKILL_DIR}       0   ← never existed
```
- A `PreToolUse` deny aborts *before* execution, so in `cat > f.md <<EOF … && gh issue create …` the heredoc **never ran**.
