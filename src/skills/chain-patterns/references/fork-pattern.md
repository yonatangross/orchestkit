# Fork Pattern — Cache-Sharing Parallel Subagents

CC 2.1.89 automatically forks subagents that meet certain criteria, sharing the parent's cached API prefix. This eliminates cold-start re-tokenization and reduces API cost by 30-50% for multi-agent skills.

## When CC Forks Automatically

CC routes `Agent()` calls to fork (cache-sharing) mode when ALL conditions are met:

| Condition | Requirement |
|-----------|-------------|
| **No custom model** | Agent inherits parent model (no `model=` parameter) |
| **No worktree isolation** | No `isolation: "worktree"` parameter |
| **Short prompt** | Prompt body < 500 words (only the divergent part) |
| **Same tool schema** | Agent uses same tools as parent (no `exact-tools` override) |

If ANY condition fails, CC falls back to standard cold-start `Agent()`.

## Fork-Friendly Prompt Template

```python
Agent(
  subagent_type="backend-system-architect",
  name="backend-explorer",            # Named for @mention routing
  prompt="""Scope: {specific_task}

  Context: {brief_shared_context}

  Deliverable: {expected_output_format}

  RESULT: End with a one-line summary.""",
  run_in_background=True,
  max_turns=25
)
```

**Rules:**
- Start with `Scope:` header (signals fork-friendly intent)
- Keep prompt under 500 words — parent context is inherited
- Do NOT repeat system instructions (fork inherits them)
- Do NOT set `model=` (breaks cache prefix sharing)
- Do NOT set `isolation: "worktree"` (breaks fork mode)
- End with `RESULT:` summary line for structured collection

## What Forks Inherit

Forked subagents automatically receive:
- Parent's full system prompt and CLAUDE.md rules
- All prior conversation context (cached)
- Tool definitions (same schema, same cache prefix)
- MCP server connections
- Session environment variables

They do NOT inherit:
- Parent's in-progress edits (no shared filesystem writes)
- Other forks' outputs (forks are isolated from each other)

## Cache Mechanics

```
Parent conversation:
  System prompt + CLAUDE.md + tool schemas + N turns of context
  ───────────────────────────────────────────────────────────
  │                CACHED PREFIX (~90%)                     │
  ───────────────────────────────────────────────────────────
                                                    ▼
Fork A: [cached prefix] + "Scope: analyze backend..."     (~10% new)
Fork B: [cached prefix] + "Scope: analyze frontend..."    (~10% new)
Fork C: [cached prefix] + "Scope: check test coverage..." (~10% new)
                           ▲
                           Only this part is re-tokenized
```

**Cost: ~1.1× instead of ~3× for 3 parallel agents.**

## When NOT to Fork

| Scenario | Why | Use Instead |
|----------|-----|-------------|
| Agent needs worktree isolation | File edits conflict between forks | `Agent(isolation="worktree")` |
| Agent needs custom model | e.g., Haiku for cheap analysis | `Agent(model="haiku")` |
| Agent reads prior phase handoff | Handoff file not in cache prefix | Standard `Agent()` with file content in prompt |
| Coordinator mode active | Coordinator disables forks | Standard `Agent()` |
| Agent needs `permission_mode: "bubble"` | Prompts appear in parent terminal | Only if acceptable UX |

## Fork-Eligible Skills

| Skill | Agents | Fork-Ready | Notes |
|-------|--------|------------|-------|
| explore | 4 parallel | ✓ | All read-only, no worktree |
| brainstorm | 3-5 parallel | ✓ | Divergent ideation, no state |
| verify | 6-7 parallel | ⚠ partial | Domain filter runs in parent; fork after filtering |
| review-pr | 6-7 parallel | ⚠ partial | Context injection in parent; fork the review agents |
| implement | 3 parallel | ✗ | Worktree isolation required |
| fix-issue | 1-5 parallel | ✗ | Worktree isolation for RCA agents |

## Context Stager Behavior

The `subagent-context-stager` SubagentStart hook detects forks via `input.is_fork`:
- **Fork = true**: Skip heavy context injection (CLAUDE.md rules, decisions, task list) — fork inherits parent context
- **Fork = false**: Full context staging (standard Agent cold-start path)

This prevents double-injection that wastes tokens and can confuse the model.

## Analytics

Fork metrics are logged to `subagent-quality.jsonl`:
```json
{
  "agent": "backend-system-architect",
  "is_fork": true,
  "cache_creation_tokens": 150000,
  "cache_read_tokens": 148500,
  "cache_hit_pct": 99.0,
  "duration_ms": 12500
}
```

Compare `cache_hit_pct` between fork and non-fork agents to measure savings.

## Fallback Strategy

If fork fails (CC version < 2.1.89, coordinator mode, etc.), the skill should gracefully degrade:

```python
# Fork-friendly prompt (CC auto-detects):
Agent(subagent_type="Explore", prompt="Scope: ...", run_in_background=True)
# ↑ If CC can fork: forked (cheap)
# ↑ If CC can't fork: standard cold-start (works, just more expensive)
```

No code change needed for fallback — CC handles routing automatically. The prompt pattern works in both modes.
