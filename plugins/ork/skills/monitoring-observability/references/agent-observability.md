# Agent Observability

Trace multi-agent systems with Agent Graphs, new observation types, and rendered tool calls.

## Agent Graphs (GA Nov 2025)

Agent Graphs provide visual execution flow for multi-agent systems. Langfuse automatically renders agent handoffs, tool calls, and decision points as an interactive graph.

### Enabling Agent Graphs

```python
from langfuse import observe, get_client

@observe(type="agent", name="supervisor")
async def supervisor_agent(query: str):
    """Supervisor agent that routes to specialists."""
    get_client().update_current_observation(
        metadata={"routing_strategy": "semantic"}
    )

    intent = await classify_intent(query)

    if intent == "code_review":
        return await code_review_agent(query)
    elif intent == "security_audit":
        return await security_audit_agent(query)
    else:
        return await general_agent(query)


@observe(type="agent", name="code_review")
async def code_review_agent(query: str):
    """Specialist agent for code review."""
    context = await retrieve_context(query)
    return await generate_review(context)


@observe(type="agent", name="security_audit")
async def security_audit_agent(query: str):
    """Specialist agent for security auditing."""
    vulnerabilities = await scan_code(query)
    return await generate_audit_report(vulnerabilities)
```

### Result in Langfuse UI — Agent Graph View

```
supervisor (agent)
├── classify_intent (chain) → "code_review"
├── code_review (agent)
│   ├── retrieve_context (retriever) → 5 chunks
│   └── generate_review (generation) → $0.03
│       └── tool_call: analyze_diff → rendered inline
└── Total: 3.2s, $0.05
```

The Agent Graph View renders:
- **Agent nodes** with execution order
- **Tool calls** with inputs/outputs rendered inline
- **Decision edges** showing routing logic
- **Timing breakdown** per agent

## New Observation Types

Langfuse v3 adds 7 observation types beyond `generation` and `span`:

| Type | Use Case | Example |
|------|----------|---------|
| `agent` | Autonomous agent execution | Supervisor, specialist agents |
| `tool` | Tool/function call | API calls, database queries |
| `chain` | Sequential processing steps | Prompt chain, pipeline stage |
| `retriever` | Document/context retrieval | Vector search, RAG retrieval |
| `evaluator` | Quality assessment | G-Eval judge, human review |
| `embedding` | Embedding generation | Text → vector conversion |
| `guardrail` | Safety/validation check | PII filter, toxicity check |

### Using Observation Types

```python
from langfuse import observe, get_client

@observe(type="retriever", name="vector_search")
async def retrieve_context(query: str):
    """Retrieve relevant context from vector DB."""
    results = await vector_db.search(query, top_k=5)
    get_client().update_current_observation(
        metadata={
            "top_k": 5,
            "chunks_returned": len(results),
            "avg_similarity": sum(r.score for r in results) / len(results),
        }
    )
    return results


@observe(type="tool", name="web_search")
async def search_web(query: str):
    """Execute web search tool."""
    results = await tavily.search(query)
    get_client().update_current_observation(
        input=query,
        output=results[:3],  # Top 3 results
        metadata={"source": "tavily", "result_count": len(results)},
    )
    return results


@observe(type="guardrail", name="pii_filter")
async def check_pii(text: str):
    """Check for PII before sending to LLM."""
    has_pii = detect_pii(text)
    get_client().update_current_observation(
        input=text[:200],
        output={"has_pii": has_pii, "action": "blocked" if has_pii else "passed"},
        metadata={"check_type": "pii"},
    )
    if has_pii:
        raise PiiDetectedError("PII detected in input")
    return text


@observe(type="embedding", name="embed_query")
async def embed_query(text: str):
    """Generate embedding for query."""
    embedding = await embeddings.embed(text)
    get_client().update_current_observation(
        input=text,
        model="text-embedding-3-large",
        usage={"input_tokens": len(text.split())},
        metadata={"dimensions": len(embedding)},
    )
    return embedding


@observe(type="evaluator", name="relevance_judge")
async def evaluate_relevance(query: str, response: str):
    """Evaluate response relevance with LLM judge."""
    score = await llm_judge.evaluate(
        criteria="relevance",
        query=query,
        response=response,
    )
    get_client().update_current_observation(
        input={"query": query, "response": response[:500]},
        output={"score": score, "criteria": "relevance"},
    )
    # Each evaluator run creates its own inspectable trace
    return score
```

## Rendered Tool Calls

In v3, tool calls within generations are rendered inline in the trace view:

```python
@observe(type="agent")
async def coding_agent(task: str):
    response = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        tools=[
            {"name": "read_file", "description": "Read a file", "input_schema": {...}},
            {"name": "write_file", "description": "Write a file", "input_schema": {...}},
        ],
        messages=[{"role": "user", "content": task}],
    )

    # Tool calls automatically rendered in Langfuse trace:
    # generation → tool_use: read_file(path="src/main.py")
    #           → tool_result: "def main():..."
    #           → tool_use: write_file(path="src/main.py", content="...")
    #           → tool_result: "OK"
    return response
```

## Trace Log View

The Trace Log View provides a chronological log of all events within a trace, useful for debugging agent loops:

```
[00:00.000] agent:supervisor START
[00:00.050] chain:classify_intent START
[00:00.320] chain:classify_intent END → "security_audit"
[00:00.321] agent:security_audit START
[00:00.400] retriever:vector_search START
[00:00.650] retriever:vector_search END → 5 chunks
[00:00.651] guardrail:pii_filter START
[00:00.680] guardrail:pii_filter END → passed
[00:00.681] generation:analyze START
[00:02.100] generation:analyze END → $0.04
[00:02.101] evaluator:relevance_judge START
[00:02.500] evaluator:relevance_judge END → 0.92
[00:02.501] agent:security_audit END
[00:02.502] agent:supervisor END → Total: 2.5s, $0.05
```

## Framework Integration Examples

### LangGraph

```python
from langfuse import observe

@observe(type="agent", name="langgraph_supervisor")
async def run_langgraph_workflow(query: str):
    """LangGraph workflow with automatic Langfuse tracing."""
    from langgraph.graph import StateGraph

    graph = StateGraph(AgentState)
    graph.add_node("researcher", researcher_node)
    graph.add_node("writer", writer_node)

    # Each node automatically creates nested observations
    # when decorated with @observe
    app = graph.compile()
    return await app.ainvoke({"query": query})
```

### CrewAI

```python
from langfuse import observe

@observe(type="agent", name="crewai_crew")
async def run_crew(task: str):
    """CrewAI crew with Langfuse tracing."""
    from crewai import Crew, Agent, Task

    researcher = Agent(name="researcher", role="Research analyst")
    writer = Agent(name="writer", role="Technical writer")

    crew = Crew(
        agents=[researcher, writer],
        tasks=[Task(description=task, agent=researcher)],
    )
    # CrewAI has built-in Langfuse integration via callbacks
    return crew.kickoff()
```

### OpenAI Agents SDK

```python
from langfuse import observe

@observe(type="agent", name="openai_agent")
async def run_openai_agent(query: str):
    """OpenAI Agents SDK with Langfuse tracing."""
    from openai_agents import Agent, Runner

    agent = Agent(
        name="analyst",
        instructions="You are a code analyst.",
        model="gpt-5.2",
    )
    # OpenAI Agents SDK supports Langfuse via OTEL exporter
    result = await Runner.run(agent, query)
    return result.final_output
```

## Best Practices

1. **Use `type="agent"` for autonomous agents** that make routing decisions
2. **Use `type="tool"` for function calls** to external services
3. **Use `type="retriever"` for all RAG retrieval** steps
4. **Use `type="guardrail"` for safety checks** (PII, toxicity, etc.)
5. **Use `type="evaluator"` for quality judges** — each creates an inspectable trace
6. **Add metadata** with routing decisions, chunk counts, similarity scores
7. **Name observations descriptively** — they appear in the Agent Graph

## References

- [Agent Graphs](https://langfuse.com/docs/tracing-features/agent-graphs)
- [Observation Types](https://langfuse.com/docs/tracing-features/observations)
- [Tool Calls](https://langfuse.com/docs/tracing-features/tool-calls)
