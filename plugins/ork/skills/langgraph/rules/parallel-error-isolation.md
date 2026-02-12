---
title: Error Isolation in Parallel Execution
impact: HIGH
impactDescription: "One failed branch without isolation kills all parallel work — wasting completed results"
tags: parallel, error, isolation, timeout, gather
---

## Error Isolation in Parallel Execution

Isolate failures in parallel branches. Use `return_exceptions=True` and per-branch timeouts.

**Incorrect — one failure kills all:**
```python
async def run_agents(state):
    tasks = [agent.analyze(state["content"]) for agent in agents]
    results = await asyncio.gather(*tasks)  # One exception crashes everything
    return {"results": results}
```

**Correct — isolated failures with timeout:**
```python
import asyncio

async def parallel_with_isolation(agents: list, content: str, timeout: int = 30):
    """Run agents with per-agent timeout and error isolation."""
    async def run_with_timeout(agent):
        try:
            return await asyncio.wait_for(agent.analyze(content), timeout=timeout)
        except asyncio.TimeoutError:
            return {"agent": agent.name, "error": "timeout"}
        except Exception as e:
            return {"agent": agent.name, "error": str(e)}

    tasks = [run_with_timeout(a) for a in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if not isinstance(r, Exception) and "error" not in r]
    failures = [r for r in results if isinstance(r, Exception) or "error" in r]

    return {"successes": successes, "failures": failures}
```

**Key rules:**
- Always use `return_exceptions=True` in `asyncio.gather`
- Add per-branch timeout (30-60s) to prevent slow branches blocking
- Separate successes from failures — partial results are still valuable
- Log failures for debugging but continue with available results

Reference: [LangGraph Parallel Execution](https://langchain-ai.github.io/langgraph/how-tos/map-reduce/)
