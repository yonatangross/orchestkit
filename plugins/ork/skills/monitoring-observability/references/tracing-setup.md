# Distributed Tracing with Langfuse

Track LLM calls across your application with automatic parent-child span relationships using OpenTelemetry.

## Basic Usage: @observe Decorator (v3)

```python
from langfuse import observe, get_client

@observe()  # Auto-creates trace on first root span
async def analyze_content(content: str, agent_type: str):
    """Analyze content with automatic Langfuse tracing."""

    # Nested span for retrieval
    @observe(name="retrieval")
    async def retrieve_context():
        chunks = await vector_db.search(content)
        get_client().update_current_observation(
            metadata={"chunks_retrieved": len(chunks)}
        )
        return chunks

    # Nested span for generation
    @observe(name="generation")
    async def generate_analysis(context):
        response = await llm.generate(
            prompt=f"Context: {context}\n\nAnalyze: {content}"
        )
        get_client().update_current_observation(
            input=content[:500],
            output=response[:500],
            model="claude-sonnet-4-6",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
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
    └── model: claude-sonnet-4-6
    └── tokens: 1500 input, 1000 output
```

## W3C Trace Context

Langfuse v3 uses W3C Trace Context format for trace IDs:

```python
# v3 trace IDs follow W3C format (not UUIDs)
# Example: 4bf92f3577b34da6a3ce929d0e0e4736
# This enables correlation with other OTEL-instrumented services
```

## OpenTelemetry SpanProcessor Setup

For custom OTEL integration or forwarding traces to multiple backends:

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from langfuse.opentelemetry import LangfuseSpanProcessor

# Langfuse as OTEL SpanProcessor
langfuse_processor = LangfuseSpanProcessor(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com",
)

# Add to OTEL tracer provider
provider = TracerProvider()
provider.add_span_processor(langfuse_processor)

# Now all OTEL spans are sent to Langfuse
# Works with any OTEL-instrumented library
```

## New Observation Types (v3)

Beyond `generation` and `span`, v3 adds typed observations for Agent Graph rendering:

```python
from langfuse import observe, get_client

@observe(type="agent", name="supervisor")
async def supervisor(query: str):
    """Agent type — shows as agent node in graph."""
    intent = await classify(query)
    return await route_to_specialist(intent, query)

@observe(type="tool", name="web_search")
async def search(query: str):
    """Tool type — shows as tool call in graph."""
    return await tavily.search(query)

@observe(type="retriever", name="vector_search")
async def retrieve(query: str):
    """Retriever type — shows retrieval step in graph."""
    return await vector_db.search(query, top_k=5)

@observe(type="chain", name="prompt_chain")
async def chain(inputs: dict):
    """Chain type — shows sequential processing."""
    return await run_chain(inputs)

@observe(type="guardrail", name="pii_check")
async def check_pii(text: str):
    """Guardrail type — shows safety check in graph."""
    return detect_and_mask_pii(text)

@observe(type="embedding", name="embed")
async def embed(text: str):
    """Embedding type — shows vector generation."""
    return await embeddings.embed(text)

@observe(type="evaluator", name="quality_judge")
async def evaluate(output: str):
    """Evaluator type — creates inspectable trace."""
    return await llm_judge.score(output)
```

## Workflow Integration

```python
from langfuse import observe, get_client

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str):
    """Full workflow with automatic Langfuse tracing."""

    # Set trace-level metadata
    get_client().update_current_trace(
        user_id=f"analysis_{analysis_id}",
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content),
        },
    )

    # Each agent execution automatically creates nested spans
    results = []
    for agent in agents:
        result = await execute_agent(agent, content)  # @observe decorated
        results.append(result)

    return results
```

## LangChain/LangGraph Integration

For LangChain/LangGraph applications, use the CallbackHandler:

```python
from langfuse.callback import CallbackHandler

langfuse_handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
)

# Use with LangChain
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    callbacks=[langfuse_handler],
)

response = llm.invoke("Analyze this code...")  # Auto-traced!
```

## JavaScript/TypeScript Tracing

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "@langfuse/otel";

// Setup OTEL exporter to Langfuse
const sdk = new NodeSDK({
  traceExporter: new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  }),
});
sdk.start();

// All OTEL-compatible libraries now trace to Langfuse
```

## Best Practices

1. **Use `from langfuse import observe, get_client`** — NOT `from langfuse.decorators`
2. **Let `@observe()` auto-create traces** — no explicit `langfuse.trace()` needed
3. **Name your spans** with descriptive names (e.g., "retrieval", "generation")
4. **Use `type=` parameter** for Agent Graph rendering
5. **Add metadata** to observations for debugging (chunk counts, model params)
6. **Truncate large inputs/outputs** to 500-1000 chars to reduce storage
7. **Use nested observations** to track sub-operations

## References

- [Python SDK v3 @observe](https://langfuse.com/docs/sdk/python/decorators)
- [OpenTelemetry Integration](https://langfuse.com/docs/integrations/opentelemetry)
- [CallbackHandler Docs](https://langfuse.com/docs/integrations/langchain)
- [Observation Types](https://langfuse.com/docs/tracing-features/observations)
