# Agent Orchestration: ork delta

House decisions rescued from retired reference and rule files during the wrap + delta
conversion (2026-07-31). Maintained for src/skills/agent-orchestration. Vendor tutorials
are not restated here; see "Upstream coverage (do not restate)" in SKILL.md for where each
retired topic now lives.

## Bound every agent loop: 5-15 max steps, 10-20 message memory window
Why: House defaults set in the v2.0.0 consolidation of agent-loops (metadata.json, Feb 2026). The unbounded while-True ReAct loop and the context-overflow crash are the two failure modes these numbers exist to prevent; upstream tutorials omit the guardrail values.
Upstream: OpenAI function calling guide (https://platform.openai.com/docs/guides/function-calling); LangGraph plan-and-execute tutorials (context7: /langchain-ai/langgraph).

## Cap multi-agent fan-out at 8 parallel workers, 30s per-worker timeout, one retry
Why: House defaults from the v2.0.0 consolidation of multi-agent-orchestration (Feb 2026), rescued from the retired coordination-patterns reference. One hung specialist must never stall the whole fan-out, and beyond 8 parallel specialists synthesis quality degraded in ork demo runs.
Upstream: asyncio.gather with return_exceptions (https://docs.python.org/3/library/asyncio-task.html); supervisor routing in ork:langgraph.

## End every multi-agent run with a synthesis step, never return raw gathered output
Why: v2.0.0 house rule (Feb 2026), rescued from the retired multi-synthesis rule: asyncio.gather output is a list of disconnected findings, so every ork multi-agent flow closes with category grouping, an executive summary, and a confidence score.
Upstream: SKILL.md Quick Start (synthesize_findings example); LangGraph multi-agent tutorials (context7: /langchain-ai/langgraph).

## Default new multi-agent work to LangGraph and never mix frameworks in one project
Why: House recommendation from the retired frameworks-comparison rule (v2.0.0, Feb 2026): LangGraph is the only framework ork ships a dedicated skill for (ork:langgraph), and framework mixing is a recorded complexity explosion in SKILL.md Common Mistakes.
Upstream: references/framework-comparison.md (in-skill decision matrix); per-framework docs listed in SKILL.md Upstream coverage.

## Scale multi-scenario demos 1x/3x/8x with 30s/90s/300s budgets, always exactly 3 scenarios
Why: House convention for ork skill demos from the v2.0.0 consolidation of multi-scenario-orchestration (Feb 2026). Exponential rather than linear scaling because most skills carry fixed per-run overhead that linear steps fail to expose.
Upstream: rules/scenario-orchestrator.md and rules/scenario-routing.md (maintained in this skill; no vendor surface covers it).

## Never block forever at a scenario sync point: time out, log, proceed, isolate failures
Why: Design decision rescued from the retired multi-scenario state-machine and architecture references (Feb 2026): milestone sync is for interactive demos, free-running is for production, and a slow or failed scenario must never deadlock its siblings.
Upstream: rules/scenario-routing.md (synchronize_at_milestone with timeout and failure isolation).
