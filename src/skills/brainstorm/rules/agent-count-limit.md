---
title: Limit parallel brainstorm agents to 5 maximum to avoid diminishing returns and context waste
impact: MEDIUM
impactDescription: "Spawning more than 5 parallel agents produces diminishing returns while consuming 80K+ tokens per extra agent, degrading synthesis quality from context overload"
tags: agents, parallelism, limits, tokens, cost, orchestration
---

# Agent Count Limit

Never spawn more than 5 parallel brainstorm agents (Task tool or Agent Teams). Beyond 5, each additional agent produces diminishing returns while consuming significant tokens, and the synthesis phase struggles to meaningfully integrate outputs from too many sources.

## Problem

The brainstorm skill dynamically selects agents based on topic keywords (Step 0). Without a hard cap, broad topics like "brainstorm full-stack architecture" can trigger 7-8 agents (workflow-architect, backend, frontend, security, data, devops, test-generator, performance). Each agent consumes 40-80K tokens. The synthesis phase then receives 400K+ tokens of input, leading to shallow integration, missed contradictions, and context exhaustion before the design presentation completes.

## Token Budget by Agent Count

| Agents | Est. Tokens (Task) | Est. Tokens (Teams) | Synthesis Quality |
|--------|--------------------|--------------------|-------------------|
| 2-3 | ~100-150K | ~200-300K | Excellent |
| 4-5 | ~150-250K | ~300-500K | Good |
| 6-7 | ~250-350K | ~500-700K | Degraded |
| 8+ | ~350K+ | ~700K+ | Poor -- context exhaustion likely |

## Rules

- Maximum 5 agents in any brainstorm session (including the mandatory `workflow-architect` and `test-generator`)
- This leaves 3 slots for domain-specific agents selected by topic analysis
- If topic analysis suggests more than 5 agents, prioritize by relevance and merge overlapping roles
- Document which agents were excluded and why in `00-topic-analysis.json`

**Incorrect -- spawning too many agents for a broad topic:**
```python
# Topic: "brainstorm e-commerce platform architecture"
# 8 agents spawned -- exceeds limit
TaskCreate(subject="workflow-architect: system design")
TaskCreate(subject="backend-system-architect: API design")
TaskCreate(subject="frontend-ui-developer: UI patterns")
TaskCreate(subject="security-auditor: auth + payments")
TaskCreate(subject="data-pipeline-engineer: analytics")
TaskCreate(subject="devops-engineer: deployment")
TaskCreate(subject="test-generator: test strategy")
TaskCreate(subject="performance-engineer: load testing")
# Synthesis receives 8 agent outputs (~400K tokens)
# Context exhaustion before design presentation completes
```

**Correct -- capping at 5, merging overlapping roles:**
```python
# Topic: "brainstorm e-commerce platform architecture"
# 8 candidates identified, capped to 5 by priority
selected = [
    "workflow-architect",          # Always included (system design lead)
    "backend-system-architect",    # Core: API + data model
    "security-auditor",            # Critical: payments require security focus
    "frontend-ui-developer",       # User-facing: checkout + catalog UX
    "test-generator",              # Always included (testability)
]
excluded = [
    {"agent": "data-pipeline-engineer", "reason": "Merged into backend scope"},
    {"agent": "devops-engineer", "reason": "Deferred to implementation phase"},
    {"agent": "performance-engineer", "reason": "Merged into backend scope"},
]

Write(".claude/chain/00-topic-analysis.json", {
    "agents_selected": selected,
    "agents_excluded": excluded,
    "agent_count": len(selected),
    "cap_applied": True
})

for agent in selected:
    TaskCreate(subject=f"{agent}: brainstorm e-commerce architecture")
```

## Exceptions

- If the user explicitly requests more agents ("use all available agents"), allow up to 7 with a warning about token cost and synthesis quality
- Agent Teams mode has a stricter effective limit of 4-5 due to higher per-agent token cost from cross-agent communication
