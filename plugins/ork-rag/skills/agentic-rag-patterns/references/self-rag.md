# Self-RAG: Reflection and Adaptive Retrieval

Self-RAG enables LLMs to decide when retrieval is needed and evaluate output quality.

## Reflection Tokens

Self-RAG uses special tokens to control retrieval and assess quality:

```python
from pydantic import BaseModel, Field
from typing import Literal

class RetrievalDecision(BaseModel):
    """Decide whether retrieval is needed."""
    needs_retrieval: bool = Field(
        description="Whether external retrieval would help answer this query"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in answering without retrieval"
    )
    reason: str = Field(description="Brief explanation of decision")

class RelevanceScore(BaseModel):
    """Assess document relevance."""
    is_relevant: Literal["yes", "no"] = Field(
        description="Whether document is relevant to query"
    )
    key_overlap: list[str] = Field(
        default_factory=list,
        description="Key concepts that overlap with query"
    )

class SupportScore(BaseModel):
    """Assess if generation is supported by documents."""
    is_supported: Literal["fully", "partially", "not"] = Field(
        description="Whether generation is supported by retrieved documents"
    )
    unsupported_claims: list[str] = Field(
        default_factory=list,
        description="Claims not supported by documents"
    )

class UsefulnessScore(BaseModel):
    """Assess overall response usefulness."""
    score: Literal[1, 2, 3, 4, 5] = Field(
        description="Usefulness rating from 1 (poor) to 5 (excellent)"
    )
    improvements: list[str] = Field(
        default_factory=list,
        description="Suggested improvements"
    )
```

## Adaptive Retrieval Node

```python
from langchain_core.runnables import Runnable

def create_retrieval_decider(llm) -> Runnable:
    """Create a structured output chain for retrieval decisions."""
    system = """Decide if external retrieval would help answer this query.

Consider:
- Can you answer confidently from your knowledge?
- Does the query ask about specific facts, data, or recent events?
- Would retrieved documents improve answer quality?

Be conservative - retrieve when in doubt."""

    return llm.with_structured_output(RetrievalDecision).bind(
        system=system
    )

async def adaptive_retrieve(state: RAGState) -> dict:
    """Decide whether to retrieve based on query analysis."""
    question = state["question"]

    # Check if retrieval is needed
    decision = await retrieval_decider.ainvoke({"question": question})

    if not decision.needs_retrieval and decision.confidence > 0.8:
        # Skip retrieval, generate directly
        return {
            "documents": [],
            "skip_retrieval": True,
            "retrieval_reason": decision.reason
        }

    # Perform retrieval
    documents = await retriever.ainvoke(question)
    return {
        "documents": documents,
        "skip_retrieval": False,
        "retrieval_reason": decision.reason
    }
```

## Relevance Grading with Explanation

```python
def create_relevance_grader(llm) -> Runnable:
    """Create a grader that explains relevance decisions."""
    system = """Assess if this document is relevant to the query.

A document is relevant if it contains:
- Direct answers to the query
- Background information needed to understand the answer
- Related facts that support answering

Be strict - only mark as relevant if genuinely helpful."""

    return llm.with_structured_output(RelevanceScore).bind(
        system=system
    )

async def grade_with_explanation(
    question: str,
    documents: list[Document],
    grader: Runnable
) -> tuple[list[Document], dict]:
    """Grade documents with detailed explanations."""
    relevant_docs = []
    explanations = {}

    for doc in documents:
        result = await grader.ainvoke({
            "question": question,
            "document": doc.page_content
        })

        doc_id = doc.metadata.get("id", hash(doc.page_content))
        explanations[doc_id] = {
            "relevant": result.is_relevant == "yes",
            "key_overlap": result.key_overlap
        }

        if result.is_relevant == "yes":
            relevant_docs.append(doc)

    return relevant_docs, explanations
```

## Support Verification

```python
async def verify_support(
    generation: str,
    documents: list[Document],
    verifier: Runnable
) -> SupportScore:
    """Verify that generation is supported by documents."""
    context = "\n\n".join([d.page_content for d in documents])

    result = await verifier.ainvoke({
        "generation": generation,
        "context": context
    })

    return result

async def generate_with_verification(state: RAGState) -> dict:
    """Generate and verify support in one step."""
    question = state["question"]
    documents = state["documents"]

    # Generate answer
    generation = await rag_chain.ainvoke({
        "context": documents,
        "question": question
    })

    # Verify support
    support = await verify_support(generation, documents, support_verifier)

    if support.is_supported == "not":
        # Regenerate with stricter grounding
        generation = await strict_rag_chain.ainvoke({
            "context": documents,
            "question": question,
            "instruction": "Only use information explicitly stated in the context."
        })

    return {
        "generation": generation,
        "support_score": support.is_supported,
        "unsupported_claims": support.unsupported_claims
    }
```

## Token Efficiency Patterns

```python
class EfficientSelfRAG:
    """Self-RAG with token budget awareness."""

    def __init__(
        self,
        retriever,
        generator,
        grader,
        max_docs: int = 5,
        max_tokens: int = 4000
    ):
        self.retriever = retriever
        self.generator = generator
        self.grader = grader
        self.max_docs = max_docs
        self.max_tokens = max_tokens

    async def query(self, question: str) -> dict:
        """Execute Self-RAG with token efficiency."""
        # 1. Retrieve
        all_docs = await self.retriever.ainvoke(question)

        # 2. Grade (early exit if first doc is perfect)
        graded_docs = []
        for doc in all_docs[:self.max_docs]:
            score = await self.grader.ainvoke({
                "question": question,
                "document": doc.page_content
            })
            if score.is_relevant == "yes":
                graded_docs.append(doc)

            # Early exit: if we have 3 highly relevant docs, stop grading
            if len(graded_docs) >= 3:
                break

        # 3. Fit to token budget
        context_docs = self._fit_to_budget(graded_docs)

        # 4. Generate
        response = await self.generator.ainvoke({
            "context": context_docs,
            "question": question
        })

        return {
            "answer": response,
            "docs_retrieved": len(all_docs),
            "docs_used": len(context_docs)
        }

    def _fit_to_budget(self, docs: list[Document]) -> list[Document]:
        """Truncate documents to fit token budget."""
        total_tokens = 0
        selected = []

        for doc in docs:
            doc_tokens = len(doc.page_content.split()) * 1.3  # Rough estimate
            if total_tokens + doc_tokens > self.max_tokens:
                break
            selected.append(doc)
            total_tokens += doc_tokens

        return selected
```

## When to Use Self-RAG

**Use Self-RAG when:**
- Quality is critical (customer-facing, compliance)
- You can afford extra LLM calls for grading
- Queries vary widely in complexity
- You need explainable retrieval decisions

**Skip Self-RAG when:**
- Latency is critical (< 500ms)
- All queries need retrieval (domain-specific)
- Cost is primary constraint
- Simple Q&A with consistent quality
