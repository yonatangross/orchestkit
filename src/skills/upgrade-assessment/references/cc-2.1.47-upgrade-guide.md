# CC 2.1.47 Upgrade Guide

## What Changed

CC 2.1.47 is the new minimum version for OrchestKit 6.0.x. This release includes platform fixes, new hook fields, and UX improvements.

## Breaking Changes

None. CC 2.1.47 is backwards-compatible with all OrchestKit hooks and skills.

## New Hook Input Fields

| Field | Event | Description |
|-------|-------|-------------|
| `last_assistant_message` | Stop, SubagentStop | Final assistant message text from the session/agent |
| `added_dirs` | All events | List of directories added via `--add-dir` or `/add-dir` |

These fields are optional — hooks should always use `input.field ?? fallback` patterns.

## Platform Fixes

### Windows Support
- Hooks now execute on Windows via Git Bash (previously silently failed)
- Windows worktree session matching fixed (drive letter casing)
- PR #645 added Windows-safe spawning to prevent console flashing

### Worktree Support
- Skills and agents are now discovered from worktrees (previously main checkout only)
- Background tasks (`Task` tool) complete successfully from worktrees
- Heartbeat and cleanup hooks work reliably in worktrees

### SessionStart Deferral
- SessionStart hooks now fire ~500ms after session init
- All OrchestKit SessionStart hooks are compatible with this deferral
- Async hooks (`unified-dispatcher`, `pr-status-enricher`) are unaffected (already fire-and-forget)
- Sync hooks (`session-context-loader`, `prefill-guard`, `mcp-health-check`) still run before first prompt

## UX Improvements

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Find in output | `Ctrl+F` | Search through all session output |
| Multi-line input | `Shift+Down` | Enter multi-line prompts without sending |

## Agent Teams Improvements

- `model` field in agent frontmatter is now respected in team spawns
- Improved agent memory provides larger context for spawned agents
- `TeammateIdle` and `TaskCompleted` events available since CC 2.1.33

## OrchestKit Adoption Summary

### Hooks Updated
- `monorepo-detector`: Skips `--add-dir` suggestion when `added_dirs` already active
- `memory-capture`: Tracks `added_dirs_count` and classifies `session_outcome`
- `session-tracking`: Passes `added_dirs_count` to session context
- `session-cleanup`: Includes `last_msg_len` and `added_dirs_count` in analytics
- `session-context-loader`: Scans added directories for context files
- `subagent-stop/unified-dispatcher`: Tracks `last_msg_len` in agent analytics
- `auto-approve-project-writes`: Already supports `added_dirs` (reference implementation)

### Skills Updated
- `doctor`: Version compatibility matrix with all CC 2.1.47 features
- `configure`: Team plugin distribution docs
- `worktree-coordination`: CC 2.1.47 platform support table
- `help`: CC keyboard shortcuts reference

### Runtime Utilities
- `cc-version-matrix.ts`: 18-feature matrix with version comparison and query helpers
- `hasFeature(version, feature)`: Check if a feature is available at a given CC version

## Verification

Run the doctor skill to verify your CC version:

```bash
/ork:doctor
```

Check 10 (Claude Code Version) validates CC >= 2.1.47 and reports missing features for older versions.

## Rollback

If you need to downgrade below CC 2.1.47:
- OrchestKit hooks will continue to work in degraded mode
- `added_dirs` and `last_assistant_message` fields will be undefined (hooks handle this gracefully)
- Windows hook execution will fail silently
- Worktree discovery will not find skills/agents from worktrees
