# CC Version Compatibility Matrix

## Overview

OrchestKit requires Claude Code >= 2.1.78. This matrix documents which CC features OrchestKit depends on and their minimum version requirements.

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
| `${ENV_VAR}` in HTTP hooks | 2.1.69 | `$TOKEN` in headers works; `${VAR}` in URLs broken since 2.1.71 (validated before expansion) — use `generate-http-hooks` CLI with real URLs instead | Must use command hooks for env vars |
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
| `/output-style` deprecated → `/config` | 2.1.73 | No OrchestKit references to /output-style | None — already using /config |
| Skill-file deadlock fix on `git pull` | 2.1.73 | Fixes hang with 89-skill plugin after `git pull` | CC hangs during/after git pull |
| SessionStart hooks double-fire fix | 2.1.73 | ~15 SessionStart hooks fire exactly once on resume | Hooks fire twice on --resume/--continue |
| No-op system reminder injection fix | 2.1.73 | ~2K tokens/turn recovered across 99 hooks | Empty system-reminder tags waste context |
| Opus 4.6 default on Bedrock/Vertex/Foundry | 2.1.73 | 6 opus-tier agents auto-upgrade on cloud providers | Older Opus model on cloud providers |
| `/context` optimization hints | 2.1.74 | Actionable suggestions for context-heavy tools, memory bloat, capacity | No optimization guidance |
| `autoMemoryDirectory` setting | 2.1.74 | Custom auto-memory storage path via settings.json | Default path only |
| SessionEnd `hook.timeout` respected | 2.1.74 | SessionEnd hooks run to configured timeout (was hardcoded 1.5s) | SessionEnd hooks killed at 1.5s regardless of config |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | 2.1.74 | Env var override for SessionEnd hook timeout | No env var control |
| `--plugin-dir` precedence | 2.1.74 | Local dev plugins override marketplace installs | Marketplace takes precedence |
| Full model IDs in agent frontmatter | 2.1.74 | `claude-opus-4-6` etc. accepted (not just `opus`) | Only symbolic names (`opus`, `sonnet`, `haiku`) |
| Managed policy precedence fix | 2.1.74 | Managed policy `ask` overrides user `allow` + `allowed-tools` | User rules could bypass managed policy |
| Streaming + bash prefix memory fixes | 2.1.74 | Two memory leaks fixed (streaming buffers, bash prefix cache) | RSS growth in long sessions |
| 1M context default for Opus 4.6 | 2.1.75 | No extra usage needed on Max/Team/Enterprise | Must opt-in to 1M context |
| Memory file timestamps | 2.1.75 | Last-modified timestamps for memory freshness reasoning | No staleness signal on memories |
| Hook source in permission prompts | 2.1.75 | Shows settings/plugin/skill origin when hook asks for confirmation | Opaque hook origin |
| Token estimation fix | 2.1.75 | Prevents premature compaction from thinking/tool_use over-counting | Compaction triggers too early |
| Async hook messages suppressed | 2.1.75 | Hook completion messages hidden by default (visible with --verbose) | Noisy async hook output |
| MCP elicitation support | 2.1.76 | Servers request structured input mid-task via form/URL dialog | No MCP input dialogs |
| Elicitation/ElicitationResult hooks | 2.1.76 | Intercept and override MCP elicitation requests/responses | No elicitation interception |
| `-n`/`--name` CLI flag | 2.1.76 | Set display name for session at startup | No session naming at launch |
| `worktree.sparsePaths` setting | 2.1.76 | Selective sparse-checkout for large monorepos | Full checkout in worktrees |
| PostCompact hook | 2.1.76 | Fires after compaction completes for context recovery | Only PreCompact (before) exists |
| `/effort` slash command | 2.1.76 | Set model effort level mid-session | No effort control |
| `feedbackSurveyRate` setting | 2.1.76 | Enterprise session quality survey sample rate | No quality feedback loop |
| Deferred tools compaction fix | 2.1.76 | ToolSearch schemas retained after compaction | Array/number params rejected post-compaction |
| Background agent partial results | 2.1.76 | Killed agents preserve partial results in context | Killed agents lose all output |
| Compaction circuit breaker | 2.1.76 | Auto-compaction stops after 3 consecutive failures | Compaction retries indefinitely |
| Stale worktree cleanup | 2.1.76 | Worktrees from interrupted parallel runs auto-cleaned | Stale worktrees accumulate |
| Worktree startup performance | 2.1.76 | Direct ref reads, skip redundant fetch | Slower worktree startup |
| Opus 4.6 64k default output | 2.1.77 | 64k default, 128k upper bound for Opus+Sonnet | 32k output limit |
| `allowRead` sandbox setting | 2.1.77 | Re-allow read access within denyRead regions | No granular read exceptions |
| `claude plugin validate` | 2.1.77 | Official frontmatter + hooks.json validation | Manual/custom validation only |
| SendMessage auto-resume | 2.1.77 | Stopped agents auto-resume on SendMessage | SendMessage returns error for stopped agents |
| Agent `resume` param removed | 2.1.77 | Must use SendMessage({to: id}) to continue agents | Agent(resume=...) silently ignored |
| Background bash 5GB limit | 2.1.77 | Tasks killed at 5GB output to prevent disk fill | Unbounded background output |
| `/fork` renamed to `/branch` | 2.1.77 | `/fork` still works as alias | Only `/fork` available |
| PreToolUse allow/deny fix | 2.1.77 | "allow" no longer bypasses deny rules (security fix) | allow hooks could bypass deny rules |
| Worktree race condition fix | 2.1.77 | Stale cleanup no longer deletes resumed agent worktrees | Race between cleanup and agent resume |
| --resume performance | 2.1.77 | 45% faster loading, ~100-150MB less peak memory | Slower fork-heavy session resume |
| Progress message memory fix | 2.1.77 | Progress messages cleaned up during compaction | Memory growth from accumulated progress messages |
| `StopFailure` hook event | 2.1.78 | Hooks fire on API errors (rate limit, auth failure) | No hook on API errors |
| `${CLAUDE_PLUGIN_DATA}` | 2.1.78 | Plugin persistent state survives plugin updates | State lost on plugin update |
| Agent `effort`/`maxTurns`/`disallowedTools` frontmatter | 2.1.78 | Plugin agents support effort, turn limits, tool restrictions | No agent-level frontmatter controls |
| PreToolUse allow bypass fix | 2.1.78 | "allow" hooks no longer bypass deny permission rules | allow hooks could bypass deny rules |
| `claude plugin validate` enhanced | 2.1.78 | Validates skill, agent, command frontmatter + hooks.json | Basic validation only |
| Worktree skills/hooks loading fix | 2.1.78 | --worktree flag loads skills and hooks from worktree dir | Skills/hooks loaded from original dir |
| `--console` auth flag | 2.1.79 | `claude auth login --console` for API billing auth | Only OAuth/API key auth |
| "Show turn duration" toggle | 2.1.79 | Turn duration visible in /config menu | No turn duration display |
| `/remote-control` (VSCode) | 2.1.79 | Bridge session to claude.ai/code from browser/phone | VSCode-only sessions |
| Multi-dir `PLUGIN_SEED_DIR` | 2.1.79 | Multiple seed dirs separated by platform path delimiter | Single seed directory only |
| `-p` mode Ctrl+C fix | 2.1.79 | Ctrl+C works in print mode | Ctrl+C ignored in -p mode |
| Startup memory reduction | 2.1.79 | ~18MB less memory on startup | Higher startup memory |

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
| >= 2.1.73 | Full++++ | Skill-file deadlock fix, SessionStart double-fire fix, no-op reminder fix, Opus 4.6 cloud default |
| >= 2.1.74 | Full+++++ | SessionEnd timeout fix, managed policy precedence, full model IDs, memory leak fixes, /context hints |
| >= 2.1.75 | Full++++++ | 1M context default, memory timestamps, hook source display, token estimation fix |
| >= 2.1.76 | Full+++++++ | PostCompact hook, Elicitation hooks, worktree.sparsePaths, /effort, bg agent partial results |
| >= 2.1.77 | Full++++++++ | 64k/128k output, allowRead sandbox, plugin validate, SendMessage auto-resume, PreToolUse deny fix |
| >= 2.1.78 | Full+++++++++ | StopFailure hooks, CLAUDE_PLUGIN_DATA, agent frontmatter, plugin validate, worktree skills fix |
| >= 2.1.79 | Full++++++++++ | --console auth, /remote-control, multi-dir PLUGIN_SEED_DIR, turn duration toggle |

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
| v7.14.x | 2.1.79 | --console auth, /remote-control, multi-dir PLUGIN_SEED_DIR, turn duration toggle |
| v7.14.x | 2.1.78 | StopFailure hooks, CLAUDE_PLUGIN_DATA, agent frontmatter, plugin validate, worktree skills fix |
| v7.12.x | 2.1.77 | 64k/128k output, allowRead sandbox, plugin validate, SendMessage auto-resume, PreToolUse deny fix |
| v7.8.x | 2.1.76 | PostCompact hook, Elicitation hooks, sparse paths, /effort, bg agent partial results |
| v7.7.x | 2.1.75 | 1M context default, memory timestamps, hook source display, token estimation fix |
| v7.5.x | 2.1.74 | SessionEnd timeout fix, managed policy precedence, full model IDs, memory fixes |
| v7.4.x | 2.1.73 | Deadlock fix, SessionStart fix, no-op fix, Opus 4.6 cloud default |
| v7.1.x | 2.1.69 | InstructionsLoaded, once:true loaders, outputAsk, env var HTTP hooks, worktree dedup |
| v7.0.x | 2.1.59 | Auto-memory, @imports, ConfigChange, HTTP hooks (2.1.63+), unified plugin |
| v6.0.x | 2.1.47 | Full CC 2.1.47 adoption, relaxed context limits |
| v5.x | 2.1.34 | Agent Teams support, unified dispatchers |
| v4.x | 2.1.9 | Session tracking, TypeScript hooks |
