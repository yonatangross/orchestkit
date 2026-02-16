---
title: Self-RAG — Document Grading
impact: HIGH
impactDescription: "Without relevance grading, irrelevant documents contaminate context and degrade generation quality"
tags: self-rag, grading, relevance, adaptive-retrieval
---

## Self-RAG — Document Grading

LLM grades retrieved documents for relevance before generation.

**State Definition:**
```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List, Annotated
from langchain_core.documents import Document
import operator

class RAGState(TypedDict):
    question: str
    documents: Annotated[List[Document], operator.add]
    generation: str
    web_search_needed: bool
    retry_count: int
    relevance_scores: dict[str, float]
```

**Document Grading:**
```python
from pydantic import BaseModel, Field

class GradeDocuments(BaseModel):
    binary_score: str = Field(description="Relevance score 'yes' or 'no'")

def grade_documents(state: RAGState) -> dict:
    """Grade documents for relevance — core Self-RAG pattern."""
    question = state["question"]
    documents = state["documents"]
    filtered_docs, relevance_scores = [], {}

    for doc in documents:
        score = retrieval_grader.invoke({
            "question": question, "document": doc.page_content
        })
        doc_id = doc.metadata.get("id", hash(doc.page_content))
        relevance_scores[doc_id] = 1.0 if score.binary_score == "yes" else 0.0
        if score.binary_score == "yes":
            filtered_docs.append(doc)

    web_search_needed = len(filtered_docs) < len(documents) // 2
    return {
        "documents": filtered_docs,
        "web_search_needed": web_search_needed,
        "relevance_scores": relevance_scores
    }
```

**Incorrect — no document grading, all docs used:**
```python
def generate(state: RAGState) -> dict:
    # Uses all retrieved docs without quality check
    context = "\n\n".join([d.page_content for d in state["documents"]])
    return {"generation": llm.invoke(context)}
```

**Correct — grade documents before generation:**
```python
def grade_documents(state: RAGState) -> dict:
    filtered_docs = []
    for doc in state["documents"]:
        score = grader.invoke({"question": state["question"], "document": doc.page_content})
        if score.binary_score == "yes":  # Only keep relevant docs
            filtered_docs.append(doc)

    web_search_needed = len(filtered_docs) < len(state["documents"]) // 2
    return {"documents": filtered_docs, "web_search_needed": web_search_needed}
```

**Key rules:**
- Binary grading (yes/no) is simpler and more reliable than numeric scores
- Trigger web search fallback when >50% of docs are filtered out
- Track relevance scores for debugging and quality monitoring
- Self-RAG lets the LLM decide when to retrieve — adaptive by design
