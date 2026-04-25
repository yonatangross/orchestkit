# CC 2.1.117 + 2.1.119 OTEL Enrichments

OpenTelemetry attributes shipped in CC 2.1.117 (3 fields) and CC 2.1.119 (3 more) that enable cross-cutting analytics this skill did not previously surface. All are **optional** — data from older CC versions lacks them and every query here falls back cleanly.

## The fields

### From 2.1.117 (M117 adoption)

| Field | Event | Values | Purpose |
|---|---|---|---|
| `command_name` | `user_prompt` | `/ork:implement`, `/commit`, `/effort`, … (string, may be null) | Which slash command triggered this prompt. Null for free-text prompts. |
| `command_source` | `user_prompt` | `user` \| `model` | `user` = user typed the slash; `model` = model invoked it via `SlashCommand` tool. |
| `effort` | `cost.usage`, `token.usage`, `api_request`, `api_error` | `low` \| `medium` \| `high` \| `xhigh` | Effort tier set via `/effort` or `xhigh` (CC 2.1.111+). |

### From 2.1.119 (M122 adoption)

| Field | Event | Values | Purpose |
|---|---|---|---|
| `duration_ms` | `tool_result`, `tool_decision` (PostToolUse + PostToolUseFailure inputs) | non-negative integer (ms) | Server-measured per-tool latency. Accurate for streaming/async tools where local timing misses dispatch/queue overhead. |
| `tool_use_id` | `tool_result`, `tool_decision` | string (UUID-like) | Correlates a PreToolUse span with its PostToolUse span — enables pre/post pair queries in tracing backends. |
| `tool_input_size_bytes` | `tool_result` | non-negative integer | Byte size of the serialized tool input. Surfaces oversized inputs that bloat context (e.g., 100K-byte file_path lists from broken tool callers). |

Exports land in `~/.claude/otel/` (when OTEL export is enabled in `settings.json`) and in the same JSONL streams this skill already reads if OTEL-to-JSONL bridging is on.

## Data location

```
~/.claude/otel/user-prompts.jsonl    # command_name, command_source         (2.1.117)
~/.claude/otel/usage.jsonl           # effort                                (2.1.117)
~/.claude/otel/api-requests.jsonl    # effort                                (2.1.117)
~/.claude/otel/tool-results.jsonl    # duration_ms, tool_use_id, tool_input_size_bytes  (2.1.119)
~/.claude/otel/tool-decisions.jsonl  # duration_ms, tool_use_id              (2.1.119)
```

When OTEL export is disabled the files simply do not exist — queries below handle this with `2>/dev/null` and empty-result fallbacks.

## Dashboard panels

Three new panels compose a CC-2.1.117-aware extension of the existing `summary` subcommand.

### Panel 1 — Top invoked slash commands (user-typed vs model-delegated)

```bash
jq -s 'map(select(.command_name != null))
  | group_by(.command_name)
  | map({
      command: .[0].command_name,
      total: length,
      user: (map(select(.command_source == "user")) | length),
      model: (map(select(.command_source == "model")) | length)
    })
  | sort_by(-.total)' ~/.claude/otel/user-prompts.jsonl 2>/dev/null
```

Output shape: `[{command: "/ork:implement", total: 47, user: 42, model: 5}, …]`.

Falls back to `[]` if the file is absent — render as "no OTEL data available (upgrade to CC ≥ 2.1.117)".

### Panel 2 — Per-effort-level cost breakdown

```bash
jq -s 'map(select(.effort != null))
  | group_by(.effort)
  | map({
      effort: .[0].effort,
      runs: length,
      input_tokens: (map(.input_tokens // 0) | add),
      output_tokens: (map(.output_tokens // 0) | add),
      est_cost_usd: (map(.cost_usd // 0) | add | . * 100 | floor / 100)
    })
  | sort_by(.effort)' ~/.claude/otel/usage.jsonl 2>/dev/null
```

Expected order when rendered: `low → medium → high → xhigh`. If all rows share one effort tier, present as a single-row table rather than an empty-panel error.

### Panel 3 — Effort-vs-success rate correlation

```bash
jq -s 'map(select(.effort != null))
  | group_by(.effort)
  | map({
      effort: .[0].effort,
      runs: length,
      success_rate: ((map(select(.success == true)) | length) / length * 100 | floor),
      error_rate: ((map(select(.error != null)) | length) / length * 100 | floor),
      avg_duration_ms: (map(.duration_ms // 0) | add / length | floor)
    })
  | sort_by(.effort)' ~/.claude/otel/api-requests.jsonl 2>/dev/null
```

Interpretation: a monotonic success-rate increase from `low → xhigh` is the expected signal. A dip in the middle (e.g., medium worse than low) often indicates context-budget thrash at that tier.

### Panel 4 — Per-tool latency p50/p95 (CC 2.1.119)

```bash
jq -s 'map(select(.duration_ms != null))
  | group_by(.tool_name)
  | map({
      tool: .[0].tool_name,
      runs: length,
      p50: ((map(.duration_ms) | sort)[length / 2 | floor]),
      p95: ((map(.duration_ms) | sort)[(length * 0.95) | floor]),
      max: (map(.duration_ms) | max)
    })
  | sort_by(-.p95)' ~/.claude/otel/tool-results.jsonl 2>/dev/null
```

Use this to spot tools whose tail latency dominates session time. p95 ≫ p50 typically indicates either (a) variable input size or (b) backend-throttling on a particular MCP server.

### Panel 5 — Oversized tool inputs (CC 2.1.119)

```bash
jq -s 'map(select(.tool_input_size_bytes != null and .tool_input_size_bytes > 10000))
  | sort_by(-.tool_input_size_bytes)
  | .[0:10]
  | map({
      tool: .tool_name,
      bytes: .tool_input_size_bytes,
      kb: (.tool_input_size_bytes / 1024 | floor),
      tool_use_id: .tool_use_id
    })' ~/.claude/otel/tool-results.jsonl 2>/dev/null
```

Top 10 tool inputs over 10 KB. Repeated offenders are usually broken tool callers or unexpected large file_path lists — investigate the matching `tool_use_id` in your traces.

### Panel 6 — Pre/post latency correlation (CC 2.1.119)

```bash
jq -s 'map(select(.tool_use_id != null and .duration_ms != null))
  | group_by(.tool_use_id)
  | map(select(length == 2))    # only pairs (PreToolUse + PostToolUse)
  | map({
      tool_use_id: .[0].tool_use_id,
      tool: .[0].tool_name,
      pre_ms: ((map(select(.event == "tool_decision")) | .[0]?.duration_ms) // 0),
      post_ms: ((map(select(.event == "tool_result")) | .[0]?.duration_ms) // 0)
    })' ~/.claude/otel/tool-decisions.jsonl ~/.claude/otel/tool-results.jsonl 2>/dev/null
```

Reveals hooks that add significant pre-tool latency. If `pre_ms` rivals `post_ms`, the hook chain is the bottleneck — candidate for `type: "mcp_tool"` direct dispatch (see `src/skills/chain-patterns/references/mcp-tool-hooks.md`).

## Graceful fallback

All three queries:

1. Use `2>/dev/null` on the file read — missing file → empty stream.
2. Filter `select(.command_name != null)` / `select(.effort != null)` — events from older CC versions lack the attributes and are skipped, not rendered as "unknown" bars.
3. Return `[]` on empty input so the dashboard renders a placeholder instead of crashing.

## When to use

Include these panels in `summary` when **any** of the three OTEL files are present with non-empty content for the time range. Otherwise fall back to the legacy `summary` output — do not render empty OTEL panels just because the fields exist in recent events.

## Related

- `src/skills/analytics/references/jq-queries.md` — base queries for non-OTEL JSONL sources.
- `src/skills/analytics/references/cost-estimation.md` — per-model pricing; combines with Panel 2 for dollar-denominated breakdowns.
- `src/hooks/src/lib/cc-version-matrix.ts` — `otel_command_attrs` entry gates these fields behind `MIN_CC_VERSION = 2.1.117`.
