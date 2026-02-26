# Agent Coordination Patterns

Patterns for coordinating multiple specialized agents in complex workflows.

## Supervisor-Worker Pattern

```python
from typing import Protocol, Any
import asyncio

class Agent(Protocol):
    async def run(self, task: str, context: dict) -> dict: ...

class SupervisorCoordinator:
    """Central supervisor that routes tasks to worker agents."""

    def __init__(self, workers: dict[str, Agent]):
        self.workers = workers
        self.execution_log: list[dict] = []

    async def route_and_execute(
        self,
        task: str,
        required_agents: list[str],
        parallel: bool = True
    ) -> dict[str, Any]:
        """Route task to specified agents."""
        context = {"task": task, "results": {}}

        if parallel:
            tasks = [
                self._run_worker(name, task, context)
                for name in required_agents
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return dict(zip(required_agents, results))
        else:
            for name in required_agents:
                context["results"][name] = await self._run_worker(
                    name, task, context
                )
            return context["results"]

    async def _run_worker(
        self, name: str, task: str, context: dict
    ) -> dict:
        """Execute single worker with timeout."""
        try:
            result = await asyncio.wait_for(
                self.workers[name].run(task, context),
                timeout=30.0
            )
            self.execution_log.append({
                "agent": name, "status": "success", "result": result
            })
            return result
        except asyncio.TimeoutError:
            return {"error": f"{name} timed out"}
```

## Conflict Resolution

```python
async def resolve_agent_conflicts(
    findings: list[dict],
    llm: Any
) -> dict:
    """Resolve conflicts between agent outputs."""
    conflicts = []
    for i, f1 in enumerate(findings):
        for f2 in findings[i+1:]:
            if f1.get("recommendation") != f2.get("recommendation"):
                conflicts.append((f1, f2))

    if not conflicts:
        return {"status": "no_conflicts", "findings": findings}

    # LLM arbitration
    resolution = await llm.ainvoke(f"""
        Agents disagree. Determine best recommendation:
        Agent 1: {conflicts[0][0]}
        Agent 2: {conflicts[0][1]}
        Provide: winner, reasoning, confidence (0-1)
    """)
    return {"status": "resolved", "resolution": resolution}
```

## Configuration

- Worker timeout: 30s default
- Max parallel agents: 8
- Retry failed agents: 1 attempt
- Log all executions for debugging

## Cost Optimization

- Batch similar tasks to reduce overhead
- Cache agent results by task hash
- Use cheaper models for simple agents
- Parallelize independent agents always