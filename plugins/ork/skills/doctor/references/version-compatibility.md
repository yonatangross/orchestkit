# CC Version Compatibility Matrix

## Overview

OrchestKit requires Claude Code >= 2.1.72. This matrix documents which CC features OrchestKit depends on and their minimum version requirements.

## Feature Matrix

| Feature | Min CC Version | OrchestKit Usage | Degradation if Missing |
|---------|---------------|-----------------|----------------------|
| `subagent_type` in SubagentStart | 2.1.7 | Agent type detection in all SubagentStart hooks | Hooks fall back to prompt scanning (removed in v6.0) |
| `session_id` guaranteed | 2.1.9 | Session tracking in all hooks | Session-scoped features fail |
| Hook `continue` field | 2.1.7 | All hook responses | Hooks silently ignored |
| Permission rules detection | 2.1.3 | Doctor unreachable rules check | Permission check skipped |
| `sonnet-4-6` model | 2.1.45 | Agent model field in frontmatter | Falls back to older sonnet |
| Plugin hot reload | 2.1.45 | Live plugin updates without restart | Must restart CC after changes |
| `last_assistant_message` | 2.1.47 | Stop/SubagentStop context capture | Missing assistant context |
| `added_dirs` statusline field | 2.1.47 | Multi-directory project support | Single-dir only in statusline |
| Deferred SessionStart (500ms) | 2.1.47 | Hooks fire after env is ready | Race conditions on cold start |
| Agent model in Teams | 2.1.47 | Model field respected in team spawns | Model ignored, uses default |
| Worktree discovery | 2.1.47 | Skills/agents found from worktrees | Worktree sessions miss plugins |
| Background tasks in worktrees | 2.1.47 | Task tool from worktrees | Background agents fail silently |
| Windows hook execution | 2.1.47 | All hooks on Windows | Hooks silently fail on Windows |
| Windows worktree sessions | 2.1.47 | Drive letter casing match | Worktree sessions not matched |
| Improved agent memory | 2.1.47 | Higher context limits | Conservative limits apply |
| `Ctrl+F` find in output | 2.1.47 | Search through session output | No search capability |
| `Shift+Down` multi-line input | 2.1.47 | Multi-line prompt entry | Single-line input only |
| Memory leak fixes (8 leaks) | 2.1.50 | Stable long-running sessions | Memory grows unbounded over time |
| `claude_agents_cli` | 2.1.50 | Doctor agent registration check | Agent registration check skipped |
| ConfigChange hook event | 2.1.50 | Detect mid-session settings changes | Stale config until restart |
| Auto-memory | 2.1.59 | Claude saves learnings across sessions | Manual CLAUDE.md only |
| `@import` in CLAUDE.md | 2.1.59 | Modular instruction files | Single monolithic CLAUDE.md |
| `.claude/rules/` with `paths:` | 2.1.59 | Path-scoped rules per directory | All rules loaded always |
| HTTP hooks (`type: "http"`) | 2.1.63 | Observability hooks POST to remote endpoints | Falls back to command hooks (local JSONL) |
| Worktree config sharing | 2.1.63 | Project configs shared across worktrees | Manual config copy needed |
| `/clear` resets skills | 2.1.63 | Fixes stale skill content after edits | Native since 2.1.63; no workaround needed |
| Teammate memory fix | 2.1.63 | Safe for 5+ teammate swarms | Memory grows in long team sessions |
| `/simplify`, `/batch` built-in | 2.1.63 | Bundled CC slash commands | Not available |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | 2.1.63 | Opt out of claude.ai MCP servers | All claude.ai MCPs always loaded |
| InstructionsLoaded hook event | 2.1.69 | Rules materialization timing, context injection | Rules written too late, stale context |
| `once: true` hooks | 2.1.69 | 13 skill context loaders fire once then auto-remove | Loaders fire every prompt (wasted tokens) |
| `permissionDecision: 'ask'` | 2.1.69 | Gray-zone command escalation to user | Binary allow/deny only |
| `tool_use_id` correlation | 2.1.69 | Pre/PostToolUse pair tracking | No correlation between pre/post |
| `${ENV_VAR}` in HTTP hooks | 2.1.69 | ORCHESTKIT_HOOK_URL/TOKEN in type:http hooks | Must use command hooks for env vars |
| Path-scoped rules (`paths:`) | 2.1.69 | 10 conditional rules scoped to file paths | All rules always loaded |
| Worktree dedup fixes | 2.1.70 | Prevents duplicate hook fires in worktrees | Hooks may fire twice |
| 74% prompt re-render reduction | 2.1.70 | CC-internal perf (no action needed) | Higher latency on re-renders |
| ~600 token skill listing savings | 2.1.70 | CC-internal (frees headroom for hook injection) | Tighter token budget |
| MCP cache invalidation | 2.1.70 | MCP tools refresh on reconnect | Stale MCP tool definitions |
| `/loop` command | 2.1.71 | Recurring prompts on intervals (deploy watch, health monitor) | Manual re-invocation |
| Cron scheduling tools | 2.1.71 | Session-scoped cron for recurring tasks | No in-session scheduling |
| Expanded bash auto-approval | 2.1.71 | `fmt`, `comm`, `cmp`, `seq`, `printf`, `test`, etc. auto-approved | Manual approval for POSIX utils |
| `/debug` toggle mid-session | 2.1.71 | Toggle debug logging without restart | Must restart to change log level |
| `settings.local.json` uninstall | 2.1.71 | `/plugin uninstall` writes to local settings, not shared | Uninstall modifies committed settings.json |
| `voice:pushToTalk` rebindable | 2.1.71 | Custom keybinding for push-to-talk in voice mode | Fixed keybinding |
| Background agent output path | 2.1.71 | Completion notifications include output file path | Missing output path in notifications |
| Plugin multi-instance fix | 2.1.71 | Concurrent CC instances preserve plugin installs | Plugin state lost with multiple instances |
| ToolSearch cleanup | 2.1.71 | "Tool loaded." message removed from output | Noisy ToolSearch output |
| Plugin marketplace fixes | 2.1.71 | `@ref` parsing and merge conflict resolution | Marketplace update/add failures |
| Skill listing skip on `--resume` | 2.1.71 | ~600 tokens saved on session resume (no re-injection) | Skill listing re-injected on every resume |
| ExitWorktree tool | 2.1.72 | Agents can leave worktree sessions programmatically | Agents stuck in worktree until session ends |
| Agent `model` parameter restored | 2.1.72 | Per-invocation model override via Agent tool | Model override silently ignored |
| Team agents inherit leader model | 2.1.72 | Teammates use leader's model when unspecified | Teammates fall back to default model |
| `/plan` accepts description arg | 2.1.72 | `/plan fix auth bug` starts plan with context | Must type description after `/plan` prompt |
| Effort levels simplified | 2.1.72 | Three levels: low/medium/high (was 5-level) | Five-level effort scale |
| `CLAUDE_CODE_DISABLE_CRON` env var | 2.1.72 | Disable cron scheduling via environment | No way to disable cron |
| Skill hooks double-fire fix | 2.1.72 | Skill-scoped hooks fire exactly once | Skill hooks may fire twice per invocation |
| `/clear` preserves bg agents | 2.1.72 | Background agents survive `/clear` | `/clear` kills background agents |
| Agent prompt persistence fix | 2.1.72 | Agent prompt no longer deleted from settings.json | Agent prompts lost on restart |
| AlwaysAllow rule matching fix | 2.1.72 | Permission rules match commands correctly | AlwaysAllow rules may not match |
| Worktree task resume fixes | 2.1.72 | cwd restore + bg notification metadata on resume | Worktree tasks resume in wrong dir, missing metadata |
| Prompt cache fix | 2.1.72 | Up to 12x token cost reduction via improved caching | Higher token costs from cache misses |
| Expanded bash auto-approval | 2.1.72 | `lsof`, `pgrep`, `tput`, `ss`, `fd`, `fdfind` auto-approved | Manual approval for system inspection tools |
| `vscode://anthropic.claude-code/open` | 2.1.72 | URI handler to open CC from VS Code links | No deep-link integration with VS Code |

## Version Detection

The doctor skill checks the CC version at runtime:

```bash
# CC reports version via environment or CLI
claude --version  # Returns e.g. "2.1.47"
```

## Compatibility Levels

| CC Version | Support Level | Description |
|-----------|--------------|-------------|
| < 2.1.7 | Unsupported | Core hook protocol missing |
| 2.1.7 - 2.1.44 | Degraded | Missing memory improvements, worktree fixes, Windows support |
| 2.1.45 - 2.1.46 | Partial | Missing 2.1.47 features but functional |
| 2.1.47 - 2.1.49 | Partial | All hook features, memory leak risk in long sessions |
| 2.1.50 - 2.1.58 | Partial | Memory leaks fixed, missing auto-memory and @imports |
| 2.1.59 - 2.1.62 | Partial | Auto-memory, @imports, missing HTTP hooks and 2.1.69 features |
| 2.1.63 - 2.1.68 | Partial | HTTP hooks, worktree config sharing, missing InstructionsLoaded/once:true/ask |
| >= 2.1.69 | Full | InstructionsLoaded, once:true, outputAsk, path-scoped rules, env var interpolation |
| >= 2.1.70 | Full+ | Worktree dedup, 74% re-render reduction, MCP cache fixes |
| >= 2.1.71 | Full++ | `/loop` command, cron scheduling, expanded bash allowlist, `/debug` toggle, plugin stability |
| >= 2.1.72 | Full+++ | ExitWorktree, agent model override, effort simplification, prompt cache 12x savings, skill hook fix |

## Doctor Check Implementation

The doctor skill validates CC version in category 10:

```
Claude Code: 2.1.47 (OK)
- Minimum required: 2.1.47
```

When CC version is below 2.1.47, doctor should show:

```
Claude Code: 2.1.44 (DEGRADED)
- Minimum required: 2.1.47
- Missing features:
  - last_assistant_message (Stop/SubagentStop context)
  - added_dirs (multi-directory support)
  - Windows hook execution
  - Worktree discovery
  - Deferred SessionStart
- Upgrade: npm install -g @anthropic-ai/claude-code@latest
```

## Memory Leak Warning (CC < 2.1.50)

CC 2.1.50 fixed 8 memory leaks affecting long-running sessions:
- Agent teams: completed teammate tasks never garbage collected
- Task state objects never removed from AppState
- TaskOutput retained data after cleanup
- CircularBuffer cleared items retained in backing array
- Shell execution: ChildProcess/AbortController refs retained after cleanup
- LSP diagnostic data never cleaned up after delivery
- File history snapshots: unbounded growth
- Internal caches not cleared after compaction (fixed in 2.1.63)

**Recommendation:** If CC version < 2.1.50, warn user to upgrade for long sessions.

Doctor should display when CC < 2.1.50:

```
Claude Code: 2.1.4x (MEMORY LEAK RISK)
- 8 memory leaks fixed in 2.1.50 affect long-running sessions
- Symptoms: increasing memory usage, slower responses over time
- Upgrade: npm install -g @anthropic-ai/claude-code@latest
```

## Release Channel Detection

Doctor should detect and display the release channel alongside the CC version check. The version is read from `.claude-plugin/plugin.json` or `version.txt`.

| Version Pattern | Channel | Stability |
|----------------|---------|-----------|
| `X.Y.Z` (no suffix) | stable | Production-ready |
| `X.Y.Z-beta.N` | beta | Feature-complete, may have bugs |
| `X.Y.Z-alpha.N` | alpha | Experimental, expect breaking changes |

When on beta or alpha, doctor should append a pre-release reminder to the compatibility output:

```
Claude Code: 2.1.56 (OK)
- Minimum required: 2.1.56
- OrchestKit channel: beta (v7.0.0-beta.3)
  ⚠ Pre-release version — some features may be unstable. Report issues at github.com/yonatangross/orchestkit/issues
```

On stable, no extra warning is needed — just include the channel line:

```
Claude Code: 2.1.56 (OK)
- Minimum required: 2.1.56
- OrchestKit channel: stable (v7.0.0)
```

## OrchestKit Version History

| OrchestKit | Min CC | Key Changes |
|-----------|--------|-------------|
| v7.1.x | 2.1.69 | InstructionsLoaded, once:true loaders, outputAsk, env var HTTP hooks, worktree dedup |
| v7.0.x | 2.1.59 | Auto-memory, @imports, ConfigChange, HTTP hooks (2.1.63+), unified plugin |
| v6.0.x | 2.1.47 | Full CC 2.1.47 adoption, relaxed context limits |
| v5.x | 2.1.34 | Agent Teams support, unified dispatchers |
| v4.x | 2.1.9 | Session tracking, TypeScript hooks |
