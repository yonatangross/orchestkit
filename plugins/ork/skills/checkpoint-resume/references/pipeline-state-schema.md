# Pipeline State Schema

The pipeline state file (`.claude/pipeline-state.json`) is the source of truth for checkpoint/resume. It is validated against `.claude/schemas/pipeline-state.schema.json`.

## Top-Level Shape

```json
{
  "completed_phases": [...],
  "current_phase": {...},
  "remaining_phases": [...],
  "context_summary": {...},
  "created_at": "2026-02-19T10:00:00Z",
  "updated_at": "2026-02-19T10:45:00Z"
}
```

## completed_phases

Array of phases that finished successfully. Append-only — never remove entries.

```json
{
  "id": "create-issues",
  "name": "Create GitHub Issues",
  "timestamp": "2026-02-19T10:05:00Z",
  "commit_sha": "a1b2c3d"   // optional — only if phase produced a commit
}
```

## current_phase

The phase actively being executed. `progress_description` is a free-text note describing partial work done so far within this phase — helps resume after interruption.

```json
{
  "id": "write-source",
  "name": "Write Source Files",
  "progress_description": "Completed auth module, starting billing module"
}
```

Set `current_phase` to `null` when all phases are done.

## remaining_phases

Ordered list of phases not yet started. Remove a phase from here when it moves to `current_phase`.

```json
{
  "id": "final-commit",
  "name": "Final Commit",
  "dependencies": ["write-source", "write-tests"]
}
```

`dependencies`: IDs of phases that must complete before this one. Empty array = can run immediately or in parallel.

## context_summary

Compact context snapshot for restoring session state after interruption.

```json
{
  "branch": "feat/issue-42-new-feature",
  "key_decisions": [
    "Used postgres not mongo for user storage",
    "Chose REST over GraphQL for external API"
  ],
  "file_paths": [
    "/Users/dev/project/src/auth/login.ts",
    "/Users/dev/project/src/billing/invoice.ts"
  ]
}
```

Update `file_paths` each time a phase creates or significantly modifies files.

## Full Example

```json
{
  "completed_phases": [
    {
      "id": "create-issues",
      "name": "Create GitHub Issues",
      "timestamp": "2026-02-19T10:05:00Z"
    },
    {
      "id": "scaffold-commit",
      "name": "Commit Initial Scaffold",
      "timestamp": "2026-02-19T10:20:00Z",
      "commit_sha": "a1b2c3d"
    }
  ],
  "current_phase": {
    "id": "write-source",
    "name": "Write Source Files",
    "progress_description": "auth module done, starting billing"
  },
  "remaining_phases": [
    {
      "id": "write-tests",
      "name": "Write Tests",
      "dependencies": ["write-source"]
    },
    {
      "id": "final-commit",
      "name": "Final Commit",
      "dependencies": ["write-source", "write-tests"]
    }
  ],
  "context_summary": {
    "branch": "feat/issue-42-dashboard",
    "key_decisions": ["REST over GraphQL", "Postgres for storage"],
    "file_paths": ["/project/src/auth/login.ts"]
  },
  "created_at": "2026-02-19T10:00:00Z",
  "updated_at": "2026-02-19T10:22:00Z"
}
```
