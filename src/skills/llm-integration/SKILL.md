---
name: llm-integration
license: MIT
compatibility: "Claude Code 2.1.34+."
description: LLM integration patterns for function calling, streaming responses, local inference with Ollama, and fine-tuning customization. Use when implementing tool use, SSE streaming, local model deployment, LoRA/QLoRA fine-tuning, or multi-provider LLM APIs.
tags: [llm, function-calling, streaming, ollama, fine-tuning, lora, tool-use, local-inference]
context: fork
agent: llm-integrator
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: mcp-enhancement
---

# LLM Integration

Patterns for integrating LLMs into production applications: tool use, streaming, local inference, and fine-tuning. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Function Calling](#function-calling) | 3 | CRITICAL | Tool definitions, parallel execution, input validation |
| [Streaming](#streaming) | 3 | HIGH | SSE endpoints, structured streaming, backpressure handling |
| [Local Inference](#local-inference) | 3 | HIGH | Ollama setup, model selection, GPU optimization |
| [Fine-Tuning](#fine-tuning) | 3 | HIGH | LoRA/QLoRA training, dataset preparation, evaluation |
| [Context Optimization](#context-optimization) | 2 | HIGH | Window management, compression, caching, budget scaling |
| [Evaluation](#evaluation) | 2 | HIGH | LLM-as-judge, RAGAS metrics, quality gates, benchmarks |
| [Prompt Engineering](#prompt-engineering) | 2 | HIGH | CoT, few-shot, versioning, DSPy optimization |

**Total: 18 rules across 7 categories**

## Quick Start

```python
# Function calling: strict mode tool definition
tools = [{
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": "Search knowledge base",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "description": "Max results"}
            },
            "required": ["query", "limit"],
            "additionalProperties": False
        }
    }
}]
```

```python
# Streaming: SSE endpoint with FastAPI
@app.get("/chat/stream")
async def stream_chat(prompt: str):
    async def generate():
        async for token in async_stream(prompt):
            yield {"event": "token", "data": token}
        yield {"event": "done", "data": ""}
    return EventSourceResponse(generate())
```

```python
# Local inference: Ollama with LangChain
llm = ChatOllama(
    model="deepseek-r1:70b",
    base_url="http://localhost:11434",
    temperature=0.0,
    num_ctx=32768,
)
```

```python
# Fine-tuning: QLoRA with Unsloth
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Meta-Llama-3.1-8B",
    max_seq_length=2048, load_in_4bit=True,
)
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=32)
```

## Function Calling

Enable LLMs to use external tools and return structured data. Use strict mode schemas (2026 best practice) for reliability. Limit to 5-15 tools per request, validate all inputs with Pydantic/Zod, and return errors as tool results.

- `calling-tool-definition.md` -- Strict mode schemas, OpenAI/Anthropic formats, LangChain binding
- `calling-parallel.md` -- Parallel tool execution, asyncio.gather, strict mode constraints
- `calling-validation.md` -- Input validation, error handling, tool execution loops

## Streaming

Deliver LLM responses in real-time for better UX. Use SSE for web, WebSocket for bidirectional. Handle backpressure with bounded queues.

- `streaming-sse.md` -- FastAPI SSE endpoints, frontend consumers, async iterators
- `streaming-structured.md` -- Streaming with tool calls, partial JSON parsing, chunk accumulation
- `streaming-backpressure.md` -- Backpressure handling, bounded buffers, cancellation

## Local Inference

Run LLMs locally with Ollama for cost savings (93% vs cloud), privacy, and offline development. Pre-warm models, use provider factory for cloud/local switching.

- `local-ollama-setup.md` -- Installation, model pulling, environment configuration
- `local-model-selection.md` -- Model comparison by task, hardware profiles, quantization
- `local-gpu-optimization.md` -- Apple Silicon tuning, keep-alive, CI integration

## Fine-Tuning

Customize LLMs with parameter-efficient techniques. Fine-tune ONLY after exhausting prompt engineering and RAG. Requires 1000+ quality examples.

- `tuning-lora.md` -- LoRA/QLoRA configuration, Unsloth training, adapter merging
- `tuning-dataset-prep.md` -- Synthetic data generation, quality validation, deduplication
- `tuning-evaluation.md` -- DPO alignment, evaluation metrics, anti-patterns

## Context Optimization

Manage context windows, compression, and attention-aware positioning. Optimize for tokens-per-task.

- `context-window-management.md` -- Five-layer architecture, anchored summarization, compression triggers
- `context-caching.md` -- Just-in-time loading, budget scaling, probe evaluation, CC 2.1.32+

## Evaluation

Evaluate LLM outputs with multi-dimension scoring, quality gates, and benchmarks.

- `evaluation-metrics.md` -- LLM-as-judge, RAGAS metrics, hallucination detection
- `evaluation-benchmarks.md` -- Quality gates, batch evaluation, pairwise comparison

## Prompt Engineering

Design, version, and optimize prompts for production LLM applications.

- `prompt-design.md` -- Chain-of-Thought, few-shot learning, pattern selection guide
- `prompt-testing.md` -- Langfuse versioning, DSPy optimization, A/B testing, self-consistency

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool schema mode | `strict: true` (2026 best practice) |
| Tool count | 5-15 max per request |
| Streaming protocol | SSE for web, WebSocket for bidirectional |
| Buffer size | 50-200 tokens |
| Local model (reasoning) | `deepseek-r1:70b` |
| Local model (coding) | `qwen2.5-coder:32b` |
| Fine-tuning approach | LoRA/QLoRA (try prompting first) |
| LoRA rank | 16-64 typical |
| Training epochs | 1-3 (more risks overfitting) |
| Context compression | Anchored iterative (60-80%) |
| Compress trigger | 70% utilization, target 50% |
| Judge model | GPT-5.2-mini or Haiku 4.5 |
| Quality threshold | 0.7 production, 0.6 drafts |
| Few-shot examples | 3-5 diverse, representative |
| Prompt versioning | Langfuse with labels |
| Auto-optimization | DSPy MIPROv2 |

## Related Skills

- `rag-retrieval` -- Embedding patterns, when RAG is better than fine-tuning
- `agent-loops` -- Multi-step tool use with reasoning
- `llm-evaluation` -- Evaluate fine-tuned and local models
- `langfuse-observability` -- Track training experiments

## Capability Details

### function-calling
**Keywords:** tool, function, define tool, tool schema, function schema, strict mode, parallel tools
**Solves:**
- Define tools with clear descriptions and strict schemas
- Execute tool calls in parallel with asyncio.gather
- Validate inputs and handle errors in tool execution loops

### streaming
**Keywords:** streaming, SSE, Server-Sent Events, real-time, backpressure, token stream
**Solves:**
- Stream LLM tokens via SSE endpoints
- Handle tool calls within streams
- Manage backpressure with bounded queues

### local-inference
**Keywords:** Ollama, local, self-hosted, model selection, GPU, Apple Silicon
**Solves:**
- Set up Ollama for local LLM inference
- Select models based on task and hardware
- Optimize GPU usage and CI integration

### fine-tuning
**Keywords:** LoRA, QLoRA, fine-tune, DPO, synthetic data, PEFT, alignment
**Solves:**
- Configure LoRA/QLoRA for parameter-efficient training
- Generate and validate synthetic training data
- Align models with DPO and evaluate results
