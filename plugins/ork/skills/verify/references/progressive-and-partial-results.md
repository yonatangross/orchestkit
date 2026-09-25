# Progressive output and partial results

Moved from SKILL.md Phase 2. With `workflows/verify-dispatch.js` the dispatch returns all verifier results together and marks a dead verifier `NO-RESULT`; this is the procedure when Phase 2 runs in Agent Teams or plain Agent mode.

## Progressive Output (CC 2.1.76+)

Output each agent's score **as soon as it completes** — don't wait for all 6-7 agents.

> **Focus mode (CC 2.1.101):** In focus mode, include the full composite score, all dimension scores, and the verdict in your final message — the user didn't see the incremental outputs.

```
Security:     8.2/10 — No critical vulnerabilities found
Code Quality: 7.5/10 — 3 complexity hotspots identified
[...remaining agents still running...]
```

This gives users real-time visibility into multi-agent verification. If any dimension scores below the `security_minimum` threshold (default 5.0), flag it as a **blocker immediately** — the user can terminate early without waiting for remaining agents.

## Partial results (CC 2.1.98)

**Partial results (CC 2.1.98):** If a verification agent fails mid-analysis, synthesize partial scores rather than re-spawning:

```python
for agent_result in verification_results:
    if "[PARTIAL RESULT]" in agent_result.output: A `maxTurns` stop is also partial since CC 2.1.246 (summary: "stopped at its N-turn limit (partial result; continue it with SendMessage to the task-id)"); continue that agent with `SendMessage` instead of re-spawning it.
        # Extract whatever scores the agent produced before crashing
        partial_score = parse_score(agent_result.output)  # May be incomplete
        scores[agent_result.dimension] = {
            "score": partial_score, "partial": True,
            "note": "Agent crashed — score based on partial analysis"
        }
        # A 4-dimension score is better than no score. Do NOT re-spawn.
```

> **Cross-session replies land in the parent (CC 2.1.248):** when a subagent sends `SendMessage` to another session, the reply is delivered to the parent session's conversation, never to the subagent; a subagent sends and moves on, the parent reads the answer. Cross-session `SendMessage` / `ListAgents` also work on Bedrock, Vertex and Foundry and with telemetry disabled (CC 2.1.248).
