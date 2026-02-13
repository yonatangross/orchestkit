---
title: "Multi-Agent: Supervisor Pattern"
category: multi
impact: CRITICAL
---

# Supervisor Pattern

Central coordinator that routes tasks to specialist agents, supports parallel and sequential execution, and aggregates results.

## Fan-Out/Fan-In

```python
async def multi_agent_analysis(content: str) -> dict:
    """Fan-out to specialists, fan-in to synthesize."""
    agents = [
        ("security", security_agent),
        ("performance", performance_agent),
        ("code_quality", quality_agent),
        ("architecture", architecture_agent),
    ]

    # Fan-out: Run all agents in parallel
    tasks = [agent(content) for _, agent in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter successful results
    findings = [
        {"agent": name, "result": result}
        for (name, _), result in zip(agents, results)
        if not isinstance(result, Exception)
    ]

    # Fan-in: Synthesize findings
    return await synthesize_findings(findings)
```

## Supervisor with Routing

```python
class Supervisor:
    """Central coordinator that routes to specialists."""

    def __init__(self, agents: dict):
        self.agents = agents  # {"security": agent, "performance": agent}
        self.completed = []

    async def run(self, task: str) -> dict:
        """Route task through appropriate agents."""
        # 1. Determine which agents to use
        plan = await self.plan_routing(task)

        # 2. Execute in dependency order
        results = {}
        for agent_name in plan.execution_order:
            if plan.can_parallelize(agent_name):
                batch = plan.get_parallel_batch(agent_name)
                batch_results = await asyncio.gather(*[
                    self.agents[name](task, context=results)
                    for name in batch
                ])
                results.update(dict(zip(batch, batch_results)))
            else:
                results[agent_name] = await self.agents[agent_name](
                    task, context=results
                )

        return results

    async def plan_routing(self, task: str) -> RoutingPlan:
        """Use LLM to determine agent routing."""
        response = await llm.chat([{
            "role": "user",
            "content": f"""Task: {task}

Available agents: {list(self.agents.keys())}

Which agents should handle this task?
What order? Can any run in parallel?"""
        }])
        return parse_routing_plan(response.content)
```

## Supervisor-Worker with Timeout

```python
class SupervisorCoordinator:
    """Central supervisor that routes tasks to worker agents."""

    def __init__(self, workers: dict[str, Agent]):
        self.workers = workers
        self.execution_log: list[dict] = []

    async def route_and_execute(
        self, task: str, required_agents: list[str], parallel: bool = True
    ) -> dict[str, Any]:
        context = {"task": task, "results": {}}

        if parallel:
            tasks = [self._run_worker(name, task, context) for name in required_agents]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return dict(zip(required_agents, results))
        else:
            for name in required_agents:
                context["results"][name] = await self._run_worker(name, task, context)
            return context["results"]

    async def _run_worker(self, name: str, task: str, context: dict) -> dict:
        """Execute single worker with timeout."""
        try:
            result = await asyncio.wait_for(
                self.workers[name].run(task, context), timeout=30.0
            )
            self.execution_log.append({"agent": name, "status": "success", "result": result})
            return result
        except asyncio.TimeoutError:
            return {"error": f"{name} timed out"}
```

## CC Agent Teams (CC 2.1.33+)

CC 2.1.33 introduces native Agent Teams with peer-to-peer messaging and mesh topology.

### Star vs Mesh Topology

```
Star (Task tool):              Mesh (Agent Teams):
      Lead                           Lead (delegate)
     /||\                          /  |  \
    / || \                        /   |   \
   A  B  C  D                   A <-> B <-> C
   (no cross-talk)              (peer messaging)
```

### Dual-Mode Decision Tree

```
Complexity Assessment:
+-- Score < 3.0  -> Task tool subagents (cheaper, simpler)
+-- Score 3.0-3.5 -> User choice (recommend Teams for cross-cutting)
+-- Score > 3.5  -> Agent Teams (if CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
```

### Team Formation

```
# 1. Create team with shared task list
TeamCreate(team_name="feature-auth", description="User auth implementation")

# 2. Create tasks in shared list
TaskCreate(subject="Design API schema", description="...")
TaskCreate(subject="Build React components", description="...", addBlockedBy=["1"])

# 3. Spawn teammates
Task(prompt="You are the backend architect...",
     team_name="feature-auth", name="backend-dev",
     subagent_type="backend-system-architect")
```

### Peer Messaging

```
# Direct message (default)
SendMessage(type="message", recipient="frontend-dev",
  content="API contract: GET /users/:id -> {id, name, email}",
  summary="API contract ready")

# Broadcast (expensive -- use sparingly)
SendMessage(type="broadcast",
  content="Auth header format changed to Bearer",
  summary="Breaking auth change")
```

### Cost Comparison

| Scenario | Task Tool | Agent Teams | Ratio |
|----------|-----------|-------------|-------|
| 3-agent review | ~150K tokens | ~400K tokens | 2.7x |
| 8-agent feature | ~500K tokens | ~1.2M tokens | 2.4x |
| 6-agent research | ~300K tokens | ~800K tokens | 2.7x |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Agent count | 3-8 specialists |
| Parallelism | Parallelize independent agents |
| Worker timeout | 30s default |
| Communication | Shared state, message bus, or SendMessage (CC 2.1.33+) |
| Topology | Task tool (star) for simple; Agent Teams (mesh) for complex |
