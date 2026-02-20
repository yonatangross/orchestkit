---
title: Synthesize parallel agent outputs into coherent actionable results with quality metrics
category: multi
impact: HIGH
impactDescription: "Ensures parallel agent outputs are combined into coherent, actionable results with quality metrics"
tags: synthesis, aggregation, coordination, collaboration, results
---

# Result Synthesis

Combine outputs from multiple parallel agents into coherent, actionable results.

## Synthesis Pattern

```python
async def synthesize_findings(findings: list[dict]) -> dict:
    """Combine multiple agent outputs into coherent result."""
    # Group by category
    by_category = {}
    for f in findings:
        cat = f.get("category", "general")
        by_category.setdefault(cat, []).append(f)

    # Synthesize each category
    synthesis = await llm.chat([{
        "role": "user",
        "content": f"""Synthesize these agent findings into a coherent summary:

{json.dumps(by_category, indent=2)}

Output format:
- Executive summary (2-3 sentences)
- Key findings by category
- Recommendations
- Confidence score (0-1)"""
    }])

    return parse_synthesis(synthesis.content)
```

## Multi-Agent Collaboration (TypeScript)

```typescript
export async function multiAgentCollaboration(
  task: string,
  agents: Agent[]
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  let totalCost = 0;

  // 1. Coordinator plans the task
  const planResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are a coordinator. Break down tasks and assign to agents:
${agents.map(a => `- ${a.name}: ${a.role}`).join('\n')}

Provide a numbered plan with agent assignments.`
      },
      { role: 'user', content: `Task: ${task}\n\nProvide a step-by-step plan.` }
    ]
  });

  const plan = planResponse.choices[0].message.content!;
  steps.push({ thought: 'Coordinator planning', observation: plan });

  // 2. Execute agent subtasks in parallel
  const agentResults = await Promise.all(
    agents.map(async (agent) => {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: `Task: ${task}\n\nPlan:\n${plan}\n\nComplete your part.` }
        ]
      });
      return { agent: agent.name, result: response.choices[0].message.content! };
    })
  );

  // 3. Synthesize results
  const synthesisResponse = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: 'Synthesize agent results into a coherent final answer.' },
      { role: 'user', content: `Task: ${task}\n\nAgent Results:\n${JSON.stringify(agentResults, null, 2)}` }
    ]
  });

  return {
    answer: synthesisResponse.choices[0].message.content!,
    steps,
    totalCost,
    iterations: agents.length + 2
  };
}
```

## Aggregation Strategies

### Comparative (Default)

Compare metrics across all agents:

```json
{
  "quality_comparison": {
    "security_agent": {"score": 0.92, "findings": 3},
    "perf_agent": {"score": 0.88, "findings": 5}
  },
  "consensus_items": ["Use parameterized queries", "Add rate limiting"],
  "disagreements": []
}
```

### Pattern Extraction

Find common patterns:

```json
{
  "success_patterns": ["Caching strategy effective", "Batch size 50+ preferred"],
  "failure_patterns": ["Timeout at >5000 items per batch"]
}
```

### Recommendation Engine

Generate actionable recommendations:

```json
{
  "priority_1": "Fix SQL injection in auth module (security + quality agree)",
  "priority_2": "Add connection pooling (performance agent)",
  "confidence": 0.91
}
```

## Cost Optimization

- Batch similar tasks to reduce overhead
- Cache agent results by task hash
- Use cheaper models for simple agents
- Parallelize independent agents always
- Max parallel agents: 8

## Orchestration Checklist

- [ ] Define agent responsibilities (single responsibility per agent)
- [ ] Plan communication patterns (shared state, message bus, or SendMessage)
- [ ] Set coordination strategy (central orchestrator with task queue)
- [ ] Design failure handling (timeout per agent, error isolation)
- [ ] Agent health checks and performance metrics

**Incorrect — returning raw agent outputs without synthesis:**
```python
async def multi_agent_analysis(task: str):
    results = await asyncio.gather(agent1(task), agent2(task), agent3(task))
    return results  # Returns list of disconnected findings
```

**Correct — synthesizing results into coherent output:**
```python
async def multi_agent_analysis(task: str):
    results = await asyncio.gather(agent1(task), agent2(task), agent3(task))
    synthesis = await llm.chat([{
        "role": "user",
        "content": f"Synthesize these findings: {json.dumps(results)}"
    }])
    return parse_synthesis(synthesis.content)
```
