"""
Corrective RAG (CRAG) LangGraph Implementation

A complete CRAG workflow using LangGraph with:
- Document relevance grading (correct/ambiguous/incorrect)
- Query rewriting for ambiguous results
- Web search fallback via Tavily
- Result fusion from multiple sources

Usage:
    from crag_workflow import build_crag, CRAGConfig

    config = CRAGConfig(
        retriever=your_retriever,
        llm=your_llm,
        tavily_api_key="your-tavily-key"
    )
    graph = build_crag(config)

    result = await graph.ainvoke({"question": "What are the latest AI trends?"})
    print(result["generation"])
"""

from __future__ import annotations

import logging
import operator
from dataclasses import dataclass
from enum import Enum
from typing import Annotated, Literal, Protocol

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
# Enums and Schemas
# =============================================================================


class DocumentRelevance(str, Enum):
    """Document relevance categories for CRAG."""

    CORRECT = "correct"  # Highly relevant, can answer query
    AMBIGUOUS = "ambiguous"  # Partially relevant, needs more context
    INCORRECT = "incorrect"  # Not relevant to query


class GradingResult(BaseModel):
    """Structured document grading result."""

    relevance: DocumentRelevance = Field(description="Document relevance category")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in grading")
    key_facts: list[str] = Field(
        default_factory=list, description="Key facts from document if relevant"
    )
    rationale: str = Field(description="Brief explanation for grade")


class RewrittenQuery(BaseModel):
    """Improved query for re-retrieval."""

    query: str = Field(description="Rewritten query")
    search_terms: list[str] = Field(
        default_factory=list, description="Key search terms to prioritize"
    )
    rationale: str = Field(description="Why this rewrite should help")


class RetrievalAction(str, Enum):
    """Actions based on grading results."""

    GENERATE = "generate"  # Have enough relevant docs
    REWRITE = "rewrite"  # Try rewriting query
    WEB_SEARCH = "web_search"  # Fall back to web


# =============================================================================
# State Definition
# =============================================================================


class CRAGState(BaseModel):
    """State for CRAG workflow."""

    # Input
    question: str
    original_question: str = ""  # Preserved original for web search

    # Documents
    documents: Annotated[list[Document], operator.add] = Field(default_factory=list)
    grading_results: dict[str, GradingResult] = Field(default_factory=dict)

    # Categorized documents
    correct_docs: list[Document] = Field(default_factory=list)
    ambiguous_docs: list[Document] = Field(default_factory=list)
    incorrect_docs: list[Document] = Field(default_factory=list)

    # Generation
    generation: str = ""
    sources_used: list[str] = Field(default_factory=list)

    # Control flow
    action: RetrievalAction = RetrievalAction.GENERATE
    retry_count: int = 0
    max_retries: int = 2
    used_web_search: bool = False

    class Config:
        arbitrary_types_allowed = True


# =============================================================================
# Configuration
# =============================================================================


@dataclass
class CRAGConfig:
    """Configuration for CRAG workflow."""

    retriever: Retriever
    llm: LLM
    tavily_api_key: str | None = None
    max_retries: int = 2
    min_correct_docs: int = 1
    web_search_max_results: int = 5


# =============================================================================
# Web Search
# =============================================================================


class WebSearcher:
    """Web search using Tavily API."""

    def __init__(self, api_key: str):
        try:
            from tavily import TavilyClient

            self.client = TavilyClient(api_key=api_key)
            self.available = True
        except ImportError:
            logger.warning("Tavily not installed. Web search disabled.")
            self.available = False

    async def search(
        self, query: str, max_results: int = 5, search_depth: str = "advanced"
    ) -> list[Document]:
        """Search web and return as Documents."""
        if not self.available:
            return []

        try:
            results = self.client.search(
                query=query,
                max_results=max_results,
                search_depth=search_depth,
                include_raw_content=False,
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
                    },
                )
                documents.append(doc)

            logger.info(f"Web search returned {len(documents)} results")
            return documents

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []


# =============================================================================
# Node Functions
# =============================================================================


def create_document_grader(llm: LLM) -> Runnable:
    """Create CRAG document grader."""
    system = """Grade this document's relevance to the query using CRAG criteria.

Grading categories:
- CORRECT: Document directly answers or strongly supports the query. Contains specific facts, data, or explanations that address the question.
- AMBIGUOUS: Document is related but insufficient alone. Contains tangentially relevant information or partial answers.
- INCORRECT: Document is not relevant. Topic mismatch or doesn't help answer the query.

Be strict with CORRECT - only use when document genuinely helps answer the query.
Extract key facts if the document is CORRECT or AMBIGUOUS."""

    return llm.with_structured_output(GradingResult)


def create_query_rewriter(llm: LLM) -> Runnable:
    """Create query rewriter for failed retrievals."""
    system = """Rewrite this query to improve document retrieval.

The previous retrieval returned ambiguous or irrelevant documents.
Consider:
- Using more specific terminology
- Adding context or qualifiers
- Breaking compound questions apart
- Including synonyms or alternative phrasings

Provide search terms that should be prioritized."""

    return llm.with_structured_output(RewrittenQuery)


async def retrieve_documents(state: CRAGState, config: CRAGConfig) -> dict:
    """Retrieve documents from vector store."""
    # Preserve original question on first retrieval
    original = state.original_question or state.question

    documents = await config.retriever.ainvoke(state.question)

    logger.info(f"Retrieved {len(documents)} documents for: {state.question[:50]}...")

    return {"documents": documents, "original_question": original}


async def grade_documents(state: CRAGState, config: CRAGConfig) -> dict:
    """Grade all documents and categorize."""
    grader = create_document_grader(config.llm)

    grading_results = {}
    correct_docs = []
    ambiguous_docs = []
    incorrect_docs = []

    for i, doc in enumerate(state.documents):
        doc_id = doc.metadata.get("id", f"doc_{i}")

        result = await grader.ainvoke(
            {"question": state.question, "document": doc.page_content}
        )

        grading_results[doc_id] = result

        if result.relevance == DocumentRelevance.CORRECT:
            correct_docs.append(doc)
        elif result.relevance == DocumentRelevance.AMBIGUOUS:
            ambiguous_docs.append(doc)
        else:
            incorrect_docs.append(doc)

    logger.info(
        f"Grading complete: {len(correct_docs)} correct, "
        f"{len(ambiguous_docs)} ambiguous, {len(incorrect_docs)} incorrect"
    )

    return {
        "grading_results": grading_results,
        "correct_docs": correct_docs,
        "ambiguous_docs": ambiguous_docs,
        "incorrect_docs": incorrect_docs,
    }


def determine_action(state: CRAGState, config: CRAGConfig) -> dict:
    """Determine next action based on grading results."""
    correct_count = len(state.correct_docs)
    ambiguous_count = len(state.ambiguous_docs)

    # Case 1: Have enough correct documents
    if correct_count >= config.min_correct_docs:
        action = RetrievalAction.GENERATE
        logger.info(f"Action: GENERATE (have {correct_count} correct docs)")

    # Case 2: Mix of correct and ambiguous
    elif correct_count >= 1 or ambiguous_count >= 2:
        action = RetrievalAction.GENERATE
        logger.info("Action: GENERATE (using correct + ambiguous)")

    # Case 3: Only ambiguous, can retry
    elif ambiguous_count >= 1 and state.retry_count < config.max_retries:
        action = RetrievalAction.REWRITE
        logger.info("Action: REWRITE (ambiguous results, retry available)")

    # Case 4: Poor results, web search available
    elif config.tavily_api_key and not state.used_web_search:
        action = RetrievalAction.WEB_SEARCH
        logger.info("Action: WEB_SEARCH (falling back to web)")

    # Case 5: No options left, generate with what we have
    else:
        action = RetrievalAction.GENERATE
        logger.info("Action: GENERATE (no other options)")

    return {"action": action}


async def rewrite_query(state: CRAGState, config: CRAGConfig) -> dict:
    """Rewrite query for better retrieval."""
    rewriter = create_query_rewriter(config.llm)

    # Provide context about what was retrieved
    ambiguous_topics = [doc.page_content[:100] for doc in state.ambiguous_docs[:3]]
    context = (
        f"\n\nPrevious retrieval returned these partially relevant topics:\n"
        + "\n".join(ambiguous_topics)
        if ambiguous_topics
        else ""
    )

    rewritten = await rewriter.ainvoke({"question": state.question, "context": context})

    logger.info(f"Query rewritten: {rewritten.query[:80]}...")

    return {
        "question": rewritten.query,
        "retry_count": state.retry_count + 1,
        # Clear document state for re-retrieval
        "documents": [],
        "grading_results": {},
        "correct_docs": [],
        "ambiguous_docs": [],
        "incorrect_docs": [],
    }


async def web_search(state: CRAGState, config: CRAGConfig) -> dict:
    """Perform web search as fallback."""
    if not config.tavily_api_key:
        logger.warning("Web search requested but no API key configured")
        return {"used_web_search": True}

    searcher = WebSearcher(config.tavily_api_key)

    # Use original question for web search (more natural phrasing)
    query = state.original_question or state.question

    web_docs = await searcher.search(
        query, max_results=config.web_search_max_results
    )

    # Add to correct docs (web results assumed relevant)
    combined_correct = state.correct_docs + web_docs

    logger.info(f"Web search added {len(web_docs)} documents")

    return {
        "correct_docs": combined_correct,
        "documents": state.documents + web_docs,
        "used_web_search": True,
    }


async def generate_answer(state: CRAGState, config: CRAGConfig) -> dict:
    """Generate answer from graded documents."""
    # Combine correct and ambiguous docs, prioritizing correct
    usable_docs = state.correct_docs + state.ambiguous_docs

    if not usable_docs:
        return {
            "generation": "I couldn't find relevant information to answer your question.",
            "sources_used": [],
        }

    # Build context with source attribution
    context_parts = []
    sources = []

    for i, doc in enumerate(usable_docs):
        source = doc.metadata.get("source", f"Source {i + 1}")
        source_type = doc.metadata.get("type", "document")
        sources.append(f"{source} ({source_type})")
        context_parts.append(f"[{i + 1}] {doc.page_content}")

    context = "\n\n".join(context_parts)

    prompt = f"""Answer the question using the provided context.
Cite sources using [1], [2], etc. when referencing specific information.
If the context doesn't fully answer the question, acknowledge what's missing.

Context:
{context}

Question: {state.original_question or state.question}

Answer:"""

    generation = await config.llm.ainvoke({"prompt": prompt})

    logger.info(f"Generated answer using {len(usable_docs)} documents")

    return {"generation": generation, "sources_used": sources}


# =============================================================================
# Routing Functions
# =============================================================================


def route_after_action(state: CRAGState) -> str:
    """Route based on determined action."""
    if state.action == RetrievalAction.GENERATE:
        return "generate"
    elif state.action == RetrievalAction.REWRITE:
        return "rewrite"
    elif state.action == RetrievalAction.WEB_SEARCH:
        return "web_search"
    else:
        return "generate"


# =============================================================================
# Graph Builder
# =============================================================================


def build_crag(config: CRAGConfig) -> StateGraph:
    """Build the CRAG workflow graph.

    Args:
        config: Configuration including retriever, LLM, and optional Tavily key

    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(CRAGState)

    # Add nodes
    workflow.add_node("retrieve", lambda s: retrieve_documents(s, config))
    workflow.add_node("grade", lambda s: grade_documents(s, config))
    workflow.add_node("decide", lambda s: determine_action(s, config))
    workflow.add_node("rewrite", lambda s: rewrite_query(s, config))
    workflow.add_node("web_search", lambda s: web_search(s, config))
    workflow.add_node("generate", lambda s: generate_answer(s, config))

    # Define flow
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "grade")
    workflow.add_edge("grade", "decide")

    # Conditional routing after decision
    workflow.add_conditional_edges(
        "decide",
        route_after_action,
        {
            "generate": "generate",
            "rewrite": "rewrite",
            "web_search": "web_search",
        },
    )

    # Rewrite loops back to retrieve
    workflow.add_edge("rewrite", "retrieve")

    # Web search goes to generate
    workflow.add_edge("web_search", "generate")

    # Generate ends the workflow
    workflow.add_edge("generate", END)

    return workflow.compile()


# =============================================================================
# Convenience Functions
# =============================================================================


async def crag_query(
    question: str,
    retriever: Retriever,
    llm: LLM,
    tavily_api_key: str | None = None,
) -> dict:
    """Convenience function for single CRAG query.

    Args:
        question: The question to answer
        retriever: Document retriever
        llm: Language model for grading and generation
        tavily_api_key: Optional Tavily API key for web fallback

    Returns:
        Dict with generation, sources_used, and metadata
    """
    config = CRAGConfig(
        retriever=retriever, llm=llm, tavily_api_key=tavily_api_key
    )

    graph = build_crag(config)
    result = await graph.ainvoke({"question": question})

    return {
        "answer": result["generation"],
        "sources": result["sources_used"],
        "used_web_search": result["used_web_search"],
        "retry_count": result["retry_count"],
        "correct_doc_count": len(result["correct_docs"]),
        "ambiguous_doc_count": len(result["ambiguous_docs"]),
    }


# =============================================================================
# Example Usage
# =============================================================================


async def example_usage():
    """Example of using CRAG workflow."""
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_community.vectorstores import FAISS

    # Setup components
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # Create a simple retriever
    embeddings = OpenAIEmbeddings()
    texts = [
        "CRAG stands for Corrective Retrieval-Augmented Generation.",
        "CRAG grades documents as correct, ambiguous, or incorrect.",
        "Web search is used as a fallback when retrieval quality is poor.",
        "Query rewriting improves retrieval for ambiguous results.",
        "This document is about cooking recipes.",  # Irrelevant
    ]
    vectorstore = FAISS.from_texts(texts, embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

    # Build and run workflow
    config = CRAGConfig(
        retriever=retriever,
        llm=llm,
        tavily_api_key=None,  # Set your key for web fallback
        max_retries=2,
    )

    graph = build_crag(config)

    result = await graph.ainvoke({"question": "What is CRAG and how does it work?"})

    print("=" * 60)
    print(f"Question: {result['original_question']}")
    print(f"\nAnswer:\n{result['generation']}")
    print(f"\nSources: {result['sources_used']}")
    print(f"Retries: {result['retry_count']}")
    print(f"Web search used: {result['used_web_search']}")
    print(
        f"Docs: {len(result['correct_docs'])} correct, "
        f"{len(result['ambiguous_docs'])} ambiguous"
    )


if __name__ == "__main__":
    import asyncio

    asyncio.run(example_usage())
