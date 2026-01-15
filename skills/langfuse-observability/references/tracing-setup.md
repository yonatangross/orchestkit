# Distributed Tracing with Langfuse

Track LLM calls across your application with automatic parent-child span relationships.

## Basic Usage: @observe Decorator

```python
from langfuse.decorators import observe, langfuse_context

@observe()  # Automatic tracing
async def analyze_content(content: str, agent_type: str):
    """Analyze content with automatic Langfuse tracing."""

    # Nested span for retrieval
    @observe(name="retrieval")
    async def retrieve_context():
        chunks = await vector_db.search(content)
        langfuse_context.update_current_observation(
            metadata={"chunks_retrieved": len(chunks)}
        )
        return chunks

    # Nested span for generation
    @observe(name="generation")
    async def generate_analysis(context):
        response = await llm.generate(
            prompt=f"Context: {context}\n\nAnalyze: {content}"
        )
        langfuse_context.update_current_observation(
            input=content[:500],
            output=response[:500],
            model="claude-sonnet-4-20250514",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        )
        return response

    context = await retrieve_context()
    return await generate_analysis(context)
```

## Result in Langfuse UI

```
analyze_content (2.3s, $0.045)
├── retrieval (0.1s)
│   └── metadata: {chunks_retrieved: 5}
└── generation (2.2s, $0.045)
    └── model: claude-sonnet-4-20250514
    └── tokens: 1500 input, 1000 output
```

## Workflow Integration

```python
# backend/app/workflows/content_analysis.py
from langfuse.decorators import observe

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str):
    """Full workflow with automatic Langfuse tracing."""

    # Set global metadata
    langfuse_context.update_current_trace(
        user_id=f"analysis_{analysis_id}",
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content)
        }
    )

    # Each agent execution automatically creates nested spans
    results = []
    for agent in agents:
        result = await execute_agent(agent, content)  # @observe decorated
        results.append(result)

    return results
```

## LangChain/LangGraph Integration with CallbackHandler

For LangChain/LangGraph applications:

```python
from langfuse.callback import CallbackHandler

langfuse_handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY
)

# Use with LangChain
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    callbacks=[langfuse_handler]
)

response = llm.invoke("Analyze this code...")  # Auto-traced!
```

## Best Practices

1. **Always use @observe decorator** for automatic tracing
2. **Name your spans** with descriptive names (e.g., "retrieval", "generation")
3. **Add metadata** to observations for debugging (chunk counts, model params, etc.)
4. **Truncate large inputs/outputs** to 500-1000 chars to reduce storage
5. **Use nested observations** to track sub-operations

## References

- [Langfuse Decorators Guide](https://langfuse.com/docs/sdk/python/decorators)
- [CallbackHandler Docs](https://langfuse.com/docs/integrations/langchain)
