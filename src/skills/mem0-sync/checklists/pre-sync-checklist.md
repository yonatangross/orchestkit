# Pre-Sync Checklist

Verify these conditions before executing Mem0 sync.

## Prerequisites

- [ ] **Mem0 MCP Available**: Verify `mcp__mem0__add_memory` tool is accessible
- [ ] **Project ID Valid**: `CLAUDE_PROJECT_DIR` is set and project name is sanitized
- [ ] **Session ID Available**: `CLAUDE_SESSION_ID` or fallback timestamp exists

## Data Collection

- [ ] **Decision Log Exists**: Check `.claude/coordination/decision-log.json`
- [ ] **Patterns Log Exists**: Check `.claude/logs/agent-patterns.jsonl`
- [ ] **Sync State Readable**: Load `.claude/coordination/.decision-sync-state.json`

## Pending Items Check

- [ ] **Count Unsynced Decisions**: Compare decision IDs against sync state
- [ ] **Count Pending Patterns**: Filter patterns with `pending_sync: true`
- [ ] **Build Session Summary**: Extract task, blockers, next steps

## Validation

- [ ] **Text Length Valid**: Each memory text > 10 characters
- [ ] **User ID Format Correct**: Follows `{project}-{scope}` pattern
- [ ] **Metadata Complete**: Required fields present (category, outcome, project)
- [ ] **No Sensitive Data**: Check for secrets/credentials in content

## Sync Execution

For each item type, execute in order:

### 1. Session Summary
```
mcp__mem0__add_memory(session_summary_payload)
```
- [ ] Executed
- [ ] Response received
- [ ] No errors

### 2. Decisions (for each unsynced)
```
mcp__mem0__add_memory(decision_payload)
```
- [ ] All decisions processed
- [ ] Sync state updated with new IDs
- [ ] Failures logged

### 3. Agent Patterns (for each pending)
```
mcp__mem0__add_memory(pattern_payload)
```
- [ ] All patterns processed
- [ ] Patterns marked as synced
- [ ] Failures logged

### 4. Global Best Practices (if any)
```
mcp__mem0__add_memory(best_practice_payload)
```
- [ ] Generalizable patterns identified
- [ ] Global sync completed

## Post-Sync

- [ ] **Update Sync State**: Write new synced IDs to state file
- [ ] **Clear Pending Flags**: Mark patterns as `pending_sync: false`
- [ ] **Log Sync Summary**: Record items synced, timestamp, any errors
- [ ] **Output Confirmation**: Return sync status to user

## Error Handling

If MCP call fails:
- [ ] Log error with payload for retry
- [ ] Continue with remaining items
- [ ] Report partial sync status
- [ ] Do not mark failed items as synced

## Sync Summary Output

```
Mem0 Sync Complete:
- Session summary: ✓
- Decisions: 3/3 synced
- Patterns: 5/5 synced
- Best practices: 1 promoted to global
```
