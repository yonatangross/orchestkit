# Data Schema Reference

Full schema specification for decision history data.

## Decision Object

```typescript
interface Decision {
  // Required fields
  id: string;              // Unique identifier (kebab-case)
  date: string;            // ISO date (YYYY-MM-DD)
  summary: string;         // Brief description (< 100 chars)

  // Context fields
  cc_version?: string;     // Claude Code version (e.g., "2.1.16")
  plugin_version?: string; // OrchestKit version (e.g., "4.28.3")

  // Classification
  category: DecisionCategory;
  impact: "high" | "medium" | "low";
  status: "proposed" | "implemented" | "deprecated" | "superseded";

  // Detail fields
  rationale?: string;      // Why this decision was made
  best_practice?: string;  // Related best practice name
  alternatives?: string[]; // Rejected alternatives
  trade_offs?: string;     // Known trade-offs

  // Relationships
  entities?: string[];     // Related entities (technologies, patterns)
  supersedes?: string;     // ID of decision this supersedes
  superseded_by?: string;  // ID of decision that supersedes this
  related?: string[];      // Related decision IDs

  // Metadata
  source: "mem0" | "changelog" | "session" | "extracted";
  agent_name?: string;     // Agent that made the decision
  skill?: string;          // Skill context
  created_at: string;      // ISO timestamp
  updated_at?: string;     // ISO timestamp
}
```

## Categories

```typescript
type DecisionCategory =
  | "architecture"      // System design, structure
  | "api"               // API design, endpoints
  | "database"          // Schema, migrations, queries
  | "security"          // Auth, validation, OWASP
  | "testing"           // Test strategy, coverage
  | "deployment"        // CI/CD, infrastructure
  | "observability"     // Logging, metrics, tracing
  | "frontend"          // React, UI patterns
  | "performance"       // Optimization, caching
  | "ai-ml"             // LLM, RAG, embeddings
  | "data-pipeline"     // ETL, streaming
  | "authentication"    // Login, JWT, OAuth
  | "pagination"        // Cursor, offset strategies
  | "lifecycle"         // Hooks, session management
  | "decision";         // General/uncategorized
```

## mem0 Storage Format

Decisions stored in mem0 use this metadata schema:

```json
{
  "text": "Decided to use cursor-based pagination for user listings",
  "user_id": "orchestkit:all-agents",
  "metadata": {
    "category": "pagination",
    "source": "orchestkit-plugin",
    "skill": "api-design-framework",
    "agent_name": "backend-system-architect",
    "cc_version": "2.1.16",
    "plugin_version": "4.28.3",
    "importance": "high",
    "best_practice": "cursor-pagination",
    "shared": false,
    "timestamp": "2026-01-23T10:30:00Z"
  }
}
```

## CHANGELOG Extraction Format

Decisions extracted from CHANGELOG.md:

```json
{
  "id": "changelog-2026-01-18-ts-hooks",
  "date": "2026-01-18",
  "summary": "TypeScript Hook Migration Phase 1 complete",
  "rationale": "2-5x performance improvement, type safety",
  "cc_version": "2.1.16",
  "plugin_version": "4.28.3",
  "category": "architecture",
  "impact": "high",
  "source": "changelog",
  "entities": ["TypeScript", "ESM", "hooks", "esbuild"]
}
```

## Session State Format

Active decisions in `.claude/context/knowledge/decisions/active.json`:

```json
{
  "$schema": "context://decisions/v1",
  "_meta": {
    "position": "START",
    "token_budget": 400,
    "auto_load": "on_trigger",
    "triggers": ["decision", "why", "rationale"]
  },
  "decisions": [
    {
      "id": "context-engineering-2.0",
      "date": "2026-01-08",
      "summary": "Migrated to tiered context system",
      "rationale": "Old shared-context.json was 1070 lines...",
      "status": "implemented",
      "impact": "high"
    }
  ]
}
```

## Aggregated View

The dashboard aggregates all sources into a unified view:

```json
{
  "metadata": {
    "total_decisions": 47,
    "sources": {
      "mem0": 32,
      "changelog": 12,
      "session": 3
    },
    "last_sync": "2026-01-23T10:00:00Z"
  },
  "by_cc_version": {
    "2.1.16": ["task-management", "vscode-plugins"],
    "2.1.11": ["setup-hooks", "self-healing"],
    "2.1.9": ["additional-context", "auto-n-mcp"]
  },
  "by_category": {
    "architecture": 15,
    "security": 8,
    "api": 7
  },
  "decisions": [/* Decision[] */]
}
```

## Validation Rules

1. **id**: Must be unique, kebab-case, 3-50 characters
2. **date**: Valid ISO date, not in future
3. **summary**: 10-100 characters, no line breaks
4. **rationale**: Optional, max 500 characters
5. **cc_version**: Must match pattern `\d+\.\d+\.\d+`
6. **category**: Must be from enum list
7. **impact**: Must be "high", "medium", or "low"
