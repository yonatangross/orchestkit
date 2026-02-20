---
title: Generate multi-step plans before execution with replanning when conditions change
category: loops
impact: HIGH
impactDescription: "Ensures agents generate multi-step plans before execution with replanning capability when conditions change"
tags: planning, execution, react, function-calling, agents
---

# Plan-and-Execute Pattern

Generate a multi-step plan first, then execute each step sequentially with the option to replan when conditions change.

## Core Implementation

```python
async def plan_and_execute(goal: str) -> str:
    """Create plan first, then execute steps."""
    # 1. Generate plan
    plan = await llm.chat([{
        "role": "user",
        "content": f"Create a step-by-step plan to: {goal}\n\nFormat as numbered list."
    }])

    steps = parse_plan(plan.content)
    results = []

    # 2. Execute each step
    for i, step in enumerate(steps):
        result = await execute_step(step, context=results)
        results.append({"step": step, "result": result})

        # 3. Check if replanning needed
        if should_replan(results):
            return await plan_and_execute(
                f"{goal}\n\nProgress so far: {results}"
            )

    # 4. Synthesize final answer
    return await synthesize(goal, results)
```

## TypeScript ReAct Agent

```typescript
interface AgentStep {
  thought: string;
  action?: string;
  actionInput?: unknown;
  observation?: string;
}

interface AgentResult {
  answer: string;
  steps: AgentStep[];
  totalCost: number;
  iterations: number;
}

export async function reactAgent(
  task: string,
  options: { maxIterations?: number; verbose?: boolean } = {}
): Promise<AgentResult> {
  const { maxIterations = 10, verbose = false } = options;
  const steps: AgentStep[] = [];
  let totalCost = 0;

  const systemPrompt = `You are an autonomous agent that can use tools.

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Use this format:
Thought: [Your reasoning]
Action: [tool name]
Action Input: {"param": "value"}
Observation: [Tool result]

When done: Answer: [Final answer]`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: task }
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2', messages, temperature: 0.1
    });

    const content = response.choices[0].message.content!;
    totalCost += (response.usage!.total_tokens / 1000) * 0.01;

    if (content.includes('Answer:')) {
      const answer = content.split('Answer:')[1].trim();
      return { answer, steps, totalCost, iterations: i + 1 };
    }

    const parsed = parseAgentResponse(content);
    const step: AgentStep = { thought: parsed.thought };

    if (parsed.action && parsed.actionInput) {
      step.action = parsed.action;
      step.actionInput = JSON.parse(parsed.actionInput);
      step.observation = await executeTool(parsed.action, step.actionInput);
    }

    steps.push(step);
    messages.push({ role: 'assistant', content });
    if (step.observation) {
      messages.push({ role: 'user', content: `Observation: ${step.observation}` });
    }
  }

  throw new Error(`Agent exceeded max iterations (${maxIterations})`);
}
```

## Function Calling Agent (Alternative)

```typescript
export async function functionCallingAgent(task: string): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  let totalCost = 0;

  const messages = [
    { role: 'system' as const, content: 'You are a helpful assistant with access to tools.' },
    { role: 'user' as const, content: task }
  ];

  const openaiTools = tools.map(tool => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters }
  }));

  let iteration = 0;
  while (iteration < 10) {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2', messages, tools: openaiTools
    });

    const message = response.choices[0].message;
    totalCost += (response.usage!.total_tokens / 1000) * 0.01;

    // No tool calls = final answer
    if (!message.tool_calls) {
      return { answer: message.content!, steps, totalCost, iterations: iteration + 1 };
    }

    messages.push(message as any);
    for (const toolCall of message.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.function.name);
      if (!tool) continue;
      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args);
      steps.push({
        thought: `Calling ${toolCall.function.name}`,
        action: toolCall.function.name,
        actionInput: args,
        observation: JSON.stringify(result)
      });
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
    iteration++;
  }

  throw new Error('Agent exceeded max iterations');
}
```

## When to Choose Which Pattern

| Pattern | Best For | Trade-off |
|---------|----------|-----------|
| ReAct | Exploratory tasks, research | More flexible, harder to control |
| Plan-Execute | Well-defined goals | Structured, but replanning adds cost |
| Function Calling | Production APIs | Most reliable, requires tool schemas |
| Self-Correction | Quality-critical output | Higher cost, better quality |

**Incorrect — executing without planning first:**
```python
async def execute_goal(goal: str):
    steps = ["step1", "step2", "step3"]  # Hardcoded, no reasoning
    for step in steps:
        await execute_step(step)
```

**Correct — LLM generates plan before execution:**
```python
async def plan_and_execute(goal: str):
    plan = await llm.chat([{"role": "user", "content": f"Create plan for: {goal}"}])
    steps = parse_plan(plan.content)
    for step in steps:
        result = await execute_step(step)
        if should_replan(result):
            return await plan_and_execute(f"{goal}\nProgress: {result}")
```
