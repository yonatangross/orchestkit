# GitHub Issue: Hook Progress Indicator Bug

**Repository:** `anthropics/claude-code`

---

## Title

Hook progress indicator stuck at "1/N" - counter never increments during execution

---

## Description

### Summary

The hook progress indicator displayed during hook execution shows `Running [Event] hooks... (1/N done)` but the counter never increments beyond "1" as hooks complete. The total count (N) is correct, but the progress tracking appears non-functional.

### Environment

| Component | Version/Value |
|-----------|---------------|
| Claude Code | 2.1.17 |
| Platform | macOS Darwin 25.2.0 |
| Shell | zsh 5.9 |
| Node.js | v22.x |
| Plugin | [OrchestKit](https://github.com/yonatangross/orchestkit) v4.28.3 |

### Observed Behavior

When Claude Code executes hooks, the UI displays a progress indicator that **never updates**:

```plaintext
Running PostToolUse hooks... (1/12 done)
Running PostToolUse hooks... (1/6 done)
Running PostToolUse hooks... (1/4 done)
```

**Key observations:**

1. The counter **always shows "1"** regardless of how many hooks have completed
2. The total count (N) varies correctly based on the number of matching hooks:
   - `1/12` for Bash tool (4 global + 7 Bash-specific + 1 catch-all)
   - `1/6` for Task tool (4 global + 1 Task-specific + 1 catch-all)
   - `1/4` for Read/Glob tools (4 global hooks only)
3. All hooks **do execute correctly** - this is purely a display issue
4. The indicator stays at `1/N` until all hooks finish, then disappears

### Expected Behavior

The progress indicator should increment as each hook completes:

```plaintext
Running PostToolUse hooks... (1/12 done)
Running PostToolUse hooks... (2/12 done)
Running PostToolUse hooks... (3/12 done)
...
Running PostToolUse hooks... (12/12 done)
```

---

## Steps to Reproduce

### Option A: Minimal Reproduction (No Plugin Required)

1. Create a `.claude/settings.json` with multiple hooks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "echo '{\"continue\":true,\"suppressOutput\":true}'" },
          { "type": "command", "command": "echo '{\"continue\":true,\"suppressOutput\":true}'" },
          { "type": "command", "command": "echo '{\"continue\":true,\"suppressOutput\":true}'" },
          { "type": "command", "command": "echo '{\"continue\":true,\"suppressOutput\":true}'" }
        ]
      }
    ]
  }
}
```

2. Start Claude Code in that directory
3. Run any tool (e.g., ask Claude to read a file)
4. Observe progress indicator shows `(1/4 done)` and never changes

### Option B: Full Reproduction with OrchestKit Plugin

This bug was discovered using the [OrchestKit plugin](https://github.com/yonatangross/orchestkit) which registers 146 hooks across all lifecycle events.

**Installation:**

```bash
# Clone the plugin
git clone https://github.com/yonatangross/orchestkit ~/.claude/plugins/orchestkit

# Or install via marketplace (if available)
/plugin marketplace add yonatangross/orchestkit
```

**Hook Configuration (from OrchestKit's `.claude/settings.json`):**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/session-metrics.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/audit-logger.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/context-budget-monitor.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/error-collector.sh" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/error-tracker.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/error-solution-suggester.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/skill/redact-secrets.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/bash/pattern-extractor.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/bash/issue-progress-commenter.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/bash/issue-subtask-updater.sh" },
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/mem0-webhook-handler.sh" }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|Skill|Task",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/hooks/posttool/realtime-sync.sh" }
        ]
      }
    ]
  }
}
```

**Total Hook Counts in OrchestKit:**

| Event | Hook Count |
|-------|------------|
| PreToolUse | 43 |
| PostToolUse | 28 |
| Stop | 25 |
| SessionStart | 12 |
| SubagentStop | 9 |
| UserPromptSubmit | 8 |
| Setup | 6 |
| SessionEnd | 5 |
| PermissionRequest | 4 |
| SubagentStart | 4 |
| Notification | 2 |
| **Total** | **146** |

**Reproduction Steps:**

1. Install OrchestKit plugin as shown above
2. Start Claude Code: `claude`
3. Run any Bash command (e.g., `ls -la`)
4. Observe: `Running PostToolUse hooks... (1/12 done)` - never increments
5. Run a Read operation (e.g., ask to read a file)
6. Observe: `Running PostToolUse hooks... (1/4 done)` - never increments

---

## Visual Evidence

### Screenshot 1: Bash Tool Execution

```plaintext
⏺ Bash(git status --short 2>/dev/null | head -30)
  ⎿  PreToolUse:Bash hook error
  ⎿  M CLAUDE.md
  ⎿  ?? .claude/plans/agent-orchestration-roadmap.md
  ⎿  Running PostToolUse hooks… (1/12 done)   ← STUCK AT 1
```

### Screenshot 2: Multiple Tool Types Show Different Totals But Same "1"

```plaintext
● Explore(Investigate hooks 1/N display bug)
  ⎿  Done (6 tool uses · 51.5k tokens · 14s)
  ⎿  Running PostToolUse hooks… (1/6 done)    ← STUCK AT 1

● Search(pattern: "**/.claude/settings*.json")
  ⎿  Found 2 files (ctrl+o to expand)
  ⎿  Running PostToolUse hooks… (1/4 done)    ← STUCK AT 1

● Search(pattern: "**/hooks/posttool/**/*.sh")
  ⎿  Found 22 files (ctrl+o to expand)
  ⎿  Running PostToolUse hooks… (1/4 done)    ← STUCK AT 1
```

---

## Technical Analysis

### Hook Execution is Working Correctly

- All registered hooks execute in the expected order
- Hook output (JSON) is properly parsed
- `continue: true` and `suppressOutput: true` are respected
- The total count (N) is accurately calculated based on matcher patterns

### Hook Output Format (CC 2.1.7 Compliant)

All OrchestKit hooks output valid JSON:

```json
{"continue": true, "suppressOutput": true}
```

Example hook implementation (TypeScript):

```typescript
export function outputSilentSuccess(): HookResult {
  return { continue: true, suppressOutput: true };
}
```

### The Bug Appears to Be in the Progress Display Logic

Possible causes:

1. **Counter not incrementing:** The progress counter variable is initialized to 1 but never incremented after each hook completes
2. **UI not re-rendering:** The terminal UI might not be refreshing between hook completions
3. **Race condition:** Hooks complete faster than the UI update cycle
4. **Async tracking issue:** The progress tracking may not be properly awaiting hook completion signals

### Relevant Code Paths (Speculation)

The bug likely exists in the hook executor that:
1. Calculates total hooks (working correctly - shows accurate N)
2. Tracks completed hooks (NOT working - always shows 1)
3. Renders progress string (working correctly - format is fine)

---

## Impact

| Area | Impact |
|------|--------|
| User Experience | Users cannot gauge hook execution progress |
| Debugging | Harder to identify which hook is slow/stuck |
| Perceived Performance | Users may think hooks are stuck when progressing |
| Trust | Progress indicators that don't progress reduce user confidence |

### Severity

**Low** - Functionality is not affected. All hooks execute correctly. This is purely a cosmetic/UX issue.

---

## Workaround

None available. This is a display-only issue that doesn't affect hook execution.

Users can verify hooks are running by:
1. Adding logging to hooks
2. Checking hook log files
3. Observing that operations complete successfully

---

## Additional Context

### Plugin Repository

- **Name:** OrchestKit
- **Repository:** https://github.com/yonatangross/orchestkit
- **Version:** 4.28.3
- **Hook Architecture:** TypeScript ESM bundle (244 KB) + Bash wrappers
- **Total Hooks:** 146 across all lifecycle events

### Acknowledgment

This bug was acknowledged by @bcherny (Boris Cherny, Anthropic) on Twitter/X:
> "That seems like a bug, looking"

### Affects All Hook Events

The bug is reproducible across all hook event types:
- PreToolUse
- PostToolUse
- UserPromptSubmit
- SessionStart
- SessionEnd
- Stop
- SubagentStart
- SubagentStop
- PermissionRequest
- Setup
- Notification

---

## Suggested Fix

The fix likely involves ensuring the progress counter is:
1. Properly incremented after each hook's promise/callback resolves
2. Triggering a UI re-render after each increment
3. Using atomic counter updates if hooks run in parallel

Pseudocode:

```javascript
// Current (broken):
let completed = 1;  // ← Never changes
for (const hook of hooks) {
  await runHook(hook);
  // Missing: completed++;
  // Missing: updateProgressUI(completed, total);
}

// Fixed:
let completed = 0;
for (const hook of hooks) {
  await runHook(hook);
  completed++;
  updateProgressUI(completed, total);
}
```

---

## Labels

`bug`, `hooks`, `ui`, `low-priority`
