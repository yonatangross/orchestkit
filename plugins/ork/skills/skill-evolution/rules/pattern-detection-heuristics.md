---
title: "Pattern Detection Heuristics"
impact: HIGH
---

# Edit Pattern Detection Heuristics

The system tracks these common edit patterns users apply after skill output:

| Pattern | Description | Detection Regex |
|---------|-------------|-----------------|
| `add_pagination` | User adds pagination to API responses | `limit.*offset`, `cursor.*pagination` |
| `add_rate_limiting` | User adds rate limiting | `rate.?limit`, `throttl` |
| `add_error_handling` | User adds try/catch blocks | `try.*catch`, `except` |
| `add_types` | User adds TypeScript/Python types | `interface\s`, `Optional` |
| `add_validation` | User adds input validation | `validate`, `Pydantic`, `Zod` |
| `add_logging` | User adds logging/observability | `logger\.`, `console.log` |
| `remove_comments` | User removes generated comments | Pattern removal detection |
| `add_auth_check` | User adds authentication checks | `@auth`, `@require_auth` |

## How Detection Works

The PostTool Edit Tracker hook monitors file edits after skill invocations. When a user edits skill output, the edit is classified against the patterns above using regex matching. Results are appended to `.claude/feedback/edit-patterns.jsonl`.
