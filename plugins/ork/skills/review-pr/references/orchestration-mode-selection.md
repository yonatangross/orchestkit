# Orchestration Mode Selection

Choose **Agent Teams** (mesh -- reviewers cross-reference findings) or **Task tool** (star -- all report to lead):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` -> **Agent Teams mode**
2. Agent Teams unavailable -> **Task tool mode** (default)
3. Otherwise: Full review with 6+ agents and cross-cutting concerns -> recommend **Agent Teams**; Quick/focused review -> **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Communication | All reviewers report to lead | Reviewers cross-reference findings |
| Security + quality overlap | Lead deduplicates | security-auditor messages code-quality-reviewer directly |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Quick/focused reviews | Full reviews with cross-cutting concerns |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining review.
