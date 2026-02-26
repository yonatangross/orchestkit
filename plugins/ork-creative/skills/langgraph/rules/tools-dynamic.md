---
title: Filter tools dynamically by relevance to avoid context overflow from large sets
impact: HIGH
impactDescription: "Binding 50+ tools causes context overflow and poor selection — filter by relevance"
tags: tools, dynamic, selection, embedding, relevance
---

## Dynamic Tool Selection

When you have many tools, select the most relevant subset per query using embeddings.

**Incorrect — all tools always bound:**
```python
# 50 tools bound — floods context, LLM makes poor choices
model_with_all = model.bind_tools(all_50_tools)
```

**Correct — dynamic selection by relevance:**
```python
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Pre-compute tool embeddings (once at startup)
TOOL_EMBEDDINGS = {
    tool.name: embedder.encode(tool.description)
    for tool in all_tools
}

def select_relevant_tools(query: str, all_tools: list, top_k: int = 5) -> list:
    query_embedding = embedder.encode(query)
    similarities = [
        (tool, cosine_similarity(query_embedding, TOOL_EMBEDDINGS[tool.name]))
        for tool in all_tools
    ]
    sorted_tools = sorted(similarities, key=lambda x: x[1], reverse=True)
    return [tool for tool, _ in sorted_tools[:top_k]]

def agent_with_dynamic_tools(state):
    relevant_tools = select_relevant_tools(
        state["messages"][-1].content, all_tools, top_k=5
    )
    model_bound = model.bind_tools(relevant_tools)
    response = model_bound.invoke(state["messages"])
    return {"messages": [response]}
```

**Key rules:**
- Pre-compute embeddings at startup (not per request)
- Select top 5-10 tools per query
- Use cosine similarity for relevance scoring
- Fall back to general tools if no strong match

Reference: [LangGraph Tool Calling](https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#tool-calling-agent)
