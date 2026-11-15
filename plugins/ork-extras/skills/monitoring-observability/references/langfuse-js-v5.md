# Langfuse JS/TS SDK v5: the delta from the Python page

Wrap, not tutorial. Full API docs live at <https://langfuse.com/docs/sdk/typescript>. This page
carries only what a Python-shaped mental model gets wrong, plus the symbols this repo has
already been burned by.

The JS/TS SDK is a **different major** from Python and a different package layout. Python is on
4.x and imports everything from `langfuse`; JS/TS is on 5.x and splits across scoped packages.
Do not translate a Python snippet by guessing the JS name.

Every symbol below was taken from the published type declarations at 5.9.1
(`cdn.jsdelivr.net/npm/@langfuse/<pkg>@5.9.1/dist/index.d.ts`). If you add one, verify it the
same way. This file previously documented `LangfuseExporter`, a class that has never existed.

## Package map

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
  `@langfuse/vercel-ai-sdk`. It was documented here for months and was never published.

## It is a SpanProcessor, not an exporter

The single most common porting mistake. It goes in `spanProcessors`, never `traceExporter`.

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
sdk.start();

// Short-lived processes MUST flush, or trailing spans are dropped on exit.
main().finally(() => sdk.shutdown());
```

Credentials default to `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL`
(default `https://cloud.langfuse.com`), the same names the Python client reads.

## Masking and filtering: where the Python kwargs went

The Python client takes `should_export_span` as a constructor kwarg. In JS the equivalent levers
live on the processor as `mask` and `shouldExportSpan`, alongside `flushAt`, `flushInterval`,
`exportMode`, `environment` and `release`.

```typescript
new LangfuseSpanProcessor({
  // Redact secrets from span payloads before they leave the process.
  mask: ({ data }) =>
    typeof data === "string" ? data.replace(/secret_\w+/g, "secret_***") : data,

  // Drop noisy infra spans (DB drivers, DNS, HTTP clients) to cut ingestion cost.
  shouldExportSpan: ({ otelSpan }) => otelSpan.name.startsWith("my-service"),
});
```

`shouldExportSpan` is a **full override** of the default filtering, not a narrowing. To narrow,
compose with the shipped predicate instead of replacing it:

```typescript
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";

new LangfuseSpanProcessor({
  shouldExportSpan: (params) =>
    isDefaultExportSpan(params) && !params.otelSpan.name.startsWith("pg."),
});
```

## Evaluator vs RunEvaluator

The JS client ships an experiment runner the Python-focused pages do not cover, and the two
evaluator shapes are easy to confuse.

| Type | Shape |
|---|---|
| `ExperimentTask` | `(params) => Promise<any>`, receives `input`, `expectedOutput`, `metadata` |
| `Evaluator` | `(params) => Promise<Evaluation \| Evaluation[]>`, scores ONE item |
| `RunEvaluator` | `(params) => Promise<Evaluation \| Evaluation[]>`, scores the WHOLE run |
| `Evaluation` | `{ name, value, comment?, metadata?, dataType?, configId? }` |

Use `Evaluator` for per-item quality and `RunEvaluator` for aggregate assertions (pass rate,
mean score). A per-item evaluator cannot see the other items, so an aggregate check written as
an `Evaluator` silently measures the wrong thing.

`createEvaluatorFromAutoevals` adapts an autoevals scorer instead of hand-writing one, and
`RegressionError` is thrown when a run regresses against a configured baseline. Catch it to fail
CI on quality drops rather than only on exceptions.

On the older AI SDK v6 line there is no integration package: set
`experimental_telemetry: { isEnabled: true }` on the call and let `LangfuseSpanProcessor`
collect it.

## Cross-references

- Ork-specific floors, scars and house decisions: `references/ork-delta.md`
- Python v4 tracing rules: `rules/llm-langfuse-traces.md`
- Upstream migration guides: <https://langfuse.com/docs/sdk/typescript/v4-migration>
