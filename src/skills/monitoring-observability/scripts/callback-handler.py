"""
Langfuse CallbackHandler for LangChain/LangGraph integration.

Use this pattern for automatic tracing of LangChain LLM calls
without modifying existing LangChain code.
"""

from app.core.config import settings
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langfuse.callback import CallbackHandler


def create_langfuse_handler(
    session_id: str | None = None,
    user_id: str | None = None,
    metadata: dict | None = None,
    tags: list[str] | None = None,
    sample_rate: float = 1.0,
) -> CallbackHandler:
    """
    Create a Langfuse CallbackHandler with optional context.

    In v4, CallbackHandler is backward-compatible but has improved auto-detection
    of LLM providers and token usage. No code changes needed for existing integrations.

    Args:
        session_id: Group related traces (e.g., "analysis_abc123")
        user_id: User identifier (e.g., "user_123")
        metadata: Custom metadata dict
        tags: Tags for filtering (e.g., ["production", "security"])
        sample_rate: v4 sampling rate (0.0-1.0) to reduce tracing cost in
                     high-throughput scenarios. Default 1.0 traces everything.

    Returns:
        Configured CallbackHandler
    """
    handler = CallbackHandler(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_HOST,
        session_id=session_id,
        user_id=user_id,
        metadata=metadata or {},
        tags=tags or [],
        sample_rate=sample_rate,
    )

    return handler


# Example 1: Basic LangChain LLM with tracing
async def analyze_with_langchain(content: str, analysis_id: str) -> str:
    """
    Use LangChain LLM with automatic Langfuse tracing.
    """
    # Create handler with context
    langfuse_handler = create_langfuse_handler(
        session_id=f"analysis_{analysis_id}",
        user_id=analysis_id,
        metadata={"content_length": len(content), "analysis_type": "security"},
        tags=["production", "langchain", "security-audit"],
    )

    # Create LLM with callback
    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        temperature=1.0,
        max_tokens=4096,
        callbacks=[langfuse_handler],  # Pass as list!
    )

    # Invoke LLM - automatically traced!
    messages = [
        SystemMessage(content="You are a security auditor. Analyze code for vulnerabilities."),
        HumanMessage(content=f"Analyze this code:\n\n{content}"),
    ]

    response = await llm.ainvoke(messages)

    return response.content


# Example 2: LangGraph workflow with tracing
from langgraph.graph import StateGraph  # noqa: E402


async def run_langgraph_workflow(content: str, analysis_id: str):
    """
    LangGraph workflow with Langfuse tracing.
    """
    # Create shared handler
    langfuse_handler = create_langfuse_handler(
        session_id=f"analysis_{analysis_id}",
        metadata={"workflow": "content_analysis", "agent_count": 3},
    )

    # Create LLMs with shared handler
    llm = ChatAnthropic(
        model="claude-sonnet-4-6", callbacks=[langfuse_handler]
    )

    # Define nodes
    async def security_node(state):
        messages = [
            SystemMessage(content="Security auditor..."),
            HumanMessage(content=state["content"]),
        ]
        response = await llm.ainvoke(messages)  # Auto-traced!
        return {"security_analysis": response.content}

    async def tech_node(state):
        messages = [
            SystemMessage(content="Tech comparator..."),
            HumanMessage(content=state["content"]),
        ]
        response = await llm.ainvoke(messages)  # Auto-traced!
        return {"tech_comparison": response.content}

    # Build graph
    workflow = StateGraph(dict)
    workflow.add_node("security", security_node)
    workflow.add_node("tech", tech_node)
    workflow.set_entry_point("security")
    workflow.add_edge("security", "tech")
    workflow.set_finish_point("tech")

    # Run workflow - all LLM calls traced!
    app = workflow.compile()
    result = await app.ainvoke({"content": content})

    return result


# Example 3: Streaming LLM with tracing
async def stream_analysis_with_tracing(content: str, analysis_id: str):
    """
    Stream LLM responses with Langfuse tracing.
    """
    langfuse_handler = create_langfuse_handler(
        session_id=f"analysis_{analysis_id}", tags=["streaming", "production"]
    )

    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        streaming=True,
        callbacks=[langfuse_handler],
    )

    messages = [
        SystemMessage(content="Security auditor..."),
        HumanMessage(content=content),
    ]

    # Stream response
    full_response = ""
    async for chunk in llm.astream(messages):
        full_response += chunk.content
        yield chunk.content

    # Trace automatically captures full response
    return


# Example 4: Batch processing with tracing
# v4 best practice: create a fresh handler per batch item to isolate trace state.
# Reusing a single handler across items can leak metadata between traces.
async def batch_analyze_with_tracing(items: list[str], batch_id: str):
    """
    Process multiple items with per-item trace isolation.

    v4 improvement: each batch item gets a fresh CallbackHandler so that
    trace state (metadata, token counts) does not bleed across items.
    The shared session_id still groups them in the Langfuse UI.
    """
    results = []
    for idx, item in enumerate(items):
        # Fresh handler per item — prevents state leakage between traces
        item_handler = create_langfuse_handler(
            session_id=f"batch_{batch_id}",
            metadata={
                "batch_size": len(items),
                "batch_type": "analysis",
                "batch_item_index": idx,
                "batch_item_id": item[:50],
            },
            tags=["batch", "production"],
        )

        llm = ChatAnthropic(
            model="claude-sonnet-4-6", callbacks=[item_handler]
        )

        messages = [HumanMessage(content=f"Analyze: {item}")]
        response = await llm.ainvoke(messages)
        results.append(response.content)

    return results


# Example 5: Multiple handlers for different contexts
async def multi_context_analysis(content: str, analysis_id: str):
    """
    Use different handlers for different LLM calls.
    """
    # Handler for retrieval
    retrieval_handler = create_langfuse_handler(
        session_id=f"analysis_{analysis_id}",
        metadata={"phase": "retrieval"},
        tags=["retrieval"],
    )

    # Handler for generation
    generation_handler = create_langfuse_handler(
        session_id=f"analysis_{analysis_id}",
        metadata={"phase": "generation"},
        tags=["generation"],
    )

    # Retrieval LLM
    retrieval_llm = ChatAnthropic(
        model="claude-haiku-4-5-20251101",  # Faster, cheaper for retrieval
        callbacks=[retrieval_handler],
    )

    # Generation LLM
    generation_llm = ChatAnthropic(
        model="claude-sonnet-4-6",  # More capable for generation
        callbacks=[generation_handler],
    )

    # Use different LLMs for different tasks
    query = await retrieval_llm.ainvoke([HumanMessage(content="Generate query...")])
    analysis = await generation_llm.ainvoke(
        [HumanMessage(content=f"Analyze with query: {query.content}")]
    )

    return analysis.content


# Example 6: v4 sample_rate for cost reduction in high-throughput scenarios
async def high_throughput_analysis(items: list[str]):
    """
    Use sample_rate to trace only a fraction of requests.

    In production with thousands of requests per minute, tracing every
    call is expensive. v4's sample_rate (0.0-1.0) lets you trace a
    representative sample while keeping costs predictable.
    """
    # Trace only 20% of requests — sufficient for trend analysis
    langfuse_handler = create_langfuse_handler(
        metadata={"pipeline": "high_throughput"},
        tags=["production", "sampled"],
        sample_rate=0.2,
    )

    llm = ChatAnthropic(
        model="claude-sonnet-4-6", callbacks=[langfuse_handler]
    )

    results = []
    for item in items:
        messages = [HumanMessage(content=f"Analyze: {item}")]
        response = await llm.ainvoke(messages)
        results.append(response.content)

    return results


# Usage example
if __name__ == "__main__":
    import asyncio

    async def main():
        result = await analyze_with_langchain(
            content="Sample code to analyze...", analysis_id="abc123"
        )
        print(result)

    asyncio.run(main())

    # View trace in Langfuse UI
    # Trace structure:
    # Session: analysis_abc123
    # └── ChatAnthropic.ainvoke (auto-traced)
    #     ├── model: claude-sonnet-4-6
    #     ├── input_tokens: 150
    #     ├── output_tokens: 300
    #     └── cost: $0.0045
