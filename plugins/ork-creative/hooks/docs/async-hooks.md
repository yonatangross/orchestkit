# Async Hooks Reference

Comprehensive guide to implementing and using async hooks in OrchestKit.

## Overview

Async hooks execute in the background without blocking the main Claude Code conversation flow. Introduced in CC 2.1.19, they replace the earlier `background: true` flag with more explicit `async: true` semantics.

## Architecture

```
User Input → Claude Code → Sync Hooks (blocking) → Tool Execution
                              ↓
                         Async Hooks (background)
                              ↓
                         Completion Notification
```

### Execution Model

1. **Sync hooks** run first and can block/modify execution
2. **Async hooks** are spawned in background after sync hooks complete
3. **Notification** is sent when async hooks finish (success or timeout)
4. **Main conversation** continues without waiting

## Configuration Schema

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs posttool/my-hook",
            "async": true,
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `async` | boolean | Must be `true` to enable async execution |
| `timeout` | number | Timeout in seconds (required for async hooks) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `once` | boolean | Run only once per session |

## Use Cases

### 1. Analytics and Metrics

Track usage patterns without slowing conversation:

```typescript
// posttool/session-metrics.ts
export function sessionMetrics(input: HookInput): HookResult {
  const metrics = {
    tool: input.tool_name,
    session: input.session_id,
    timestamp: Date.now(),
    success: !input.tool_error
  };

  // Write to local log (fast)
  appendMetricsLog(metrics);

  // Sync to cloud (slow, but async so OK)
  syncMetricsToCloud(metrics).catch(err => {
    logHook('session-metrics', `Cloud sync failed: ${err.message}`);
  });

  return outputSilentSuccess();
}
```

### 2. External API Calls

GitHub, webhooks, cloud services:

```typescript
// posttool/bash/issue-progress-commenter.ts
export async function issueProgressCommenter(input: HookInput): Promise<HookResult> {
  // Only for git commits that reference issues
  if (!isGitCommit(input) || !hasIssueRef(input)) {
    return outputSilentSuccess();
  }

  const issueNumber = extractIssueNumber(input);

  try {
    // This can take 1-5 seconds - fine because async
    await ghApi(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      body: `Progress update from commit: ${commitSha}`
    });
  } catch (err) {
    // Don't fail - just log
    logHook('issue-commenter', `Failed to comment: ${err.message}`);
  }

  return outputSilentSuccess();
}
```

### 3. Session Startup

Heavy initialization that can run in background:

```typescript
// lifecycle/mem0-context-retrieval.ts
export async function mem0ContextRetrieval(input: HookInput): Promise<HookResult> {
  try {
    // This can take 2-5 seconds - fine because async
    const memories = await mem0Client.search({
      query: `project:${projectName}`,
      limit: 20
    });

    // Write to local cache for later use
    writeContextCache(memories);

  } catch (err) {
    // Cloud unavailable - OK, continue without
    logHook('mem0-retrieval', `Skipping mem0: ${err.message}`);
  }

  return outputSilentSuccess();
}
```

### 4. Pattern Learning

Extract patterns from operations:

```typescript
// posttool/write/code-style-learner.ts
export function codeStyleLearner(input: HookInput): HookResult {
  if (!isWriteInput(input.tool_input)) {
    return outputSilentSuccess();
  }

  const content = input.tool_input.content;
  const filePath = input.tool_input.file_path;

  // Extract style patterns (can be slow for large files)
  const patterns = extractStylePatterns(content, filePath);

  // Merge with existing patterns
  updateLearnedPatterns(patterns);

  return outputSilentSuccess();
}
```

## Best Practices

### 1. Always Handle Errors Gracefully

Async hooks should never fail visibly:

```typescript
// Good: Catch and log
try {
  await riskyOperation();
} catch (err) {
  logHook('my-hook', `Error (non-critical): ${err.message}`);
}
return outputSilentSuccess();

// Bad: Let errors propagate
await riskyOperation(); // May crash hook!
```

### 2. Set Appropriate Timeouts

| Operation Type | Timeout |
|----------------|---------|
| Local file ops | 10s |
| Simple API calls | 30s |
| Complex sync | 60s |

### 3. Avoid State Dependencies

Async hooks may complete after conversation moves on:

```typescript
// Bad: Assume state still valid
const currentFile = getCurrentEditFile(); // May have changed!
await processFile(currentFile);

// Good: Use input data only
const file = input.tool_input.file_path; // Captured at hook trigger
await processFile(file);
```

### 4. Use Idempotent Operations

Async hooks may be retried or run multiple times:

```typescript
// Good: Idempotent update
await upsertMetric(key, value);

// Bad: Non-idempotent append
await appendMetric(value); // Duplicates on retry!
```

### 5. Keep Async Hooks Focused

One async hook = one task:

```typescript
// Good: Single responsibility
// posttool/audit-logger.ts - just logging
// posttool/metrics.ts - just metrics
// posttool/sync.ts - just syncing

// Bad: Kitchen sink
// posttool/everything.ts - logging AND metrics AND sync
```

## Anti-Patterns

### 1. Using Async for Blocking Operations

```json
// Wrong: Security check must block!
{
  "command": ".../pretool/bash/dangerous-command-blocker",
  "async": true  // DANGEROUS - won't block execution
}
```

### 2. Missing Timeout

```json
// Wrong: No timeout
{
  "command": "...",
  "async": true
  // Missing timeout - may hang
}
```

### 3. Heavy Processing Without Timeout

```typescript
// Wrong: No timeout protection
export function heavyHook(input: HookInput): HookResult {
  // Process 1000 files... no timeout protection!
  processAllFiles();
}

// Right: Use timeout protection
export function heavyHook(input: HookInput): HookResult {
  const timeoutMs = 25000; // Leave buffer for 30s timeout
  const deadline = Date.now() + timeoutMs;

  for (const file of files) {
    if (Date.now() > deadline) break;
    processFile(file);
  }
}
```

## Debugging Async Hooks

### Check Hook Logs

```bash
# View hook execution logs
tail -f ~/.claude/logs/ork/hooks.log

# Filter by hook name
grep 'session-metrics' ~/.claude/logs/ork/hooks.log
```

### Test Hook Directly

```bash
# Test async hook behavior
echo '{"tool_name":"Bash","session_id":"test","tool_input":{"command":"git status"}}' | \
  timeout 35 node src/hooks/bin/run-hook.mjs posttool/session-metrics
```

### Verify Async Configuration

```bash
# Count async hooks
grep -c '"async": true' src/hooks/hooks.json

# List async hooks
grep -B5 '"async": true' src/hooks/hooks.json | grep '"command"'
```

## Migration Checklist

When converting a sync hook to async:

- [ ] Add `"async": true` to hooks.json
- [ ] Add `"timeout": N` (seconds) to hooks.json
- [ ] Wrap all operations in try/catch
- [ ] Return `outputSilentSuccess()` on errors
- [ ] Remove any blocking validation logic
- [ ] Test hook still works in isolation
- [ ] Verify no state dependencies on conversation flow

## Related Documentation

- [README.md](../README.md) - Main hooks documentation
- [CC 2.1.19 Release Notes](https://docs.anthropic.com/claude-code/changelog) - Async hooks introduction
- [Best Practices](../README.md#best-practices) - General hook best practices

---

**Last Updated:** 2026-01-26
**CC Version:** >= 2.1.19
