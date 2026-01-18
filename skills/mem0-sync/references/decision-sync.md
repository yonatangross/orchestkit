# Decision Sync

Guide for syncing architectural decisions to Mem0.

## Decision Structure

```json
{
  "text": "Decided to use PostgreSQL with pgvector for RAG storage instead of dedicated vector DB",
  "user_id": "myproject-decisions",
  "metadata": {
    "category": "database",
    "outcome": "success",
    "rationale": "Simplifies ops, good enough performance for <1M vectors",
    "alternatives_considered": ["Pinecone", "Weaviate", "Milvus"],
    "project": "myproject",
    "stored_at": "2026-01-17T15:00:00Z"
  },
  "enable_graph": true
}
```

## Reading Decision Log

Decisions are stored in `.claude/coordination/decision-log.json`:

```json
{
  "decisions": [
    {
      "decision_id": "dec-001",
      "content": "Use cursor pagination",
      "category": "api",
      "timestamp": "2026-01-17T14:00:00Z",
      "agent": "backend-system-architect"
    }
  ]
}
```

## Sync State Tracking

`.claude/coordination/.decision-sync-state.json`:

```json
{
  "synced_decisions": ["dec-001", "dec-002"],
  "last_sync": "2026-01-17T15:00:00Z"
}
```

## Syncing Unsynced Decisions

### 1. Find Unsynced

```javascript
// Pseudo-code for finding unsynced
const allDecisions = readDecisionLog();
const syncedIds = readSyncState().synced_decisions;
const unsynced = allDecisions.filter(d => !syncedIds.includes(d.decision_id));
```

### 2. Execute MCP for Each

```javascript
for (const decision of unsynced) {
  mcp__mem0__add_memory({
    text: decision.content,
    user_id: `${project}-decisions`,
    metadata: {
      decision_id: decision.decision_id,
      category: decision.category,
      outcome: "success",
      agent: decision.agent,
      project: project,
      stored_at: new Date().toISOString()
    },
    enable_graph: true
  });
}
```

### 3. Update Sync State

```javascript
// After successful sync
syncState.synced_decisions.push(...newlySyncedIds);
syncState.last_sync = new Date().toISOString();
writeSyncState(syncState);
```

## Decision Categories

| Category | Description | Example |
|----------|-------------|---------|
| architecture | System design choices | Microservices vs monolith |
| database | Data storage decisions | PostgreSQL + pgvector |
| api | API design choices | REST with cursor pagination |
| authentication | Auth approach | JWT with refresh tokens |
| frontend | UI/UX decisions | React 19 with Server Components |
| infrastructure | Deployment choices | Kubernetes on GCP |

## Entity Extraction

With `enable_graph: true`, Mem0 extracts entities:

**From**: "Decided to use PostgreSQL with pgvector for RAG storage"

**Entities**:
- Technology: PostgreSQL
- Technology: pgvector
- Pattern: RAG storage

**Relations**:
- PostgreSQL SUPPORTS pgvector
- pgvector ENABLES RAG storage

## Querying Decisions

```javascript
// Find related decisions
mcp__mem0__search_memories({
  query: "database storage decisions",
  filters: {
    AND: [
      { user_id: "myproject-decisions" },
      { "metadata.category": "database" }
    ]
  },
  limit: 5,
  enable_graph: true
})
```

## Conflict Resolution

If decision contradicts a previous one:

```json
{
  "text": "Switching from offset to cursor pagination due to performance issues at scale",
  "metadata": {
    "category": "api",
    "outcome": "success",
    "supersedes": "dec-001",
    "reason": "Offset pagination caused timeouts on tables > 100k rows"
  }
}
```
