---
title: LLM Integration Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Function Calling (calling) -- CRITICAL -- 3 rules

Enable LLMs to use external tools with strict mode schemas and structured output.

- `calling-tool-definition.md` -- Strict mode schemas, OpenAI/Anthropic formats, LangChain tool binding
- `calling-parallel.md` -- Parallel tool execution, asyncio.gather, strict mode constraints
- `calling-validation.md` -- Input validation with Pydantic, error handling, tool execution loops

## 2. Streaming (streaming) -- HIGH -- 3 rules

Deliver LLM responses in real-time via SSE and handle structured streaming.

- `streaming-sse.md` -- FastAPI SSE endpoints, frontend SSE consumers, async iterators
- `streaming-structured.md` -- Streaming with tool calls, chunk accumulation, partial JSON parsing
- `streaming-backpressure.md` -- Bounded buffers, producer/consumer pattern, stream cancellation

## 3. Local Inference (local) -- HIGH -- 3 rules

Run LLMs locally with Ollama for cost savings, privacy, and offline development.

- `local-ollama-setup.md` -- Installation, model pulling, LangChain integration, environment config
- `local-model-selection.md` -- Model comparison by task, hardware profiles, quantization options
- `local-gpu-optimization.md` -- Apple Silicon tuning, keep-alive, CI integration, provider factory

## 4. Fine-Tuning (tuning) -- HIGH -- 3 rules

Customize LLMs with parameter-efficient techniques and alignment.

- `tuning-lora.md` -- LoRA/QLoRA configuration, Unsloth/PEFT training, adapter merging
- `tuning-dataset-prep.md` -- Synthetic data generation, quality validation, deduplication, formatting
- `tuning-evaluation.md` -- DPO alignment, preference datasets, evaluation metrics, anti-patterns

## 5. Context Optimization (context) -- HIGH -- 2 rules

Context window management, compression strategies, and attention-aware positioning.

- `context-window-management.md` -- Five-layer context architecture, anchored summarization, lost-in-the-middle, compression triggers
- `context-caching.md` -- Just-in-time loading, budget scaling, probe-based evaluation, CC 2.1.32+ auto-scaling

## 6. Evaluation (evaluation) -- HIGH -- 2 rules

LLM output evaluation, quality gates, and benchmarking.

- `evaluation-metrics.md` -- LLM-as-judge, RAGAS metrics, hallucination detection, multi-dimension scoring
- `evaluation-benchmarks.md` -- Quality gates, batch evaluation, pairwise comparison, regression detection

## 7. Prompt Engineering (prompt) -- HIGH -- 2 rules

Prompt design patterns, versioning, and automatic optimization.

- `prompt-design.md` -- Chain-of-Thought, few-shot learning, zero-shot CoT, pattern selection guide
- `prompt-testing.md` -- Langfuse versioning, DSPy optimization, A/B testing, self-consistency
