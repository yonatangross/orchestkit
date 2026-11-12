---
title: Build knowledge graph RAG for multi-hop reasoning over entity-rich domains
impact: MEDIUM
impactDescription: "Vector search misses entity relationships — knowledge graphs enable multi-hop reasoning for entity-rich domains"
tags: graphrag, knowledge-graph, neo4j, entity, multi-hop
---

## Knowledge Graph RAG (GraphRAG)

Combine knowledge graphs with vector search for entity-rich domains.

**Architecture:**
```
Query → [Entity Extraction] → [KG Lookup] → [Vector Search] → [Merge] → [Generate]
```

**Pattern Comparison:**

| Pattern | When to Use | Key Feature |
|---------|-------------|-------------|
| Self-RAG | Need adaptive retrieval | LLM decides when to retrieve |
| CRAG | Need quality assurance | Document grading + web fallback |
| GraphRAG | Entity-rich domains | Knowledge graph + vector hybrid |
| Agentic | Complex multi-step | Full plan-route-act-verify loop |

**Incorrect — vector-only search missing entity relationships:**
```python
async def search(query: str) -> list[dict]:
    # Misses relationships between entities
    return await vector_db.search(query, limit=10)
```

**Correct — hybrid KG + vector search:**
```python
async def graph_rag_search(query: str) -> list[dict]:
    entities = await extract_entities(query)  # Extract entities from query
    kg_results = await neo4j.lookup_entities(entities)  # KG lookup
    vector_results = await vector_db.search(query, limit=10)  # Vector search
    return merge_results(kg_results, vector_results)  # Combine both
```

**Key rules:**
- Use GraphRAG when domain has rich entity relationships (people, organizations, products)
- Combine KG entity lookup with vector similarity for hybrid results
- Entity extraction should use structured output (Pydantic) for reliability
- Multi-hop reasoning: follow graph edges to find connected information
- Neo4j or similar graph DB for production knowledge graphs
