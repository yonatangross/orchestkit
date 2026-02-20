# Agent Teams Assessment Mode

In Agent Teams mode, form an assessment team where dimension assessors cross-validate scores and discuss disagreements:

```python
TeamCreate(team_name="assess-{target-slug}", description="Assess {target}")

# SCOPE CONSTRAINT (injected into every agent prompt):
SCOPE_INSTRUCTIONS = f"""
## Scope Constraint
ONLY read and analyze the following {len(scope_files)} files — do NOT explore beyond this list:
{file_list}

Budget: Use at most 15 tool calls. Read files from the list above, then score.
Do NOT use Glob or Grep to discover additional files.
"""

Task(subagent_type="code-quality-reviewer", name="correctness-assessor",
     team_name="assess-{target-slug}", max_turns=25,
     prompt=f"""Assess CORRECTNESS (0-10) and MAINTAINABILITY (0-10) for: {target}
     {SCOPE_INSTRUCTIONS}
     When you find issues that affect security, message security-assessor.
     When you find issues that affect performance, message perf-assessor.
     Share your scores with all teammates for calibration — if scores diverge
     significantly (>2 points), discuss the disagreement.""")

Task(subagent_type="security-auditor", name="security-assessor",
     team_name="assess-{target-slug}", max_turns=25,
     prompt=f"""Assess SECURITY (0-10) for: {target}
     {SCOPE_INSTRUCTIONS}
     When correctness-assessor flags security-relevant patterns, investigate deeper.
     When you find performance-impacting security measures, message perf-assessor.
     Share your score and flag any cross-dimension trade-offs.""")

Task(subagent_type="python-performance-engineer", name="perf-assessor",  # or frontend-performance-engineer for frontend
     team_name="assess-{target-slug}", max_turns=25,
     prompt=f"""Assess PERFORMANCE (0-10) and SCALABILITY (0-10) for: {target}
     {SCOPE_INSTRUCTIONS}
     When security-assessor flags performance trade-offs, evaluate the impact.
     When you find testability issues (hard-to-benchmark code), message test-assessor.
     Share your scores with reasoning for the composite calculation.""")

Task(subagent_type="test-generator", name="test-assessor",
     team_name="assess-{target-slug}", max_turns=25,
     prompt=f"""Assess TESTABILITY (0-10) for: {target}
     {SCOPE_INSTRUCTIONS}
     Evaluate test coverage, test quality, and ease of testing.
     When other assessors flag dimension-specific concerns, verify test coverage
     for those areas. Share your score and any coverage gaps found.""")
```

**Team teardown** after report compilation:
```python
SendMessage(type="shutdown_request", recipient="correctness-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="security-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="perf-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="test-assessor", content="Assessment complete")
TeamDelete()
```

> **Fallback — Team Formation Failure:** If team formation fails, use standard Phase 2 Task spawns.
>
> **Fallback — Context Exhaustion:** If agents hit "Context limit reached" before returning scores, collect whatever partial results were produced, then score remaining dimensions yourself using the scoped file list from Phase 1.5. Do NOT re-spawn agents — assess the remaining dimensions inline and proceed to Phase 3.
