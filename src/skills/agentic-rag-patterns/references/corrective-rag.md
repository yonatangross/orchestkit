# Corrective RAG (CRAG): Document Grading and Web Fallback

CRAG evaluates retrieved documents and falls back to web search when quality is insufficient.

## CRAG Architecture

```
Query → Retrieve → Grade Each Doc → Route Decision
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
        Docs Relevant?      Docs Ambiguous?
              ↓                   ↓
           Generate          Rewrite Query
                                  ↓
                             Re-retrieve
                                  ↓
                          Still Poor? → Web Search
```

## Document Grading System

```python
from pydantic import BaseModel, Field
from typing import Literal
from enum import Enum

class DocumentGrade(str, Enum):
    CORRECT = "correct"      # Highly relevant, can answer query
    AMBIGUOUS = "ambiguous"  # Partially relevant, needs more context
    INCORRECT = "incorrect"  # Not relevant to query

class GradingResult(BaseModel):
    """Structured document grading result."""
    grade: DocumentGrade = Field(
        description="Document relevance grade"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in grading decision"
    )
    rationale: str = Field(
        description="Brief explanation for grade"
    )

def create_document_grader(llm):
    """Create a grader using structured output."""
    system = """Grade this document's relevance to the query.

Grading criteria:
- CORRECT: Document directly answers or strongly supports answering the query
- AMBIGUOUS: Document is tangentially related but insufficient alone
- INCORRECT: Document is not relevant to the query

Be strict - only mark CORRECT if the document genuinely helps."""

    return llm.with_structured_output(GradingResult).bind(system=system)
```

## Batch Document Grading

```python
async def grade_documents_batch(
    question: str,
    documents: list[Document],
    grader
) -> dict:
    """Grade all documents and categorize results."""
    correct_docs = []
    ambiguous_docs = []
    incorrect_docs = []
    grades = {}

    for doc in documents:
        result = await grader.ainvoke({
            "question": question,
            "document": doc.page_content
        })

        doc_id = doc.metadata.get("id", str(hash(doc.page_content))[:8])
        grades[doc_id] = {
            "grade": result.grade.value,
            "confidence": result.confidence,
            "rationale": result.rationale
        }

        if result.grade == DocumentGrade.CORRECT:
            correct_docs.append(doc)
        elif result.grade == DocumentGrade.AMBIGUOUS:
            ambiguous_docs.append(doc)
        else:
            incorrect_docs.append(doc)

    return {
        "correct": correct_docs,
        "ambiguous": ambiguous_docs,
        "incorrect": incorrect_docs,
        "grades": grades
    }
```

## Routing Logic

```python
def determine_action(grading_result: dict) -> str:
    """Determine next action based on grading results."""
    correct = grading_result["correct"]
    ambiguous = grading_result["ambiguous"]

    # Case 1: Have enough correct documents
    if len(correct) >= 2:
        return "generate"

    # Case 2: Mix of correct and ambiguous
    if len(correct) >= 1 and len(ambiguous) >= 1:
        return "generate"  # Use both correct and ambiguous

    # Case 3: Only ambiguous documents
    if len(ambiguous) >= 2 and len(correct) == 0:
        return "rewrite_query"

    # Case 4: All incorrect or too few documents
    return "web_search"
```

## Query Rewriting for Better Retrieval

```python
class RewrittenQuery(BaseModel):
    """Improved query for better retrieval."""
    rewritten_query: str = Field(
        description="Rephrased query for better retrieval"
    )
    search_terms: list[str] = Field(
        description="Key search terms to include"
    )

async def rewrite_query(
    original_query: str,
    failed_docs: list[Document],
    rewriter
) -> RewrittenQuery:
    """Rewrite query based on what retrieval missed."""

    # Extract what was retrieved but wasn't helpful
    retrieved_topics = [
        doc.page_content[:200] for doc in failed_docs[:3]
    ]

    result = await rewriter.ainvoke({
        "original_query": original_query,
        "retrieved_content": "\n".join(retrieved_topics),
        "instruction": """The retrieved documents didn't answer the query.
Rewrite the query to be more specific and include alternative phrasings.
Focus on what's missing from the retrieved content."""
    })

    return result
```

## Tavily Web Search Integration

```python
from tavily import TavilyClient
from langchain_core.documents import Document

class WebSearchFallback:
    """Web search fallback using Tavily API."""

    def __init__(self, api_key: str):
        self.client = TavilyClient(api_key=api_key)

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "advanced"
    ) -> list[Document]:
        """Search web and convert to Documents."""
        results = self.client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,  # "basic" or "advanced"
            include_raw_content=True
        )

        documents = []
        for result in results.get("results", []):
            doc = Document(
                page_content=result.get("content", ""),
                metadata={
                    "source": result.get("url", ""),
                    "title": result.get("title", ""),
                    "score": result.get("score", 0.0),
                    "type": "web_search",
                    "raw_content": result.get("raw_content", "")[:2000]
                }
            )
            documents.append(doc)

        return documents

    async def search_with_context(
        self,
        query: str,
        context: str = None
    ) -> list[Document]:
        """Search with additional context for better results."""
        enhanced_query = query
        if context:
            enhanced_query = f"{query} context: {context}"

        return await self.search(enhanced_query)
```

## Complete CRAG Node Implementation

```python
async def crag_grade_and_route(state: RAGState) -> dict:
    """CRAG grading with routing decision."""
    question = state["question"]
    documents = state["documents"]
    retry_count = state.get("retry_count", 0)

    # Grade all documents
    grading = await grade_documents_batch(question, documents, grader)

    # Determine action
    action = determine_action(grading)

    # Prepare documents for generation (correct + ambiguous)
    usable_docs = grading["correct"] + grading["ambiguous"]

    # Check retry limits
    if action == "rewrite_query" and retry_count >= 2:
        action = "web_search"  # Force web search after max retries

    return {
        "documents": usable_docs,
        "action": action,
        "grading_result": grading["grades"],
        "correct_count": len(grading["correct"]),
        "ambiguous_count": len(grading["ambiguous"])
    }
```

## Combining Vector Results with Web Results

```python
async def merge_retrieval_sources(
    vector_docs: list[Document],
    web_docs: list[Document],
    question: str,
    grader
) -> list[Document]:
    """Merge and deduplicate results from multiple sources."""
    all_docs = []
    seen_content = set()

    # Process vector docs first (higher trust)
    for doc in vector_docs:
        content_hash = hash(doc.page_content[:500])
        if content_hash not in seen_content:
            doc.metadata["source_type"] = "vector"
            all_docs.append(doc)
            seen_content.add(content_hash)

    # Add web docs that aren't duplicates
    for doc in web_docs:
        content_hash = hash(doc.page_content[:500])
        if content_hash not in seen_content:
            # Grade web docs before adding
            grade = await grader.ainvoke({
                "question": question,
                "document": doc.page_content
            })
            if grade.grade != DocumentGrade.INCORRECT:
                doc.metadata["source_type"] = "web"
                all_docs.append(doc)
                seen_content.add(content_hash)

    return all_docs
```

## Error Handling and Fallbacks

```python
class CRAGPipeline:
    """Complete CRAG pipeline with error handling."""

    def __init__(self, retriever, grader, generator, web_search):
        self.retriever = retriever
        self.grader = grader
        self.generator = generator
        self.web_search = web_search

    async def query(
        self,
        question: str,
        max_retries: int = 2
    ) -> dict:
        """Execute CRAG with full error handling."""
        retry_count = 0
        current_question = question

        while retry_count <= max_retries:
            try:
                # Step 1: Retrieve
                docs = await self.retriever.ainvoke(current_question)

                # Step 2: Grade
                grading = await grade_documents_batch(
                    question, docs, self.grader
                )

                # Step 3: Route
                action = determine_action(grading)

                if action == "generate":
                    usable_docs = grading["correct"] + grading["ambiguous"]
                    answer = await self.generator.ainvoke({
                        "context": usable_docs,
                        "question": question
                    })
                    return {
                        "answer": answer,
                        "sources": [d.metadata for d in usable_docs],
                        "method": "vector_retrieval"
                    }

                elif action == "rewrite_query":
                    rewritten = await rewrite_query(
                        question,
                        grading["ambiguous"] + grading["incorrect"],
                        self.rewriter
                    )
                    current_question = rewritten.rewritten_query
                    retry_count += 1

                else:  # web_search
                    web_docs = await self.web_search.search(question)
                    answer = await self.generator.ainvoke({
                        "context": web_docs,
                        "question": question
                    })
                    return {
                        "answer": answer,
                        "sources": [d.metadata for d in web_docs],
                        "method": "web_search"
                    }

            except Exception as e:
                retry_count += 1
                if retry_count > max_retries:
                    return {
                        "answer": "I couldn't find a reliable answer to your question.",
                        "error": str(e),
                        "method": "fallback"
                    }

        return {
            "answer": "Unable to find sufficient information.",
            "method": "exhausted_retries"
        }
```

## When to Use CRAG

**Use CRAG when:**
- Retrieval quality varies significantly
- Web fallback is acceptable for some queries
- You need explainable retrieval decisions
- Quality assurance is more important than latency

**Skip CRAG when:**
- Latency < 1s required
- Web search is not allowed (air-gapped)
- Simple domain with consistent retrieval quality
- Cost of multiple LLM calls is prohibitive
