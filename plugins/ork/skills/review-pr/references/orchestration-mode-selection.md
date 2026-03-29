# Orchestration Mode Selection

Choose **Agent Teams** (mesh -- reviewers cross-reference findings) or **Task tool** (star -- all report to lead):

1. Agent Teams mode (GA since CC 2.1.33) -> **recommended for full review with 6+ agents**
2. Task tool mode -> **for quick/focused review**
3. `ORCHESTKIT_FORCE_TASK_TOOL=1` -> **Task tool** (override)

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Communication | All reviewers report to lead | Reviewers cross-reference findings |
| Security + quality overlap | Lead deduplicates | security-auditor messages code-quality-reviewer directly |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Quick/focused reviews | Full reviews with cross-cutting concerns |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining review.
