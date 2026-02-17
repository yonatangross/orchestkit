---
title: "Multi-Agent: Debate & Conflict Resolution"
category: multi
impact: HIGH
impactDescription: "Ensures agent disagreements are resolved through confidence scores, LLM arbitration, or majority voting"
tags: conflict, resolution, debate, arbitration, communication
---

# Agent Debate & Conflict Resolution

Patterns for handling disagreements between agents and establishing communication channels.

## Conflict Resolution

```python
async def resolve_conflicts(findings: list[dict]) -> list[dict]:
    """When agents disagree, resolve by confidence or LLM."""
    conflicts = detect_conflicts(findings)

    if not conflicts:
        return findings

    for conflict in conflicts:
        # Option 1: Higher confidence wins
        winner = max(conflict.agents, key=lambda a: a.confidence)

        # Option 2: LLM arbitration
        resolution = await llm.chat([{
            "role": "user",
            "content": f"""Two agents disagree:

Agent A ({conflict.agent_a.name}): {conflict.agent_a.finding}
Agent B ({conflict.agent_b.name}): {conflict.agent_b.finding}

Which is more likely correct and why?"""
        }])

        conflict.resolution = parse_resolution(resolution.content)

    return apply_resolutions(findings, conflicts)
```

## Structured Conflict Detection

```python
async def resolve_agent_conflicts(
    findings: list[dict], llm: Any
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

## Agent Communication Bus

```python
class AgentBus:
    """Message passing between agents."""

    def __init__(self):
        self.messages = []
        self.subscribers = {}

    def publish(self, from_agent: str, message: dict):
        """Broadcast message to all agents."""
        msg = {"from": from_agent, "data": message, "ts": time.time()}
        self.messages.append(msg)
        for callback in self.subscribers.values():
            callback(msg)

    def subscribe(self, agent_id: str, callback):
        """Register agent to receive messages."""
        self.subscribers[agent_id] = callback

    def get_history(self, agent_id: str = None) -> list:
        """Get message history, optionally filtered."""
        if agent_id:
            return [m for m in self.messages if m["from"] == agent_id]
        return self.messages
```

## Resolution Strategies

| Strategy | When to Use | Trade-off |
|----------|-------------|-----------|
| Confidence-based | Agents provide confidence scores | Fast but requires calibrated scores |
| LLM arbitration | Complex disagreements | Higher quality but adds LLM cost |
| Majority voting | 3+ agents on same question | Simple but requires odd count |
| Weighted consensus | Agents have different expertise | Best for specialized teams |
| Human-in-the-loop | High-stakes decisions | Most reliable but slowest |

## Common Mistakes

- No timeout per agent (one slow agent blocks all)
- No error isolation (one failure crashes workflow)
- Over-coordination (too much overhead)
- Using Agent Teams for simple sequential work (use Task tool)
- Broadcasting when a direct message suffices (wastes tokens)

**Incorrect — no conflict resolution strategy:**
```python
async def multi_agent_analysis(task: str):
    results = await asyncio.gather(agent1(task), agent2(task))
    return results  # Return conflicting results without resolution
```

**Correct — LLM arbitration resolves conflicts:**
```python
async def multi_agent_analysis(task: str):
    results = await asyncio.gather(agent1(task), agent2(task))
    if results[0] != results[1]:  # Conflict detected
        resolution = await llm.chat([{
            "role": "user",
            "content": f"Agent 1: {results[0]}\nAgent 2: {results[1]}\nWhich is correct?"
        }])
        return resolution.content
    return results[0]
```
