# Observability Layers for Claude Code

Three complementary observability layers for Claude Code sessions. Each captures different data at different boundaries. No single layer replaces the others.

## Layer Comparison

| | CC Native OTLP | OrchestKit JSONL | LiteLLM Proxy (dev-agent-lens) |
|---|---|---|---|
| **What it captures** | Tool-level spans (Read, Write, Bash, Task) | Hook timing, agent routing, skill usage, team activity, session summaries | API calls, token counts, costs, model routing, latency |
| **Boundary** | Inside CC process | Hook execution layer | Network (API proxy) |
| **Latency impact** | Zero | Zero (async file writes) | +5-15ms per API call |
| **Setup effort** | 3 env vars | Already active (zero config) | Docker compose + env vars |
| **API key required** | No (OTLP endpoint only) | No | Yes (proxy needs `ANTHROPIC_API_KEY`) |
| **Works with CC Free/Pro** | Yes (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) | Yes | No (can't set `ANTHROPIC_BASE_URL`) |
| **Data format** | OpenTelemetry spans | JSONL files in `~/.claude/analytics/` | Depends on callback (Langfuse traces, Prometheus metrics) |
| **Visualization** | Any OTLP-compatible backend | Custom (bridge script needed) | Langfuse UI, Grafana |

## Layer 1: CC Native OTLP (Tool Spans)

Built into Claude Code. Exports OpenTelemetry spans for every tool invocation.

### Setup

```bash
# Add to ~/.zshrc
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:3100/api/public/otel"
export OTEL_EXPORTER_OTLP_HEADERS="x-langfuse-public-key=pk-lf-dev,x-langfuse-secret-key=sk-lf-dev"
```

### What You See

- Every `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Task` call as a span
- Span duration, parent-child relationships
- Tool arguments and results (if enabled)

### Best For

- Understanding tool usage patterns within a session
- Identifying slow tool calls (file reads on large files, long bash commands)
- Correlating tool sequences with outcomes

## Layer 2: OrchestKit JSONL (Hook Analytics)

OrchestKit hooks already write structured analytics to `~/.claude/analytics/`:

| File | Contents | Written By |
|------|----------|------------|
| `hook-timing.jsonl` | Hook execution durations, success/failure | All hooks |
| `agent-usage.jsonl` | Agent spawn events, model selection, duration | Agent routing hooks |
| `session-summary.jsonl` | Session-level metrics (duration, tool counts, costs) | Session end hook |
| `skill-usage.jsonl` | Skill invocation events, parameters | Skill dispatch hooks |
| `task-usage.jsonl` | Task creation, completion, dependency chains | Task tracking hooks |
| `team-activity.jsonl` | Team creation, member spawns, message counts | Team coordination hooks |

### What You See

- Which agents were spawned and their model assignments
- Hook execution timing (are hooks slowing down sessions?)
- Skill usage frequency and patterns
- Team coordination metrics

### Best For

- OrchestKit-specific observability (agent routing decisions, skill patterns)
- Hook performance monitoring
- Usage analytics across sessions

### Visualization

JSONL files need a bridge to reach a visualization tool. Options:
- **Langfuse bridge**: Python script watches JSONL, pushes to Langfuse as traces/spans
- **jq + CLI**: Quick ad-hoc queries (`cat hook-timing.jsonl | jq 'select(.duration_ms > 100)'`)
- **DuckDB**: SQL queries over JSONL files for analytics

## Layer 3: LiteLLM Proxy (API Observability)

Intercepts API calls between Claude Code and Anthropic's API. See `references/dev-agent-lens.md` for full setup.

### What You See

- Per-request token counts and costs
- Model version used for each call
- API latency (time-to-first-token, total)
- Rate limit events and retries
- Error rates by model/endpoint

### Best For

- Cost tracking and budget alerts
- API performance monitoring
- Model routing verification
- Rate limit debugging

### Limitation

Only works with API key access (`ANTHROPIC_API_KEY`). Claude Code Free/Pro/Max subscriptions route through Anthropic's infrastructure — the proxy cannot intercept these calls.

## Choosing Your Stack

### Minimal (recommended starting point)

```
CC OTLP → Langfuse     (tool spans, zero setup cost)
JSONL → jq queries      (hook data, already exists)
```

### Full Local Observability

```
CC OTLP → Langfuse          (tool spans)
JSONL → Langfuse bridge      (hook/agent/skill spans)
LiteLLM → Langfuse           (API costs/latency)
```

### Enterprise / Multi-User

```
CC OTLP → Jaeger/Tempo       (tool spans, self-hosted)
JSONL → Custom pipeline       (ETL to data warehouse)
LiteLLM → Prometheus/Grafana  (API metrics, alerting)
```

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Add Langfuse SDK to OrchestKit hooks | SDK init 50-150ms per hook process spawn | Use JSONL bridge (SDK init once, long-lived) |
| Require `LANGFUSE_*` env vars in OrchestKit | Optional cloud API keys kill adoption | Keep OrchestKit's output format-agnostic (JSONL) |
| Use proxy for hook timing data | Proxy only sees API boundary | Read `hook-timing.jsonl` directly |
| Skip CC OTLP in favor of proxy-only | Proxy misses tool-level detail | Use both — they're complementary |

## References

- [CC Telemetry docs](https://docs.anthropic.com/en/docs/claude-code/telemetry)
- [OpenTelemetry OTLP spec](https://opentelemetry.io/docs/specs/otlp/)
- [Langfuse OTEL ingestion](https://langfuse.com/docs/open-telemetry)
- [dev-agent-lens setup](references/dev-agent-lens.md)
