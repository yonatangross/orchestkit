# dev-agent-lens Integration

LiteLLM-based proxy that intercepts Claude API calls for cost tracking, latency monitoring, and model routing visibility. Complements OrchestKit's hook-level JSONL analytics with API-level observability.

## When to Use dev-agent-lens vs Other Layers

| Layer | What It Sees | Latency Impact | Setup |
|-------|-------------|----------------|-------|
| **dev-agent-lens** (proxy) | API calls, token counts, model routing, costs | +5-15ms per call | Docker compose, env vars |
| **OrchestKit JSONL** (hooks) | Hook timing, agent spawns, skill usage, team activity | Zero (async writes) | Already active |
| **CC Native OTLP** (telemetry) | Tool-level spans (Read, Write, Bash, Task) | Zero (built-in) | 3 env vars |

**Use dev-agent-lens when you need**: per-request cost breakdown, model version tracking, API error rates, prompt/completion token ratios, latency percentiles at the API boundary.

**Don't use dev-agent-lens when**: you only need hook/skill/agent-level data (use JSONL), or tool-level spans (use CC OTLP).

## Architecture

```
Claude Code CLI
  │
  ├─ ANTHROPIC_BASE_URL=http://localhost:4000 ──→ dev-agent-lens (LiteLLM proxy :4000)
  │                                                  │
  │                                                  ├─→ Anthropic API (actual model calls)
  │                                                  ├─→ Langfuse (traces, costs)
  │                                                  └─→ Prometheus (:9090, optional)
  │
  ├─ OTEL_EXPORTER_OTLP_ENDPOINT ──→ Langfuse OTEL (:3100/api/public/otel)
  │                                    (tool-level spans from CC native telemetry)
  │
  └─ ~/.claude/analytics/*.jsonl ──→ JSONL bridge script (optional)
                                      (hook timing, agent routing, skill usage)
```

## API Key Caveat

**Claude Code Free/Pro users**: Cannot use `ANTHROPIC_BASE_URL` — the CLI sends requests directly to Anthropic's API using your subscription. The proxy approach only works with **API key access** (pay-per-token via `ANTHROPIC_API_KEY`).

**Claude Code Max users**: Same limitation — Max plans route through Anthropic's managed infrastructure, not a configurable base URL.

This means dev-agent-lens is primarily useful for:
- Self-hosted/enterprise deployments using API keys
- Development environments where you control the API routing
- CI/CD pipelines calling Claude via API

## Docker Compose Template

```yaml
# Add to your project's docker-compose.yml
# Profile: observability (docker compose --profile observability up)

services:
  dev-agent-lens:
    image: ghcr.io/berriai/litellm:main-latest
    profiles: [observability]
    ports:
      - "4000:4000"
    environment:
      LITELLM_MASTER_KEY: "sk-dev-local"
      LANGFUSE_PUBLIC_KEY: "${LANGFUSE_PUBLIC_KEY:-pk-lf-dev}"
      LANGFUSE_SECRET_KEY: "${LANGFUSE_SECRET_KEY:-sk-lf-dev}"
      LANGFUSE_HOST: "${LANGFUSE_HOST:-http://langfuse-web:3100}"
    volumes:
      - ./litellm-config.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### LiteLLM Config (`litellm-config.yaml`)

```yaml
model_list:
  - model_name: claude-sonnet-4-20250514
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-opus-4-20250514
    litellm_params:
      model: anthropic/claude-opus-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-haiku-4-5-20251001
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: sk-dev-local

litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
  cache: false
  set_verbose: false
```

### Shell Configuration (API key users only)

```bash
# ~/.zshrc or ~/.bashrc — only for API key access
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_API_KEY="sk-ant-..."  # your actual key
```

## What You See in Langfuse

With dev-agent-lens forwarding to Langfuse, each Claude API call creates a trace with:

- **Model**: Exact model ID (`claude-sonnet-4-20250514`)
- **Tokens**: Input/output/cache token counts
- **Cost**: Per-request USD cost (Anthropic pricing)
- **Latency**: Time-to-first-token, total duration
- **Status**: Success/failure, error codes, rate limits
- **Metadata**: Request headers, retry counts

This is the **API boundary** layer — it sees what crosses the network. It does NOT see:
- Which OrchestKit agent spawned the request (use JSONL for that)
- Which tool CC executed (use CC OTLP for that)
- Hook execution timing (use JSONL for that)

## Complementary Data: Proxy + Hooks + OTLP

The three layers together give full observability:

```
Question: "Why was this session slow?"

Layer 1 (CC OTLP):    Tool spans show 47 Read calls, 12 Bash calls
Layer 2 (JSONL):       Hook timing shows pre-push hook took 8.3s
Layer 3 (Proxy):       API calls show 3 rate-limited retries, p99 latency 4.2s

Answer: Rate limiting + excessive file reads + slow pre-push hook
```

## References

- [LiteLLM Proxy docs](https://docs.litellm.ai/docs/proxy/quick_start)
- [Langfuse LiteLLM integration](https://langfuse.com/docs/integrations/litellm)
- [CC OTLP telemetry](https://docs.anthropic.com/en/docs/claude-code/telemetry)
