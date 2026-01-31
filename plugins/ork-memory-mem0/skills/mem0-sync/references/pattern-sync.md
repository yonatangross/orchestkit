# Agent Pattern Sync

Guide for syncing agent-learned patterns to Mem0.

## Pattern Structure

```json
{
  "text": "database-engineer recommends cursor-based pagination for large tables over offset pagination",
  "user_id": "myproject-agents",
  "agent_id": "ork:database-engineer",
  "metadata": {
    "category": "pagination",
    "outcome": "success",
    "project": "myproject",
    "stored_at": "2026-01-17T15:00:00Z",
    "source": "orchestkit-plugin"
  },
  "enable_graph": true
}
```

## Reading Pending Patterns

Patterns are logged to `.claude/logs/agent-patterns.jsonl`:

```jsonl
{"agent_id":"ork:database-engineer","pattern":"cursor pagination","outcome":"success","pending_sync":true}
{"agent_id":"ork:security-auditor","pattern":"JWT validation","outcome":"failed","pending_sync":true}
```

## Syncing Patterns

### Success Patterns (Best Practices)

```javascript
mcp__mem0__add_memory({
  text: "database-engineer: Use cursor-based pagination with indexed columns for tables > 10k rows",
  user_id: "myproject-agents",
  agent_id: "ork:database-engineer",
  metadata: {
    category: "pagination",
    outcome: "success",
    project: "myproject"
  },
  enable_graph: true
})
```

### Failed Patterns (Anti-Patterns)

```javascript
mcp__mem0__add_memory({
  text: "security-auditor: Manual JWT validation without library caused token bypass vulnerability",
  user_id: "myproject-agents",
  agent_id: "ork:security-auditor",
  metadata: {
    category: "authentication",
    outcome: "failed",
    lesson: "Use established JWT libraries like python-jose",
    project: "myproject"
  },
  enable_graph: true
})
```

## Cross-Agent Federation

When syncing, consider related agents:

| Agent | Related Agents |
|-------|----------------|
| database-engineer | backend-system-architect, security-auditor |
| backend-system-architect | database-engineer, frontend-ui-developer |
| security-auditor | backend-system-architect, infrastructure-architect |

Patterns from related agents appear in cross-agent searches.

## Global Best Practices

If a pattern is generalizable across projects:

```javascript
mcp__mem0__add_memory({
  text: "Cursor-based pagination outperforms offset pagination for large datasets",
  user_id: "orchestkit-global-best-practices",
  metadata: {
    category: "pagination",
    outcome: "success",
    original_project: "myproject",
    original_agent: "database-engineer"
  },
  enable_graph: true
})
```

## Marking Patterns Synced

After successful MCP call, update the patterns log:

```bash
# Mark pattern as synced
jq '.pending_sync = false' pattern.json
```

Or update sync state:
```json
{
  "synced_patterns": ["pattern-id-1", "pattern-id-2"],
  "last_sync": "2026-01-17T15:00:00Z"
}
```

## Pattern Categories

| Category | Keywords |
|----------|----------|
| pagination | cursor, offset, page, limit |
| authentication | jwt, oauth, token, session |
| database | sql, query, schema, index |
| api | endpoint, rest, graphql |
| performance | cache, optimize, latency |
| security | vulnerability, injection, xss |
