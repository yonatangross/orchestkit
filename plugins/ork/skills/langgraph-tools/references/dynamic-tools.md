# Dynamic Tools Reference

Select relevant tools based on query for large tool inventories.

## The Problem

```python
# Too many tools = context overflow + poor selection
all_tools = [tool1, tool2, ..., tool100]
model.bind_tools(all_tools)  # Bad: 100 tool descriptions in context
```

## Semantic Tool Selection

```python
from sentence_transformers import SentenceTransformer
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Pre-compute tool embeddings (do once at startup)
TOOL_REGISTRY = {
    tool.name: {
        "tool": tool,
        "embedding": embedder.encode(f"{tool.name}: {tool.description}")
    }
    for tool in all_tools
}

def select_tools(query: str, top_k: int = 5) -> list:
    """Select most relevant tools for query."""
    query_embedding = embedder.encode(query)

    # Calculate similarities
    similarities = []
    for name, data in TOOL_REGISTRY.items():
        sim = np.dot(query_embedding, data["embedding"])
        similarities.append((data["tool"], sim))

    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)

    return [tool for tool, _ in similarities[:top_k]]
```

## In Agent Node

```python
def agent_with_dynamic_tools(state: State):
    """Bind only relevant tools."""
    # Get user's latest message
    user_query = state["messages"][-1].content

    # Select relevant tools
    relevant_tools = select_tools(user_query, top_k=5)

    # Bind selected tools
    model_bound = model.bind_tools(relevant_tools)

    # Invoke
    response = model_bound.invoke(state["messages"])
    return {"messages": [response]}
```

## Category-Based Selection

```python
TOOL_CATEGORIES = {
    "research": [search_web, read_document, summarize],
    "communication": [send_email, send_slack, create_ticket],
    "data": [query_database, create_chart, export_csv],
    "code": [run_python, lint_code, run_tests]
}

def select_by_category(query: str) -> list:
    """Select tools by detected category."""
    # Use LLM to classify
    category = llm.invoke(
        f"Classify this query into one of: {list(TOOL_CATEGORIES.keys())}\n"
        f"Query: {query}\n"
        f"Category:"
    ).content.strip().lower()

    return TOOL_CATEGORIES.get(category, TOOL_CATEGORIES["research"])
```

## Hybrid Selection

```python
def hybrid_tool_selection(query: str, context: dict) -> list:
    """Combine multiple selection strategies."""
    tools = set()

    # 1. Always include core tools
    tools.update([search, calculate])

    # 2. Add category-based tools
    category_tools = select_by_category(query)
    tools.update(category_tools)

    # 3. Add context-based tools
    if context.get("has_code"):
        tools.update([run_python, lint_code])

    # 4. Add semantically similar tools
    semantic_tools = select_tools(query, top_k=3)
    tools.update(semantic_tools)

    return list(tools)[:10]  # Cap at 10
```

## Caching Tool Embeddings

```python
import json
from pathlib import Path

CACHE_FILE = Path("tool_embeddings.json")

def load_or_compute_embeddings(tools: list) -> dict:
    """Load cached embeddings or compute new ones."""
    if CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text())
        # Check if tools changed
        if set(cache.keys()) == {t.name for t in tools}:
            return cache

    # Compute embeddings
    embeddings = {}
    for tool in tools:
        text = f"{tool.name}: {tool.description}"
        embeddings[tool.name] = embedder.encode(text).tolist()

    # Cache
    CACHE_FILE.write_text(json.dumps(embeddings))
    return embeddings
```
