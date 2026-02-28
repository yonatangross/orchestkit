# OrchestKit Hooks - TypeScript/ESM

TypeScript hook system for the OrchestKit Claude Plugin. Provides lifecycle automation, permission management, and validation for Claude Code operations.

## Overview

The hooks system intercepts Claude Code operations at various lifecycle points to provide:

- **Permission management** - Auto-approve safe operations, block dangerous commands
- **Pre-execution validation** - Git protection, security checks, quality gates
- **Post-execution tracking** - Audit logging, pattern extraction, error tracking
- **Context enhancement** - Inject additional context before tool execution (CC 2.1.9)
- **Session lifecycle** - Setup, initialization, cleanup, and maintenance

**Architecture:**
- TypeScript source → ESM split bundles → Event-based deployment
- 12 event-specific bundles + 1 unified bundle for CLI tools
- 89% per-load savings (~35KB average vs 324KB unified)
- Zero dependencies in production bundles
- CC 2.1.17 compliant (engine field), CC 2.1.16 compliant (Task Management), CC 2.1.9 compliant (additionalContext)

---

## Directory Structure

```
hooks/
├── src/                     # TypeScript source files
│   ├── index.ts            # Main hook registry and exports
│   ├── types.ts            # TypeScript type definitions
│   ├── entries/            # Event-based entry points (Phase 4)
│   │   ├── permission.ts   # Permission hooks entry (8KB)
│   │   ├── pretool.ts      # PreToolUse hooks entry (48KB)
│   │   ├── posttool.ts     # PostToolUse hooks entry (58KB)
│   │   ├── prompt.ts       # UserPromptSubmit hooks entry (57KB)
│   │   ├── lifecycle.ts    # SessionStart/SessionEnd entry (31KB)
│   │   ├── stop.ts         # Stop event hooks entry (33KB)
│   │   ├── subagent.ts     # SubagentStart/Stop entry (56KB)
│   │   ├── notification.ts # Notification hooks entry (5KB)
│   │   ├── setup.ts        # Setup hooks entry (24KB)
│   │   ├── skill.ts        # Skill hooks entry (52KB)
│   │   └── agent.ts        # Agent hooks entry (8KB)
│   ├── lib/                # Shared utilities
│   │   ├── common.ts       # Logging, output builders, environment
│   │   ├── git.ts          # Git operations and validation
│   │   └── guards.ts       # Conditional execution predicates
│   ├── permission/         # Permission hooks (3)
│   ├── pretool/            # Pre-execution hooks (30)
│   │   ├── bash/           # Bash command hooks
│   │   ├── write-edit/     # File operation hooks
│   │   ├── Write/          # Write-specific hooks
│   │   ├── mcp/            # MCP integration hooks
│   │   ├── input-mod/      # Input modification hooks
│   │   └── skill/          # Skill tracking hooks
│   ├── posttool/           # Post-execution hooks (22)
│   │   ├── (root)/         # General post-tool hooks
│   │   ├── write/          # Write tracking hooks
│   │   ├── bash/           # Bash tracking hooks
│   │   ├── skill/          # Skill optimization hooks
│   │   └── write-edit/     # File lock hooks
│   ├── prompt/             # Prompt enhancement hooks (12)
│   ├── subagent-start/     # Subagent spawn hooks (5)
│   ├── subagent-stop/      # Subagent completion hooks (11)
│   ├── notification/       # Notification hooks (3)
│   ├── stop/               # Session stop hooks (29 via unified dispatcher)
│   ├── lifecycle/          # Lifecycle hooks (17)
│   ├── setup/              # Setup and maintenance hooks (9)
│   ├── agent/              # Agent-specific hooks (5)
│   └── skill/              # Skill validation hooks (22)
├── dist/                   # Compiled output (12 split bundles + 1 unified)
│   ├── permission.mjs      # Permission bundle (8KB)
│   ├── pretool.mjs         # PreToolUse bundle (48KB)
│   ├── posttool.mjs        # PostToolUse bundle (58KB)
│   ├── prompt.mjs          # UserPromptSubmit bundle (57KB)
│   ├── lifecycle.mjs       # Lifecycle bundle (31KB)
│   ├── stop.mjs            # Stop bundle (79KB - 29 hooks consolidated)
│   ├── subagent.mjs        # Subagent bundle (56KB)
│   ├── notification.mjs    # Notification bundle (5KB)
│   ├── setup.mjs           # Setup bundle (24KB)
│   ├── skill.mjs           # Skill bundle (52KB)
│   ├── agent.mjs           # Agent bundle (8KB)
│   ├── hooks.mjs           # Unified bundle for CLI tools (324KB)
│   └── bundle-stats.json   # Build metrics
├── bin/
│   ├── run-hook.mjs               # CLI runner (loads event-specific bundles)
│   ├── stop-uncommitted-check.mjs # Warns about unsaved work on exit
│   └── decision-history.mjs       # Decision tracking utility
├── package.json            # NPM configuration
├── tsconfig.json           # TypeScript configuration
└── esbuild.config.mjs      # Build configuration (split bundles)

**Total:** 66 hooks (37 global + 28 agent-scoped + 1 skill-scoped, 9 native async)
```

---

## Hook Types

### Permission Hooks (PermissionRequest)
Auto-approve or deny permission requests based on safety rules.

**Examples:**
- `permission/auto-approve-readonly` - Auto-approve Read, Glob, Grep
- `permission/auto-approve-safe-bash` - Auto-approve safe bash commands
- `permission/auto-approve-project-writes` - Auto-approve writes to project directory

### PreTool Hooks (PreToolUse)
Execute BEFORE a tool runs, can inject context or block execution.

**Examples:**
- `pretool/bash/git-validator` - Validate git operations (branch protection, commit messages)
- `pretool/bash/dangerous-command-blocker` - Block `rm -rf`, `sudo`, force push
- `pretool/Write/architecture-change-detector` - Detect major architecture changes

**CC 2.1.9 Feature:** Use `additionalContext` to inject guidance before execution.

### PostTool Hooks (PostToolUse)
Execute AFTER a tool completes, used for logging and tracking.

**Examples:**
- `posttool/audit-logger` - Log all tool executions
- `posttool/unified-error-handler` - Track and categorize errors
- `posttool/memory-bridge` - Sync important info to knowledge graph

### Prompt Hooks (UserPromptSubmit)
Enhance user prompts with additional context before processing.

**Examples:**
- `prompt/context-injector` - Inject session context
- `prompt/antipattern-warning` - Warn about known anti-patterns
- `prompt/skill-auto-suggest` - Suggest relevant skills

### Lifecycle Hooks
Session and instance lifecycle management.

**Events:**
- `SessionStart` - Initialize session, load context
- `SessionEnd` - Save state, cleanup
- `Stop` - User stops conversation, trigger compaction
- `Setup` - First-run setup, maintenance tasks
- `SubagentStart` - Subagent spawn validation
- `SubagentStop` - Subagent completion tracking

### Notification Hooks (Notification)
Handle notifications and alerts.

**Examples:**
- `notification/desktop` - Desktop notifications for completion
- `notification/sound` - Sound alerts for errors

---

## Development Commands

### Building

```bash
# Build production bundle (minified)
npm run build

# Build and watch for changes (development)
npm run build:watch

# Type check without building
npm run typecheck

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Verification

```bash
# Check bundle size and stats
cat dist/bundle-stats.json

# Test a hook directly
echo '{"tool_name":"Read","session_id":"test","tool_input":{}}' | \
  node bin/run-hook.mjs permission/auto-approve-readonly

# Expected output:
# {"continue":true,"suppressOutput":true,"hookSpecificOutput":{"permissionDecision":"allow"}}
```

---

## Adding a New Hook

### Step 1: Create Hook File

```bash
# Choose appropriate directory based on hook type
mkdir -p src/pretool/bash
touch src/pretool/bash/my-hook.ts
```

### Step 2: Implement Hook

```typescript
/**
 * My Hook - Brief description
 * Hook: PreToolUse (Bash)
 * CC 2.1.9 Compliant
 */

import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, outputBlock, logHook } from '../../lib/common.js';
import { guardBash } from '../../lib/guards.js';

/**
 * Main hook logic
 */
export function myHook(input: HookInput): HookResult {
  // Apply guards to skip hook if conditions not met
  const guardResult = guardBash(input);
  if (guardResult) return guardResult;

  const command = input.tool_input.command || '';

  // Log hook execution
  logHook('my-hook', `Checking command: ${command}`);

  // Example: Block dangerous pattern
  if (command.includes('danger')) {
    return outputBlock('Dangerous command detected');
  }

  // Allow by default
  return outputSilentSuccess();
}
```

### Step 3: Register in Index

Add to `src/index.ts`:

```typescript
// Import hook
import { myHook } from './pretool/bash/my-hook.js';

// Add to hooks registry
export const hooks: Record<string, HookFn> = {
  // ... existing hooks ...
  'pretool/bash/my-hook': myHook,
};
```

### Step 4: Build and Test

```bash
# Build bundle
npm run build

# Test the hook
echo '{"tool_name":"Bash","session_id":"test","tool_input":{"command":"echo hello"}}' | \
  node bin/run-hook.mjs pretool/bash/my-hook
```

### Step 5: Add to Plugin Configuration

Add hook registration to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "name": "My Hook",
        "path": "./src/hooks/bin/run-hook.mjs pretool/bash/my-hook",
        "matcher": "Bash"
      }
    ]
  }
}
```

---

## Hook Input/Output Format

### Input (HookInput interface)

Received via stdin as JSON:

```typescript
interface HookInput {
  hook_event?: 'PreToolUse' | 'PostToolUse' | 'PermissionRequest' | 'UserPromptSubmit' | ...;
  tool_name: string;              // e.g., "Bash", "Write", "Read"
  session_id: string;             // CC 2.1.9 guaranteed
  tool_input: ToolInput;          // Tool-specific params
  tool_output?: unknown;          // PostToolUse only
  tool_error?: string;            // If tool errored
  exit_code?: number;             // Bash exit code
  prompt?: string;                // UserPromptSubmit only
  project_dir?: string;           // Project directory
  subagent_type?: string;         // SubagentStart/Stop
  agent_output?: string;          // SubagentStop
  // ... additional fields
}
```

### Output (HookResult interface)

Written to stdout as JSON:

```typescript
interface HookResult {
  continue: boolean;              // true = proceed, false = block
  suppressOutput?: boolean;       // Hide from user (default: false)
  systemMessage?: string;         // Message shown to user
  stopReason?: string;            // Reason for blocking (when continue=false)
  hookSpecificOutput?: {
    permissionDecision?: 'allow' | 'deny';         // PermissionRequest
    permissionDecisionReason?: string;             // Why allowed/denied
    additionalContext?: string;                    // CC 2.1.9: inject context
    hookEventName?: 'PreToolUse' | 'PostToolUse' | ...; // Required for additionalContext
  };
}
```

---

## Output Builders (lib/common.ts)

Use these helpers for consistent output:

```typescript
import {
  outputSilentSuccess,    // { continue: true, suppressOutput: true }
  outputSilentAllow,      // Silent permission allow
  outputBlock,            // Block with reason
  outputWithContext,      // Inject context (PostToolUse)
  outputPromptContext,    // Inject context (UserPromptSubmit)
  outputAllowWithContext, // Allow + inject context (PreToolUse)
  outputError,            // Show error message
  outputWarning,          // Show warning
  outputDeny,             // Deny permission with reason
} from './lib/common.js';

// Example: Silent success
return outputSilentSuccess();

// Example: Block operation
return outputBlock('Committing to main branch is not allowed');

// Example: Inject context before tool execution
return outputWithContext('💡 Consider using cursor-based pagination for large datasets');
```

---

## Guards (lib/guards.ts)

Guards are predicates that determine if a hook should run. Return early if guard fails:

```typescript
import {
  guardBash,              // Only run for Bash tool
  guardWriteEdit,         // Only run for Write/Edit tools
  guardCodeFiles,         // Only run for .py, .ts, .js, etc.
  guardTestFiles,         // Only run for test files
  guardSkipInternal,      // Skip .claude/, node_modules/, etc.
  guardGitCommand,        // Only run for git commands
  guardNontrivialBash,    // Skip echo, ls, pwd, etc.
  guardPathPattern,       // Only run for specific paths
  guardFileExtension,     // Only run for specific extensions
} from './lib/guards.js';

export function myHook(input: HookInput): HookResult {
  // Apply guard: skip if not Bash tool
  const guardResult = guardBash(input);
  if (guardResult) return guardResult;

  // Hook logic runs only for Bash tool
  // ...
}
```

### Composite Guards

Run multiple guards in sequence:

```typescript
import { runGuards, guardBash, guardNontrivialBash } from './lib/guards.js';

export function myHook(input: HookInput): HookResult {
  // Skip if not Bash OR is trivial command
  const guardResult = runGuards(input, guardBash, guardNontrivialBash);
  if (guardResult) return guardResult;

  // Hook logic...
}
```

---

## Fire-and-Forget Pattern (Issue #243)

### Overview

Async hooks run in the background via CC's native `async: true` flag without blocking the conversation. Previously used fire-and-forget spawning (removed in #653). Now all 9 async hooks use `run-hook.mjs` with `async: true`.

### How It Works

```
User types /exit
    ↓
run-hook.mjs stop/unified-dispatcher (async: true)
    ↓
CC runs hook in background, session exits immediately
    ↓
Unified dispatcher runs cleanup hooks in parallel
```

### Stop Hooks (via async dispatcher)

**Core Session (6):** auto-save-context, session-patterns, issue-work-summary, calibration-persist, session-profile-aggregator, session-end-tracking

**Memory Sync (2):** graph-queue-sync, workflow-preference-learner

**Instance Management (3):** multi-instance-cleanup, cleanup-instance, task-completion-check

**Analysis (3):** context-compressor, auto-remember-continuity, security-scan-aggregator

**Skill Validation (12):** coverage-check, evidence-collector, coverage-threshold-gate, cross-instance-test-validator, di-pattern-enforcer, duplicate-code-detector, eval-metrics-collector, migration-validator, review-summary-generator, security-summary, test-pattern-validator, test-runner

**Heavy Analysis (1):** full-test-suite

### Security Hardening

**SEC-001 — SQL Injection Prevention:** `multi-instance-cleanup` and `cleanup-instance` validate instance IDs with `/^[a-zA-Z0-9_\-.:]+$/` before shell-exec SQLite interpolation. Invalid IDs are rejected with silent success.

**SEC-003 — Atomic File Writes:** `multi-instance-lock` writes lock data to a temp file (`locks.json.<pid>.tmp`) then uses `renameSync` for atomic replacement, preventing TOCTOU race conditions when multiple instances write concurrently.

### When to Use Async Hooks

Use `"async": true` for hooks that:
- Don't need to block user interaction
- Can fail silently without impact
- Perform analytics, metrics, or cleanup operations
- Run at session exit (Stop event)

---

## Async Hooks (CC 2.1.19+)

### Overview

Async hooks execute in the background without blocking the main conversation flow. This is ideal for:
- **Analytics and metrics** - Track usage patterns without slowing responses
- **Network I/O** - External API calls (webhooks, sync operations)
- **Session startup** - Heavy initialization that doesn't need to complete before user interaction

### Configuration

Add `async: true` and `timeout` to hook definitions in `hooks.json`:

```json
{
  "type": "command",
  "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs posttool/session-metrics",
  "async": true,
  "timeout": 30
}
```

### Async vs Synchronous Hooks

| Aspect | Synchronous | Async |
|--------|-------------|-------|
| Blocking | Yes - waits for completion | No - runs in background |
| Result handling | Immediate response processing | Notified on completion |
| Use case | Validation, blocking, context injection | Analytics, logging, external calls |
| Timeout | Default 2 minutes | Explicit timeout required |

### When to Use Async Hooks

**Use async for:**
- Session metrics and audit logging
- Pattern extraction and learning
- External API calls (GitHub, webhooks)
- Non-critical sync operations
- Any hook that doesn't need to block execution

**Keep synchronous for:**
- Security validation (must block dangerous commands)
- Permission decisions (must respond before execution)
- Context injection (must add context before tool runs)
- Quality gates (must validate before allowing writes)

### Current Async Hooks (9 hooks.json entries dispatching individual hooks)

**SessionStart (4 hooks)** - Startup optimization:
- `pattern-sync-pull` - Pull learned patterns
- `coordination-init` - Multi-instance coordination
- `decision-sync-pull` - Pull decision history
- `dependency-version-check` - Check for outdated deps

> **CC 2.1.47 Deferral**: SessionStart hooks fire ~500ms after session init. Async hooks are unaffected (fire-and-forget). Sync hooks still run before the first user prompt. Do not assume env vars set by async SessionStart hooks are available at first `UserPromptSubmit`.

**PostToolUse Analytics (7 hooks)** - Non-blocking metrics:
- `session-metrics` - Track tool usage
- `audit-logger` - Log all operations
- `calibration-tracker` - Calibration metrics
- `code-style-learner` - Extract code style patterns
- `naming-convention-learner` - Extract naming conventions
- `skill-usage-optimizer` - Track skill patterns
- `realtime-sync` - Real-time state sync

**Network I/O (5 hooks)** - External API calls:
- `pattern-extractor` - Extract patterns from git
- `issue-progress-commenter` - Comment on GitHub issues
- `issue-subtask-updater` - Update subtask checkboxes
- `coordination-heartbeat` - Multi-instance heartbeat
- `memory-bridge` - Sync to knowledge graph

### Timeout Recommendations

| Hook Category | Recommended Timeout | Rationale |
|---------------|---------------------|-----------|
| Local analytics | 10-30s | Fast local operations |
| Memory sync | 30s | Cloud API calls |
| GitHub operations | 30-60s | Rate limit handling |
| Heavy processing | 60s | Complex extraction |

### Error Handling

Async hooks should handle errors gracefully:

```typescript
export function myAsyncHook(input: HookInput): HookResult {
  try {
    // External API call or heavy processing
    await syncToCloud(data);
    return outputSilentSuccess();
  } catch (err) {
    // Log error but don't fail - async hooks shouldn't block
    logHook('my-async-hook', `Error (non-blocking): ${err.message}`);
    return outputSilentSuccess();
  }
}
```

### Migration from background: true

The `background: true` flag (CC 2.1.19) was replaced by `async: true` for clarity:

```json
// Old (deprecated)
{
  "type": "command",
  "command": "...",
  "background": true
}

// New (CC 2.1.19+)
{
  "type": "command",
  "command": "...",
  "async": true,
  "timeout": 30
}
```

---

## CC 2.1.9 Compliance

### additionalContext Feature

Hooks can inject additional context BEFORE tool execution:

```typescript
import { outputAllowWithContext } from './lib/common.js';

export function myPreToolHook(input: HookInput): HookResult {
  const context = `
⚠️ IMPORTANT: You are about to modify a critical file.
- Ensure changes are backwards compatible
- Update tests if behavior changes
- Document breaking changes in CHANGELOG
`;

  return outputAllowWithContext(context);
}
```

**Use Cases:**
- Warn about risky operations
- Inject best practices before execution
- Provide contextual guidance based on detected patterns

### Session ID Guaranteed

CC 2.1.9 guarantees `session_id` field is always present:

```typescript
export function myHook(input: HookInput): HookResult {
  // No fallback needed - session_id guaranteed
  const sessionId = input.session_id;
  logHook('my-hook', `Session: ${sessionId}`);
}
```

---

## CC 2.1.16 Compliance (Task Management)

Hooks can interact with CC 2.1.16 Task Management System for dependency tracking:

```typescript
// Example: Create task dependency when detecting blocking issue
export function myHook(input: HookInput): HookResult {
  const context = `
⚠️ Migration required before proceeding

Consider creating a task:
- Subject: "Run database migration"
- Add blockedBy dependency to current task
`;

  return outputWithContext(context);
}
```

**Task Status Workflow:**
- `pending` → `in_progress` → `completed`

**Dependency Tracking:**
- Use `blockedBy` for prerequisites
- Use `blocks` for dependent tasks

See `skills/task-dependency-patterns` for comprehensive patterns.

---

## Logging

### Hook Logging

```typescript
import { logHook } from './lib/common.js';

// Log general hook activity
logHook('my-hook', 'Processing bash command');
logHook('my-hook', `File: ${filePath}`);
```

**Output:** `~/.claude/logs/ork/hooks.log` (if installed via plugin) or `.claude/logs/hooks.log`

**Format:** `[2026-01-23 10:15:30] [my-hook] Processing bash command`

**Rotation:** Automatic at 200KB

### Permission Feedback Logging

```typescript
import { logPermissionFeedback } from './lib/common.js';

// Log permission decisions for audit trail
logPermissionFeedback('allow', 'Auto-approved readonly operation', input);
logPermissionFeedback('deny', 'Blocked dangerous command', input);
logPermissionFeedback('warn', 'Potential security risk detected', input);
```

**Output:** `~/.claude/logs/ork/permission-feedback.log`

**Format:** `2026-01-23T10:15:30.123Z | allow | Auto-approved readonly operation | tool=Read | session=abc123`

**Rotation:** Automatic at 100KB

---

## Type Guards

Use type guards to narrow tool input types:

```typescript
import { isBashInput, isWriteInput, isEditInput } from '../types.js';
import type { BashToolInput, WriteToolInput } from '../types.js';

export function myHook(input: HookInput): HookResult {
  if (isBashInput(input.tool_input)) {
    // TypeScript knows tool_input has 'command' field
    const command: string = input.tool_input.command;
  }

  if (isWriteInput(input.tool_input)) {
    // TypeScript knows tool_input has 'file_path' and 'content'
    const filePath: string = input.tool_input.file_path;
    const content: string = input.tool_input.content;
  }
}
```

**Available Type Guards:**
- `isBashInput(input)` - Bash tool (command field)
- `isWriteInput(input)` - Write tool (file_path, content)
- `isEditInput(input)` - Edit tool (file_path, old_string, new_string)
- `isReadInput(input)` - Read tool (file_path)

---

## Best Practices

### 1. Use Guards Early

```typescript
// ✅ Good: Guard at top, fast return
export function myHook(input: HookInput): HookResult {
  const guardResult = guardBash(input);
  if (guardResult) return guardResult;

  // Hook logic...
}

// ❌ Bad: Complex logic before guard check
export function myHook(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const normalized = normalizeCommand(command);
  // ... 50 lines of logic ...

  if (input.tool_name !== 'Bash') return outputSilentSuccess(); // Too late!
}
```

### 2. Silent by Default

```typescript
// ✅ Good: Silent success for non-issues
if (noIssuesFound) {
  return outputSilentSuccess();
}

// ❌ Bad: Noisy logging for normal operations
return {
  continue: true,
  systemMessage: "✓ Hook completed successfully" // Don't spam user
};
```

### 3. Block with Clear Reasons

```typescript
// ✅ Good: Explain WHY and HOW to fix
return outputBlock(`
❌ Direct commits to 'main' branch are not allowed.

Fix: Create a feature branch
  git checkout -b feature/my-feature
  git commit -m "Your changes"
  gh pr create
`);

// ❌ Bad: Vague error
return outputBlock('Operation not allowed');
```

### 4. Use Type Guards

```typescript
// ✅ Good: Type-safe access
if (isBashInput(input.tool_input)) {
  const command = input.tool_input.command; // TypeScript knows this exists
}

// ❌ Bad: Unsafe access
const command = input.tool_input.command || ''; // Might be undefined
```

### 5. Log Sparingly

```typescript
// ✅ Good: Log meaningful events
logHook('my-hook', `Blocked dangerous command: ${command}`);

// ❌ Bad: Log noise
logHook('my-hook', 'Hook started');
logHook('my-hook', 'Checking command...');
logHook('my-hook', 'Command is safe');
logHook('my-hook', 'Hook finished');
```

### 6. Handle Errors Gracefully

```typescript
// ✅ Good: Catch errors, return silent success
export function myHook(input: HookInput): HookResult {
  try {
    // Hook logic...
    return outputSilentSuccess();
  } catch (err) {
    logHook('my-hook', `Error: ${err.message}`);
    return outputSilentSuccess(); // Don't block on hook errors
  }
}

// ❌ Bad: Let errors crash the hook
export function myHook(input: HookInput): HookResult {
  const data = fs.readFileSync('/nonexistent'); // May throw!
  // Hook logic...
}
```

---

## Performance Considerations

### Bundle Architecture (Phase 4 Split Bundles)

**Per-Event Loading:** Each hook event loads only its specific bundle:

| Bundle | Size | Exports | When Loaded |
|--------|------|---------|-------------|
| permission.mjs | 8KB | 41 | PermissionRequest events |
| pretool.mjs | 48KB | 50 | PreToolUse events |
| posttool.mjs | 58KB | 35 | PostToolUse events |
| prompt.mjs | 57KB | 89 | UserPromptSubmit events |
| lifecycle.mjs | 31KB | 35 | SessionStart/SessionEnd |
| stop.mjs | 33KB | 35 | Stop events |
| subagent.mjs | 56KB | 66 | SubagentStart/Stop |
| notification.mjs | 5KB | 26 | Notification events |
| setup.mjs | 24KB | 26 | Setup/maintenance |
| skill.mjs | 52KB | 35 | Skill operations |
| agent.mjs | 8KB | 41 | Agent operations |
| hooks.mjs (unified) | 324KB | 136 | CLI tools only |

**Performance Gains:**
- **89% per-load savings:** Average ~35KB loaded per hook vs 324KB unified
- **Split total:** 381KB (across 12 bundles)
- **Typical load:** 8-58KB depending on event type

### Hook Execution Time

- **Permission hooks:** < 10ms (block if slower)
- **PreTool hooks:** < 50ms (critical path)
- **PostTool hooks:** < 100ms (non-blocking)

### Optimization Tips

1. **Early returns:** Use guards at top of function
2. **Lazy loading:** Import heavy dependencies only when needed
3. **Avoid I/O:** Minimize file system operations
4. **Cache results:** Store expensive computations
5. **Skip trivial:** Use guards to skip echo, ls, pwd, etc.
6. **Bundle-aware:** Place hooks in correct entry point for optimal loading

### 7. Preserve Prompt Cache

Claude Code uses prefix-based prompt caching. Hooks interact with caching in two ways:

**Safe (preserves cache):**
- Injecting `additionalContext` via `outputPromptContext()` or `outputAllowWithContext()` — these add to the current user message, not the system prompt prefix
- Using `<system-reminder>` tags in tool results — appended to messages, not the prefix
- `async: true` hooks — run in background, don't affect the conversation prefix

**Dangerous (breaks cache):**
- Anything that would modify the system prompt, tool definitions, or tool ordering
- Adding/removing MCP servers mid-session (changes the tool set in the prefix)
- Hooks that suggest switching models mid-conversation (each model has its own cache)

```typescript
// CORRECT: Inject via additionalContext (appended to message, cache-safe)
return outputPromptContext('Updated context: project uses React 19');

// WRONG: Using systemMessage for dynamic updates (visible to user, not cache-related
// but wasteful — additionalContext is the right channel for hook-injected guidance)
return { continue: true, systemMessage: 'Updated context: project uses React 19' };
```

**Why this matters:** The Claude Code team monitors cache hit rate like uptime. A few percentage points of cache miss can dramatically affect cost and latency for users.

---

## Troubleshooting

### Hook Not Running

**Check:**
1. Hook registered in `src/index.ts`?
2. Hook added to `.claude/settings.json`?
3. Bundle built? (`npm run build`)
4. Matcher pattern correct?

**Debug:**
```bash
# Test hook directly
echo '{"tool_name":"Bash","session_id":"test","tool_input":{"command":"git status"}}' | \
  node bin/run-hook.mjs pretool/bash/my-hook
```

### Hook Blocking Incorrectly

**Check:**
1. Guard logic correct?
2. Using correct output builder?
3. Return early for non-matching cases?

**Debug:**
```typescript
// Add logging
logHook('my-hook', `Tool: ${input.tool_name}, Command: ${input.tool_input.command}`);
```

### Bundle Size Exceeds 100KB

**Actions:**
1. Check `dist/bundle-stats.json` for breakdown
2. Identify large dependencies
3. Consider lazy loading or removal
4. Run `npm run build` and check warnings

### TypeScript Errors

**Check:**
```bash
npm run typecheck
```

**Common Issues:**
- Missing type imports
- Incorrect type annotations
- Outdated types.ts definitions

---

## Adding Hooks to Split Bundles

When adding new hooks, place them in the appropriate entry point for optimal bundle loading:

### Step 1: Identify Event Type

| Event | Entry Point | Bundle |
|-------|-------------|--------|
| PermissionRequest | src/entries/permission.ts | permission.mjs |
| PreToolUse | src/entries/pretool.ts | pretool.mjs |
| PostToolUse | src/entries/posttool.ts | posttool.mjs |
| UserPromptSubmit | src/entries/prompt.ts | prompt.mjs |
| SessionStart/End | src/entries/lifecycle.ts | lifecycle.mjs |
| Stop | src/entries/stop.ts | stop.mjs |
| SubagentStart/Stop | src/entries/subagent.ts | subagent.mjs |
| Notification | src/entries/notification.ts | notification.mjs |
| Setup | src/entries/setup.ts | setup.mjs |
| Skill-specific | src/entries/skill.ts | skill.mjs |
| Agent-specific | src/entries/agent.ts | agent.mjs |

### Step 2: Register in Entry Point

```typescript
// In src/entries/pretool.ts (example)
import { myNewHook } from '../pretool/bash/my-new-hook.js';

export const hooks: Record<string, HookFn> = {
  // ... existing hooks ...
  'pretool/bash/my-new-hook': myNewHook,
};
```

### Step 3: Export from Main Index

Also add to `src/index.ts` for CLI tools that use the unified bundle:

```typescript
export { myNewHook } from './pretool/bash/my-new-hook.js';
```

### Step 4: Update run-hook.mjs (if new category)

If adding a new hook category, update `bin/run-hook.mjs` bundleMap:

```javascript
const bundleMap = {
  // ... existing mappings ...
  'my-category': 'my-bundle',
};
```

---

## References

- **Claude Code Plugin Docs:** https://docs.anthropic.com/claude-code/plugins
- **CC 2.1.16 Spec:** Task Management System with dependency tracking
- **CC 2.1.9 Spec:** additionalContext support
- **CC 2.1.7 Spec:** Hook output format
- **Project README:** `/Users/yonatangross/coding/projects/orchestkit/README.md`
- **CLAUDE.md:** `/Users/yonatangross/coding/projects/orchestkit/CLAUDE.md`

## Managed vs User Settings (CC 2.1.49)

Plugin `settings.json` provides **managed defaults** for hooks. Three tiers of precedence:

1. **Managed** (plugin `settings.json`) — shipped by OrchestKit, user can override
2. **Project** (`.claude/settings.json`) — repository-level config
3. **User** (`~/.claude/settings.json`) — personal preferences, highest priority

OrchestKit hooks are managed defaults. Users retain full control to disable any hook.

---

**Last Updated:** 2026-02-28
**Version:** 2.1.0 (Async hooks support)
**Architecture:** 12 split bundles (381KB total) + 1 unified (324KB)
**Hooks:** 66 hooks (37 global + 28 agent-scoped + 1 skill-scoped, 9 native async)
**Average Bundle:** ~35KB per event
**Claude Code Requirement:** >= 2.1.49

See the async hooks section above for detailed async hook patterns.
