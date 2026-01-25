# Semantic Routing Pattern

Route based on embedding similarity for intent-based decisions.

## Implementation

```python
from langchain_openai import OpenAIEmbeddings
import numpy as np

ROUTE_EMBEDDINGS = {}  # Pre-computed route embeddings

async def compute_route_embeddings():
    """Pre-compute embeddings for route descriptions."""
    embeddings = OpenAIEmbeddings()
    routes = {
        "technical": "Code, programming, API, debugging questions",
        "general": "General conversation, greetings, small talk",
        "analysis": "Data analysis, reports, statistics"
    }
    for route, description in routes.items():
        ROUTE_EMBEDDINGS[route] = await embeddings.aembed_query(description)

async def semantic_router(state: WorkflowState) -> str:
    """Route by semantic similarity."""
    embeddings = OpenAIEmbeddings()
    query_embedding = await embeddings.aembed_query(state["input"])

    best_route, best_score = "general", 0.0
    for route, route_emb in ROUTE_EMBEDDINGS.items():
        score = np.dot(query_embedding, route_emb)
        if score > best_score:
            best_route, best_score = route, score

    return best_route if best_score > 0.7 else "general"
```

## When to Use

- Intent classification without fine-tuning
- Dynamic topic routing
- Fuzzy matching requirements
- Multi-domain agents

## Anti-patterns

- Computing embeddings on every request (cache them)
- No similarity threshold (false positives)
- Too many similar routes (confusion)
- Ignoring latency of embedding calls