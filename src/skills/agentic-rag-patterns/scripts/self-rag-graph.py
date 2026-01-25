"""
Self-RAG LangGraph Implementation

A complete Self-RAG workflow using LangGraph with:
- Adaptive retrieval decisions
- Document relevance grading
- Generation with support verification
- Query rewriting for failed retrievals

Usage:
    from self_rag_graph import build_self_rag, SelfRAGConfig

    config = SelfRAGConfig(
        retriever=your_retriever,
        llm=your_llm,
        embedding_model=your_embeddings
    )
    graph = build_self_rag(config)

    result = await graph.ainvoke({"question": "What is RAG?"})
    print(result["generation"])
"""

from __future__ import annotations

import logging
import operator
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, Protocol

from langchain_core.documents import Document
from langchain_core.runnables import Runnable
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Protocols and Types
# =============================================================================


class Retriever(Protocol):
    """Protocol for document retriever."""

    async def ainvoke(self, query: str) -> list[Document]:
        """Retrieve documents for a query."""
        ...


class LLM(Protocol):
    """Protocol for language model."""

    def with_structured_output(self, schema: type) -> Runnable:
        """Create structured output chain."""
        ...

    async def ainvoke(self, input: dict) -> str:
        """Generate text response."""
        ...


# =============================================================================
# Structured Output Schemas
# =============================================================================


class RetrievalDecision(BaseModel):
    """Decision on whether to retrieve documents."""

    needs_retrieval: bool = Field(
        description="Whether retrieval would help answer this query"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in answering without retrieval"
    )
    reason: str = Field(description="Brief explanation")


class DocumentGrade(BaseModel):
    """Grade for document relevance."""

    is_relevant: Literal["yes", "no"] = Field(
        description="Whether document is relevant to the query"
    )
    key_information: list[str] = Field(
        default_factory=list, description="Key facts from document relevant to query"
    )


class SupportVerification(BaseModel):
    """Verification that generation is supported by documents."""

    is_supported: Literal["fully", "partially", "not"] = Field(
        description="Whether generation is supported by context"
    )
    unsupported_claims: list[str] = Field(
        default_factory=list, description="Claims not supported by documents"
    )


class RewrittenQuery(BaseModel):
    """Improved query for better retrieval."""

    query: str = Field(description="Rewritten query")
    rationale: str = Field(description="Why this rewrite should help")


# =============================================================================
# State Definition
# =============================================================================


class SelfRAGState(BaseModel):
    """State for Self-RAG workflow."""

    # Input
    question: str

    # Retrieval
    documents: Annotated[list[Document], operator.add] = Field(default_factory=list)
    retrieval_decision: RetrievalDecision | None = None
    document_grades: dict[str, DocumentGrade] = Field(default_factory=dict)

    # Generation
    generation: str = ""
    support_verification: SupportVerification | None = None

    # Control flow
    retry_count: int = 0
    max_retries: int = 2
    skip_retrieval: bool = False

    class Config:
        arbitrary_types_allowed = True


# =============================================================================
# Configuration
# =============================================================================


@dataclass
class SelfRAGConfig:
    """Configuration for Self-RAG workflow."""

    retriever: Retriever
    llm: LLM
    max_retries: int = 2
    min_relevant_docs: int = 1
    support_threshold: Literal["fully", "partially"] = "partially"
    grading_concurrency: int = 5


# =============================================================================
# Node Functions
# =============================================================================


def create_retrieval_decider(llm: LLM) -> Runnable:
    """Create chain to decide if retrieval is needed."""
    system = """Decide if external document retrieval would help answer this query.

Retrieve when:
- Query asks about specific facts, data, or recent events
- You're not confident in your knowledge
- Query requires domain-specific information

Don't retrieve when:
- Query is about general knowledge you're confident about
- Query is a simple greeting or clarification
- Query asks for your opinion or creative content"""

    return llm.with_structured_output(RetrievalDecision)


def create_document_grader(llm: LLM) -> Runnable:
    """Create chain to grade document relevance."""
    system = """Grade if this document is relevant to answering the query.

A document is relevant if it:
- Contains information that directly helps answer the query
- Provides context needed to understand the answer
- Has facts or data mentioned in the query

Be strict - only mark relevant if genuinely helpful."""

    return llm.with_structured_output(DocumentGrade)


def create_support_verifier(llm: LLM) -> Runnable:
    """Create chain to verify generation is supported."""
    system = """Verify if the generated answer is supported by the provided documents.

- fully: All claims in the answer are directly supported by documents
- partially: Some claims supported, some are reasonable inferences
- not: Contains claims not supported or contradicted by documents

List any unsupported claims found."""

    return llm.with_structured_output(SupportVerification)


def create_query_rewriter(llm: LLM) -> Runnable:
    """Create chain to rewrite queries."""
    system = """Rewrite this query to improve document retrieval.

Consider:
- Adding specific terms mentioned in failed retrievals
- Rephrasing for better keyword matching
- Breaking down compound questions
- Adding context that might help"""

    return llm.with_structured_output(RewrittenQuery)


# =============================================================================
# Workflow Nodes
# =============================================================================


async def decide_retrieval(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Decide whether to retrieve documents."""
    decider = create_retrieval_decider(config.llm)

    decision = await decider.ainvoke({"question": state.question})

    skip = not decision.needs_retrieval and decision.confidence > 0.8

    logger.info(
        f"Retrieval decision: needs={decision.needs_retrieval}, "
        f"confidence={decision.confidence:.2f}, skip={skip}"
    )

    return {"retrieval_decision": decision, "skip_retrieval": skip}


async def retrieve_documents(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Retrieve documents from vector store."""
    if state.skip_retrieval:
        return {"documents": []}

    documents = await config.retriever.ainvoke(state.question)

    logger.info(f"Retrieved {len(documents)} documents")

    return {"documents": documents}


async def grade_documents(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Grade each document for relevance."""
    if not state.documents:
        return {"document_grades": {}}

    grader = create_document_grader(config.llm)
    grades = {}

    # Grade documents (could be parallelized with asyncio.gather)
    for i, doc in enumerate(state.documents):
        doc_id = doc.metadata.get("id", f"doc_{i}")

        grade = await grader.ainvoke(
            {"question": state.question, "document": doc.page_content}
        )

        grades[doc_id] = grade
        logger.debug(f"Graded {doc_id}: {grade.is_relevant}")

    relevant_count = sum(1 for g in grades.values() if g.is_relevant == "yes")
    logger.info(f"Document grading: {relevant_count}/{len(grades)} relevant")

    return {"document_grades": grades}


async def generate_answer(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Generate answer from relevant documents."""
    # Filter to relevant documents
    relevant_docs = []
    for i, doc in enumerate(state.documents):
        doc_id = doc.metadata.get("id", f"doc_{i}")
        grade = state.document_grades.get(doc_id)
        if grade and grade.is_relevant == "yes":
            relevant_docs.append(doc)

    # Build context
    if relevant_docs:
        context = "\n\n".join(
            [f"[{i + 1}] {doc.page_content}" for i, doc in enumerate(relevant_docs)]
        )
        prompt = f"""Answer the question using the provided context.
If the context doesn't contain enough information, say so.

Context:
{context}

Question: {state.question}

Answer:"""
    else:
        # No relevant docs - generate from knowledge
        prompt = f"""Answer this question based on your knowledge.
If you're not confident, indicate that.

Question: {state.question}

Answer:"""

    generation = await config.llm.ainvoke({"prompt": prompt})

    logger.info(f"Generated answer ({len(generation)} chars)")

    return {"generation": generation}


async def verify_support(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Verify generation is supported by documents."""
    if not state.documents or state.skip_retrieval:
        # Can't verify without documents
        return {
            "support_verification": SupportVerification(
                is_supported="not", unsupported_claims=["No documents to verify against"]
            )
        }

    verifier = create_support_verifier(config.llm)

    context = "\n\n".join([doc.page_content for doc in state.documents])

    verification = await verifier.ainvoke(
        {"generation": state.generation, "context": context}
    )

    logger.info(f"Support verification: {verification.is_supported}")

    return {"support_verification": verification}


async def rewrite_query(state: SelfRAGState, config: SelfRAGConfig) -> dict:
    """Rewrite query for better retrieval."""
    rewriter = create_query_rewriter(config.llm)

    # Include info about what was retrieved but not relevant
    failed_context = ""
    if state.documents:
        irrelevant_topics = [
            doc.page_content[:100]
            for i, doc in enumerate(state.documents)
            if state.document_grades.get(doc.metadata.get("id", f"doc_{i}"), None)
            and state.document_grades[
                doc.metadata.get("id", f"doc_{i}")
            ].is_relevant
            == "no"
        ][:3]
        if irrelevant_topics:
            failed_context = f"\n\nPrevious retrieval returned these irrelevant topics:\n" + "\n".join(
                irrelevant_topics
            )

    rewritten = await rewriter.ainvoke(
        {"question": state.question, "context": failed_context}
    )

    logger.info(f"Query rewritten: {rewritten.query[:100]}...")

    return {
        "question": rewritten.query,
        "retry_count": state.retry_count + 1,
        "documents": [],  # Clear for re-retrieval
        "document_grades": {},
    }


# =============================================================================
# Routing Functions
# =============================================================================


def route_after_grading(state: SelfRAGState, config: SelfRAGConfig) -> str:
    """Route based on document grading results."""
    if state.skip_retrieval:
        return "generate"

    relevant_count = sum(
        1 for g in state.document_grades.values() if g.is_relevant == "yes"
    )

    if relevant_count >= config.min_relevant_docs:
        return "generate"
    elif state.retry_count < config.max_retries:
        return "rewrite"
    else:
        # Max retries - generate with what we have
        return "generate"


def route_after_verification(state: SelfRAGState, config: SelfRAGConfig) -> str:
    """Route based on support verification."""
    if state.support_verification is None:
        return END

    support_level = state.support_verification.is_supported

    if support_level == "fully":
        return END
    elif support_level == "partially" and config.support_threshold == "partially":
        return END
    elif state.retry_count < config.max_retries:
        return "rewrite"
    else:
        return END


# =============================================================================
# Graph Builder
# =============================================================================


def build_self_rag(config: SelfRAGConfig) -> StateGraph:
    """Build the Self-RAG workflow graph.

    Args:
        config: Configuration including retriever and LLM

    Returns:
        Compiled StateGraph ready for execution
    """
    # Create graph
    workflow = StateGraph(SelfRAGState)

    # Add nodes with config binding
    workflow.add_node(
        "decide_retrieval", lambda s: decide_retrieval(s, config)
    )
    workflow.add_node(
        "retrieve", lambda s: retrieve_documents(s, config)
    )
    workflow.add_node(
        "grade", lambda s: grade_documents(s, config)
    )
    workflow.add_node(
        "generate", lambda s: generate_answer(s, config)
    )
    workflow.add_node(
        "verify", lambda s: verify_support(s, config)
    )
    workflow.add_node(
        "rewrite", lambda s: rewrite_query(s, config)
    )

    # Define edges
    workflow.add_edge(START, "decide_retrieval")

    # After deciding, either skip or retrieve
    workflow.add_conditional_edges(
        "decide_retrieval",
        lambda s: "generate" if s.skip_retrieval else "retrieve",
        {"generate": "generate", "retrieve": "retrieve"},
    )

    workflow.add_edge("retrieve", "grade")

    # After grading, route based on relevance
    workflow.add_conditional_edges(
        "grade",
        lambda s: route_after_grading(s, config),
        {"generate": "generate", "rewrite": "rewrite"},
    )

    workflow.add_edge("generate", "verify")

    # After verification, maybe rewrite or end
    workflow.add_conditional_edges(
        "verify",
        lambda s: route_after_verification(s, config),
        {"rewrite": "rewrite", END: END},
    )

    # Rewrite loops back to retrieve
    workflow.add_edge("rewrite", "retrieve")

    return workflow.compile()


# =============================================================================
# Example Usage
# =============================================================================


async def example_usage():
    """Example of using Self-RAG workflow."""
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_community.vectorstores import FAISS

    # Setup components (replace with your actual setup)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # Create a simple retriever (replace with your vector store)
    embeddings = OpenAIEmbeddings()
    texts = [
        "RAG stands for Retrieval-Augmented Generation.",
        "Self-RAG adds reflection to decide when retrieval helps.",
        "Document grading filters irrelevant retrievals.",
    ]
    vectorstore = FAISS.from_texts(texts, embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    # Build workflow
    config = SelfRAGConfig(retriever=retriever, llm=llm, max_retries=2)

    graph = build_self_rag(config)

    # Execute
    result = await graph.ainvoke({"question": "What is Self-RAG?"})

    print(f"Question: {result['question']}")
    print(f"Answer: {result['generation']}")
    print(f"Support: {result['support_verification'].is_supported}")
    print(f"Retries: {result['retry_count']}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(example_usage())
