# Langfuse JS/TS SDK v5

The JS/TS SDK is a **different major** from Python and a different package layout. Python is on
4.x and imports everything from `langfuse`; JS/TS is on 5.x and splits across scoped packages.
Do not translate a Python snippet by guessing the JS name.

Every symbol on this page was taken from the published type declarations at 5.9.1
(`cdn.jsdelivr.net/npm/@langfuse/<pkg>@5.9.1/dist/index.d.ts`). If you add one, verify it the same
way — this file previously documented `LangfuseExporter`, a class that has never existed.

## Packages

| Package | Exports you actually use |
|---|---|
| `@langfuse/otel` | `LangfuseSpanProcessor`, `MaskFunction`, `ShouldExportSpan`, `isDefaultExportSpan`, `isGenAISpan`, `isKnownLLMInstrumentor`, `isLangfuseSpan` |
| `@langfuse/tracing` | `observe`, `startObservation`, `startActiveObservation`, `updateActiveObservation`, `createTraceId`, `getActiveTraceId`, `setActiveTraceIO`, `propagateAttributes` |
| `@langfuse/client` | `LangfuseClient`, `DatasetManager`, `ExperimentManager`, `ScoreManager`, `PromptManager`, `createEvaluatorFromAutoevals`, `RegressionError` |
| `@langfuse/langchain` | `CallbackHandler` |
| `@langfuse/openai` | OpenAI SDK auto-instrumentation |
| `@langfuse/vercel-ai-sdk` | `LangfuseVercelAiSdkIntegration` |

Two traps:

- **`@langfuse/core` is not the client.** It is an internal utility package ("Core functions and
  utilities for Langfuse packages") exporting API types and `LangfuseAPIClient`. It has no
  `Langfuse` export. Never install or import it directly.
- **`@langfuse/vercel` does not exist.** The successor to the old `langfuse-vercel` is
  `@langfuse/vercel-ai-sdk`.

## Tracing setup

```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// A SpanProcessor, NOT an exporter — it goes in `spanProcessors`, never `traceExporter`.
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
sdk.start();

// Short-lived processes MUST flush, or trailing spans are dropped on exit.
main().finally(() => sdk.shutdown());
```

Credentials default to `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`
(default `https://cloud.langfuse.com`).

### LangfuseSpanProcessorParams

| Param | Purpose |
|---|---|
| `publicKey` / `secretKey` / `baseUrl` | Credentials; fall back to env |
| `mask` | `MaskFunction` — redact span data before export |
| `shouldExportSpan` | `ShouldExportSpan` — full override of default span filtering |
| `flushAt` / `flushInterval` | Batch size / interval |
| `exportMode` | `"immediate"` or `"batched"` |
| `environment` / `release` | Tag every span |
| `mediaUploadEnabled`, `timeout`, `additionalHeaders`, `exporter` | Less common |

### Masking and filtering — the JS equivalents of the Python kwargs

The Python client takes `should_export_span` as a constructor kwarg. In JS the same two levers live
on the processor:

```typescript
new LangfuseSpanProcessor({
  // Redact secrets from span payloads before they leave the process.
  mask: ({ data }) =>
    typeof data === "string" ? data.replace(/secret_\w+/g, "secret_***") : data,

  // Drop noisy infra spans (DB drivers, DNS, HTTP clients) to cut ingestion cost.
  shouldExportSpan: ({ otelSpan }) => otelSpan.name.startsWith("my-service"),
});
```

`shouldExportSpan` is a **full override** of the default filtering. To narrow rather than replace
it, compose with the shipped predicate:

```typescript
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";

new LangfuseSpanProcessor({
  shouldExportSpan: (params) => isDefaultExportSpan(params) && !params.otelSpan.name.startsWith("pg."),
});
```

## Manual instrumentation

```typescript
import { observe, startActiveObservation, updateActiveObservation } from "@langfuse/tracing";

const tracedFn = observe(async (input: string) => {
  updateActiveObservation({ metadata: { chunks: 12 } });
  return await llm.generate(input);
}, { name: "analyze_content" });

await startActiveObservation("retrieval", async () => {
  return await vectorStore.similaritySearch(query);
});
```

## Client API — prompts, scores, datasets

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();   // reads the same env vars

const prompt = await langfuse.prompt.get("summarize");
const dataset = await langfuse.dataset.get("my-evaluation-dataset");
```

## LangChain JS

```typescript
import { CallbackHandler } from "@langfuse/langchain";

const handler = new CallbackHandler({
  sessionId: "session_abc",
  userId: "user_123",
  tags: ["production"],
});

await chain.invoke({ input }, { callbacks: [handler] });
```

## Vercel AI SDK

```bash
npm install @langfuse/vercel-ai-sdk @langfuse/client @langfuse/tracing @langfuse/otel
```

```typescript
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";

registerTelemetry(new LangfuseVercelAiSdkIntegration());
```

On the older AI SDK v6 line there is no integration package: set
`experimental_telemetry: { isEnabled: true }` on the call and let `LangfuseSpanProcessor` collect it.

## Experiments and evaluators

The JS client ships a full experiment runner the Python-focused pages do not cover.

```typescript
const dataset = await langfuse.dataset.get("my-dataset");

const result = await dataset.runExperiment({
  name: "Model Evaluation",
  runName: "Model Evaluation Run 1",   // optional
  task: myTask,
  evaluators: [myEvaluator],
});
```

Type contracts worth knowing before you write one:

| Type | Shape |
|---|---|
| `ExperimentTask` | `(params) => Promise<any>` — receives `input`, `expectedOutput`, `metadata` |
| `Evaluator` | `(params) => Promise<Evaluation \| Evaluation[]>` — scores ONE item |
| `RunEvaluator` | `(params) => Promise<Evaluation \| Evaluation[]>` — scores the WHOLE run, receives every item's result |
| `Evaluation` | `{ name, value, comment?, metadata?, dataType?, configId? }` |

Use `Evaluator` for per-item quality and `RunEvaluator` for aggregate assertions (pass rate, mean
score) — a per-item evaluator cannot see the other items.

`createEvaluatorFromAutoevals` adapts an autoevals scorer instead of hand-writing one, and
`RegressionError` is thrown when a run regresses against a configured baseline — catch it to fail
CI on quality drops rather than only on exceptions.

## Cross-references

- Python v4 tracing: `rules/llm-langfuse-traces.md`
- Cost tracking and Metrics API v2: `rules/llm-cost-tracking.md`
- Migration paths for both SDKs: `references/migration-v3-v4.md`
