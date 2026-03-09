# Handoff File Schema

Handoff files pass structured data between phases of a pipeline skill. They persist to disk, surviving context compaction and rate limits.

## Location

```
.claude/chain/
  capabilities.json          # MCP probe results (written once at start)
  state.json                 # Checkpoint state (updated after each phase)
  NN-phase-name.json         # Phase handoff (one per completed phase)
```

## Schema

```json
{
  "phase": "rca",
  "phase_number": 4,
  "skill": "fix-issue",
  "timestamp": "2026-03-07T16:30:00Z",
  "status": "completed",
  "outputs": {
    // Phase-specific structured data
  },
  "mcps_used": ["memory", "context7"],
  "next_phase": 5,
  "next_phase_name": "fix-design"
}
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Phase identifier (kebab-case) |
| `phase_number` | number | Numeric phase index |
| `skill` | string | Parent skill name |
| `timestamp` | string | ISO-8601 timestamp |
| `status` | string | `completed` or `failed` |
| `outputs` | object | Phase-specific results |
| `next_phase` | number | Next phase index |

## Naming Convention

```
NN-phase-name.json

Examples:
  03-hypotheses.json     # fix-issue Phase 3
  04-rca.json            # fix-issue Phase 4
  02-ideas.json          # brainstorm Phase 2
  05-implementation.json # implement Phase 5
```

## Cleanup

Handoff files are NOT automatically cleaned up. They persist until:
- User manually deletes `.claude/chain/`
- A new skill run overwrites them (same phase numbers)
- The skill's final phase cleans up on success

## Size Limits

Keep handoff files under 50KB. For large outputs (full file contents, long diffs), summarize in the handoff and reference the source files by path.
