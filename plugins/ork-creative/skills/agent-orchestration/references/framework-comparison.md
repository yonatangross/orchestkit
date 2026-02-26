# Framework Comparison

Decision matrix for choosing between multi-agent frameworks.

## Feature Comparison

| Feature | LangGraph | CrewAI | OpenAI SDK | MS Agent |
|---------|-----------|--------|------------|----------|
| State Management | Excellent | Good | Basic | Good |
| Persistence | Built-in | Plugin | Manual | Built-in |
| Streaming | Native | Limited | Native | Native |
| Human-in-Loop | Native | Manual | Manual | Native |
| Memory | Via Store | Built-in | Manual | Manual |
| Observability | Langfuse/LangSmith | Limited | Tracing | Azure Monitor |
| Learning Curve | Steep | Easy | Medium | Medium |
| Production Ready | Yes | Yes | Yes | Q1 2026 |

## Use Case Matrix

| Use Case | Best Framework | Why |
|----------|---------------|-----|
| Complex state machines | LangGraph | Native StateGraph, persistence |
| Role-based teams | CrewAI | Built-in delegation, backstories |
| OpenAI-only projects | OpenAI SDK | Native integration, handoffs |
| Enterprise/compliance | MS Agent | Azure integration, A2A |
| Research/experiments | AG2 | Open-source, flexible |
| Quick prototypes | CrewAI | Minimal boilerplate |
| Long-running workflows | LangGraph | Checkpointing, recovery |
| Customer support bots | OpenAI SDK | Handoffs, guardrails |

## Decision Tree

```
Start
  |
  +-- Need complex state machines?
  |     |
  |     +-- Yes --> LangGraph
  |     |
  |     +-- No
  |           |
  +-- Role-based collaboration?
  |     |
  |     +-- Yes --> CrewAI
  |     |
  |     +-- No
  |           |
  +-- OpenAI ecosystem only?
  |     |
  |     +-- Yes --> OpenAI Agents SDK
  |     |
  |     +-- No
  |           |
  +-- Enterprise requirements?
  |     |
  |     +-- Yes --> Microsoft Agent Framework
  |     |
  |     +-- No
  |           |
  +-- Open-source priority?
        |
        +-- Yes --> AG2
        |
        +-- No --> LangGraph (default)
```

## Migration Paths

### From AutoGen to MS Agent Framework

```python
# AutoGen 0.2 (old)
from autogen import AssistantAgent, UserProxyAgent
agent = AssistantAgent(name="assistant", llm_config=config)

# MS Agent Framework (new)
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
model_client = OpenAIChatCompletionClient(model="gpt-5.2")
agent = AssistantAgent(name="assistant", model_client=model_client)
```

### From Custom to LangGraph

```python
# Custom orchestration (old)
async def workflow(task):
    step1 = await agent1.run(task)
    step2 = await agent2.run(step1)
    return step2

# LangGraph (new)
from langgraph.graph import StateGraph
workflow = StateGraph(State)
workflow.add_node("agent1", agent1_node)
workflow.add_node("agent2", agent2_node)
workflow.add_edge("agent1", "agent2")
```

## Cost Considerations

| Framework | Licensing | Infra Cost | LLM Cost |
|-----------|-----------|------------|----------|
| LangGraph | MIT | Self-host / LangGraph Cloud | Any LLM |
| CrewAI | MIT | Self-host | Any LLM |
| OpenAI SDK | MIT | Self-host | OpenAI only |
| MS Agent | MIT | Self-host / Azure | Any LLM |
| AG2 | Apache 2.0 | Self-host | Any LLM |

## Performance Characteristics

| Framework | Cold Start | Latency | Throughput |
|-----------|------------|---------|------------|
| LangGraph | ~100ms | Low | High |
| CrewAI | ~200ms | Medium | Medium |
| OpenAI SDK | ~50ms | Low | High |
| MS Agent | ~150ms | Medium | High |

## Team Expertise Requirements

| Framework | Python | LLM | Infra |
|-----------|--------|-----|-------|
| LangGraph | Expert | Expert | Medium |
| CrewAI | Beginner | Beginner | Low |
| OpenAI SDK | Medium | Medium | Low |
| MS Agent | Medium | Medium | High |

## Recommendation Summary

1. **Default choice**: LangGraph (most capable, production-proven)
2. **Fastest to prototype**: CrewAI (minimal code, intuitive)
3. **OpenAI shops**: OpenAI Agents SDK (native integration)
4. **Enterprise**: Microsoft Agent Framework (compliance, Azure)
5. **Research**: AG2 (open community, experimental features)
