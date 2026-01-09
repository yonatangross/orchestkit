# Context Engineering 2.0 - Initialization Protocol

**Version:** 2.0.0
**Purpose:** Attention-aware, tiered context loading for optimal LLM performance

---

## Architecture Overview

```
.claude/context/
├── identity.json              # START position - Always loaded (~200 tokens)
├── session/
│   └── state.json             # END position - Current task (~500 tokens)
├── knowledge/
│   ├── index.json             # START position - Discovery layer (~150 tokens)
│   ├── decisions/active.json  # START position - On-demand (~400 tokens)
│   ├── patterns/established.json  # MIDDLE position - On-demand (~300 tokens)
│   └── blockers/current.json  # END position - If non-empty (~150 tokens)
├── agents/
│   └── {agent_id}.json        # MIDDLE position - Per-agent (~300 tokens)
└── archive/                   # Never auto-loaded
```

---

## Attention Positioning

The LLM pays **unequal attention** across the context window:

```
Attention
Strength   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
           ↑                                                      ↑
        START              MIDDLE (weakest attention)           END
```

### Position Assignments

| Position | Attention | Content | When to Load |
|----------|-----------|---------|--------------|
| **START** | High | Identity, constraints, critical decisions | Always |
| **MIDDLE** | Lower | Patterns, agent context, background knowledge | On-demand |
| **END** | High | Current task, blockers, next steps | Always |

---

## Automatic Loading (Hooks)

Context loading is **hook-driven**, not manual:

| Hook Event | What Loads | Position |
|------------|------------|----------|
| `session_start` | identity.json, knowledge/index.json, session/state.json | START, END |
| `before_subagent` | agents/{agent_id}.json + relevant patterns | MIDDLE |
| `after_tool_use` | Budget monitoring, compression if >70% | N/A |
| `session_end` | Archives session, compresses old decisions | N/A |

**You do NOT need to manually read context files.** The hooks handle it.

---

## When to Manually Load Context

Only load additional context when **explicitly needed**:

### Load Decisions (on architecture questions)
```
Triggers: "why did we", "rationale", "decision", "chose"
File: knowledge/decisions/active.json
```

### Load Patterns (on convention questions)
```
Triggers: "pattern", "convention", "how do we", "standard"
File: knowledge/patterns/established.json
```

### Load Blockers (on issue investigation)
```
Triggers: "blocked", "failing", "issue", "problem"
File: knowledge/blockers/current.json
```

### Load Agent Context (automatic via hook)
```
Triggers: Agent spawn
File: agents/{agent_id}.json
```

---

## Token Budget

**Total budget: 2,200 tokens** for context layer

| Layer | Budget | Auto-Load |
|-------|--------|-----------|
| Identity | 200 | Always |
| Knowledge Index | 150 | Always |
| Session State | 500 | Always |
| Blockers | 150 | If non-empty |
| Decisions | 400 | On-demand |
| Patterns | 300 | On-demand |
| Agent Context | 500 | On spawn |

### Compression Triggers

- **70% utilization**: Start compression
- **50% target**: After compression
- **Preserve always**: Last 3 next_steps, all blockers, current_task

---

## Updating Context

### Session State (automatic)
Updated by hooks during the session. No manual updates needed.

### Decisions (manual when significant)
When making an **architectural decision**:

```json
// Add to knowledge/decisions/active.json
{
  "id": "decision-name",
  "date": "YYYY-MM-DD",
  "summary": "One-line description",
  "rationale": "Why this approach",
  "status": "implemented|planned|deprecated"
}
```

### Patterns (rare, on new convention)
Only when establishing a **new project-wide pattern**:

```json
// Add to knowledge/patterns/established.json under appropriate category
{
  "name": "Pattern Name",
  "description": "What it is",
  "enforcement": "How it's enforced (hook, review, etc.)"
}
```

### Blockers (when stuck)
When encountering a **blocking issue**:

```json
// Add to knowledge/blockers/current.json
{
  "id": "blocker-name",
  "description": "What's blocked and why",
  "status": "active|investigating|resolved"
}
```

---

## Migration from Old System

The old `session/state.json (Context Protocol 2.0)` (1,070 lines) has been archived to:
```
archive/sessions/shared-context-pre-refactor.json
```

**Do NOT use the old file.** The new tiered system provides:

| Old System | New System |
|------------|------------|
| 1 file, ~30KB | 7+ files, ~2KB typical load |
| All-or-nothing loading | Progressive, on-demand |
| No attention awareness | START/MIDDLE/END positioning |
| Manual updates | Hook-driven automation |
| Grows unbounded | Auto-compression at 70% |
| Same context for all agents | Agent-scoped context |

---

## Quick Reference

### Files That Auto-Load
- `identity.json` - Always (project identity, constraints)
- `session/state.json` - Always (current task, next steps)
- `knowledge/index.json` - Always (what knowledge exists)
- `knowledge/blockers/current.json` - If non-empty

### Files Loaded On-Demand
- `knowledge/decisions/active.json` - On architecture keywords
- `knowledge/patterns/established.json` - On convention keywords
- `agents/{agent_id}.json` - On agent spawn

### Files Never Auto-Loaded
- `archive/*` - Historical data, explicit request only

---

**Last Updated:** January 2026 (Context Engineering 2.0 Migration)
