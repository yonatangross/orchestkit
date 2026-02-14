---
name: agent-orchestration
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Agent orchestration patterns for agentic loops, multi-agent coordination, alternative frameworks, and multi-scenario workflows. Use when building autonomous agent loops, coordinating multiple agents, evaluating CrewAI/AutoGen/Swarm, or orchestrating complex multi-step scenarios.
tags: [agents, orchestration, multi-agent, agent-loops, crewai, autogen, swarm, coordination]
context: fork
agent: workflow-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: workflow-automation
---

# Agent Orchestration

Comprehensive patterns for building and coordinating AI agents -- from single-agent reasoning loops to multi-agent systems and framework selection. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Agent Loops](#agent-loops) | 2 | HIGH | ReAct reasoning, plan-and-execute, self-correction |
| [Multi-Agent Coordination](#multi-agent-coordination) | 3 | CRITICAL | Supervisor routing, agent debate, result synthesis |
| [Alternative Frameworks](#alternative-frameworks) | 3 | HIGH | CrewAI crews, AutoGen teams, framework comparison |
| [Multi-Scenario](#multi-scenario) | 2 | MEDIUM | Parallel scenario orchestration, difficulty routing |

**Total: 10 rules across 4 categories**

## Quick Start

```python
# ReAct agent loop
async def react_loop(question: str, tools: dict, max_steps: int = 10) -> str:
    history = REACT_PROMPT.format(tools=list(tools.keys()), question=question)
    for step in range(max_steps):
        response = await llm.chat([{"role": "user", "content": history}])
        if "Final Answer:" in response.content:
            return response.content.split("Final Answer:")[-1].strip()
        if "Action:" in response.content:
            action = parse_action(response.content)
            result = await tools[action.name](*action.args)
            history += f"\nObservation: {result}\n"
    return "Max steps reached without answer"
```

```python
# Supervisor with fan-out/fan-in
async def multi_agent_analysis(content: str) -> dict:
    agents = [("security", security_agent), ("perf", perf_agent)]
    tasks = [agent(content) for _, agent in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return await synthesize_findings(results)
```

## Agent Loops

Patterns for autonomous LLM reasoning: ReAct (Reasoning + Acting), Plan-and-Execute with replanning, self-correction loops, and sliding-window memory management.

**Key decisions:** Max steps 5-15, temperature 0.3-0.7, memory window 10-20 messages.

## Multi-Agent Coordination

Fan-out/fan-in parallelism, supervisor routing with dependency ordering, conflict resolution (confidence-based or LLM arbitration), result synthesis, and CC Agent Teams (mesh topology for peer messaging in CC 2.1.33+).

**Key decisions:** 3-8 specialists, parallelize independent agents, use Task tool (star) for simple work, Agent Teams (mesh) for cross-cutting concerns.

## Alternative Frameworks

CrewAI hierarchical crews with Flows (1.8+), OpenAI Agents SDK handoffs and guardrails (0.7.0), Microsoft Agent Framework (AutoGen + SK merger), GPT-5.2-Codex for long-horizon coding, and AG2 for open-source flexibility.

**Key decisions:** Match framework to team expertise + use case. LangGraph for state machines, CrewAI for role-based teams, OpenAI SDK for handoff workflows, MS Agent for enterprise compliance.

## Multi-Scenario

Orchestrate a single skill across 3 parallel scenarios (simple/medium/complex) with progressive difficulty scaling (1x/3x/8x), milestone synchronization, and cross-scenario result aggregation.

**Key decisions:** Free-running with checkpoints, always 3 scenarios, 1x/3x/8x exponential scaling, 30s/90s/300s time budgets.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Single vs multi-agent | Single for focused tasks, multi for decomposable work |
| Max loop steps | 5-15 (prevent infinite loops) |
| Agent count | 3-8 specialists per workflow |
| Framework | Match to team expertise + use case |
| Topology | Task tool (star) for simple; Agent Teams (mesh) for complex |
| Scenario count | Always 3: simple, medium, complex |

## Common Mistakes

- No step limit in agent loops (infinite loops)
- No memory management (context overflow)
- No error isolation in multi-agent (one failure crashes all)
- Missing synthesis step (raw agent outputs not useful)
- Mixing frameworks in one project (complexity explosion)
- Using Agent Teams for simple sequential work (use Task tool)
- Sequential instead of parallel scenarios (defeats purpose)

## Related Skills

- `langgraph` - LangGraph workflow patterns (supervisor, routing, state)
- `function-calling` - Tool definitions and execution
- `task-dependency-patterns` - Task management with Agent Teams workflow

## Capability Details

### react-loop
**Keywords:** react, reason, act, observe, loop, agent
**Solves:**
- Implement ReAct pattern
- Create reasoning loops
- Build iterative agents

### plan-execute
**Keywords:** plan, execute, replan, multi-step, autonomous
**Solves:**
- Create plan then execute steps
- Implement replanning on failure
- Build goal-oriented agents

### supervisor-coordination
**Keywords:** supervisor, route, coordinate, fan-out, fan-in, parallel
**Solves:**
- Route tasks to specialized agents
- Run agents in parallel
- Aggregate multi-agent results

### agent-debate
**Keywords:** debate, conflict, resolution, arbitration, consensus
**Solves:**
- Resolve agent disagreements
- Implement LLM arbitration
- Handle conflicting outputs

### result-synthesis
**Keywords:** synthesize, combine, aggregate, merge, summary
**Solves:**
- Combine outputs from multiple agents
- Create executive summaries
- Score confidence across findings

### crewai-patterns
**Keywords:** crewai, crew, hierarchical, delegation, role-based, flows
**Solves:**
- Build role-based agent teams
- Implement hierarchical coordination
- Use Flows for event-driven orchestration

### autogen-patterns
**Keywords:** autogen, microsoft, agent framework, teams, enterprise, a2a
**Solves:**
- Build enterprise agent systems
- Use AutoGen/SK merged framework
- Implement A2A protocol

### framework-selection
**Keywords:** choose, compare, framework, decision, which, crewai, autogen, openai
**Solves:**
- Select appropriate framework
- Compare framework capabilities
- Match framework to requirements

### scenario-orchestrator
**Keywords:** scenario, parallel, fan-out, difficulty, progressive, demo
**Solves:**
- Run skill across multiple difficulty levels
- Implement parallel scenario execution
- Aggregate cross-scenario results

### scenario-routing
**Keywords:** route, synchronize, milestone, checkpoint, scaling
**Solves:**
- Route tasks by difficulty level
- Synchronize at milestones
- Scale inputs progressively
