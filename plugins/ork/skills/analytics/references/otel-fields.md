# CC 2.1.117 OTEL Enrichments

Three new OpenTelemetry attributes shipped in CC 2.1.117 that enable cross-cutting analytics this skill did not previously surface. All three are **optional** — data from CC < 2.1.117 will not have them and every query here falls back cleanly.

## The fields

| Field | Event | Values | Purpose |
|---|---|---|---|
| `command_name` | `user_prompt` | `/ork:implement`, `/commit`, `/effort`, … (string, may be null) | Which slash command triggered this prompt. Null for free-text prompts. |
| `command_source` | `user_prompt` | `user` \| `model` | `user` = user typed the slash; `model` = model invoked it via `SlashCommand` tool. |
| `effort` | `cost.usage`, `token.usage`, `api_request`, `api_error` | `low` \| `medium` \| `high` \| `xhigh` | Effort tier set via `/effort` or `xhigh` (CC 2.1.111+). |

Exports land in `~/.claude/otel/` (when OTEL export is enabled in `settings.json`) and in the same JSONL streams this skill already reads if OTEL-to-JSONL bridging is on.

## Data location

```
~/.claude/otel/user-prompts.jsonl    # command_name, command_source
~/.claude/otel/usage.jsonl           # effort
~/.claude/otel/api-requests.jsonl    # effort (on cost.usage + api_request events)
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
