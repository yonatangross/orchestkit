# CC Version Compatibility Matrix

## Overview

OrchestKit requires Claude Code >= 2.1.47. This matrix documents which CC features OrchestKit depends on and their minimum version requirements.

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
| Windows hook execution | 2.1.47 | All 87 hooks on Windows | Hooks silently fail on Windows |
| Windows worktree sessions | 2.1.47 | Drive letter casing match | Worktree sessions not matched |
| Improved agent memory | 2.1.47 | Higher context limits | Conservative limits apply |

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
| >= 2.1.47 | Full | All features available |

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

## OrchestKit Version History

| OrchestKit | Min CC | Key Changes |
|-----------|--------|-------------|
| v6.0.x | 2.1.47 | Full CC 2.1.47 adoption, relaxed context limits |
| v5.x | 2.1.34 | Agent Teams support, unified dispatchers |
| v4.x | 2.1.9 | Session tracking, TypeScript hooks |
