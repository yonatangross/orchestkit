# OTEL gateway source (Loki + Prometheus)

The local `~/.claude/otel/*.jsonl` files (see `otel-fields.md`) only exist on the
machine that ran the session. A floor that sends Claude Code telemetry to a
collector (OTLP to Grafana Alloy, then Loki for events and Prometheus for
metrics) can answer the same questions for every machine and every cloud
session, plus per-lane and per-harness splits. This reference is the remote
source for the `otel` subcommand.

Use it only when the user names the endpoints. Nothing here has a default host:

```bash
ORK_OTEL_LOKI_URL=...        # e.g. a Loki reachable over the VPN, no trailing slash
ORK_OTEL_PROM_URL=...        # e.g. the Prometheus that receives remote write
```

If neither is set, stay on the local JSONL files. Never print tokens or query
auth headers; if the endpoint needs auth, ask the user for the existing
mechanism instead of inventing one.

## Step 1: discover the real names (do not guess)

Exporters translate OTLP names. `claude_code.cost.usage` (unit USD) can land in
Prometheus as `claude_code_cost_usage_USD_total` or another spelling depending
on the exporter version, and Loki's `json` parser flattens `event.name` to a
field whose name depends on the line format. Read them first:

```bash
curl -s "$ORK_OTEL_PROM_URL/api/v1/label/__name__/values" | jq -r '.data[] | select(startswith("claude_code"))'
curl -s "$ORK_OTEL_PROM_URL/api/v1/labels" | jq -r '.data[]' | grep -E '^(hq_|skill|agent|model|effort|query_source)'
curl -sG "$ORK_OTEL_LOKI_URL/loki/api/v1/query_range" --data-urlencode 'query={source="cc-otel"}' \
  --data-urlencode 'limit=1' | jq -r '.data.result[0].values[0][1]' | jq 'keys, (.attributes // {} | keys)'
```

Substitute what Step 1 printed into the queries below. The names below are the
common spelling; they are templates, not facts.

## Step 2: queries

Cost per skill and per agent, 7 days (the metric carries `skill.name`,
`agent.name`, `plugin.name`, `effort` per the Claude Code monitoring docs):

```promql
sum by (skill_name) (increase(claude_code_cost_usage_USD_total[7d]))
sum by (agent_name) (increase(claude_code_cost_usage_USD_total[7d]))
sum by (effort)     (increase(claude_code_cost_usage_USD_total[7d]))
```

Cost and tokens per lane and per harness, when the sessions carry resource
attributes such as `hq.lane` and `hq.harness` (a floor that sets
`OTEL_RESOURCE_ATTRIBUTES`, or a gateway that stamps them):

```promql
sum by (hq_lane)    (increase(claude_code_cost_usage_USD_total[1d]))
sum by (hq_harness) (increase(claude_code_token_usage_tokens_total[1d]))
```

Tool calls and tool error rate per tool, from log events:

```logql
sum by (tool_name) (count_over_time({source="cc-otel"} | json | event_name="tool_result" [1d]))
sum by (tool_name) (count_over_time({source="cc-otel"} | json | event_name="tool_result" | success="false" [1d]))
```

Hook latency, when traces are on (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`): read
the `claude_code.hook` spans in the trace store (for example Langfuse or Tempo).
It carries `hook_name` and `duration_ms` for every hook, not just the ones the
local `hook-timing.jsonl` sampled.

## Output

Same panels as `otel-fields.md`, with two extra splits when the attributes are
present: per lane and per harness. Label the source line `source: gateway
(Loki/Prometheus), <range>` so a reader can tell remote numbers from local ones.

## Graceful fallback

- Endpoint unreachable or empty result: say so in one line ("gateway returned no
  cc-otel series for 7d") and fall back to the local JSONL panels. Never render
  a zero that came from a failed query.
- Name not found in Step 1: report the names that were found; do not retry with
  guessed spellings.
