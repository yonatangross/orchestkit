# Progressive Output and Partial Results (fallback modes)

Applies when Phase 3 runs in the Agent tool or Agent Teams fallback. On the default Workflow path, `workflows/review-fanout.js` returns every reviewer's result in one object, and a reviewer that fails is reported as `NOT-REVIEWED` in `reviewers`.

## Progressive Output (CC 2.1.76+)

Output each agent's findings **as they complete**. Don't batch until synthesis.

> **Focus mode (CC 2.1.101):** In focus mode, the user only sees your final message. Include the full review verdict, all findings by severity, and the approve/request-changes recommendation. Don't assume they saw per-agent outputs.

- **Security findings** → show blockers and critical issues first
- **Code quality** → show pattern violations, complexity hotspots
- **Test coverage gaps** → show missing test cases

This lets the PR author start addressing blocking issues while remaining agents are still analyzing. Only the final synthesis (Phase 5) requires all agents to have completed.

**Partial results (CC 2.1.98):** If a review agent fails mid-analysis, synthesize partial findings:

```python
for agent_result in review_results:
    if "[PARTIAL RESULT]" in agent_result.output:
        # A security agent that found 2 issues before crashing > no security review
        findings.extend(parse_findings(agent_result.output))
        findings[-1]["partial"] = True  # Flag in synthesis
        # Do NOT re-spawn: partial findings are still valuable
```

A `maxTurns` stop is also partial since CC 2.1.246 (summary: "stopped at its N-turn limit (partial result; continue it with SendMessage to the task-id)"); continue that agent with `SendMessage` instead of re-spawning it.

**Monitor for CI streaming (CC 2.1.98):** Stream CI check output in Phase 4:

```python
Bash(command="gh pr checks $PR_NUMBER --watch 2>&1", run_in_background=true)
Monitor(pid=ci_watch_id)  # Each status change → notification
```
