---
title: Per-Agent Cost Attribution
impact: MEDIUM
impactDescription: "Without per-agent cost attribution, you cannot identify which agents are most expensive or optimize the highest-cost workflows"
tags: attribution, per-agent, hierarchical, rollup, trace
---

## Hierarchical Cost Rollup

```python
class AnalysisWorkflow:
    @observe(as_type="trace")
    async def run_analysis(self, url: str, analysis_id: UUID):
        """Parent trace aggregates child costs.

        Trace Hierarchy:
        run_analysis (trace)
        +-- security_agent (generation)
        +-- tech_agent (generation)
        +-- synthesis (generation)
        """
        langfuse_context.update_current_trace(
            name="content_analysis",
            session_id=str(analysis_id),
            tags=["multi-agent"]
        )

        for agent in self.agents:
            await self.run_agent(agent, content, analysis_id)

    @observe(as_type="generation")
    async def run_agent(self, agent, content, analysis_id):
        """Child generation - costs roll up to parent."""
        langfuse_context.update_current_observation(
            name=f"{agent.name}_generation",
            metadata={"agent_type": agent.name}
        )
        return await agent.analyze(content)
```

## Cost Queries

```python
from langfuse import Langfuse

async def get_analysis_costs(analysis_id: UUID) -> dict:
    langfuse = Langfuse()

    traces = langfuse.get_traces(session_id=str(analysis_id), limit=1)

    if traces.data:
        trace = traces.data[0]
        return {
            "total_cost": trace.total_cost,
            "input_tokens": trace.usage.input_tokens,
            "output_tokens": trace.usage.output_tokens,
            "cache_read_tokens": trace.usage.cache_read_input_tokens,
        }

async def get_costs_by_agent() -> list[dict]:
    generations = langfuse.get_generations(
        from_timestamp=datetime.now() - timedelta(days=7),
        limit=1000
    )

    costs = {}
    for gen in generations.data:
        agent = gen.metadata.get("agent_type", "unknown")
        if agent not in costs:
            costs[agent] = {"total": 0, "calls": 0, "cache_hits": 0}

        costs[agent]["total"] += gen.calculated_total_cost or 0
        costs[agent]["calls"] += 1
        if gen.metadata.get("cache_hit"):
            costs[agent]["cache_hits"] += 1

    return list(costs.values())
```

**Key rules:**
- Use `@observe(as_type="trace")` for parent workflows
- Use `@observe(as_type="generation")` for individual agent calls
- Always include `agent_type` in metadata for attribution
- Group by `session_id` (analysis_id) for per-analysis cost views
- Query 7-30 day windows for meaningful cost trends
