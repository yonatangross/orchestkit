---
title: Corrective RAG (CRAG)
impact: HIGH
impactDescription: "Without quality assurance and fallback paths, bad queries produce bad results — CRAG provides self-correction with web fallback"
tags: crag, corrective, web-fallback, query-rewriting, langgraph
---

## Corrective RAG (CRAG)

Self-correcting retrieval with query rewriting and web search fallback.

**CRAG Workflow:**
```python
def build_crag_workflow() -> StateGraph:
    workflow = StateGraph(RAGState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade", grade_documents)
    workflow.add_node("generate", generate)
    workflow.add_node("web_search", web_search)
    workflow.add_node("transform_query", transform_query)

    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "grade")

    workflow.add_conditional_edges("grade", route_after_grading, {
        "generate": "generate",
        "transform_query": "transform_query",
        "web_search": "web_search"
    })

    workflow.add_edge("transform_query", "retrieve")  # Retry
    workflow.add_edge("web_search", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()

def route_after_grading(state: RAGState) -> str:
    if state["web_search_needed"]:
        if state.get("retry_count", 0) < 2:
            return "transform_query"
        return "web_search"
    return "generate"
```

**Web Search Fallback:**
```python
def web_search(state: RAGState) -> dict:
    web_results = tavily_client.search(state["question"], max_results=5, search_depth="advanced")
    web_docs = [
        Document(page_content=r["content"], metadata={"source": r["url"], "type": "web"})
        for r in web_results
    ]
    return {"documents": web_docs, "web_search_needed": False}
```

**Key rules:**
- Fallback order: Rewrite query (2x max) -> Web search -> Abstain
- Max 2-3 retries for query rewriting to prevent infinite loops
- Web search as last resort (latency + cost)
- Always include retry_count to prevent infinite loops
- No fallback path = workflow hangs on bad queries
