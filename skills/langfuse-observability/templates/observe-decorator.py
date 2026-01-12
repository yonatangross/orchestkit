"""
Basic @observe decorator usage for Langfuse tracing.

This template shows common patterns for using the @observe decorator
to automatically trace async functions with nested operations.
"""

from langfuse.decorators import observe, langfuse_context


@observe()  # Automatic tracing for top-level function
async def analyze_content(content: str, agent_type: str) -> dict:
    """
    Analyze content with automatic Langfuse tracing.

    The @observe decorator creates a trace and span automatically.
    All nested @observe functions become child spans.
    """

    # Update trace metadata
    langfuse_context.update_current_trace(
        session_id=f"session_{content[:20]}",
        user_id="user_123",
        metadata={
            "agent_type": agent_type,
            "content_length": len(content),
        },
        tags=["production", "content-analysis"],
    )

    # Nested span for retrieval
    context = await retrieve_context(content)

    # Nested span for generation
    analysis = await generate_analysis(content, context)

    return {"analysis": analysis, "context_used": len(context)}


@observe(name="retrieval")  # Named span
async def retrieve_context(content: str) -> list[str]:
    """
    Retrieve relevant context chunks.

    This becomes a child span of analyze_content.
    """
    # Simulate vector search
    chunks = ["chunk1", "chunk2", "chunk3"]

    # Add metadata to current span
    langfuse_context.update_current_observation(
        metadata={"chunks_retrieved": len(chunks)}, input=content[:100]  # Truncated
    )

    return chunks


@observe(name="generation")
async def generate_analysis(content: str, context: list[str]) -> str:
    """
    Generate analysis using LLM.

    This becomes a child span of analyze_content.
    """
    # Simulate LLM call
    response_text = "Analysis result..."
    input_tokens = 1500
    output_tokens = 1000

    # Update span with LLM details
    langfuse_context.update_current_observation(
        input={"content": content[:500], "context": context},  # Truncated
        output=response_text[:500],  # Truncated
        model="claude-sonnet-4-20250514",
        usage={"input_tokens": input_tokens, "output_tokens": output_tokens},
        metadata={"temperature": 1.0, "max_tokens": 4096},
    )

    return response_text


# Example: Error handling with @observe
@observe(name="risky_operation")
async def operation_that_might_fail(data: str) -> dict:
    """
    Operations that raise exceptions are automatically logged.

    Langfuse captures the exception and marks the span as failed.
    """
    try:
        # Risky operation
        if not data:
            raise ValueError("Empty data provided")

        result = await process_data(data)
        return {"success": True, "result": result}

    except Exception as e:
        # Exception is automatically captured by Langfuse
        # But you can add custom error metadata
        langfuse_context.update_current_observation(
            metadata={"error_type": type(e).__name__, "error_message": str(e)},
            level="ERROR",
        )
        raise


# Example: Conditional tracing
@observe(name="conditional_operation")
async def operation_with_early_return(condition: bool) -> str:
    """
    Early returns are handled correctly by @observe.
    """
    if not condition:
        langfuse_context.update_current_observation(
            metadata={"early_return": True, "reason": "condition_false"}
        )
        return "skipped"

    result = await expensive_operation()

    langfuse_context.update_current_observation(
        metadata={"early_return": False, "operation_completed": True}
    )

    return result


# Helper (not traced)
async def process_data(data: str) -> str:
    """Not decorated with @observe, so not traced."""
    return data.upper()


async def expensive_operation() -> str:
    """Simulate expensive operation."""
    return "expensive_result"


# Usage example
if __name__ == "__main__":
    import asyncio

    async def main():
        result = await analyze_content(
            content="Sample article about Langfuse observability...",
            agent_type="security_auditor",
        )
        print(result)

    asyncio.run(main())

    # View trace in Langfuse UI at http://localhost:3000
    # Trace structure:
    # analyze_content (parent)
    # ├── retrieval (child)
    # └── generation (child)
