---
title: Knowledge Graph RAG (GraphRAG)
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

**Key rules:**
- Use GraphRAG when domain has rich entity relationships (people, organizations, products)
- Combine KG entity lookup with vector similarity for hybrid results
- Entity extraction should use structured output (Pydantic) for reliability
- Multi-hop reasoning: follow graph edges to find connected information
- Neo4j or similar graph DB for production knowledge graphs
