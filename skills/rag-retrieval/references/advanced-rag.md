# Advanced RAG Patterns

## HyDE Integration

HyDE (Hypothetical Document Embeddings) improves retrieval when queries don't match document vocabulary.

```python
from openai import OpenAI

client = OpenAI()

async def hyde_rag(question: str, top_k: int = 5) -> str:
    """RAG with HyDE for better retrieval on vocabulary mismatch."""

    # 1. Generate hypothetical answer (HyDE)
    hyde_response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Write a short, factual paragraph that would answer this question.
Write as if you're certain, even if you're not. Focus on using domain-specific vocabulary.

Question: {question}"""
        }],
        max_tokens=200
    )
    hypothetical_doc = hyde_response.choices[0].message.content

    # 2. Embed hypothetical doc (not the question!)
    embedding = await client.embeddings.create(
        model="text-embedding-3-small",
        input=hypothetical_doc
    )
    query_vector = embedding.data[0].embedding

    # 3. Retrieve with hypothetical embedding
    docs = await vector_db.search(query_vector, limit=top_k)

    # 4. Generate with real documents
    context = "\n\n".join([f"[{i+1}] {doc.text}" for i, doc in enumerate(docs)])

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Answer using ONLY the provided context."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
        ]
    )

    return response.choices[0].message.content
```

**When to use HyDE**:
- Technical domains with specialized vocabulary
- User queries in natural language vs. formal documents
- Cross-language or terminology mismatch scenarios

See `hyde-retrieval` skill for full implementation.

---

## Agentic RAG

Multi-step retrieval with tool use for complex queries.

### Query Router

```python
from pydantic import BaseModel
from enum import Enum

class QueryType(str, Enum):
    SIMPLE = "simple"          # Single retrieval sufficient
    MULTI_HOP = "multi_hop"    # Needs multiple retrievals
    COMPARISON = "comparison"  # Compare multiple entities
    AGGREGATION = "aggregation"  # Summarize across docs

class QueryAnalysis(BaseModel):
    query_type: QueryType
    sub_queries: list[str]  # Decomposed queries for multi-hop
    entities: list[str]     # Key entities to retrieve

async def analyze_query(question: str) -> QueryAnalysis:
    """Analyze query to determine retrieval strategy."""
    return await llm.with_structured_output(QueryAnalysis).ainvoke(
        f"""Analyze this question and determine the best retrieval strategy:

Question: {question}

Determine:
- query_type: simple (one search), multi_hop (chain of searches),
  comparison (compare entities), aggregation (summarize many docs)
- sub_queries: if multi_hop, list the sub-questions to answer in order
- entities: key entities/concepts to search for"""
    )
```

### Multi-Hop RAG

```python
async def multi_hop_rag(question: str) -> str:
    """RAG with iterative retrieval for complex queries."""
    analysis = await analyze_query(question)

    if analysis.query_type == QueryType.SIMPLE:
        return await basic_rag(question)

    # Multi-hop: answer sub-queries in sequence
    accumulated_context = []

    for sub_query in analysis.sub_queries:
        # Retrieve for sub-query
        docs = await vector_db.search(sub_query, limit=3)

        # Generate intermediate answer
        sub_answer = await llm.chat([
            {"role": "system", "content": "Answer concisely from context."},
            {"role": "user", "content": f"Context: {docs}\n\nQuestion: {sub_query}"}
        ])

        accumulated_context.append({
            "question": sub_query,
            "answer": sub_answer.content,
            "sources": [d.metadata["source"] for d in docs]
        })

    # Final synthesis
    context_summary = "\n".join([
        f"Q: {c['question']}\nA: {c['answer']}"
        for c in accumulated_context
    ])

    final = await llm.chat([
        {"role": "system", "content":
            "Synthesize the intermediate answers to fully answer the original question."},
        {"role": "user", "content":
            f"Intermediate findings:\n{context_summary}\n\nOriginal question: {question}"}
    ])

    return final.content
```

### RAG with Tool Use

```python
from langchain_core.tools import tool

@tool
def search_documents(query: str, filters: dict = None) -> list[dict]:
    """Search the document database.

    Args:
        query: Search query
        filters: Optional filters like {"category": "legal", "date_after": "2024-01-01"}
    """
    return vector_db.search(query, filters=filters, limit=5)

@tool
def get_document_by_id(doc_id: str) -> dict:
    """Retrieve a specific document by ID."""
    return document_store.get(doc_id)

@tool
def summarize_documents(doc_ids: list[str]) -> str:
    """Summarize multiple documents."""
    docs = [document_store.get(id) for id in doc_ids]
    return llm.invoke(f"Summarize: {docs}")

# Agent with RAG tools
from langgraph.prebuilt import create_react_agent

rag_agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o"),
    tools=[search_documents, get_document_by_id, summarize_documents],
    prompt="""You are a research assistant with access to a document database.
Use the search tool to find relevant documents, then synthesize an answer.
Always cite your sources."""
)

# Usage
result = await rag_agent.ainvoke({
    "messages": [{"role": "user", "content": "Compare Q3 vs Q4 2024 revenue"}]
})
```

---

## Self-RAG (Retrieval-Augmented Self-Reflection)

```python
from pydantic import BaseModel

class RetrievalDecision(BaseModel):
    needs_retrieval: bool
    reason: str

class RelevanceCheck(BaseModel):
    is_relevant: bool
    relevance_score: float

class ResponseValidation(BaseModel):
    is_supported: bool
    unsupported_claims: list[str]

async def self_rag(question: str) -> str:
    """Self-RAG: LLM decides when to retrieve and validates its outputs."""

    # 1. Decide if retrieval needed
    decision = await llm.with_structured_output(RetrievalDecision).ainvoke(
        f"Does answering this question require external knowledge retrieval?\n\n{question}"
    )

    if not decision.needs_retrieval:
        # Answer from parametric knowledge
        return await llm.invoke(question)

    # 2. Retrieve
    docs = await vector_db.search(question, limit=10)

    # 3. Filter relevant docs
    relevant_docs = []
    for doc in docs:
        check = await llm.with_structured_output(RelevanceCheck).ainvoke(
            f"Is this document relevant to: {question}\n\nDocument: {doc.text}"
        )
        if check.is_relevant and check.relevance_score > 0.7:
            relevant_docs.append(doc)

    if not relevant_docs:
        return "I couldn't find relevant information to answer this question."

    # 4. Generate response
    context = "\n".join([d.text for d in relevant_docs])
    response = await llm.invoke(
        f"Context: {context}\n\nQuestion: {question}"
    )

    # 5. Validate response is supported by context
    validation = await llm.with_structured_output(ResponseValidation).ainvoke(
        f"""Check if this response is fully supported by the context.

Context: {context}

Response: {response}

Identify any claims not supported by the context."""
    )

    if not validation.is_supported:
        # Regenerate without unsupported claims
        response = await llm.invoke(
            f"""Context: {context}

Question: {question}

Generate a response using ONLY information from the context.
Do NOT include: {validation.unsupported_claims}"""
        )

    return response
```

---

## Corrective RAG (CRAG)

```python
async def corrective_rag(question: str) -> str:
    """CRAG: Evaluate retrieval quality and correct if needed."""

    # Initial retrieval
    docs = await vector_db.search(question, limit=5)

    # Evaluate each document
    evaluations = []
    for doc in docs:
        eval_result = await llm.with_structured_output(
            {"score": "correct|ambiguous|incorrect", "reason": str}
        ).ainvoke(
            f"Evaluate if this document can answer: {question}\n\nDoc: {doc.text}"
        )
        evaluations.append((doc, eval_result))

    # Count correct documents
    correct_docs = [d for d, e in evaluations if e["score"] == "correct"]

    if len(correct_docs) >= 2:
        # Sufficient correct docs - proceed with generation
        context = "\n".join([d.text for d in correct_docs])

    elif len(correct_docs) == 1:
        # Ambiguous - augment with web search
        web_results = await web_search(question)
        context = correct_docs[0].text + "\n\n" + web_results

    else:
        # No correct docs - use web search only
        context = await web_search(question)

    return await llm.invoke(f"Context: {context}\n\nQuestion: {question}")
```

---

## Retrieval Pipeline Composition

Combine multiple techniques:

```python
async def advanced_rag_pipeline(question: str) -> str:
    """Full pipeline: Query analysis → HyDE → Hybrid → Rerank → Generate."""

    # 1. Analyze query
    analysis = await analyze_query(question)

    # 2. HyDE for better embedding
    hyde_embedding = await generate_hyde_embedding(question)

    # 3. Hybrid search (BM25 + vector)
    bm25_results = await bm25_search(question, limit=20)
    vector_results = await vector_search(hyde_embedding, limit=20)
    combined = reciprocal_rank_fusion(bm25_results, vector_results)

    # 4. Rerank with cross-encoder
    reranked = await cross_encoder_rerank(question, combined[:20])
    top_docs = reranked[:5]

    # 5. Context sufficiency check
    is_sufficient = await check_sufficiency(question, top_docs)
    if not is_sufficient:
        return "I don't have enough information to answer this accurately."

    # 6. Generate with citations
    return await generate_with_citations(question, top_docs)
```

---

## Related Skills

- `hyde-retrieval` - Full HyDE implementation
- `query-decomposition` - Multi-concept query handling
- `reranking-patterns` - Cross-encoder and LLM reranking
- `contextual-retrieval` - Context-prepending for chunks
- `langgraph-functional` - Building agentic workflows