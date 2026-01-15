"""
Langfuse CallbackHandler for LangChain/LangGraph integration.

Use this pattern for automatic tracing of LangChain LLM calls
without modifying existing LangChain code.
"""

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langfuse.callback import CallbackHandler

from app.core.config import settings


def create_langfuse_handler(
    session_id: str | None = None,
    user_id: str | None = None,
    metadata: dict | None = None,
    tags: list[str] | None = None,
) -> CallbackHandler:
    """
    Create a Langfuse CallbackHandler with optional context.

    Args:
        session_id: Group related traces (e.g., "analysis_abc123")
        user_id: User identifier (e.g., "user_123")
        metadata: Custom metadata dict
        tags: Tags for filtering (e.g., ["production", "security"])

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
        model="claude-sonnet-4-20250514",
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
from langgraph.graph import StateGraph


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
        model="claude-sonnet-4-20250514", callbacks=[langfuse_handler]
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
        model="claude-sonnet-4-20250514",
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
    return full_response


# Example 4: Batch processing with tracing
async def batch_analyze_with_tracing(items: list[str], batch_id: str):
    """
    Process multiple items with shared session.
    """
    # Shared handler for entire batch
    langfuse_handler = create_langfuse_handler(
        session_id=f"batch_{batch_id}",
        metadata={"batch_size": len(items), "batch_type": "analysis"},
        tags=["batch", "production"],
    )

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514", callbacks=[langfuse_handler]
    )

    results = []
    for idx, item in enumerate(items):
        # Update handler metadata for each item
        langfuse_handler.metadata = {
            **langfuse_handler.metadata,
            "batch_item_index": idx,
            "batch_item_id": item[:50],
        }

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
        model="claude-haiku-4-20250514",  # Faster, cheaper for retrieval
        callbacks=[retrieval_handler],
    )

    # Generation LLM
    generation_llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",  # More capable for generation
        callbacks=[generation_handler],
    )

    # Use different LLMs for different tasks
    query = await retrieval_llm.ainvoke([HumanMessage(content="Generate query...")])
    analysis = await generation_llm.ainvoke(
        [HumanMessage(content=f"Analyze with query: {query.content}")]
    )

    return analysis.content


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
    #     ├── model: claude-sonnet-4-20250514
    #     ├── input_tokens: 150
    #     ├── output_tokens: 300
    #     └── cost: $0.0045
