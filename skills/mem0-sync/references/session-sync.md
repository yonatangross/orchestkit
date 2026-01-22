# Session Summary Sync

Detailed guide for syncing session summaries to Mem0.

## Session Summary Structure

```json
{
  "text": "Session Summary: Implemented API pagination with cursor-based approach",
  "user_id": "myproject-continuity",
  "metadata": {
    "type": "session_summary",
    "status": "completed",
    "project": "myproject",
    "session_id": "abc123",
    "stored_at": "2026-01-17T15:00:00Z",
    "has_blockers": false,
    "has_next_steps": true,
    "source": "orchestkit-plugin"
  },
  "enable_graph": true
}
```

## Building Session Summary

### From Hook Context

The `mem0-pre-compaction-sync.sh` hook provides:

```bash
SYNC_CONTEXT='{
  "task_summary": "Implemented cursor pagination",
  "status": "in_progress",
  "blockers": "JWT validation failing",
  "next_steps": "Add unit tests; Update docs",
  "decision_count": 3,
  "pattern_count": 5
}'
```

### Text Format

```
Session Summary: {task_summary}
| Blockers: {blockers}
| Next: {next_steps}
```

Example:
```
Session Summary: Implemented cursor pagination | Blockers: JWT validation failing | Next: Add unit tests; Update docs
```

## MCP Execution

```javascript
// Execute this MCP call
mcp__mem0__add_memory({
  text: "Session Summary: Implemented cursor pagination | Blockers: JWT validation failing | Next: Add unit tests",
  user_id: "myproject-continuity",
  metadata: {
    type: "session_summary",
    status: "in_progress",
    project: "myproject",
    session_id: "abc123",
    stored_at: "2026-01-17T15:00:00Z",
    has_blockers: true,
    has_next_steps: true,
    source: "orchestkit-plugin"
  },
  enable_graph: true
})
```

## Retrieval at Next Session

```javascript
// Search for recent sessions
mcp__mem0__search_memories({
  query: "session context blockers next steps",
  filters: {
    AND: [
      { user_id: "myproject-continuity" },
      { "created_at": { "gte": "2026-01-10" } }
    ]
  },
  limit: 3,
  enable_graph: true
})
```

## Status Values

| Status | Description |
|--------|-------------|
| `in_progress` | Work ongoing, has next steps |
| `completed` | Task finished successfully |
| `blocked` | Cannot proceed, has blockers |
| `paused` | Intentionally stopped |

## Graph Relationships

With `enable_graph: true`, Mem0 extracts:

- **Entities**: Technologies, patterns, agents mentioned
- **Relations**: WORKED_ON, BLOCKED_BY, NEXT_STEP
- **Clusters**: Related session summaries grouped
