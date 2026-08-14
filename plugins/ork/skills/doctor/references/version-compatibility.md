# CC Version Compatibility Matrix

## Overview

OrchestKit requires Claude Code >= 2.1.220. This matrix documents which CC features OrchestKit depends on and their minimum version requirements.

## Experimental skills

Skills that depend on a Claude Code Research Preview feature are marked with an
`experimental:` frontmatter block declaring the reason, expected GA window, and
exit criteria. Doctor should compute this list dynamically by scanning
`src/skills/*/SKILL.md` for frontmatter containing `experimental:` and report
any skills whose `exit-criteria` is missing or empty as a warning.

Current experimental skills (M139, snapshot — verify via dynamic scan):

_None._ `ork:agents-view` was removed in favor of the native `claude agents`
CLI (CC 2.1.139+) plus the parallel-primitives doc at
`docs/parallel-primitives.md`.

When a future skill depends on an unreleased CC feature, add it to this table
with its `exit-criteria` so doctor can warn about Research Preview surface
area. Remove the entry once the underlying CLI feature reaches GA and the
skill is no longer marked `experimental:` in its frontmatter.

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
| `/code-review`, `/batch` built-in | 2.1.63 | Bundled CC slash commands (`/simplify` renamed `/code-review` in 2.1.146) | Not available |
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
| `rate_limits` statusline field | 2.1.80 | Statusline scripts receive rate limit usage (5h/7d windows, `used_percentage`, `resets_at`) | No rate limit visibility |
| `source: 'settings'` marketplace | 2.1.80 | Declare plugin entries inline in settings.json | Marketplace JSON files only |
| CLI tool usage detection for tips | 2.1.80 | Plugin tips detect CLI tool usage, not just file patterns | File pattern matching only |
| `effort` frontmatter for skills | 2.1.80 | Skills declare effort level (low/high) to override model effort | No per-skill effort control |
| `--channels` (research preview) | 2.1.80 | MCP servers push messages into active session | Pull-only MCP communication |
| `--resume` parallel tool fix | 2.1.80 | Sessions with parallel tool calls restore all tool_use/tool_result pairs | `[Tool result missing]` on resume |
| Voice mode WebSocket fix | 2.1.80 | Fixes Cloudflare bot detection on non-browser TLS fingerprints | Voice mode connection failures |
| Fine-grained tool streaming fix | 2.1.80 | Fixes 400 errors through API proxies, Bedrock, or Vertex | Streaming failures on proxied deployments |
| `/effort` shows auto resolution | 2.1.80 | Shows what "auto" resolves to, matching status bar | Opaque auto effort |
| Simplified plugin install tips | 2.1.80 | Single `/plugin install` command instead of two-step flow | Two-step marketplace add + install |
| Startup memory reduction (250k repos) | 2.1.80 | ~80 MB saved on startup in large repositories | Higher startup memory on large repos |
| Managed settings cache fix | 2.1.80 | `enabledPlugins`, `permissions.defaultMode`, policy env vars applied at startup | Stale remote-settings.json from prior session |
| `--bare` flag for `-p` mode | 2.1.81 | Eval pipeline uses `--bare` to skip hooks/LSP/plugin sync for faster scripted grading | Full plugin/hook overhead on every `-p` call |
| `--channels` permission relay | 2.1.81 | Channel servers forward tool approval prompts to phone for long-running agents | Must be at terminal for every permission prompt |
| Plugin freshness re-clone | 2.1.81 | Ref-tracked plugins re-clone on every load for latest upstream | Stale plugins until manual reinstall |
| Background agent task output race fix | 2.1.81 | Background agent output no longer hangs between polling intervals | Task output could hang indefinitely |
| Worktree session resume | 2.1.81 | `--resume` of a worktree session switches back to that worktree | Resumed worktree sessions start in main tree |
| Plugin hooks deleted-dir fix | 2.1.81 | Hooks no longer block prompt submission if plugin directory deleted mid-session | Hook deadlock during `npm run build` |
| Invisible hook attachment fix | 2.1.81 | Hook attachments no longer inflate message count in transcript mode | Inflated session analytics from hook overhead |
| MCP tool call collapse | 2.1.81 | MCP read/search calls collapse to single "Queried {server}" line (Ctrl+O to expand) | Verbose MCP tool output |
| `showClearContextOnPlanAccept` | 2.1.81 | Plan mode hides "clear context" by default; restorable via setting | "Clear context" shown on every plan accept |
| Concurrent session re-auth fix | 2.1.81 | Multiple CC sessions no longer require repeated re-authentication | Re-auth when one session refreshes OAuth |
| Dashed-string permission fix | 2.1.81 | Bash commands with dashes in strings no longer trigger false permission prompts | False positives on dashed strings |
| `! bash` mode discoverability | 2.1.81 | Claude suggests `!` prefix for interactive commands automatically | Must know about `!` prefix |
| MCP OAuth CIMD/SEP-991 | 2.1.81 | MCP OAuth supports Client ID Metadata Document for servers without DCR | Limited MCP OAuth compatibility |
| Node.js 18 crash fix | 2.1.81 | Fixed crash on Node.js 18 | Crash on Node.js 18 |
| Windows line-by-line streaming disabled | 2.1.81 | Disabled line-by-line streaming on Windows/WSL due to rendering issues | Rendering glitches on Windows |
| Remote Control fixes (4) | 2.1.81 | Session titles, /rename sync, /exit archiving, first-prompt titles fixed | Generic titles, unreliable archiving |
| Voice mode fixes (2) | 2.1.81 | Retry failure messages and WebSocket recovery fixed | Misleading errors, dropped audio |
| `managed-settings.d/` drop-in directory | 2.1.83 | Separate teams deploy independent policy fragments, merged alphabetically | Single monolithic managed-settings.json |
| `CwdChanged` hook event | 2.1.83 | Reactive hooks on working directory change (direnv-like) | No cwd change detection |
| `FileChanged` hook event | 2.1.83 | Reactive hooks on file changes (cache invalidation, tamper detection) | No file change detection |
| `sandbox.failIfUnavailable` | 2.1.83 | Fail-fast when sandbox unavailable instead of running unsandboxed | Silently falls back to unsandboxed |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | 2.1.83 | Strip Anthropic/cloud creds from subprocess environments | Creds inherited by subprocesses |
| Agent `initialPrompt` frontmatter | 2.1.83 | Auto-submit first turn on agent spawn, zero-wasted-turn bootstrap | Agents idle on spawn until first interaction |
| Plugin `userConfig` with `sensitive:true` | 2.1.83 | Plugin config at enable time, keychain storage for sensitive values | Plain env vars for all secrets |
| `TaskOutput` deprecated | 2.1.83 | Use `Read` on background task output file instead | `TaskOutput` still functional but deprecated |
| `--bare -p` 14% faster | 2.1.83 | Faster eval pipeline startup | Slower `--bare` startup |
| Background agent compaction fix | 2.1.83 | Background agents no longer become invisible after compaction | Duplicate agents spawned post-compaction |
| Background agent stuck state fix | 2.1.83 | Background tasks no longer stuck "running" when git/API hangs | Stuck tasks require manual cleanup |
| Uninstalled plugin hooks fix | 2.1.83 | Hooks stop firing immediately after plugin uninstall | Stale hooks fire until next session |
| Transcript search (`/` in Ctrl+O) | 2.1.83 | Search through transcript with n/N stepping | No transcript search |
| Plugin disk cache startup | 2.1.83 | Commands/skills/agents load from cache without re-fetching | Slower startup from disk walks |
| Plugin MCP dedup | 2.1.83 | Plugin MCP servers duplicating org connectors are suppressed | Duplicate MCP connections |
| `TaskCreated` hook event | 2.1.84 | Task initialization tracking, metadata injection, dependency validation | No hook on task creation |
| WorktreeCreate `type: "http"` | 2.1.84 | Return worktree path via `hookSpecificOutput.worktreePath` for API-driven orchestration | Command hooks only |
| `paths:` YAML glob list (skills/rules) | 2.1.84 | Auto-load relevant files when skill activates; 15+ skills use this | Manual Read calls for context |
| `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL_SUPPORTS` | 2.1.84 | Override effort/thinking capability detection for Bedrock/Vertex/Foundry | Incorrect capability detection on 3P |
| `ANTHROPIC_DEFAULT_*_MODEL_NAME/_DESCRIPTION` | 2.1.84 | Customize /model picker labels for custom deployments | Generic model labels |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | 2.1.84 | Configurable streaming idle watchdog. **The former "default 90s, OrchestKit sets 180s" note here was stale and is corrected**: at 2.1.226 the binary clamps the parsed env value with `Math.max(<parsed value, or 0>, 300000)` (verified by `strings` on the real 2.1.226 binary), so 300s is a hard floor and any smaller value is discarded. ork ships no value — the 180000 it used to declare was both below the floor and inside the inert plugin `env` block (see the plugin-settings row at 2.1.226) | No way to raise the idle watchdog above its floor for very long agent runs |
| `allowedChannelPlugins` managed setting | 2.1.84 | Enterprise admin plugin allowlist for channel plugins | No channel plugin governance |
| `x-client-request-id` header | 2.1.84 | API request correlation ID for debugging timeouts | No request-level tracing |
| PowerShell tool (Windows opt-in) | 2.1.84 | Native PowerShell as alternative to Git Bash on Windows | Git Bash only on Windows |
| MCP tool description 2KB cap | 2.1.84 | Prevents OpenAPI-generated servers from bloating context | Unbounded MCP tool descriptions |
| MCP server deduplication | 2.1.84 | Local MCP config wins over claude.ai connectors | Duplicate MCP connections |
| Workflow subagent `json-schema` fix | 2.1.84 | Outer session + subagent both specifying schema no longer 400s | API 400 on nested json-schema |
| System-prompt caching + ToolSearch | 2.1.84 | Global caching works when ToolSearch enabled (incl. MCP users) | Cache misses with ToolSearch |
| Idle-return prompt (75+ min) | 2.1.84 | Nudges `/clear` after 75+ minutes idle, reduces stale token re-caching | No idle session detection |
| `owner/repo#123` link format | 2.1.84 | Bare `#123` no longer auto-linked; must use `owner/repo#123` | Bare `#123` was auto-linked |
| Improved startup parallelism (30ms) | 2.1.84 | `setup()` runs in parallel with slash command and agent loading | Sequential startup |
| MCP startup non-blocking | 2.1.84 | REPL renders immediately, MCP servers connect in background | REPL blocked until all MCP servers connect |
| Background bash stuck notification | 2.1.84 | Tasks stuck on interactive prompt surface notification after ~45s | Stuck tasks hang silently |
| MCP cache leak fix on reconnect | 2.1.84 | Tool/resource cache properly cleaned on server reconnect | Memory leak on MCP reconnect |
| `p90` prompt cache rate improvement | 2.1.84 | Better prompt caching across sessions | Lower cache hit rate |
| PreToolUse for AskUserQuestion | 2.1.85 | Headless AskUserQuestion responder hooks | No hook on AskUserQuestion |
| Config disk write fix | 2.1.86 | Eliminates unnecessary config writes on every skill invocation | Unnecessary disk I/O per skill |
| Write/Edit outside project root | 2.1.86 | Write/Edit fix for files outside project root | Write/Edit fails for external files |
| `PermissionDenied` hook event | 2.1.88 | Fires after auto mode classifier denials, supports `{retry: true}` | No hook on permission denials |
| `permissionMode: "auto"` | 2.1.88 | Classifier-based approval replaces interactive prompts | Interactive permission prompts |
| `file_path` always absolute | 2.1.88 | PreToolUse/PostToolUse file_path always absolute for Write/Edit/Read | Relative paths possible |
| Compound `if` matching | 2.1.88 | Hook `if` conditions match compound commands and env-var prefixes | Only simple command matching |
| `CLAUDE_CODE_NO_FLICKER=1` | 2.1.88 | Flicker-free alt-screen rendering with virtualized scrollback | Default rendering |
| `"defer"` permission decision | 2.1.89 | PreToolUse hooks return `decision:"defer"` to pause headless sessions | Only allow/deny/ask |
| `TaskCreated` hook blocking | 2.1.89 | TaskCreated hook fires with documented blocking behavior | TaskCreated (2.1.84) without blocking docs |
| `MCP_CONNECTION_NONBLOCKING=true` | 2.1.89 | Skip MCP connection wait in `-p` mode, bounded at 5s | Blocks on slowest MCP server |
| Named subagent typeahead | 2.1.89 | Named subagents appear in `@` mention typeahead | Only file names in typeahead |
| Hook output disk spill | 2.1.89 | Hook output >50K chars saved to disk with file path + preview | Full output injected into context |
| Edit after Bash view | 2.1.89 | Edit works on files viewed via `sed -n`/`cat` without Read | Must Read before Edit |
| Symlink permission check | 2.1.89 | Edit/Read allow rules check resolved symlink target | Only requested path checked |
| `/powerup` interactive lessons | 2.1.90 | Interactive feature tutorials with animated demos | No built-in learning tools |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | 2.1.90 | Keep marketplace cache when `git pull` fails (offline support) | Marketplace cache lost on git failure |
| `.husky` protected directory | 2.1.90 | `.husky` added to protected dirs in acceptEdits mode | .husky writable in acceptEdits |
| PreToolUse exit code 2 JSON fix | 2.1.90 | Hooks emitting JSON to stdout with exit code 2 now correctly block | Exit code 2 JSON silently ignored |
| Format-on-save hook fix | 2.1.90 | Edit/Write no longer fail when PostToolUse format-on-save rewrites file | "File content has changed" error |
| `--resume` prompt cache fix | 2.1.90 | `--resume` no longer causes full prompt-cache miss with deferred tools/MCP | Full cache miss on resume |
| MCP schema cache perf | 2.1.90 | Eliminated per-turn JSON.stringify of MCP tool schemas | Redundant serialization per turn |
| SSE linear transport perf | 2.1.90 | SSE transport handles large frames in linear time (was quadratic) | Quadratic SSE processing |
| Transcript write perf | 2.1.90 | Long conversations no longer slow down quadratically on transcript writes | Quadratic transcript slowdown |
| `--resume` hides `-p` sessions | 2.1.90 | Resume picker no longer shows `claude -p` or SDK sessions | `-p` sessions in resume picker |
| DNS cache auto-allow removed | 2.1.90 | `Get-DnsClientCache` and `ipconfig /displaydns` removed from auto-allow | DNS cache commands auto-allowed |
| MCP `_meta` result size override | 2.1.91 | `_meta["anthropic/maxResultSizeChars"]` annotation (up to 500K) — mcp-output-transform respects it | Large MCP results always truncated at 2000 chars |
| `disableSkillShellExecution` | 2.1.91 | Setting disables inline shell in skills/commands/plugins | Shell execution always enabled |
| Plugin `bin/` executables | 2.1.91 | Plugins ship executables under `bin/` invokable as bare Bash commands | Must use full paths to plugin scripts |
| Deep link multiline prompts | 2.1.91 | `claude-cli://open?q=` supports `%0A` encoded newlines | Multi-line deep links rejected |
| Edit tool shorter anchors | 2.1.91 | Edit uses shorter `old_string` anchors, reducing output tokens | Longer anchors, more output tokens |
| `--resume` transcript chain fix | 2.1.91 | Async transcript write failures no longer lose conversation history | History loss on async write failure |
| `permissions.defaultMode:"auto"` validation | 2.1.91 | JSON schema validates `auto` as permission mode | `auto` accepted but could cause issues |
| Plan mode remote session fix | 2.1.91 | Plan file retained after container restart in remote sessions | Plan lost after container restart |
| `forceRemoteSettingsRefresh` policy | 2.1.92 | Fail-closed startup: blocks until remote managed settings fetched, exits on failure | Stale managed settings on startup |
| Stop hook `preventContinuation` fix | 2.1.92 | prompt-type Stop hooks no longer fail when small fast model returns `ok:false`; `preventContinuation:true` restored | Stop hooks could incorrectly fail |
| Tool input JSON-string streaming fix | 2.1.92 | Array/object `tool_input` fields no longer emitted as JSON-encoded strings during streaming | PreToolUse hooks receive malformed tool_input |
| Plugin MCP stuck "connecting" fix | 2.1.92 | Plugin MCP servers no longer stuck connecting when duplicating unauthenticated claude.ai connectors | MCP servers hang on session start |
| Write tool diff perf | 2.1.92 | 60% faster diff computation for large files with tabs/&/$ characters | Slower Write tool on large files |
| Remote Control hostname prefix | 2.1.92 | Session names default to hostname prefix, overridable with `--remote-control-session-name-prefix` | Generic session names |
| Per-model `/cost` breakdown | 2.1.92 | `/cost` shows per-model and cache-hit breakdown for subscription users | Aggregate cost only |
| `/tag` command removed | 2.1.92 | Removed — no OrchestKit references | N/A |
| `/vim` command removed | 2.1.92 | Removed — toggle via `/config` → Editor mode | N/A |
| Subagent tmux pane fix | 2.1.92 | Subagent spawning no longer fails after tmux windows killed/renumbered | "Could not determine pane count" error |
| Prompt cache expiry hint | 2.1.92 | Pro users see uncached token count when returning after cache expires | No cache expiry visibility |
| **Skill frontmatter hooks fix** | **2.1.94** | **OrchestKit skill context loaders (assess, implement, verify, brainstorm, review-pr, fix-issue, doctor, explore, cover, setup, commit, quality-gates, visualize-plan, code-review-playbook) declared via `hooks:` in SKILL.md frontmatter now fire — previously silently ignored** | **Every skill context loader dead — skills run without their primed context (much worse UX)** |
| `hookSpecificOutput.sessionTitle` | 2.1.94 | unified-dispatcher sets session title from branch/effort/skill context — visible in prompt bar and remote sessions | Sessions use auto-generated names |
| `keep-coding-instructions` frontmatter | 2.1.94 | Plugin output styles preserve coding instructions when set true | Output styles may strip coding guidance |
| Plugin skill name stability | 2.1.94 | `"skills": ["./"]` uses frontmatter `name` for invocation, stable across install methods | Invocation name depends on directory basename |
| `${CLAUDE_PLUGIN_ROOT}` local-marketplace fix | 2.1.94 | Resolves to installed cache (not marketplace source) for local-marketplace plugins | File lookups point at wrong directory |
| Plugin hooks CLAUDE_PLUGIN_ROOT fix | 2.1.94 | Plugin hooks no longer fail with "No such file or directory" when env var unset | Hooks fail cold-start on some platforms |
| Default effort `high` | 2.1.94 | Default effort level is `high` for API-key/Bedrock/Vertex/Foundry/Team/Enterprise users (use `/effort low` or `/effort medium` to reduce) | Default `medium` — token budgets scaled conservatively |
| 429 rate-limit surface | 2.1.94 | Agents no longer stuck after 429 with long Retry-After — error surfaces immediately | Agents appear stuck, silent wait |
| SDK/print mode partial response fix | 2.1.94 | Preserves partial assistant response on interrupt mid-stream | Partial responses lost, breaks bare-eval/eval-runner |
| `--resume` across worktrees | 2.1.94 | Resume sessions from other worktrees of the same repo directly (was: print `cd` command) | Must cd manually to resume worktree session |
| CJK/multibyte stream-json fix | 2.1.94 | No U+FFFD corruption when chunk boundaries split UTF-8 sequences | International content corrupted in stream-json |
| Amazon Bedrock via Mantle | 2.1.94 | Opt in with `CLAUDE_CODE_USE_MANTLE=1` | Standard Bedrock only |
| Bedrock bearer token 403 fix | 2.1.96 | Fixed 403 "Authorization header is missing" regression when using `AWS_BEARER_TOKEN_BEDROCK` or `CLAUDE_CODE_SKIP_BEDROCK_AUTH` (regression in 2.1.94) | Bedrock bearer-token auth broken on 2.1.94 |
| MCP tool description 2KB cap | 2.1.95 | Tool descriptions and server instructions capped at 2KB — prevents OpenAPI-generated MCP servers from bloating context | Verbose MCP descriptions consume unbounded context |
| MCP local config dedup | 2.1.95 | MCP servers configured both locally and via claude.ai connectors are deduplicated, local config wins | Duplicate MCP tools from both sources |
| Focus view toggle (`/focus`) | 2.1.97 (2.1.110: moved from `Ctrl+O` to `/focus` command) | Condensed view in NO_FLICKER mode: prompt, one-line tool summary with edit diffstats, final response | No condensed view option |
| `refreshInterval` status line | 2.1.97 | New setting re-runs the status line command every N seconds automatically | Status line only updates per turn |
| `workspace.git_worktree` | 2.1.97 | Boolean in status line JSON input, set when cwd is inside a linked git worktree | Must shell out to detect worktree |
| `● N running` in `/agents` | 2.1.97 | Live subagent instance count next to each agent type | No live agent count |
| Stop/SubagentStop long-session fix | 2.1.97 | prompt-type Stop/SubagentStop hooks no longer fail on long sessions; hook evaluator shows actual error | Hooks fail silently on long sessions |
| Subagent worktree/cwd leak fix | 2.1.97 | Subagents with worktree isolation or `cwd:` override no longer leak working directory back to parent Bash tool | Parent inherits child's cwd |
| `claude plugin update` fix | 2.1.97 | No longer reports "already at latest" for git-based marketplace plugins when remote has newer commits | Users stuck on stale plugin versions |
| YAML boolean skill name fix | 2.1.97 | Slash command picker no longer breaks when plugin frontmatter `name` is a YAML boolean keyword | Skills named true/false/yes/no break picker |
| Bash permissions hardened | 2.1.97 | Tighter env-var prefix checks and network redirect validation, fewer false prompts on common commands | Looser Bash permission checks |
| Accept Edits env-prefix auto-approve | 2.1.97 | Auto-approves filesystem commands prefixed with safe env vars or process wrappers (e.g. `LANG=C rm foo`) | Env-prefixed commands always prompt |
| `sandbox.network.allowMachLookup` macOS | 2.1.97 | Now actually takes effect on macOS | Setting ignored on macOS |
| MCP HTTP/SSE memory leak fix | 2.1.97 | Connections no longer accumulate ~50 MB/hr of unreleased buffers on reconnect | Memory leak on MCP reconnect |
| MCP OAuth metadata URL fix | 2.1.97 | `oauth.authServerMetadataUrl` honored on token refresh after restart (fixes ADFS) | Token refresh ignores custom auth URL |
| 429 retry exponential backoff | 2.1.97 | Exponential backoff applied as minimum instead of burning all attempts in ~13s | Retries exhaust quickly |
| `/resume` picker fixes | 2.1.97 | `--resume <name>` editable, Ctrl+A reload preserves search, task-status text fixed, cross-project staleness | Multiple resume UX bugs |
| Resume large file diff fix | 2.1.97 | File-edit diffs no longer disappear on `--resume` for files >10KB | Diffs lost for large files |
| Compaction subagent transcript dedup | 2.1.97 | No longer writes duplicate multi-MB subagent transcripts on prompt-too-long retries | Transcript bloat on long sessions |
| Prototype property settings.json fix | 2.1.97 | Permission rules with names matching JS prototype properties (toString, constructor) no longer cause settings.json to be silently ignored | Named rules can break entire config |
| Image compression parity | 2.1.97 | Pasted/attached images compressed to same token budget as Read tool images | Pasted images use more tokens than Read |
| Bash OTEL TRACEPARENT | 2.1.97 | Subprocesses inherit W3C `TRACEPARENT` env var when OTEL tracing is enabled | No trace propagation to subprocesses |
| Managed-settings removal fix | 2.1.97 | Allow rules removed by admin take effect without process restart | Stale rules until restart |
| `additionalDirectories` mid-session | 2.1.97 | `permissions.additionalDirectories` changes in settings apply mid-session | Changes require restart |
| Bridge session git info | 2.1.97 | Bridge sessions show local git repo, branch, and working directory on claude.ai session card | No git context on bridge card |
| Transcript size optimization | 2.1.97 | Skip empty hook entries and cap stored pre-edit file copies | Larger transcripts |
| `/team-onboarding` command | 2.1.101 | Generate teammate ramp-up guide from local CC usage | No onboarding automation |
| OS CA certificate store trust | 2.1.101 | Enterprise TLS proxies work OOTB (set `CLAUDE_CODE_CERT_STORE=bundled` for only bundled CAs) | Must configure CA certs manually |
| `deny` overrides `ask` | 2.1.101 | `permissions.deny` rules override PreToolUse hook `permissionDecision:"ask"` | deny and ask conflict silently |
| Subagent dynamic MCP inheritance | 2.1.101 | Subagents inherit MCP tools from dynamically-injected servers | Subagents miss dynamic MCP tools |
| Worktree agent file access | 2.1.101 | Worktree-isolated agents can Read/Edit files inside their own worktree | Worktree agents denied file access |
| Focus mode self-contained summaries | 2.1.101 | Claude writes self-contained summaries knowing user only sees final message | Summaries reference invisible tool output |
| Settings resilience | 2.1.101 | Unrecognized hook event name no longer causes entire settings.json to be ignored | Typo in event name breaks all hooks |
| `EnterWorktree` path param | 2.1.105 | Switch into existing worktrees via `path` parameter (previously only created new) | Must create new worktree every time |
| `PreCompact` blocking | 2.1.105 | Hooks can block compaction via exit code 2 or `{"decision":"block"}` JSON | PreCompact observe-only |
| Plugin `monitors` manifest key | 2.1.105 | Background monitor support for plugins via top-level `monitors` manifest key | No declarative background monitoring |
| Skill description cap 1,536 chars | 2.1.105 | Skill descriptions up to 1,536 chars (was 250) — better discovery and selection | Descriptions truncated at 250 chars |
| `WebFetch` script stripping | 2.1.105 | Strips `<style>` and `<script>` content before returning markdown | CSS/JS waste context budget |
| Stale worktree squash cleanup | 2.1.105 | Worktrees from squash-merged PRs auto-cleaned | Orphaned worktrees accumulate |
| `ENABLE_PROMPT_CACHING_1H` | 2.1.108 | 1-hour prompt cache TTL across API key, Bedrock, Vertex, Foundry — **major cost savings for long sessions** | 5-minute cache TTL (default) |
| `/recap` session context | 2.1.108 | Auto-recap on return + manual `/recap` command for session context restoration | No context restoration after idle |
| Skill builtin discovery | 2.1.108 | Model auto-discovers `/init`, `/review`, `/security-review` via Skill tool | Must explicitly invoke built-in commands |
| Model switch warning | 2.1.108 | `/model` warns before switching mid-conversation to prevent cache invalidation | Silent model switch loses cache |
| Lazy language grammars | 2.1.108 | Grammars loaded on demand — reduced memory for file operations | All grammars loaded at startup |
| Thinking progress rotation | 2.1.109 | Extended thinking indicator with rotating progress hint | Static thinking indicator |
| `/tui` command | 2.1.110 | Switch to flicker-free fullscreen TUI rendering mid-conversation via `/tui fullscreen` | Must restart with `--tui` flag |
| `PushNotification` tool | 2.1.110 | Built-in tool for mobile push notifications when Remote Control enabled | No programmatic push notifications |
| `/focus` command | 2.1.110 | Dedicated command for focus view (previously `Ctrl+O` since 2.1.97) | Focus view via `Ctrl+O` |
| `Ctrl+O` transcript toggle | 2.1.110 | Now only toggles between normal and verbose transcript view | Also toggled focus view |
| Bash max timeout enforced | 2.1.110 | Bash tool enforces documented max timeout — values exceeding limit hard-fail | Accepted arbitrarily large values |
| Write user-edit signal | 2.1.110 | Write tool tells model when user edits proposed diff before accepting | No user-edit feedback |
| Session recap default-on | 2.1.110 | Session recap enabled even with telemetry disabled — opt out via `/config` | Required `CLAUDE_CODE_ENABLE_AWAY_SUMMARY=1` |
| `--resume` scheduled tasks | 2.1.110 | `--resume`/`--continue` resurrects unexpired scheduled tasks | Only restored session history |
| Remote Control commands | 2.1.110 | `/autocompact`, `/context`, `/exit`, `/reload-plugins` work from Remote Control | Limited remote command set |
| SDK TRACEPARENT/TRACESTATE | 2.1.110 | Auto-read in SDK/headless for OpenTelemetry distributed trace propagation | Manual trace propagation |
| `/doctor` MCP duplicate | 2.1.110 | Warns when same MCP server defined in multiple config scopes with different endpoints | Silent duplicate MCP |
| Opus 4.7 + `xhigh` effort | 2.1.111 | New effort tier between `high` and `max` for Opus 4.7 — used by `brainstorm`, `implement`, `assess`, `cover`, `verify`, `fix-issue`, `audit-full` | Silent fallback to `high` |
| `/ultrareview` skill | 2.1.111 | Built-in parallel multi-agent review; composed (gated) by `ork:review-pr` when triggers fire | Manual multi-agent review via `ork:review-pr` only |
| `/less-permission-prompts` | 2.1.111 | Built-in skill that prunes overbroad permission rules by scanning transcripts | Manual permission audit |
| Stream-json `plugin_errors` | 2.1.111 | Headless `--output-format stream-json` includes `plugin_errors` on init event | Silent plugin load failures — degraded evals |
| `OTEL_LOG_RAW_API_BODIES` | 2.1.111 | Env var for debugging raw API request/response bodies | No raw-body debug path (secret leak risk if enabled carelessly) |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | 2.1.111 | Windows PowerShell tool opt-in (progressively rolling out) | CMD tool on Windows |
| Opus 4.7 vision 2,576px | 2.1.111 | Images up to 2,576 px on long edge (~3.75 MP, 3× Opus 4.6) | Must downscale large screenshots |
| Opus 4.7 filesystem memory | 2.1.111 | Model "substantially better" at reading `.claude/chain/*.json` and `memory/*.md` across sessions | Filesystem memory less reliable |
| Auto mode on Max + Opus 4.7 | 2.1.111 | No `--enable-auto-mode` flag required | Flag required |
| Plan filename after prompt | 2.1.111 | Plan-mode files named after the prompt (was: random words) | Generic plan filenames |
| Readonly bash+glob no prompt | 2.1.111 | Read-only Bash with glob patterns no longer prompts | Permission prompt per read-only command |
| `/skills` menu token sort | 2.1.111 | Press `t` to toggle sort by token count | Alpha only |
| Native binary spawn | 2.1.113 | CLI spawns per-platform native binary via optional dep instead of bundled JS — affects hooks that inspect `process.argv0`, `__dirname`, `node_modules` paths | Hooks assume bundled-JS layout |
| `sandbox.network.deniedDomains` | 2.1.113 | Block specific domains even when broader `allowedDomains` wildcard would permit them | Wildcard allow has no exceptions |
| `/loop` Esc cancels wakeup | 2.1.113 | Pending `/loop` wakeups cancellable via Esc; transcript marker `"Claude resuming /loop wakeup"` enables analytics | Wakeup uninterruptible |
| Bash deny wrappers match | 2.1.113 | Deny rules match commands wrapped in `env`/`sudo`/`watch`/`ionice`/`setsid` | Previous wrapper bypass |
| Bash multiline comments in transcript | 2.1.113 | Multi-line Bash commands with leading `#` comments now show full command in transcript — enables `/recap` grep on intent comments | Heredocs/pipe chains opaque in transcript |
| `Bash(find:*)` tightened | 2.1.113 | Auto-approve no longer covers `-exec`/`-delete` — explicit allowlist or manual approval required | `find -delete` auto-approved |
| macOS `/private/*` dangerous | 2.1.113 | `/private/{etc,var,tmp,home}` treated as dangerous under `Bash(rm:*)` deny rules (symlink targets) | Symlink escape via `/private/etc` |
| MCP concurrent timeout fix | 2.1.113 | Hanging MCP calls error cleanly instead of blocking queue | MCP calls could silently hang siblings |
| Subagent stall error | 2.1.113 | Subagent timeouts produce clear error after 10 min instead of hanging indefinitely | Silent hang on stalled subagent |
| Remote Control `/extra-usage` | 2.1.113 | `/extra-usage` and `@`-file autocomplete work from mobile/web Remote Control clients | Desktop-only `/extra-usage` |
| Agent teams permission fix | 2.1.114 | Fixed permission dialog crash when agent-teams teammate requests tool approval | Dialog crash on teammate approval |
| Agent hooks main-thread | 2.1.116 | Agent frontmatter `hooks:` fire when agent runs as `--agent` main thread — previously subagent-only | Main-thread agent has no PreToolUse/PostToolUse blockers |
| `/reload-plugins` auto-deps | 2.1.116 | Auto-installs missing plugin dependencies from known marketplaces | Plugin silently fails to load |
| `/doctor` mid-turn | 2.1.116 | `/doctor` runs while Claude is responding (was queued) — enables mid-session diagnostics | Must wait for turn to finish |
| Sandbox `rm` dangerous-path | 2.1.116 | Sandbox auto-allow no longer bypasses dangerous-path check for `rm`/`rmdir` targeting `/`, `$HOME`, critical system dirs | Prior auto-allow escape hatch |
| `/config` search option values | 2.1.116 | Search matches option values, not just keys (e.g. `vim` finds Editor mode) | Keys-only search |
| Slash empty-state | 2.1.116 | Slash command menu shows "No commands match" when filter has zero results | Menu disappeared |
| Bash `gh` rate-limit hint | 2.1.116 | Bash surfaces a hint when `gh` hits GitHub API rate limit — helps agents back off | Blind retry on 403 |
| Usage tab immediate | 2.1.116 | Settings Usage tab renders 5-hour/weekly usage immediately, with fallback when `/usage` endpoint is rate-limited | Blank Usage tab during rate-limit |
| `/terminal-setup` scroll | 2.1.116 | Configures VS Code/Cursor/Windsurf editor scroll sensitivity for smoother fullscreen scrolling | Default terminal scroll feels stuttery in IDE terminals |
| `/resume` fast on large sessions | 2.1.116 | Up to 67% faster on 40 MB+ sessions; MCP stdio startup parallelized, `resources/templates/list` deferred to first `@`-mention | Long `/resume` wait on big sessions |
| Agent `mcpServers:` main-thread | 2.1.117 | Agent frontmatter `mcpServers:` loads for `--agent` main-thread sessions — parallels 2.1.116 agent hooks main-thread behavior | Main-thread agent missing its declared MCPs |
| `CLAUDE_CODE_FORK_SUBAGENT=1` | 2.1.117 | External builds can opt into forked subagents via env var | Full subagent spawn on external builds |
| `plugin install` auto-deps | 2.1.117 | Re-install on already-installed plugin fetches missing dependencies instead of short-circuiting | Manual dep fetch after partial install |
| Marketplace auto-deps | 2.1.117 | `claude plugin marketplace add` auto-resolves missing dependencies from configured marketplaces | Manual resolution of marketplace deps |
| Managed marketplace enforcement | 2.1.117 | `blockedMarketplaces`/`strictKnownMarketplaces` enforced on plugin install/update/refresh/autoupdate | Policy bypass on later operations |
| `/model` persists across restarts | 2.1.117 | Selections persist even when project pins a different model; startup header shows pin source | Pin lost on restart |
| `/resume` large-session summary | 2.1.117 | `/resume` offers to summarize stale large sessions before re-reading | Full re-read of stale sessions |
| OTEL `command_name`/`command_source` | 2.1.117 | `user_prompt` OTEL events distinguish user-typed slash commands from model-invoked ones | No slash-command attribution in analytics |
| OTEL `effort` attr | 2.1.117 | `cost.usage`, `token.usage`, `api_request`, `api_error` include effort attribute | No per-effort cost breakdown |
| Opus/Sonnet 4.6 default effort | 2.1.117 | **Pro/Max subscribers on Opus 4.6 + Sonnet 4.6 now default to `high` (was `medium`)** — skills assuming medium-default get wrong cost expectations | Medium-default cost assumptions off by ~2-3× |
| Advisor Tool (experimental) | 2.1.117 | New experimental tool; dialog has experimental label + learn-more link | Previous stuck-session errors on Advisor tool |
| `cleanupPeriodDays` expansion | 2.1.117 | Retention sweep now covers `~/.claude/tasks/`, `~/.claude/shell-snapshots/`, `~/.claude/backups/` | Tasks/snapshots/backups retained indefinitely |
| Native `bfs`/`ugrep` | 2.1.117 | Native builds replace Glob/Grep tools with embedded `bfs` and `ugrep` via Bash | Slower tree-traversal on native builds |
| Opus 4.7 `/context` fix | 2.1.117 | `/context` correctly computes against 1M window (was showing inflated 200K percentage) | Early autocompact on Opus 4.7 1M sessions |
| `/reload-skills` command | 2.1.152 | Re-scans skill directories without restarting; `SessionStart` hooks can return `reloadSkills: true` to expose hook-installed skills the same session | Restart required to pick up new/edited skills |
| `marketplace remove --scope` | 2.1.152 | `claude plugin marketplace remove` accepts `--scope user\|project\|local`, matching `add`/`install`/`uninstall` | `remove` had no scope selector |
| `disallowed-tools` frontmatter | 2.1.152 | Skills/slash commands can set `disallowed-tools` to remove tools while active (ork uses `allowed-tools` allowlists instead) | Tool restriction only via allowlist |
| `--fallback-model` session switch | 2.1.152 | When the primary model is not found, CC switches to the configured `--fallback-model` for the rest of the session instead of failing every request | Every request errored on a missing primary model |
| auto mode no consent | 2.1.152 | `permissionMode: "auto"` no longer requires opt-in consent before the classifier approves tools | Auto mode gated behind a one-time consent prompt |
| sandbox warning in condensed layout | 2.1.152 | The sandbox-enabled warning now shows in every startup layout — previously missing in condensed mode | Sandbox warning hidden in condensed startup |
| `MessageDisplay` hook event | 2.1.152 | New hook event: hooks can transform or hide assistant message text as it is displayed. ork has no MessageDisplay hook (recognized in the `HookEvent` type union for future use; not in the curated hook-contract spec) | No hook-point for displayed assistant text |
| Opus 4.8 + default effort | 2.1.154 | Opus 4.8 launches; **defaults to `high` effort**, `xhigh` for the hardest tasks. Lean system prompt is now default for all models except Haiku/Sonnet/Opus ≤ 4.7 | Opus 4.7 was the newest; `xhigh` framed as 4.7-only |
| Dynamic workflows / `/workflows` | 2.1.154 | Ask Claude to create a workflow; it orchestrates tens-to-hundreds of agents in the background. `/workflows` lists runs. ork treats it as complementary to its foreground Agent Teams patterns (see `agent-orchestration`, `swarm-migrate`) | No native large-scale background orchestration |
| `/simplify` cleanup-only | 2.1.154 | `/simplify` now runs a cleanup-only review (reuse, simplification, efficiency, altitude) and applies fixes — it **no longer** invokes the full `/code-review --fix` bug-hunt | ork's code-review-playbook briefly documented the old behavior (fixed) |
| subagent worktree-isolation guard | 2.1.154 | Subagents in background sessions no longer bypass the worktree-isolation guard / write to the shared checkout; `worktree.baseRef:"head"` resolves the current worktree's HEAD when spawning from a linked worktree. A residual shell-command leak persisted until 2.1.203 (see that row) | `Agent(isolation:"worktree")` thrashed the shared checkout; manual pre-create workaround needed |
| `/effort` label rename | 2.1.154 | `/effort` slider labels renamed "Speed"/"Intelligence" → "Faster"/"Smarter" | Old labels |
| `! <command>` bg shell | 2.1.154 | `claude agents` runs a shell command as an attach/detachable background session via `! <command>` (or `claude --bg --exec`) — documented in `ork:dev` | No backgrounded shell from the agents view |
| multiple-choice reserved | 2.1.154 | CC reserves the multiple-choice prompt for decisions it genuinely can't make itself; don't gate orchestration on resolvable `AskUserQuestion`s (`agent-orchestration`) | Asked even when context sufficed |
| `/model` default persist | 2.1.153 | `/model` saves the selection as the default for new sessions; press `s` for session-only. **BREAKING:** keybinding `modelPicker:setAsDefault` renamed to `modelPicker:thisSessionOnly` | `d` set default; old binding name silently dead |
| subagent MCP policy + strict-config fixes | 2.1.153 | Subagent frontmatter `mcpServers` now honor `--strict-mcp-config`/`--bare`/managed-MCP allow-deny; `--strict-mcp-config` no longer strips inline `mcpServers` from explicit `--agents` defs. ork agents declaring `mcpServers` inherit policy correctly — no ork change | Subagent MCP servers bypassed managed policy |
| OAuth gateway credential fix | 2.1.153 | Fixed a custom API gateway receiving the user's Anthropic OAuth credential instead of the gateway's own token (security). CC-internal; no ork surface | Gateway could receive the wrong credential |
| `/usage` per-category breakdown | 2.1.149 | `/usage` breaks cost down per skill, subagent, plugin, and per-MCP-server — complements `claude plugin details ork` for ork cost audits | Aggregate usage only |
| internal infra + thinking-block fix | 2.1.155–2.1.156 | 2.1.155 is internal infrastructure only; 2.1.156 fixes a client crash where modified thinking blocks on Opus 4.8 caused API errors. No ork surface | — |
| `.claude/skills` autoload + `plugin init` | 2.1.157 | Plugins under `.claude/skills` auto-load without a marketplace; `claude plugin init <name>` scaffolds a plugin; `EnterWorktree` switches worktree mid-session; `OTEL_LOG_TOOL_DETAILS=1` adds `tool_parameters` spans; `/config` toggles the Workflow keyword trigger. ork: no adoption yet (local-skills autoload could simplify dev installs) | Plugins required a marketplace; no mid-session worktree switch |
| auto mode on cloud providers | 2.1.158 | `CLAUDE_CODE_ENABLE_AUTO_MODE=1` enables auto mode on Bedrock/Vertex/Foundry for Opus 4.7 & 4.8. Latest published CC (2026-05-30). No ork surface | Auto mode was first-party API only |
| shell startup file write prompt | 2.1.160 | CC prompts before writing shell startup files (`.zshenv`/`.zlogin`/`.bash_login`, `~/.config/git/`); documented in `security-patterns`, `configure` | Silent writes to exec-on-load files |
| `acceptEdits` build-config write prompt | 2.1.160 | `acceptEdits` mode prompts before writing build-tool configs that grant code execution (`.npmrc`, `bunfig.toml`, `.bazelrc`, `.pre-commit-config.yaml`, `.devcontainer/`) | Silent writes to exec-granting build configs |
| grep satisfies read-before-edit | 2.1.160 | A single-file `grep`/`egrep`/`fgrep` now satisfies the read-before-edit check; a separate Read is no longer required before Edit | Redundant Read required before each Edit |
| bg session SIGTERM before SIGKILL | 2.1.160 | Background-session teardown (`claude rm`/`stop`, idle reap) sends SIGTERM to shell subprocesses before SIGKILL so cleanup handlers run | Cleanup handlers skipped on teardown |
| workflow trigger renamed `ultracode` | 2.1.160 | Dynamic-workflow trigger keyword renamed `workflow` → `ultracode`; the bare word "workflow" no longer triggers a run. ork invokes the Workflow tool programmatically, so no skill copy depends on the keyword | Typing "workflow" silently triggered a run |
| parallel tool independent failure | 2.1.161 | A failed Bash in a parallel tool batch no longer cancels sibling calls; each returns independently. Noted in `chain-patterns`, `agent-orchestration`, `task-dependency-patterns` | One failed call aborted the whole batch |
| `claude mcp` secret redaction | 2.1.161 | `claude mcp list/get/add` no longer expands `${VAR}` refs and redacts credential headers + URL secrets; noted in `mcp-patterns`, `security-patterns` | Secrets printed to terminal |
| OTEL resource-attr metric labels | 2.1.161 | `OTEL_RESOURCE_ATTRIBUTES` attached as labels on metric datapoints for slicing by team/repo; noted in `monitoring-observability`, `telemetry-inspect` | No custom-dimension slicing of usage metrics |
| `claude agents` done/total | 2.1.161 | `claude agents` rows show `done/total` for fanned-out work; peek shows the longest-running item | No fan-out progress in the agents list |
| `/mcp` collapse unused connectors | 2.1.161 | `/mcp` collapses claude.ai connectors never signed in to behind a "Show unused connectors" row | Long connector list with dead entries |
| `OTEL_LOG_ASSISTANT_RESPONSES` | 2.1.193 | New `claude_code.assistant_response` OTEL log event carries the model's response text. **Redacted unless `OTEL_LOG_ASSISTANT_RESPONSES=1`; when unset it follows `OTEL_LOG_USER_PROMPTS`** — deployments already logging prompts START logging response content on upgrade. Set `=0` to keep prompts-only. Same secret-leak class as `OTEL_LOG_RAW_API_BODIES` (2.1.111) | No response-text log event; prompt logging never implied response logging |
| Notification agent events | 2.1.198 | `Notification` hook fires `agent_needs_input` / `agent_completed` for background agents. **Adopted:** ork's `notification/sound.ts` + `desktop.ts` map both — needs-input gets a desktop banner + Ping (actionable), completed is sound-only Glass so a fleet of finishing agents doesn't spam banners. `ORK_SOUND_AGENT_NEEDS_INPUT` / `ORK_SOUND_AGENT_COMPLETED` override the sounds | New types silently dropped by the notification hooks |
| subagents background by default | 2.1.198 | Agent-tool subagents launch in the background by default; pass `run_in_background: false` when a synchronous result is required. ork: 15/36 agents already declare `background: true`; `cover`/`expect` pass the flag explicitly (`chain-patterns` has the await/Monitor note) | Subagents ran foreground unless requested |
| worktree git escape closed | 2.1.216 | Worktree-isolated subagents can no longer redirect git into the shared checkout via `git -C`, `--git-dir`, or `GIT_DIR`/`GIT_WORK_TREE` — isolation is enforced, not advisory. ork: coordinator-level `git -C` in swarm-migrate/quality-gates scripts is unaffected (those run in the main context); worker prompts must route parent-tree git through the coordinator (`chain-patterns/references/worktree-agent-pattern.md` has the note) | Workers could silently mutate the shared tree |
| managed OTEL endpoint governs all signals | 2.1.217 | A managed `OTEL_EXPORTER_OTLP_ENDPOINT` now governs traces, metrics, and logs; lower-scope signal-specific overrides can't redirect telemetry away. ork: no managed endpoint shipped — operator note in `configure/references/cc-version-settings.md` | Per-signal overrides in lower scopes silently won |
| /code-review backgrounds | 2.1.218 | `/code-review` runs as a background subagent — review work stays out of the conversation, stacked slash commands keep it as their target. ork: review-pr's comparison notes updated; `/ork:review-pr` remains the interactive foreground audit | `/code-review` ran inline, filling the conversation |
| fork skills background by default | 2.1.218 | Skills with `context: fork` run in the background by default; opt out per skill with `background: false`. ork: all 23 `user-invocable: true` fork skills declare `background: false` (#3093) — user-typed commands stay interactive (verdict gates, AskUserQuestion wizards); the other 50 model-invoked fork skills deliberately keep the background default. **Verified empirically (#3238): user-TYPED invocations DO background.** Session transcripts on CC 2.1.218/2.1.220 show typed fork-skill commands (no `background: false`) emitting `Running in the background as @<skill>` + a `forked-skill-launch` record, while the same skill WITH `background: false` on 2.1.220 ran foreground and returned its result as the command's own stdout in the same turn. So the regression was live for every user on >= 2.1.218 until the #3093 declarations shipped | Forked skills ran inline |
| Explore inherits session model (≤ Opus) | 2.1.198 | Built-in Explore agent inherits the main session's model capped at Opus. **Cost note:** from a premium-model session (e.g. Fable 5), Explore bills at Opus — no longer haiku-floored, and there is no knob to pin it back | Explore always ran on haiku |
| extended-thinking inheritance | 2.1.198 | Subagents and context compaction inherit the session's extended-thinking config automatically; no agent-frontmatter knob needed, no ork change | Extended thinking disabled in delegated tasks |
| `--bg` + `--print` rejected up front | 2.1.198 | `claude --bg` combined with `--print`/`-p` is rejected at launch instead of silently creating an unattachable session. ork's `--bg` usages (`ci-sentinel`, `dev`) never combine the flags | Silent unattachable session |
| `/agents` wizard removed | 2.1.198 | Manage subagents by asking Claude or editing `.claude/agents/` directly. No ork surface ever referenced the wizard | Interactive `/agents` wizard |
| stacked slash-skills (≤5) | 2.1.199 | `/skill-a /skill-b do XYZ` loads all leading skills (up to 5) in order; the trailing args belong to the whole stack — `/ork:auto /ork:brainstorm <goal>` now composes officially (documented in `auto`) | Only the first slash skill loaded |
| subagent partial results on API errors | 2.1.199 | Subagents cut off by a rate limit or server error return their partial work and report the error to the parent instead of failing silently or reading as success | Silent failure or false-success results |
| hook exit-2 stderr visible | 2.1.199 | `SessionStart`/`Setup`/`SubagentStart` hooks exiting code 2 now show stderr in the transcript. ork's SessionStart banners are async exit-0 (intentionally operator-visible, unchanged); no ork hook exits 2 on these events | Exit-2 stderr silently hidden |
| `CLAUDE_CODE_RETRY_WATCHDOG` | 2.1.199 | Raises the default retry count for non-capacity transient errors to 300 and lifts the cap of 15 on `CLAUDE_CODE_MAX_RETRIES` — relevant to long headless `claude -p` harnesses (noted in `bare-eval`) | Retry cap 15, no watchdog |
| permission mode "Manual" rename | 2.1.200 | The "default" permission mode displays as "Manual"; `--permission-mode manual` and `"defaultMode": "manual"` accepted as aliases while `default` stays valid. ork settings define no `defaultMode`; skill flags use explicit modes (`acceptEdits`/`dontAsk`/`plan`) | UI label "default" only |
| AskUserQuestion no auto-continue | 2.1.200 | AUQ dialogs no longer auto-continue by default; an idle timeout is opt-in via `/config`. ork uses AUQ as blocking intent gates and never relied on auto-continue (noted in `configure`) | Dialogs auto-continued after idle |
| worktree plugin loading fix | 2.1.200 | Project-scoped plugins now load correctly from git worktrees of the same repository — unblocks worktree-based plugin dev loops. Also fixes `claude agents --plugin-dir` flag placement | Plugins missing when working from a worktree |
| Sonnet 5 harness-reminder delivery | 2.1.201 | Sonnet 5 sessions stop using the mid-conversation system role for harness reminders. CC-internal; hook `additionalContext` delivery unchanged, no ork surface | — |
| Resume speed in many-worktree repos | 2.1.202 | Resuming a session by name or opening the resume picker no longer takes minutes / high memory in repos with many git worktrees — directly relevant to ork's worktree-heavy model (agents `isolation: worktree`, `/ork:implement`, `/ork:dev` branch-named worktrees, `hq-ext:start-issue`) | Multi-minute, high-memory session resume in worktree-heavy repos |
| MCP config `url` without `type` | 2.1.202 | A remote MCP server entry in `.mcp.json` with a `url` but no `type` now errors with a suggestion to add `"type": "http"`. Doctor MCP diagnostics should echo this: a url-only entry is a **missing `type` field**, not a malformed command — tell the user to add `"type": "http"` (or `"sse"` for SSE transport) | Pre-2.1.202 the same misconfig surfaced as the cryptic `command: expected string`, misdirecting users toward `command`/`args` |
| Worktree shell-command leak closed | 2.1.203 | Worktree-isolated subagents no longer run Bash/git against the parent checkout — completes the 2.1.154 isolation guard, which left a residual shell-command leak through 2.1.202 (claims corrected in `chain-patterns/worktree-agent-pattern.md`, `implement/manual-worktree-pattern.md`) | Isolated agents' shell commands could execute in the primary tree, auto-stashing untracked files |
| startup command warnings → `/doctor` + `/status` | 2.1.203 | CC no longer prints "claude command missing or broken" warnings at startup — they surface in native `/doctor` + `/status` instead. CC-internal display change; ork's `doctor` skill validates hook `command:` entries independently, no surface change | Warnings printed at every startup |
| LSP-plugin disuse false-positive fix | 2.1.203 | LSP-only plugins are no longer flagged for disuse when their language servers deliver diagnostics or answer navigation requests. ork ships no LSP servers — unaffected either way | LSP-only plugins wrongly flagged unused |
| MCP `roots/list` additional dirs | 2.1.203 | MCP `roots/list` now includes the session's additional working directories (`--add-dir`), with `notifications/roots/list_changed` when the set changes. Client-side capability CC advertises to servers; ork's MCP servers consume no roots | Roots omitted `--add-dir` directories; no change notification |
| SessionStart hook streaming in headless | 2.1.204 | Hook events now stream during SessionStart hooks in headless sessions — remote workers are no longer idle-reaped mid-hook. ork's 4 SessionStart hooks are fast/async (`timeout: 5`) and unaffected; benefits headless `claude -p` harnesses (`bare-eval`, `ci-sentinel`) | Headless remote workers could be idle-reaped during a SessionStart hook |
| `--json-schema` strict validation | 2.1.205 | An invalid `--json-schema` now hard-errors instead of silently falling back to unstructured output; the `format` keyword is now accepted. Relevant to `bare-eval`, the only ork surface using `--json-schema` (grading/trigger/quality schemas) — a malformed schema fails loudly now (noted in `bare-eval/references/invocation-patterns.md`). ork's grading schemas use `format` only as a property name, not the JSON-Schema keyword, so the keyword change is a no-op | Invalid schema silently produced unstructured output; `format` keyword rejected |
| native `/doctor` full checkup + `/checkup` alias | 2.1.205 | CC's native `/doctor` is now a full setup checkup that can diagnose and fix issues, aliased as `/checkup`. Distinct from ork's `/ork:doctor` skill — no ork skill behavior change; ork's doctor validates manifest/hook/skill integrity independently | Native `/doctor` was a narrower diagnostic |
| native `/doctor` CLAUDE.md-trim check | 2.1.206 | Native `/doctor` now proposes trimming checked-in `CLAUDE.md` files by cutting content Claude could derive from the codebase. Complementary to ork's own `CLAUDE.md ≤ 4800B` byte-budget PostToolUse hook (`hooks/src/posttool/write/claude-md-byte-budget.ts`) + `tests/perf/test-token-overhead.sh` — both push the same direction; no ork change | No native CLAUDE.md-size guidance |
| `EnterWorktree` external-path confirmation | 2.1.206 | `EnterWorktree` now asks for confirmation before entering a git worktree OUTSIDE the project's `.claude/worktrees/` directory. **ork's entire worktree convention is `../<repo>-<task>`** — always outside `.claude/worktrees/` — so every documented `EnterWorktree`/worktree-add path now triggers a confirmation prompt (`implement/manual-worktree-pattern.md`, `implement/references/worktree-workflow.md`, `chain-patterns/worktree-agent-pattern.md`). Interactive flows just confirm; headless/agent flows should expect the prompt or place worktrees under `.claude/worktrees/` | External-path worktrees were entered without confirmation |
| MCP per-server `request_timeout_ms` honored | 2.1.206 | A per-server `request_timeout_ms` in `.mcp.json` / `--mcp-config` is now respected instead of defaulting to 60s — long-running MCP tool calls no longer time out at 60s in fresh sessions. ork sets no per-server timeout today, but it is now available for slow MCP servers | Per-server `request_timeout_ms` ignored; hardcoded 60s default |
| `/commit-push-pr` pushDefault auto-allow | 2.1.206 | CC's built-in `/commit-push-pr` now auto-allows `git push` to `remote.pushDefault` (or the sole configured remote) in addition to `origin`. ork's `commit`/`create-pr` skills push explicitly to `origin`, so no ork permission surface changes | Only pushes to `origin` were auto-allowed |
| worktree subagent git isolation | 2.1.210 | Worktree-isolated subagents' git operations are further confined to their own worktree — continues the 2.1.154/2.1.203 isolation lineage. ork's 15+ `isolation: worktree` agents benefit; none relied on mutating the main checkout (merge-back stays explicit per ork's worktree rules) | Residual git-op leakage from isolated subagents |
| auto mode floors hook `ask` at a prompt | 2.1.211 | Auto mode no longer overrides a PreToolUse hook returning `permissionDecision: "ask"` — ork's `network-egress-guard` and `dangerous-command-blocker` Bash guards now reliably surface their prompt under auto mode. CC-side fix; no ork change | Auto mode could auto-approve past a hook's `ask`, silently bypassing ork's egress/danger guards |
| "always allow" persisted at repo root | 2.1.211 | Interactively-granted "always allow" permission decisions are stored at the repo root, so they persist across sessions and git worktrees — relevant to ork's worktree-heavy model (`isolation: worktree`, `/ork:implement`, `/ork:dev`). Distinct from ork's declared static allow/deny settings, which were never affected | Worktree sessions re-prompted for approvals already granted in the main checkout |
| `--forward-subagent-text` stream-json flag | 2.1.211 | New headless flag (`CLAUDE_CODE_FORWARD_SUBAGENT_TEXT` env) forwards subagent text into the parent `stream-json` output. Available to `bare-eval`/`ci-sentinel` harnesses; not consumed by ork today | Subagent text absent from headless stream-json |
| hook `continue:false` halt no longer dropped | 2.1.212 | A blocking hook's halt is honored even when the tool call fails or completes mid-stream, and hook-infra errors are no longer misreported as user rejections. ork's blocking hooks (SessionEnd/SubagentStop dispatchers) now block reliably; no ork change. `skill/merge-readiness-checker.ts` was cited here until #3461 removed it as a never-invoked hook | `continue:false` could be silently dropped mid-stream |
| plan mode Bash write bypass closed | 2.1.212 | Plan mode no longer auto-runs file-modifying Bash commands without a prompt — makes the "read-only plan mode" premise in `implement`/`brainstorm` accurate at the CC level | File-modifying Bash could slip through plan mode unprompted |
| worktree symlink escape fix | 2.1.212 | Worktree isolation can no longer be escaped via a symlinked `.claude/worktrees` path. ork commits no such symlink — hardening upside in the 2.1.154/2.1.203/2.1.210 lineage | Symlinked worktree dir could redirect isolated writes |
| `/fork` = background-session copy; `/subtask` | 2.1.212 | `/fork` now copies the conversation into a new background session (own row in `claude agents`); the in-session subagent it used to launch is renamed `/subtask`. ork's "fork pattern" (`chain-patterns/references/fork-pattern.md`) is `Agent()`-based auto-forking and is unaffected. Supersedes the 2.1.77-era `/fork`→`/branch` aliasing | `/fork` launched an in-session subagent |
| MCP calls >2 min auto-background | 2.1.212 | Long-running MCP tool calls automatically move to background after 2 minutes (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` to tune/disable). Complements the 2.1.206 per-server `request_timeout_ms` row; ork sets neither today | Long MCP calls blocked the turn until timeout |
| `ExitWorktree` after `--continue`/`--resume` | 2.1.212 | `ExitWorktree` no longer fails with "no active EnterWorktree" in resumed print/SDK sessions — relevant to ork's 38 ExitWorktree-carrying agents in headless harnesses (`bare-eval`, `ci-sentinel`) | Resumed headless sessions couldn't exit their worktree |
| permission-analyzer tightenings | 2.1.214 | Batch of fail-closed fixes: single-segment `dir/**` allow rules scope to `<cwd>/dir` only, fd-redirect forms fail closed, commands >10k chars always prompt, zsh subscripts in `[[ ]]` prompt, `--help`/`man` auto-approve narrowed. **All no-op for ork** — its Bash rules are deny-only and it ships no path-glob allow or `if:` rules (verified in the 2026-07-18 triage) | Analyzer edge cases could auto-approve past intent |
| SessionStart `source: "fork"` | 2.1.214 | Forked sessions report SessionStart `source: "fork"` instead of `"resume"`. **Adopted**: ork's `sync-session-dispatcher` light-mode gate now includes `fork` alongside `compact`/`resume`, so forks skip redundant rules re-materialization (forks share the original session's project dir) | Forks arrived as `"resume"` and were implicitly light-mode |
| builtin-named plugin skills invocable headless | 2.1.221 | Plugin- and org-delivered skills named after terminal-only built-ins (`/help`, `/feedback`) are invocable again in non-interactive sessions. **Real ork surface:** `src/skills/help/SKILL.md` declares `name: help` with `user-invocable: true`, so `/ork:help` was un-invocable from headless `claude -p`/SDK runs until this fix | `/ork:help` silently unavailable in `-p`/SDK sessions |
| zsh `[[ ]]` Bash permission bypass closed | 2.1.221 | A Bash permission-check bypass where zsh executed hidden commands inside `[[ ]]` regex conditionals is closed; affected commands now prompt. Hardens the same path the 2.1.214 analyzer batch started on, ahead of ork's deny-only Bash guards (`dangerous-command-blocker`, `network-egress-guard`) | Hidden commands inside `[[ ]]` conditionals ran without a permission check |
| `--mcp-config` connects before first turn in `-p` | 2.1.221 | MCP servers from `--mcp-config` are connected before the first turn in print mode; previously the model emitted tool calls as literal text. Relevant to ork's headless harnesses (`bare-eval`, `ci-sentinel`) whenever they pass `--mcp-config` | First-turn MCP tool calls rendered as text, silently degrading the run |
| `claude plugin validate` name warnings | 2.1.221 | `claude plugin validate` warns when a marketplace or plugin name would be rejected by Claude Desktop's managed marketplace sync. ork publishes the single `ork` plugin — run validate before a release to confirm the name still passes Desktop sync | Desktop managed-marketplace sync could reject the plugin with no local warning |
| plugin `skills: "."` root path | 2.1.221 | Plugins may declare `"."` as a `skills` path, and the root-level `SKILL.md` validation error now suggests using the plugin root. ork's manifest uses `"skills": "all"` (`manifests/ork.json`) and is unaffected — noted for single-skill plugin authors | `"."` rejected as a skills path |
| `/plugin` install activates immediately | 2.1.221 | Plugins installed from `/plugin` activate immediately when safe instead of always requiring `/reload-plugins`, and `/plugin install` refreshes a stale marketplace catalog and retries before reporting a plugin not found. Shortens the ork install loop documented in `setup` | Install needed a manual `/reload-plugins`; a stale catalog produced a false "not found" |
| WebSearch at `xhigh`/`max` without thinking | 2.1.221 | WebSearch no longer fails with a 400 at effort `xhigh`/`max` when thinking is disabled. ork's effort-scaling skills (`brainstorm`'s phase scaling, `quality-gates` gating) can pair the top effort tiers with WebSearch and thinking off | WebSearch 400 at the two highest effort tiers |
| `/fork` creates its own worktree | 2.1.221 | Sessions forked with `/fork` create a new worktree of their own instead of working in the original session's checkout — continues the 2.1.212 `/fork`-becomes-a-background-session change. ork's fork pattern is `Agent()`-based (`chain-patterns/references/fork-pattern.md`) and unaffected | Forked sessions shared the parent's checkout |
| `/status` shows session kind | 2.1.221 | `/status` reports `interactive`, or a background job that is `attached` or `unattended` — useful when auditing ork's `--bg` surfaces (`ci-sentinel`, `dev`) | No way to tell a background session apart from an interactive one |
| worktree isolation covers every session type | 2.1.222 | Worktree-isolated sessions **and their subagents** can no longer run destructive git against the main checkout; isolation now applies to file edits and Bash in every session type. Closes the last gap in the 2.1.154 → 2.1.203 → 2.1.210 → 2.1.212 lineage, each of which sealed one escape at a time. ork's 25 `isolation: worktree` agents are now isolated by construction rather than by convention (merge-back stays explicit per ork's worktree rules) | Some session types still let isolated agents mutate the shared checkout |
| background-task auto-allow hook bypass closed | 2.1.222 | PreToolUse auto-allow hooks no longer bypass tool restrictions inside background agent tasks (summaries, compaction, renames). Same class as the 2.1.77/2.1.78 "allow bypasses deny" fixes, now covering CC's internal housekeeping tasks | An auto-allow hook could bypass tool restrictions in background housekeeping tasks |
| `disable-model-invocation` refusal improved | 2.1.222 | When Claude tries to invoke a skill marked `disable-model-invocation`, it is now told to ask you to run the skill instead of replicating its workflow. **33 ork skills** set `disable-model-invocation: true`, so this removes the "model reimplements the skill from memory" failure mode across all of them | Model silently reproduced a DMI skill's workflow instead of asking |
| subagent spinner shows its own `effort:` | 2.1.222 | A subagent's transcript spinner shows the subagent's own `effort:` setting instead of the session's. All 36 ork agents declare `effort:` in frontmatter, so the label was wrong for every delegated run before this | Effort label misreported on every subagent |
| gateway keep-alive vs stream idle timeout | 2.1.222 | The stream idle timeout no longer fires on custom `ANTHROPIC_BASE_URL` gateways while server keep-alive pings are arriving on the wire. **Correction:** this row used to say ork sets `CLAUDE_STREAM_IDLE_TIMEOUT_MS: 180000` in `src/settings/ork.settings.json`. That declaration never took effect (plugin `settings.json` is not a scope CC reads) and 180000 is below CC's 300000 floor in any case; the key has been removed. Gateway users need no override at all now that keep-alives suppress the spurious idle | Long agent runs killed on gateways despite live keep-alives |
| `SendMessage` truncates long summaries | 2.1.222 | `SendMessage` truncates an over-long summary instead of rejecting the send. 34 of ork's 36 agents declare `SendMessage`, so agent-to-agent handoffs no longer fail on a character limit | Sends failed outright when the summary exceeded the limit |
| auto mode classifies `SendMessage` | 2.1.222 | Messages sent to other agent sessions via `SendMessage` are evaluated by the permission classifier before dispatch under auto mode — closes an inter-agent instruction path that previously skipped classification | Agent-to-agent messages bypassed the auto-mode classifier |
| `/usage` MCP attribution fix | 2.1.222 | `/usage` no longer over-attributes cost to MCP servers: a server's share reflects only the requests that actually consumed its tool results, not every turn after any call to it. Improves the per-MCP breakdown ork's `analytics` skill reads (see the 2.1.149 row) | MCP cost inflated by every turn following a single call |
| Remote Control auto-start is user-scope only | 2.1.222 | Repo-local `.claude/settings.json` / `.claude/settings.local.json` can no longer TURN ON Remote Control auto-start (they can still turn it off); enable at user scope via `/config`. ork ships no Remote Control setting (verified: zero matches in `src/settings/`), and a cloned repo can no longer opt a user in | A checked-in project setting could auto-start Remote Control |
| ultraplan removed | 2.1.222 | The ultraplan feature is removed. ork's `help` skill command table already records this (`src/skills/help/SKILL.md`) — `/ultraplan` and the "Refine with Ultraplan" hand-off no longer exist | Docs could still point users at a removed command |
| Bash permission bypass closed | 2.1.223 | A crafted command could hide parts of itself from permission checks. Independent of ork's own normalizer (`src/hooks/src/lib/`), which closed a sibling class in #3288/#3289. The two are belt-and-braces on the same surface, and ork's guards stay load-bearing because they encode ork-specific deny intent CC has no view of | A command could present one form to the permission check and another to the shell |
| invisible-Unicode approval bypass closed | 2.1.223 | Commands padded with tabs or invisible Unicode can no longer hide part of the command from the approval dialog. Same class as ork's `\<NL>`-in-token finding (2026-08-06): what the operator approves is now what runs | The approval dialog could show less than the shell would execute |
| workflow `import()` sandbox escape closed | 2.1.223 | Workflow scripts can no longer use dynamic `import()` to run code outside the workflow sandbox. ork ships 3 workflow scripts (`audit-full-mapreduce.js`, `skill-fitness.js`, `heal-loop.js`). **Verified: zero `import(` across all three**, so nothing regresses. Treat dynamic `import()` as unavailable when authoring new workflow scripts | A workflow script could execute outside its sandbox |
| agent `bypassPermissions` honors org policy | 2.1.223 | An agent definition's `bypassPermissions` mode no longer ignores the org bypass-permissions disable policy. **Verified no-op for ork: zero `bypassPermissions` in `src/agents/`**. No ork agent has ever declared it | An agent definition could override an org-wide bypass ban |
| `/review` is an alias of `/code-review` | 2.1.223 | `/review` no longer exists as a separate fast single-pass review; it now routes to `/code-review`, which with no level reuses the level you typed last. This **reverses the 2.1.202 split** that `review-pr/SKILL.md` documented, so the "quick pass → `/review`, multi-agent → `/code-review`" routing advice was stale from 2.1.223 until corrected here | Docs route users to a distinction CC no longer draws |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` widened | 2.1.223 | Now holds **every** Claude model with a native 1M window to 200K via auto-compaction, not just a fixed list, and a startup warning appears when auto-compaction isn't holding the session to 200K. `audit-full/SKILL.md` already tells users to unset it; the check stays correct, the blast radius is wider | A newly-1M model could grow past 200K despite the env var |
| `CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT` | 2.1.223 | Auto-compact now keeps sessions on unrecognized model IDs inside the assumed context window; set this to `1` to restore the old unbounded behavior. ork sets neither (verified: zero matches in `src/settings/`) | Sessions on unknown model IDs grew past the assumed window |
| `crossSessionInbound` + `dialogExpiry` | 2.1.224 | Inbound cross-session message policy (`accept` / `hold` / `refuse`) and the approval-dialog deadline (default 5 min). **ork ships neither key** (verified: zero matches across `src/` and `manifests/`), so every ork session runs CC's permission-mode default: a `bypassPermissions` session **holds** every inbound peer message for approval, and a prompting session delivers them | No declared inbound policy; behavior varies with the session's permission mode |
| cross-session `SendMessage` + `ListAgents` | 2.1.224 | Sessions can message each other across your machines; `ListAgents` discovers them. **Counts corrected TWICE. Read the method, not just the number.** Measured by parsing the frontmatter `tools:` block of all **36** agent files (`README.md` excluded): **19 grant `SendMessage`, 19 grant `ListAgents`, and it is the SAME 19.** **Zero agents grant one without the other**, so the #3316 "sends with no roster to scope against" shape does not exist in ork's roster. Two earlier figures here were wrong and are retracted: "34 of 36 grant `SendMessage`, 0 grant `ListAgents`" (2026-08-08) and "23 of 37, 19, 4 send-only" (2026-08-13, shipped in #3469). Both were produced by `grep -rln SendMessage src/agents/`, which counts a **prose mention in the agent body** as a grant and counts `README.md` as an agent. The four phantom send-only agents (`code-quality-reviewer`, `component-curator`, `eval-runner`, `security-auditor`) name `SendMessage` in their instructions and grant **neither** tool. **Do not re-derive this by grep. `tests/agents/test-agent-messaging-scope.sh` (shipped 2026-08-09 for #3316) already asserts the invariant in CI** — a non-background agent carrying `SendMessage` must also carry `ListAgents` — and it reads frontmatter inside the `---` fence precisely so a prose mention cannot false-positive. It reports 36 agents checked, 36 passed. That gate, not a grep, is the answer to "can any ork agent send without a roster". Delivery is per-session-socket on one machine, via Anthropic servers across machines | A grant count measured by file-content grep inflates silently, once by prose and once by `README.md`, and contradicts a passing CI gate nobody consulted |
| `SendMessage` reports failed delivery | 2.1.224 | `SendMessage` no longer reports "Message sent" when the write to the recipient's inbox actually failed. Directly relevant to the 10 ork agents whose prose instructs a direct peer send: a failed hand-off is now visible instead of silently assumed delivered | Agents believed a hand-off landed when it never did |
| `denyRead` trailing-slash bypass closed | 2.1.224 | Sandbox filesystem deny entries written with a trailing slash (`denyRead: "~/.aws/"`) were silently bypassable on Linux and macOS. **Verified no-op for ork**, and now doubly so: the `sandbox` block this row cited in `src/settings/ork.settings.json` has been deleted (a plugin `settings.json` never delivered it — see the plugin-settings row at 2.1.226). The surviving recommendation, `doctor/references/sandbox-posture.md`, uses `["~/.ssh", "~/.aws", "~/.config/gh"]` with no trailing slash. Keep it that way when #3311 adds the credential denies to a scope CC actually reads | A trailing slash turned a deny rule into a no-op |
| sandbox violations surface in Bash results | 2.1.224 | Sandbox violation details now appear in Bash tool results, so Claude sees which file or network access was denied and why. Removes the blind-retry loop that made sandbox adoption expensive to debug (#3311, #3322) | A sandboxed denial looked like an unexplained command failure |
| sandbox credential **masking** options | 2.1.224 | `sandbox.credentials` gains `extract` + `onExtractNoMatch` for structured env values, `decode: "jwt"` with `maskClaims`, and `awsPairs`/`sigv4` for AWS SigV4 re-signing. These require `network.tlsTerminate` and are honored **only** from user, managed, or `--settings` scope, so a plugin-shipped or project-scoped value is ignored. ork documents this key in `security-patterns/SKILL.md` with `mode: deny` only | Only whole-value denial was documented; masking was unavailable |
| 200-subagent-per-session cap removed | 2.1.224 | The per-session spawn cap is gone; long-running sessions no longer refuse new agents. Concurrency and depth limits still apply. **Retires ork's standing "capped at 6-12, below the new 200 ceiling" immunity claim** (recorded in `shared/cc-support.json` on 2026-07-18). The ceiling it referenced no longer exists, and depth is now the only structural limit (#3324) | Docs assert immunity from a cap that no longer exists |
| `archive` plugin source | 2.1.224 | Plugins can install from a zip over HTTPS with optional SHA-256 pinning, without git or npm. ork's marketplace entry uses a local path source (`.claude-plugin/marketplace.json`); `archive` is an additional distribution channel with supply-chain pinning, not a defect to fix | Plugin distribution requires git or npm |
| long project paths no longer collide | 2.1.224 | Project paths over 200 chars could resolve to another project's session directory under a shared sanitized prefix. **Verified no-op for ork: the longest sanitized project dir on this machine is 93 chars**, and the worktree convention (`.worktrees/<task>` inside the repo) adds ~15 | Session list/rename/fork/delete could cross projects |
| headless cross-session messages expire | 2.1.225 | Cross-session messages no longer stay parked without a notice or expiry in headless sessions and during startup. Matters for ork's `-p` surfaces (`bare-eval`, `ci-sentinel`): a held message in a `-p` worker cannot show an approval dialog, so without expiry it parked forever | A headless worker accumulated invisible held messages |
| auto mode: safety-filter refusal isn't a block | 2.1.225 | Auto mode no longer counts a safety-filter refusal of its own permission check toward the consecutive-block limit; the action is still denied, but the model is told to move on instead of retrying. Changes the denial dynamics ork's auto-mode guards operate inside (#3331) | A refused permission check burned the consecutive-block budget |
| `SendMessage` reaches other machines by name | 2.1.225 | `SendMessage` can now **start** a conversation with a Remote Control session on another machine by name (`ListAgents` shows them as `name [ref]`), instead of only replying. **Escalates #3316**: a background ork agent that guesses a name is no longer confined to this machine, and a confirmed remote recipient is never silently swapped for a same-named local session | Cross-machine sends were reply-only, bounding the blast radius |
| plugin `settings.json` honours only 2 keys | 2.1.226 (verified-at, not introduced-at) | **A plugin's bundled `settings.json` is NOT a settings scope.** `plugins-reference.md:858` verbatim: "Default configuration applied when the plugin is enabled. Only the `agent` and `subagentStatusLine` keys are currently supported". The scope list (`settings.md:15-24`) is Managed / User / Project / Local — a plugin bundle is none of them. Everything else a plugin declares there is silently discarded: no error, no warning, no log line. ork shipped 10 top-level keys and 14 env vars in `src/settings/ork.settings.json` for months and **not one ever took effect** (measured: of the 14 env vars, every one was unset in a live session except `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, which came from the operator's shell profile, not from ork). Three independent live proofs of the discard: `plansDirectory: ".claude/plans"` never created that directory while the default `~/.claude/plans` exists; `sandbox.enabled` + `failIfUnavailable: true` never sandboxed a Bash call nor hard-failed startup; `CLAUDE_CODE_NO_FLICKER: "1"` never overrode the operator's explicit `tui: "default"`. The inert keys were deleted in this change. **The `permissions` block is deliberately retained even though it is equally inert**, because inertness and coverage are independent arguments: deleting it loses no enforcement, but it would delete the only written record that someone intended those paths denied, and "the key was inert" must not quietly become "the risk was reviewed". Its `Read(~/.ssh/**)` / `Read(~/.aws/credentials)` / `Read(~/.netrc)` denies have never been enforced by anything — not by this discarded file, and not by a hook, because **ork registers no PreToolUse hook for the `Read` tool at all** (measured: 19 `pretool/bash/*` + 1 `pretool/write-edit/*`, no `pretool/read/*` category exists). The block stays until a real hook covers it. For plugin-private config the sanctioned path is `userConfig` -> `pluginConfigs[<plugin-id>].options` (`plugins-reference.md:581`), surfaced as `${user_config.KEY}` and `CLAUDE_PLUGIN_OPTION_<KEY>`; for anything else, guide the operator to user settings or their shell profile | A plugin author believes shipped defaults are in effect when CC discarded every one of them |
| 2.1.227 changelog bullets reviewed | 2.1.227 | Closes the deliberate limit recorded in `shared/cc-support.json` on 2026-08-11, which triaged 2.1.227 from the **shipped binaries** (contract surface only) and left the changelog unreviewed. All five bullets are CC-internal with no ork surface: feature-flag tier evaluation on an expired login token, `claude-code-action` `allowed_non_write_users` on GitHub-hosted runners, `/tui` restoring a rewound conversation, slash-menu rendering, event-loop stalls | A release was recorded as triaged on one axis only |
| project memory folder no longer deleted | 2.1.228 | Session cleanup was **deleting contents inside a project's memory folder**. That is exactly where the operator memory store lives (`~/.claude/projects/<slug>/memory/`), so on CC < 2.1.228 a cleanup pass could destroy accumulated memory files. This is a **floor argument, not an adoption**: no ork change makes it safe, only running >= 2.1.228 does | Session cleanup could silently delete the memory store |
| plugin-cache cleanup spares symlinked dev checkouts | 2.1.228 | Background plugin-cache cleanup deleted a plugin's cache when its only version was a **symlinked development checkout**, ork's own dev loop, where `CLAUDE_PLUGIN_ROOT` points into the cache. Also a floor argument | A dev-checkout plugin could be garbage-collected mid-session |
| Write tool no longer requires a prior Read | 2.1.228 | Newer models may overwrite an existing file they have not read this session, matching the Edit tool's rules; older models still require the read. **Verified no-op for ork**: no hook or doc encodes a read-before-write assumption (measured: `src/hooks/src/pretool/write/` holds `architecture-change-detector.ts` + `security-pattern-validator.ts`, neither gates on a prior read) | Write hard-failed on an unread existing file for every model |
| marketplace entries merge whole | 2.1.228 | A marketplace entry redefined in a higher-precedence settings tier could inherit **another tier's custom headers**; entries now merge as whole entries. ork's `.claude-plugin/marketplace.json` declares no custom headers, so no-op, but a consumer who redefines the ork entry in user settings is now safe from header bleed | A redefined entry silently inherited foreign auth headers |
| cross-session inbox present on first run | 2.1.228 | Cross-session messaging sometimes started **without an inbox** in the first session after install or upgrade, so peer sends had nowhere to land. Relevant to #3316's delivery assumptions; no ork code change | A first-run session could drop inbound peer messages |
| `ListAgents` marks `offline` / `cloud` | 2.1.229 | Disconnected Remote Control sessions are marked `offline` and your cloud sessions labeled `cloud`. **This is the liveness primitive #3316 was missing**: a sender can now scope to live peers instead of messaging a dead name. **ork gets this for free**, because all 19 agents that grant `SendMessage` also grant `ListAgents` (see the corrected 2.1.224 row above). The "4-agent gap" first claimed here was a measurement artifact and is retracted; no ork agent can send without also being able to check liveness | A roster entry gave no signal whether the peer was alive |
| sandbox domain lists fail closed | 2.1.229 | IPv6 literals in `sandbox.network` domain lists are now bracketed (`[::1]:443`), and **ambiguous spellings are enforced fail-closed and flagged by `/doctor`**. ork's recommended starter config in `doctor/references/sandbox-posture.md` is unaffected (4 plain hostnames, no IPv6 literal, no port), but the file's "no detection API" honest-limit was partly stale, because `/doctor` now reports at least the ambiguous-spelling class. Strengthens #3322 | An ambiguous domain spelling could fail open, unflagged |
| `CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS` | 2.1.229 | Workflow fan-outs stagger same-prefix sibling agents so later siblings read the **cached prompt prefix** instead of re-paying it; set to `0` to disable. A direct token win for ork's fan-out skills (`audit-full-mapreduce`, `skill-fitness`), documented in `chain-patterns/references/dynamic-workflow-patterns.md`, which carried no concurrency or cost content before this | Every sibling in a fan-out re-paid the shared prefix |
| workflows honour container CPU limits | 2.1.229 | Dynamic workflows inside CPU-limited containers used the **host machine's** core count instead of the container's limit, over-parallelizing ork workflows in CI runners and Docker | Workflow concurrency ignored the cgroup CPU limit |
| marketplace `command` sources | 2.1.229 | A local command (for example an IDE) prints the plugin directory; it is **re-resolved each session and applied without a restart**, and `mode: "link"` uses it in place. ork ships two `git-subdir` entries today; a `command` source would give contributors a local-build channel with no reinstall. **Opportunity, not a defect** | Local plugin development required a reinstall per build |
| `/commit-push-pr` stops auto-approving dangerous flags | 2.1.229 | git/gh commands carrying `--force`, `--amend`, `--no-verify` and similar are no longer auto-approved by that command. **Converges with ork's guards but does not replace them**: ork's guards key off the Bash command string across every command, not one slash command, so nothing is subtracted here | A dangerous flag rode along on an auto-approved commit flow |

## Prompt Caching Recommendation

For API-key, Bedrock, Vertex, or Foundry users running long OrchestKit sessions (brainstorm, implement, cover chains), enable 1-hour prompt caching:

```bash
export ENABLE_PROMPT_CACHING_1H=1
```

This extends the prompt cache TTL from 5 minutes to 1 hour, significantly reducing token costs when:
- Returning to a session after brief breaks
- Running multi-phase skills that exceed the 5-minute cache window
- Using `/loop` or scheduled tasks with intervals > 5 minutes

**Note:** Since CC 2.1.110, session recap is enabled by default even with telemetry disabled. Opt out via `/config` or `CLAUDE_CODE_ENABLE_AWAY_SUMMARY=0`. On CC 2.1.108-2.1.109, users with `DISABLE_TELEMETRY=1` must set `CLAUDE_CODE_ENABLE_AWAY_SUMMARY=1` manually.

Doctor should check for this env var and recommend it when:
- User is on API key / Bedrock / Vertex / Foundry (not subscription)
- Session has been active for > 30 minutes
- `ENABLE_PROMPT_CACHING_1H` is not set

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
| >= 2.1.69 | Full | InstructionsLoaded, once:true, outputAsk, path-scoped rules |
| >= 2.1.72 | Full | ExitWorktree, agent model override, effort simplification, prompt cache 12x |
| >= 2.1.76 | Full | MCP elicitation, PostCompact hook, /effort command |
| >= 2.1.78 | Full | StopFailure event, CLAUDE_PLUGIN_DATA, agent effort/maxTurns frontmatter |
| >= 2.1.80 | Full | rate_limits in StatusLine, skill effort frontmatter, --channels preview |
| >= 2.1.83 | Full | CwdChanged/FileChanged events, managed-settings.d/, sandbox.failIfUnavailable |
| >= 2.1.84 | Full | TaskCreated event, paths: glob, CLAUDE_STREAM_IDLE_TIMEOUT_MS, MCP non-blocking startup |
| >= 2.1.85 | Full | PreToolUse for AskUserQuestion, headless responder hooks |
| >= 2.1.86 | Full | Config disk write fix, Write/Edit outside project root |
| >= 2.1.75 | Full++++++ | 1M context default, memory timestamps, hook source display, token estimation fix |
| >= 2.1.76 | Full+++++++ | PostCompact hook, Elicitation hooks, worktree.sparsePaths, /effort, bg agent partial results |
| >= 2.1.77 | Full++++++++ | 64k/128k output, allowRead sandbox, plugin validate, SendMessage auto-resume, PreToolUse deny fix |
| >= 2.1.78 | Full+++++++++ | StopFailure hooks, CLAUDE_PLUGIN_DATA, agent frontmatter, plugin validate, worktree skills fix |
| >= 2.1.79 | Full++++++++++ | --console auth, /remote-control, multi-dir PLUGIN_SEED_DIR, turn duration toggle |
| >= 2.1.80 | Full+++++++++++ | rate_limits statusline, effort frontmatter, --channels, source:settings marketplace, --resume parallel fix |
| >= 2.1.81 | Full++++++++++++ | --bare eval mode, --channels permission relay, plugin re-clone freshness, worktree resume, bg agent race fix |
| >= 2.1.83 | Full+++++++++++++ | managed-settings.d/, CwdChanged/FileChanged hooks, sandbox.failIfUnavailable, initialPrompt, userConfig, env scrub |
| >= 2.1.84 | Full++++++++++++++ | TaskCreated hook, WorktreeCreate HTTP, paths: globs, ANTHROPIC_DEFAULT_*, stream timeout, MCP 2KB cap, json-schema fix |
| >= 2.1.88 | Full+++++++++++++++ | PermissionDenied hook, auto permission mode, absolute file_path, compound if matching, NO_FLICKER |
| >= 2.1.89 | Full++++++++++++++++ | defer permission, TaskCreated blocking, MCP_CONNECTION_NONBLOCKING, named subagent typeahead, hook disk spill |
| >= 2.1.90 | Full+++++++++++++++++ | /powerup, PLUGIN_KEEP_MARKETPLACE, .husky protected, exit code 2 fix, format-on-save fix, 3x perf |
| >= 2.1.91 | Full | MCP result size override, disableSkillShellExecution, plugin bin/, Edit shorter anchors, transcript fix |
| >= 2.1.92 | Full | forceRemoteSettingsRefresh, Stop hook preventContinuation fix, tool input JSON-string fix, Write perf, tmux pane fix |
| >= 2.1.94 | Full | Skill frontmatter hooks fix (unlocks 20 context loaders), sessionTitle hook output, keep-coding-instructions, default effort high, rate-limit 429 surface, --resume across worktrees, CJK stream-json fix |
| >= 2.1.95 | Full | MCP tool description 2KB cap, local MCP config dedup (npm-only release) |
| >= 2.1.96 | Full | Bedrock bearer token 403 hotfix (2.1.94 regression) |
| >= 2.1.97 | Full | refreshInterval status line, workspace.git_worktree, Stop/SubagentStop long-session fix, subagent cwd leak fix, plugin update fix, Bash permissions hardened, TRACEPARENT OTEL, image compression parity, 429 exponential backoff, MCP memory leak fix, transcript optimization |
| >= 2.1.101 | Full | /team-onboarding, OS CA cert trust, deny-overrides-ask, subagent dynamic MCP, worktree agent file access, focus mode summaries, settings resilience |
| >= 2.1.105 | Full | EnterWorktree path param, PreCompact blocking (exit code 2 / decision:block), plugin monitors manifest, skill description cap 1536 chars, WebFetch script stripping, stale worktree squash cleanup |
| >= 2.1.108 | Full | ENABLE_PROMPT_CACHING_1H for 1-hour cache TTL (major cost savings), /recap session context restoration, Skill tool auto-discovery of built-in commands, model switch warning, lazy language grammars (lower memory), rate limit distinction, agent auto-classifier fix |
| >= 2.1.110 | Full | /tui fullscreen rendering, PushNotification tool for long sessions, /focus command (replaces Ctrl+O), Bash max timeout enforced, Write user-edit signal, session recap default-on (no env var needed), --resume resurrects scheduled tasks, /doctor MCP duplicate warning, Remote Control commands (/autocompact, /context, /exit, /reload-plugins), SDK TRACEPARENT/TRACESTATE auto-propagation |
| >= 2.1.220 | **Minimum (current floor)** | **OrchestKit's supported floor. Anything below is unsupported. `shared/cc-support.json` is the single source of truth; this row mirrors it.** |

## Doctor Check Implementation

The doctor skill validates CC version in category 10:

```
Claude Code: 2.1.220 (OK)
- Minimum required: 2.1.220
```

When CC version is below the floor, doctor should show the shortfall. Example on a
much older build, where the missing-feature list is long enough to be useful:

```
Claude Code: 2.1.44 (DEGRADED)
- Minimum required: 2.1.220
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

## OrchestKit Version History

| OrchestKit | Min CC | Key Changes |
|-----------|--------|-------------|
| v9.6.x | 2.1.220 | **CC 2.1.221 + 2.1.222 adoption: `latest_known` 2.1.220 → 2.1.222, `supported_floor` STAYS 2.1.220 (latest_known-only bump — the 2026-07-25 `manual_override` pins floor=latest=2.1.220 until 2026-09-20), 19 new matrix entries. Highest-signal rows: 2.1.222 extends worktree isolation to file edits and Bash in EVERY session type including subagents, closing the last gap in the 2.1.154 → 2.1.203 → 2.1.210 → 2.1.212 lineage for ork's 25 `isolation: worktree` agents; 2.1.222 stops PreToolUse auto-allow hooks bypassing tool restrictions in background agent tasks; 2.1.222 tells Claude to ask the user to run a `disable-model-invocation` skill instead of replicating it (33 ork skills); 2.1.221 makes plugin skills named after terminal-only built-ins invocable in non-interactive sessions, which un-breaks `/ork:help` headless. Also documented: gateway keep-alive vs `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `SendMessage` summary truncation, auto-mode classification of `SendMessage`, `/usage` MCP attribution fix, Remote Control auto-start becoming user-scope only, `--mcp-config` connecting before the first `-p` turn, the zsh `[[ ]]` Bash permission bypass fix, and ultraplan removal** |
| v7.83.x | 2.1.125 | **M131 — CC 2.1.128 adoption (1 PR): floor 2.1.122 → 2.1.125, latest 2.1.126 → 2.1.128, 7 new matrix entries (`enter_worktree_branch_from_head`, `workspace_reserved_mcp_name`, `plugin_dir_zip_archives`, `channels_console_auth`, `init_plugin_errors_plugin_dir`, `subagent_idle_summary_capped`, `plugin_update_npm_detection_fix`); release-engineer agent documents `.zip` plugin distribution path; setup skill documents `channelsEnabled: true` for `--channels` + console auth; eval-runner agent picks up expanded `init.plugin_errors` covering `--plugin-dir` failures (was marketplace-only since 2.1.111); EnterWorktree branch-from-HEAD audit confirmed no stale "commit before worktree" guidance across 38 skill/agent mentions; M128 backfill of 2.1.122/2.1.126 matrix entries deferred (features adopted in skills/docs without runtime gates)** |
| v7.80.x | 2.1.122 | **M128 — CC 2.1.122 + 2.1.126 adoption (5 issues, 1 PR): floor 2.1.118 → 2.1.122, OTEL `invocation_trigger` attribute on `claude_code.skill_activated` (CC 2.1.126) surfaced in `/ork:analytics` skill-trigger breakdown, `claude project purge --dry-run` wired into `/ork:doctor` stale-project diagnostic + `/ork:dream` summary hint, `--dangerously-skip-permissions` scope expansion (`.git/`, `.vscode/`, shell rcs) documented in security-patterns/setup/hooks-README, OTEL numeric-attr type-safe ingestion verified for CC 2.1.122+, `claude_code.at_mention` event ingestion decision recorded** |
| v7.70.x | 2.1.118 | **M122 — CC 2.1.118 + 2.1.119 adoption (8 issues, 1 PR): floor 2.1.117 → 2.1.118, 17 new matrix entries, PostToolUse `duration_ms` threaded through posttool hooks, OTEL `tool_use_id` + `tool_input_size_bytes` documented, `--from-pr` multi-host (GitLab/Bitbucket/GHE) in review-pr/create-pr/fix-issue, `--print` honors agent `tools:`/`disallowedTools:` in bare-eval, pilot adoption of `type: "mcp_tool"` hook type, `claude plugin tag` wired into release-please workflow, three new chain-patterns refs (mcp-tool-hooks.md, pr-from-platform.md, plugin-tag.md)** |
| v7.69.x | 2.1.117 | **M117 closeout (2 issues, 1 PR): `/ork:doctor` warns on HIGH-tier MCP `@latest` pinning (closes #1462), fast-check property tests for 9 hook handlers + input validator (closes #1452), defensive-input hardening tracked separately as #1497 in M119** |
| v7.50.x | 2.1.111 | **CC 2.1.111 + Opus 4.7 adoption (23 issues, 1 PR): MIN_CC_VERSION 2.1.108 → 2.1.111, 17 new matrix entries (311 total), `xhigh` effort tier across 7 phase-based skills, token budgets converted to %-of-context via new `lib/context-window.ts`, `ork:review-pr` composes `/ultrareview` gated by sensitive-path/diff-size triggers via `AskUserQuestion`, eval preflight catches `plugin_errors` on stream-json init, 2,576px vision ceiling in design/UI skills, doctor Category 14 detects xhigh-without-Opus-4.7, retry-policy audit with rationale comments** |
| v7.44.x | 2.1.108 | **CC 2.1.108 adoption: 25 new matrix entries (278 total), ENABLE_PROMPT_CACHING_1H env var, /recap session context, Skill tool auto-discovery, model switch warning, lazy language grammars, EnterWorktree path param, PreCompact blocking, plugin monitors manifest key, skill description cap 1536 chars, expanded 11 user-invocable skill descriptions** |
| v7.38.x | 2.1.101 | **CC 2.1.101 adoption + frontmatter audit: 26 skill frontmatter fixes (context/agent fields now enforced), deny-overrides-ask behavior, subagent dynamic MCP inheritance, worktree agent file access, /team-onboarding command, OS CA cert trust, focus mode self-contained summaries, RemoteTrigger run fix, settings resilience, 18 new matrix entries (253 total)** |
| v7.37.x | 2.1.98 | **CC 2.1.98 adoption: Monitor tool for streaming background events, SCRIPT_CAPS env var, partial progress from failed bg subagents, hook stderr in transcript, /agents tabbed layout, /reload-plugins skill discovery, Bash permission hardening (backslash escape fix, compound cmd fix), stale worktree cleanup fix, team permission inheritance, Vertex AI wizard, Perforce mode** |
| v7.33.x | 2.1.97 | **CC 2.1.97 full utilization: refreshInterval status line, workspace.git_worktree awareness, TRACEPARENT OTEL tracing to HQ, Stop/SubagentStop long-session fix, subagent cwd leak fix, MCP 2KB cap guardrail, image compression parity, Bash permissions hardened, Accept Edits env-prefix, plugin update fix, prototype settings.json fix** |
| v7.30.x | 2.1.94 | **Skill frontmatter hooks unlock (20 context loaders activated), sessionTitle on UserPromptSubmit, keep-coding-instructions, default effort high adaptation, --resume across worktrees, CJK stream-json fix, Bedrock bearer token 2.1.96 hotfix** |
| v7.29.x | 2.1.92 | forceRemoteSettingsRefresh policy, Stop hook preventContinuation fix, tool input JSON-string fix, plugin MCP dedup fix, Write perf 60%, /tag + /vim removed, MCP result size override, disableSkillShellExecution, plugin bin/, Edit shorter anchors |
| v7.27.x | 2.1.90 | /powerup, PLUGIN_KEEP_MARKETPLACE, .husky protected, exit code 2 fix, format-on-save fix, 3x perf improvements |
| v7.24.x | 2.1.84 | TaskCreated hook, WorktreeCreate HTTP, paths: glob lists, ANTHROPIC_DEFAULT_* env vars, stream idle timeout, json-schema fix |
| v7.23.x | 2.1.83 | managed-settings.d/, CwdChanged/FileChanged hooks, sandbox.failIfUnavailable, initialPrompt, userConfig sensitive, env scrub |
| v7.15.x | 2.1.80 | effort frontmatter, rate_limits statusline, --channels, source:settings, simplified plugin tips |
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
