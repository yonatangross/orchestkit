---
title: Pipeline State Schema
tags: [checkpoint, schema, state]
---

# Pipeline State Schema

File: `.claude/pipeline-state.json`

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `completed_phases` | array | Phases that have finished |
| `current_phase` | object | The phase currently in progress |
| `remaining_phases` | array | Phases not yet started |
| `context_summary` | object | Session context for resume |
| `created_at` | string | ISO 8601 — when pipeline was first created |
| `updated_at` | string | ISO 8601 — last state write timestamp |

## Phase Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier, e.g. `"phase-1"` |
| `name` | string | yes | Human-readable name |
| `description` | string | no | What this phase accomplishes |
| `dependencies` | array | yes | IDs of phases that must complete first (empty = independent) |
| `status` | string | yes | `pending`, `in_progress`, `completed`, or `failed` |
| `timestamp` | string | on complete | ISO 8601 completion time |
| `commit_sha` | string | if applicable | Git SHA of the checkpoint commit |
| `progress_description` | string | current only | Human-readable progress note |

## context_summary Object

| Field | Type | Description |
|-------|------|-------------|
| `branch` | string | Current git branch |
| `key_decisions` | array | Important decisions made during the pipeline |
| `file_paths` | array | Key files created or modified |

## Example

```json
{
  "completed_phases": [
    {
      "id": "phase-1",
      "name": "Create GitHub issues",
      "status": "completed",
      "timestamp": "2026-02-19T10:00:00Z",
      "commit_sha": "abc1234"
    }
  ],
  "current_phase": {
    "id": "phase-2",
    "name": "Implement feature",
    "status": "in_progress",
    "progress_description": "Writing tests"
  },
  "remaining_phases": [
    { "id": "phase-3", "name": "Update docs", "dependencies": ["phase-2"] }
  ],
  "context_summary": {
    "branch": "feat/my-feature",
    "key_decisions": ["Using TypeScript strict mode"],
    "file_paths": ["src/hooks/src/lib/new-feature.ts"]
  },
  "created_at": "2026-02-19T09:45:00Z",
  "updated_at": "2026-02-19T10:00:00Z"
}
```
