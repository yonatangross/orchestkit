# CC Version Compatibility Matrix

## Overview

OrchestKit requires Claude Code >= 2.1.59. This matrix documents which CC features OrchestKit depends on and their minimum version requirements.

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
| >= 2.1.59 | Full | All features: auto-memory, @imports, .claude/rules/, ConfigChange |

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
- Internal caches not cleared after compaction

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
| v7.0.x | 2.1.59 | Auto-memory, @imports guidance, ConfigChange hook, unified plugin |
| v6.0.x | 2.1.47 | Full CC 2.1.47 adoption, relaxed context limits |
| v5.x | 2.1.34 | Agent Teams support, unified dispatchers |
| v4.x | 2.1.9 | Session tracking, TypeScript hooks |
