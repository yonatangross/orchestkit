# LangChain-ecosystem currency audit — verified evidence

Probed live 2026-07-25 against PyPI, npm registry, and published `.d.ts` bundles.
Everything below is a measurement, not a recollection.

## 1. Surface inventory (what ork actually ships)

| Component | Kind | Ecosystem role |
|---|---|---|
| `src/skills/langgraph` | skill, 37 rules, v2.2.0 | LangGraph patterns (Python only) |
| `src/skills/monitoring-observability` | skill, 12 rules + 24 refs, v3.0.0 | Langfuse tracing/cost/eval |
| `src/skills/agent-orchestration` | skill | framework comparison incl. LangGraph |
| `src/skills/golden-dataset` | skill | Langfuse datasets |
| `src/skills/testing-llm` | skill | DeepEval / RAGAS |
| `src/skills/llm-integration` | skill | `langchain-ollama` pin |
| `src/agents/workflow-architect.md` | agent | "Design LangGraph 1.2 workflow graphs" |
| `src/agents/eval-runner.md` | agent | DeepEval/RAGAS → Langfuse scores |
| `tests/evals/skills/langgraph.eval.yaml` + 4 more | evals | trigger coverage |

## 2. Live upstream versions (2026-07-25)

### PyPI
```
langgraph                     1.2.9    2026-07-10
langchain                     1.3.14   2026-07-16
langchain-core                1.5.1    2026-07-23
langchain-anthropic           1.5.2    2026-07-24
langchain-openai              1.4.1    2026-07-23
langchain-ollama              1.1.0    2026-04-07
langgraph-checkpoint          4.1.1    2026-05-22
langgraph-checkpoint-postgres 3.1.0    2026-05-12
langgraph-checkpoint-sqlite   3.1.0    2026-05-12
langgraph-supervisor          0.0.31   2025-11-19   <- upstream itself stale
langgraph-swarm               0.1.0    2025-12-04   <- upstream itself stale
langgraph-sdk                 0.4.2    2026-06-01
langgraph-cli                 0.4.31   2026-07-10
langfuse                      4.14.1   2026-07-20
langsmith                     0.10.10  2026-07-23
deepeval                      4.1.3    2026-07-22
ragas                         0.4.3    2026-01-13
```

### npm
```
@langchain/langgraph            1.4.8
@langchain/core                 1.2.3
langchain                       1.5.4
@langchain/anthropic            1.5.2
@langchain/langgraph-checkpoint 1.1.3
@langchain/langgraph-sdk        1.9.28
langfuse                        3.38.20   (legacy monolith, superseded)
langfuse-langchain              3.38.20   (legacy, superseded)
@langfuse/client                5.9.1
@langfuse/core                  5.9.1
@langfuse/tracing               5.9.1
@langfuse/otel                  5.9.1
@langfuse/langchain             5.9.1
@langfuse/openai                5.9.1
@langfuse/vercel                DOES NOT EXIST
langsmith                       0.8.7
```

## 3. Broken code shipped to users (hard-verified)

Fetched `https://cdn.jsdelivr.net/npm/@langfuse/otel@5.9.1/dist/index.d.ts`:

```
export { KNOWN_LLM_INSTRUMENTATION_SCOPE_PREFIXES, LangfuseSpanProcessor,
         type LangfuseSpanProcessorParams, type MaskFunction, type ShouldExportSpan,
         isDefaultExportSpan, isGenAISpan, isKnownLLMInstrumentor, isLangfuseSpan }
```

There is **no `LangfuseExporter` export**. ork ships `import { LangfuseExporter } from "@langfuse/otel"`
in three places, all of which throw at import time:

- `src/skills/monitoring-observability/rules/llm-langfuse-traces.md:168`
- `src/skills/monitoring-observability/references/framework-integrations.md:296`
- `src/skills/monitoring-observability/references/migration-v2-v3.md:243`

Fetched `@langfuse/core@5.9.1` d.ts: the export list is API types plus `LangfuseAPIClient`.
There is **no `Langfuse` class export**. ork ships
`import { Langfuse } from "@langfuse/core"` at `migration-v2-v3.md:235` — also broken.

Fetched `@langfuse/client@5.9.1` d.ts: exports `LangfuseClient` (the real client), plus a whole
experiments surface ork does not mention: `ExperimentManager`, `RunEvaluator`, `Evaluator`,
`createEvaluatorFromAutoevals`, `RegressionError`, `DatasetManager`, `ScoreManager`.

## 4. Version-claim defects

| Claim in ork | Reality | File |
|---|---|---|
| `@langchain/langgraph >= 1.2.0` | npm latest 1.4.8 | `langgraph/SKILL.md` frontmatter `targets:` |
| "Langfuse v3 integrates with modern AI frameworks" | skill targets v4; JS SDK is v5 | `framework-integrations.md:3` |
| Doc named `migration-v2-v3.md` | content is v3→v4 Python and v3→v4 JS | `monitoring-observability/references/` |
| JS table `langfuse-vercel` → `@langfuse/vercel` | `@langfuse/vercel` is unpublished | `migration-v2-v3.md:222` |

## 5. LangGraph 1.2 content misattribution

`src/skills/langgraph/SKILL.md:35` opens a callout: **"LangGraph 1.2 (Q1 2026) — new in this bump"**
listing deferred nodes, model middleware, node-level caching. LangGraph 1.2 actually shipped
**12 May 2026**, and its headline additions were different:

| Real 1.2 feature | grep hits in `src/` |
|---|---|
| `DeltaChannel` (+ `snapshot_frequency`) | 0 |
| Per-node timeouts (`timeout=` on `add_node`, `TimeoutPolicy`, `run_timeout`, `idle_timeout`, `NodeTimeoutError`) | 0 |
| Node error handlers (`error_handler=` on `add_node`, typed `NodeError`, `Command` recovery) | 0 |
| `RunControl` cooperative graceful shutdown (`runtime.control`) | 0 |

The three features ork *does* document are real, but are 1.1-era. So the skill's "what's new in 1.2"
section describes the previous minor, and the actual 1.2 surface is absent.

Downstream consequence: `rules/routing-retry-loops.md` still teaches a hand-rolled `retry_count`
counter in state as the correct pattern. As of 1.2 the framework-native answer is
`add_node(..., retry_policy=..., timeout=..., error_handler=...)`.

## 6. Structural root cause — no currency automation covers this surface

`scripts/check-labs-versions.mjs` is the repo's version watchdog. Its `TARGETS` list:

```js
emulate, portless, agent-browser, @json-render/core (x2), @json-render/mcp, agent-browser
```

It resolves versions with `npm view <pkg> version`. Consequences:

1. **It is npm-only.** `langgraph`, `langchain`, `langfuse`, `deepeval`, `ragas` are PyPI. The
   watchdog structurally cannot see them.
2. **It watches 5 packages.** None are LangChain-ecosystem.
3. It only reads/writes the `upstream-version-tested:` frontmatter key. Neither the `langgraph`
   nor the `monitoring-observability` skill declares that key, so even adding them to `TARGETS`
   would `SKIP` today.
4. `tests/skills/structure/test-targets-floor-agreement.mjs` compares `targets:` floors **between
   skills** — it never compares a floor to upstream reality. A floor can be two minors stale and
   still pass, which is exactly the `@langchain/langgraph >=1.2.0` vs 1.4.8 case.
5. `tests/skills/structure/test-upstream-version-drift.mjs` only matches `0.x` version tokens by
   design ("all four currently tracked packages are 0-major"). Every LangChain-ecosystem package
   is 1.x or 4.x, so it is a structural no-op here.

Net: the only guard that would have caught any of section 3 or 4 does not exist.

## 7. Honest counter-findings (things that are NOT stale)

Do not let the gap list imply the whole surface rotted.

- Langfuse **Python** v4 coverage is genuinely current: `as_type=`, `score_current_span()`,
  `should_export_span` as a client kwarg, `LangfuseMedia`, Observations API v2, Metrics API v2,
  and the correct "no `LangfuseSpanProcessor` module in Python v4" note are all present.
- `langgraph` Python floor `>=1.2.0` matches PyPI latest 1.2.9. That pin is correct.
- `create_react_agent` deprecation → `create_agent` from `langchain.agents` is correctly captured,
  including the `pre_model_hook`/`post_model_hook` → `before_model`/`after_model` middleware move.
- `langgraph-supervisor` (0.0.31) and `langgraph-swarm` (0.1.0) are stale **upstream**, not in ork.
  ork teaching hand-rolled supervisors instead of that package is defensible.

## Sources

- https://pypi.org/pypi/{langgraph,langchain,langfuse,...}/json (live JSON API)
- https://registry.npmjs.org/{...}/latest (live registry)
- https://cdn.jsdelivr.net/npm/@langfuse/otel@5.9.1/dist/index.d.ts
- https://cdn.jsdelivr.net/npm/@langfuse/core@5.9.1/dist/index.d.ts
- https://cdn.jsdelivr.net/npm/@langfuse/client@5.9.1/dist/index.d.ts
- https://langfuse.com/docs/observability/sdk/typescript/setup
- https://www.langchain.com/blog/fault-tolerance-in-langgraph
- https://github.com/langchain-ai/langgraph/releases
- https://langfuse.com/docs/v4
