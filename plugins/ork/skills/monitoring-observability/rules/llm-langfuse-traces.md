---
title: Trace LLM call chains with Langfuse for debugging slow or incorrect responses
impact: HIGH
impactDescription: "Langfuse tracing provides visibility into LLM call chains — without it, debugging slow or incorrect LLM responses is nearly impossible."
tags: [langfuse, tracing, observe, opentelemetry, otel, agent-graphs, spans]
---

# Langfuse Traces

## Basic Tracing with @observe (v4)

```python
from langfuse import observe, get_client

@observe(as_type="chain")  # Auto-creates trace on first root span
async def analyze_content(content: str):
    get_client().update_current_observation(
        metadata={"content_length": len(content)}
    )
    return await llm.generate(content)
```

## Nested Spans

```python
from langfuse import observe, get_client

@observe(name="content_analysis")
async def analyze(content: str):
    # Nested span for retrieval
    @observe(as_type="retriever", name="retrieval")
    async def retrieve_context():
        chunks = await vector_db.search(content)
        get_client().update_current_observation(
            metadata={"chunks_retrieved": len(chunks)}
        )
        return chunks

    # Nested span for generation
    @observe(as_type="generation", name="generation")
    async def generate_analysis(context):
        response = await llm.generate(content)
        get_client().update_current_observation(
            model="claude-sonnet-4-6",
            usage={"input_tokens": 1500, "output_tokens": 1000},
        )
        return response

    context = await retrieve_context()
    return await generate_analysis(context)
```

Result in Langfuse UI:
```
content_analysis (2.3s, $0.045)
+-- retrieval (0.1s)
|   +-- metadata: {chunks_retrieved: 5}
+-- generation (2.2s, $0.045)
    +-- model: claude-sonnet-4-6
    +-- tokens: 1500 input, 1000 output
```

## Session & User Tracking

```python
from langfuse import observe, get_client

@observe()
async def analysis(content: str):
    get_client().update_current_trace(
        user_id="user_123",
        session_id="session_abc",
        metadata={"content_type": "article", "agent_count": 8},
        tags=["production", "orchestkit"],
    )
    return await run_pipeline(content)
```

## Observation Types for Agent Graphs

Use `as_type=` (v4) to assign semantic span types for Agent Graph rendering:

```python
@observe(as_type="agent", name="supervisor")
async def supervisor(query: str): ...     # Agent node in graph

@observe(as_type="generation", name="llm_call")
async def generate(query: str): ...       # LLM generation step

@observe(as_type="retriever", name="vector_search")
async def retrieve(query: str): ...       # Retrieval step

@observe(as_type="chain", name="prompt_chain")
async def chain(inputs: dict): ...        # Sequential processing

@observe(as_type="guardrail", name="pii_check")
async def check_pii(text: str): ...       # Safety check

@observe(as_type="embedding", name="embed")
async def embed(text: str): ...           # Vector generation

@observe(as_type="evaluator", name="quality_judge")
async def evaluate(output: str): ...      # Inspectable evaluator trace
```

## Inline Span Scoring (v4)

Use `score_current_span()` to attach scores directly to the active span:

```python
from langfuse import observe, get_client

@observe(as_type="chain", name="rag_pipeline")
async def rag_pipeline(query: str):
    context = await retrieve(query)
    response = await generate(query, context)

    get_client().score_current_span(
        name="relevance", value=0.85,
        comment="Good retrieval alignment",
    )
    return response
```

## Filtering Noisy OTel Spans

When using OpenTelemetry auto-instrumentation, many infra spans (HTTP clients,
DB drivers, DNS) are exported to Langfuse. Use `should_export_span` to keep
only the spans you care about:

```python
from langfuse.opentelemetry import LangfuseSpanProcessor

def span_filter(span) -> bool:
    """Only export LLM and application spans, skip infra noise."""
    dominated_libs = {"urllib3", "httpcore", "dns", "ssl"}
    lib = span.attributes.get("otel.library.name", "")
    return lib not in dominated_libs

langfuse_processor = LangfuseSpanProcessor(
    public_key="pk-...",
    secret_key="sk-...",
    should_export_span=span_filter,
)
```

## OpenTelemetry SpanProcessor

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from langfuse.opentelemetry import LangfuseSpanProcessor

langfuse_processor = LangfuseSpanProcessor(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com",
)

provider = TracerProvider()
provider.add_span_processor(langfuse_processor)
```

## JavaScript/TypeScript Setup

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "@langfuse/otel";

const sdk = new NodeSDK({
  traceExporter: new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  }),
});
sdk.start();
```

## Best Practices

1. **Use `from langfuse import observe, get_client`** — NOT `from langfuse.decorators`
2. **Let `@observe()` auto-create traces** — no explicit `langfuse.trace()` needed
3. **Name spans descriptively** (e.g., "retrieval", "generation")
4. **Use `as_type=` parameter** (v4) for Agent Graph rendering
5. **Add metadata** for debugging (chunk counts, model params)
6. **Truncate large inputs/outputs** to 500-1000 chars
7. **Tag production vs staging** traces for environment filtering

**Incorrect — flat trace without nested spans:**
```python
@observe()
async def analyze(content: str):
    chunks = await retrieve(content)  # Not traced
    result = await generate(chunks)   # Not traced
    return result  # No visibility into sub-operations
```

**Correct — nested spans for full visibility:**
```python
@observe(name="content_analysis")
async def analyze(content: str):
    @observe(name="retrieval")
    async def retrieve_context():
        return await vector_db.search(content)

    @observe(name="generation")
    async def generate_analysis(chunks):
        return await llm.generate(chunks)

    chunks = await retrieve_context()
    return await generate_analysis(chunks)
```
