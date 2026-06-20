# CC Version-Specific Settings

## Step 6: CC 2.1.7 Settings

Configure CC 2.1.7-specific features:

### MCP Auto-Deferral Threshold

```
MCP deferral threshold (default 10%): 10
```

Adds to config.json:
```json
{
  "cc217": {
    "mcp_defer_threshold": 0.10,
    "use_effective_window": true
  }
}
```

### Effective Context Window Mode

```
Use effective context window for calculations? [Y/n]: y
```

When enabled:
- Statusline shows `context_window.effective_percentage`
- Compression triggers use effective window
- MCP deferral more accurate

## Step 7: CC 2.1.20 Settings

Configure CC 2.1.20-specific features:

### Task Deletion Support

```
Enable task deletion (status: "deleted")? [Y/n]: y
```

Enables orphan detection and automatic cleanup of blocked tasks.

### PR Status Enrichment

```
Enable PR status enrichment at session start? [Y/n]: y
```

Detects open PRs on current branch and sets `ORCHESTKIT_PR_URL` / `ORCHESTKIT_PR_STATE` env vars.

### Background Agent Permission Pre-Mapping

```
Enable permission profile suggestions for agents? [Y/n]: y
```

Shows recommended permission profiles when spawning agents.

### Monorepo Multi-Directory Detection

```
Enable monorepo detection? [Y/n]: y
```

Detects monorepo indicators and suggests `--add-dir` usage.

> **CC 2.1.47**: When `added_dirs` are already active, the monorepo detector automatically skips the `--add-dir` suggestion. The `added_dirs` field is now available in hook inputs for multi-directory awareness.

### Team Plugin Distribution (CC 2.1.45+)

Share OrchestKit across a team using a shared directory:

```bash
# Create shared plugin directory
mkdir -p /shared/team/plugins/orchestkit

# Copy plugin files
cp -r plugins/ork/* /shared/team/plugins/orchestkit/

# Team members use --add-dir to pick up the shared plugin
claude --add-dir /shared/team/plugins
```

CC 2.1.45+ supports `plugin_hot_reload` — team members get updates without restarting their sessions.

> **`enabledPlugins` vs `added_dirs`**: `enabledPlugins` is a CC-internal concept and is NOT exposed to hooks. The hook-accessible field for multi-directory awareness is `added_dirs` (available in `HookInput` since CC 2.1.47). Hooks can read `input.added_dirs` to detect which additional directories are active — useful for adapting behavior in multi-repo workspaces.

### Monorepo Package Context (CC 2.1.49)

When `added_dirs` are active, OrchestKit's monorepo detector surfaces package names from each directory as session context. This helps agents understand which packages are in scope:

```
Multi-directory context active (3 dirs)
Packages: @myapp/api, @myapp/web, @myapp/shared
Each directory may have its own CLAUDE.md with targeted instructions.
```

Use `claude --add-dir ./packages/api --add-dir ./packages/web` to include specific packages.

## Step 8: CC 2.1.23 Settings

Configure CC 2.1.23-specific features:

### Spinner Verbs Customization

Replace default Claude Code spinner verbs ("Thinking", "Working", etc.) with custom branding:

```
Customize spinner verbs? [Y/n]: y
```

Adds to `.claude/settings.json`:
```json
{
  "spinnerVerbs": {
    "mode": "replace",
    "verbs": [
      "Orchestrating",
      "Coordinating",
      "Synthesizing",
      "Analyzing",
      "Reasoning",
      "Crafting",
      "Architecting",
      "Validating",
      "Dispatching",
      "Assembling",
      "Engineering",
      "Composing"
    ]
  }
}
```

**Options:**
- `mode: "replace"` - Use only your custom verbs
- `mode: "append"` - Add your verbs to the defaults

**OrchestKit-themed verbs** focus on orchestration, architecture, and engineering actions.

## Step 9: CC 2.1.79 Settings

Configure CC 2.1.79-specific features:

### Turn Duration Display

The `/config` menu now includes a "Show turn duration" toggle.

```
Enable turn duration in statusline? [y/N]: y
```

Adds to settings.json:
```json
{
  "statusline": {
    "showTurnDuration": true
  }
}
```

## Step 10: CC 2.1.80 Settings

Configure CC 2.1.80-specific features:

### Effort Frontmatter

Skills can now declare `effort:` in frontmatter to override the model effort level when invoked. OrchestKit sets effort on 40 skills (18 high, 22 low).

### Rate Limits Statusline

The statusline now receives `rate_limits` with 5-hour and 7-day usage windows. OrchestKit surfaces this in the status bar.

### Source: Settings Marketplace

Plugin entries can be declared inline in settings.json:

```json
{
  "plugins": {
    "sources": [
      { "type": "settings", "url": "github:yonatangross/orchestkit" }
    ]
  }
}
```

### Channels (Research Preview)

MCP servers can push messages into sessions via `--channels`. Experimental — monitor for GA.

Shows elapsed time per turn in the statusline — useful for profiling slow tool calls and understanding agent performance.

## Step 11: CC 2.1.81 Settings

### Bare Mode for Scripted Calls

The `--bare` flag skips hooks, LSP, plugin sync, and skill directory walks for scripted `-p` calls. Ideal for eval pipelines and CI grading where plugin context is unnecessary.

Requirements:
- `ANTHROPIC_API_KEY` must be set (OAuth and keychain auth disabled in bare mode)
- Use with `--settings` to provide an apiKeyHelper if not using env var

```bash
# Fast grading call — no plugin overhead
claude -p "Grade this output..." --bare --max-turns 1 --output-format text

# With custom settings
claude -p "Classify..." --bare --settings ./eval-settings.json --json-schema schema.json
```

### Channels Permission Relay

Channel servers that declare the `permission` capability can forward tool approval prompts to your phone. Useful for long-running multi-agent workflows (brainstorm, implement, verify) where you're away from terminal.

```bash
# Start session with channels enabled
claude --channels

# Channel server receives permission prompts and relays approval/denial
```

Configure channel servers in settings.json:

```json
{
  "channels": {
    "servers": [
      { "url": "https://your-channel-server.example.com" }
    ]
  }
}
```

### Plan Mode Context Clearing

Plan mode now hides the "clear context" option by default when accepting a plan. Restore with:

```json
{
  "showClearContextOnPlanAccept": true
}
```

### Plugin Freshness

Ref-tracked plugins now re-clone on every load to pick up upstream changes. For stability, pin to a specific version tag:

```json
{
  "plugins": {
    "sources": [
      { "type": "settings", "url": "github:yonatangross/orchestkit@v7.20.0" }
    ]
  }
}
```

Use `@main` for bleeding edge, `@v7.x.x` for stability.

## CC 2.1.90 Settings

### Offline Plugin Resilience

Keep marketplace cache when `git pull` fails (useful for offline or restricted network environments):

```bash
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
```

### Format-on-Save Hooks (now viable)

CC 2.1.90 fixed the "File content has changed" race condition when a PostToolUse hook reformats files between consecutive edits. This enables format-on-save patterns:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "command": "prettier --write \"$CLAUDE_FILE_PATH\"",
      "timeout": 5
    }]
  }
}
```

### /powerup Lessons

CC 2.1.90 adds `/powerup` — interactive lessons teaching features with animated demos. Reference this in onboarding or setup flows for new users.

## CC 2.1.91 Settings

### MCP Tool Result Persistence Override

MCP servers can now declare large results (up to 500K chars) that should not be truncated, using the `_meta` annotation:

```json
{
  "_meta": {
    "anthropic/maxResultSizeChars": 500000
  },
  "content": [{ "type": "text", "text": "..." }]
}
```

Use this for results like database schemas, API specs, or code analysis that lose meaning when truncated. OrchestKit's `mcp-output-transform` hook respects this annotation and skips truncation when present.

### Disable Skill Shell Execution

New `disableSkillShellExecution` setting prevents inline shell commands in skills, custom slash commands, and plugin commands from executing:

```json
{
  "disableSkillShellExecution": true
}
```

Useful for enterprise environments where skills should only provide guidance, not execute commands. OrchestKit skills with `invocation_hooks` (cover, expect, commit, devops-deployment) will have their shell preconditions skipped when this is enabled.

### Plugin Executables (bin/)

Plugins can now ship executables under a `bin/` directory. These are invokable as bare commands from the Bash tool without full path qualification. OrchestKit uses this for `run-hook.mjs` and `file-suggestion.sh`.

### Edit Tool Shorter Anchors

CC 2.1.91 uses shorter `old_string` anchors in the Edit tool, reducing output tokens. No configuration needed — this is an automatic optimization that benefits all users.

### permissions.defaultMode: "auto" Validation

`permissions.defaultMode: "auto"` is now validated by JSON schema in settings.json. Previously this value was silently accepted but could cause issues. OrchestKit's settings already use valid permission modes.

## CC 2.1.92 Settings

### forceRemoteSettingsRefresh Policy

New managed policy setting for enterprise deployments. When set, CC blocks startup until remote managed settings are freshly fetched and exits if the fetch fails (fail-closed):

```json
{
  "policy": {
    "forceRemoteSettingsRefresh": true
  }
}
```

**Use case**: Enterprise environments where stale managed settings (permission policies, plugin allowlists, sandbox rules) are a compliance risk. Without this, CC falls back to cached `remote-settings.json` from a prior session.

**Trade-off**: Startup requires network access — offline/air-gapped environments will fail to launch. Combine with `managed-settings.d/` (CC 2.1.83) for local policy fragments as fallback.

**Doctor check**: `ork:doctor` warns if `forceRemoteSettingsRefresh` is set without a configured remote settings endpoint.

### Remote Control Session Naming

Remote Control session names now default to your hostname as prefix (e.g. `myhost-graceful-unicorn`). Override with:

```bash
claude --remote-control-session-name-prefix "my-prefix"
```

### Removed Commands

- `/tag` — removed. No replacement needed.
- `/vim` — removed. Toggle vim mode via `/config` → Editor mode instead.

## CC 2.1.116 Settings

### Sandbox `rm`/`rmdir` Dangerous-Path Hardening

CC 2.1.116 closes a prior escape where sandbox auto-allow could bypass the dangerous-path safety check for `rm`/`rmdir` targeting `/`, `$HOME`, or critical system directories. No configuration change required — existing `sandbox.enabled: true` configs are now safer by default.

**What changed**: Previously, commands the sandbox classified as auto-allowable could still slip past the dangerous-path check. Now the safety check runs regardless of auto-allow classification. If OrchestKit's `security-layer-auditor` agent flagged this as a residual risk in prior reviews, the gap is closed.

**Action**: None. This is a pure hardening — no settings to add. `ork:doctor` reports CC version; if ≥ 2.1.116 the check is active.

### `/reload-plugins` Auto-Installs Missing Dependencies

`/reload-plugins` and the background plugin auto-update now auto-install missing plugin dependencies from marketplaces you've already added. Previously, a plugin whose declared dependency wasn't yet installed would fail silently on reload.

**Impact for OrchestKit**: `ork` declares no external plugin deps, so no behavior change. Users who layer additional plugins on top of `ork` get cleaner reloads — no more "plugin not found in marketplace" on first startup after install.

### Agent Frontmatter `hooks:` Fire in `--agent` Main-Thread Mode

Before 2.1.116, agent-scoped hooks (defined in `src/agents/<name>.md` frontmatter) only fired when the agent ran as a subagent via the `Task` tool. As of 2.1.116, they also fire when a user invokes the agent as their main thread via `claude --agent <name>`.

**Impact for OrchestKit**: All 14 agent hooks in OrchestKit are defensive `PreToolUse`/`PostToolUse` blockers (dangerous-command-blocker, ci-safety-check, deployment-safety-check, migration-safety-check, etc.). Main-thread firing is a **net positive** — users who pick an OrchestKit agent as their default get the same safety rails that subagent runs get.

**No action required.** The audit in PR "chore(compat): CC 2.1.116 adoption" confirmed all existing agent hooks are main-thread safe.

### Other Quality-of-Life Changes

- `/doctor` now runs while Claude is responding (was queued to end of turn). Useful mid-session for diagnosing a hang or runaway tool loop.
- `/config` search matches option values, not just keys (e.g. search `vim` finds the Editor mode setting).
- Slash command menu shows explicit "No commands match" when filter has zero results (was disappearing).
- Bash tool surfaces a GitHub API rate-limit hint when `gh` commands hit 403 — helps OrchestKit's commit/create-pr/review-pr skills back off instead of retrying.
- Settings Usage tab renders 5-hour and weekly usage immediately with a fallback when `/usage` endpoint is rate-limited.
- `/terminal-setup` configures VS Code/Cursor/Windsurf editor scroll sensitivity for smoother fullscreen-mode scrolling.

## CC 2.1.128 Settings

### `--plugin-dir` Now Accepts `.zip` Archives

CC 2.1.128 extends `--plugin-dir` so it accepts a path to a `.zip` plugin archive in addition to an unpacked directory. Combined with the new `--plugin-url <url>` flag in 2.1.129 (see below), this enables a URL → download → load workflow for one-off plugin trials without committing the plugin to a marketplace or unpacking it manually.

```bash
# Load a plugin from a local zip
claude --plugin-dir ./vendor/some-plugin.zip

# Or from a download (chains naturally with --plugin-url; see 2.1.129)
curl -LO https://example.com/some-plugin.zip
claude --plugin-dir ./some-plugin.zip
```

**Action**: None for OrchestKit's own install path (we ship as a directory under `plugins/ork/`). Useful when evaluating third-party plugins side-by-side without polluting `~/.claude/plugins/`. The companion fix that stopped `/plugin` Components panel from reporting "Marketplace 'inline' not found" for `--plugin-dir`-loaded plugins (also in 2.1.128) means zip-loaded plugins now show in `/plugin` correctly.

### Subprocesses No Longer Inherit OTEL_* Env Vars

CC 2.1.128 stops propagating `OTEL_*` environment variables from the CLI process into spawned subprocesses (Bash, hooks, MCP, LSP). OTEL-instrumented apps run via the Bash tool no longer accidentally pick up the CLI's own OTLP endpoint and report into Claude Code's telemetry stream.

**Before (≤ 2.1.127)**: A user who ran `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 claude` would see every Bash-tool-launched subprocess (their app under test, their CI script, an MCP stdio server) inherit that env and emit spans into the CLI's collector.

**After (≥ 2.1.128)**: Subprocesses start with `OTEL_*` stripped. The CLI keeps emitting its own metrics; child apps emit nothing unless their environment is configured independently.

**If you need OTEL in a subprocess** — e.g., a Bash tool wrapper that shells into an OTEL-instrumented Python app — set the env explicitly inside the wrapper:

```bash
# In the wrapped command, not the CLI environment
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 \
OTEL_SERVICE_NAME=my-app \
  python -m my_app
```

**Action for OrchestKit**: None. OrchestKit hooks don't rely on inherited OTEL env. If you've been using `OTEL_EXPORTER_OTLP_ENDPOINT` to debug an MCP server by piggy-backing on the CLI's collector, switch to the explicit-env pattern above. Affected children: **Bash, hooks, MCP servers (stdio + Streamable HTTP), LSP**.

### MCP Reconnect Tool Summarization

When an MCP server reconnects mid-session, CC 2.1.128 no longer flushes the full re-announced tool-name list into the conversation. Re-announced tools are summarized by server prefix instead — e.g., `mcp__github__* (37 tools re-registered)` rather than 37 separate lines.

**Impact**: Cosmetic for end users (less noise in transcript). Material for anyone parsing audit logs or transcripts for tool-call surface area — the prior heuristic of grepping `mcp__<server>__` to enumerate connected tools breaks because reconnect events emit summaries, not enumerations. Use the initial connect event (still full enumeration) as the source of truth, and treat reconnect summaries as deltas only.

See `${CLAUDE_SKILL_DIR}/../mcp-patterns/references/mcp-audit-runbook.md` for the updated reconnect-event handling.

### SDK Hosts: "Always allow" Writes to .claude/settings.local.json

CC 2.1.128 ships a persistent `localSettings` suggestion for Bash permission prompts in SDK hosts. When the user picks **"Always allow"** from a Bash permission prompt, the SDK host now writes the new allow rule into `.claude/settings.local.json` instead of letting it evaporate at session end.

**Before**: SDK-host "Always allow" was effectively "always allow for this session" — a fresh session prompted again.

**After**: The grant persists across sessions via `.claude/settings.local.json` (the existing user-machine-local file already used for personal overrides). Project `.claude/settings.json` is unchanged — these are user-local grants, not committed.

**Action for OrchestKit**: None for the CLI host (which already persisted these grants). For SDK consumers (`claude-code-sdk-*` integrations), audit your `.gitignore` to confirm `.claude/settings.local.json` is excluded — committing it leaks per-developer auth grants. OrchestKit's `fewer-permission-prompts` skill takes advantage of this: `localSettings` writes are now durable for SDK hosts too, so the prompt-coalescing analysis applies there.

### --channels Now Works with Console Auth (channelsEnabled managed setting)

CC 2.1.128 extends `--channels` (the MCP-server-pushes-into-session feature, originally Pro/Team subscription only) to **console (API key) authentication**. Console orgs that ship managed settings must opt in by declaring `channelsEnabled: true`, otherwise `--channels` no-ops with a warning even on 2.1.128+.

```json
{
  "channelsEnabled": true
}
```

Place in the org's managed settings file (typically `/etc/claude-code/managed-settings.json` or the path your enterprise installer writes to). Without this flag, console-auth users on managed orgs see a "channels disabled by managed policy" message when invoking `--channels`.

**Action for OrchestKit**: None for personal use. Enterprise admins shipping OrchestKit alongside `claude` for API-key-auth teams should add `channelsEnabled: true` to the managed-settings bundle if channel-relayed permission prompts (the `ork:portless` + channels combo, the brainstorm-on-mobile flow) are part of the rollout.

## CC 2.1.129 Settings

### `Bash(mkdir *)` / `Bash(touch *)` Allow Rules Now Honored for In-Project Paths

Before 2.1.129, `Bash(mkdir *)` and `Bash(touch *)` allow rules in `.claude/settings.json` were silently rejected for in-project relative paths — the prompt fired anyway, even though the rule was syntactically valid. As of 2.1.129 these rules are honored as documented.

```json
{
  "permissions": {
    "allow": [
      "Bash(mkdir *)",
      "Bash(touch *)"
    ]
  }
}
```

**Impact for OrchestKit**: Skills that scaffold project structure (`ork:implement`, `ork:cover`, `ork:portless`) no longer need `Bash(mkdir:./*)`-style explicit path enumeration to silence prompts on project-relative `mkdir`/`touch` calls. If your `.claude/settings.local.json` has accumulated workaround entries from older CC, they're now redundant — the canonical glob form works.

### `--plugin-url <url>` for One-Off `.zip` Plugin Loading

CC 2.1.129 adds `--plugin-url <url>` which fetches a plugin `.zip` archive from a URL and loads it for the current session only. Pairs with the `.zip` support in `--plugin-dir` (CC 2.1.128, see above) — `--plugin-url` is the network-fetch convenience wrapper.

```bash
# Try a plugin without committing to a marketplace install
claude --plugin-url https://example.com/some-plugin.zip
```

**Use case**: Ad-hoc trial of an externally distributed plugin (e.g., a coworker's branch build, a release artifact from a GitHub Actions run) without modifying `~/.claude/plugins/` or adding a marketplace entry. The plugin is scoped to the session and discarded when CC exits. For long-term install, use the standard `/plugin install` flow against a marketplace.

**Action for OrchestKit**: None for shipping. Mention this in `ork:setup` as a way to demo OrchestKit pre-release builds (e.g., a CI-produced `.zip` from a PR branch) without disturbing the user's existing install.

### Server-Managed Settings Now Apply to Pre-`user:inference` OAuth Tokens

Before CC 2.1.129, enterprise/team users whose stored OAuth credentials predated the `user:inference` scope rollout silently bypassed server-managed settings policy — the policy file was fetched but not enforced. As of 2.1.129 the policy applies regardless of whether the cached token carries `user:inference`.

**Impact for OrchestKit**: If your org publishes a managed `permissions`/`disableSkillShellExecution`/`forceRemoteSettingsRefresh` policy and some seats appeared to ignore it, those seats are now enforced after upgrade. No setting to change — re-login (`claude /login`) is only needed if a user is still on a pre-2.1.129 token AND wants the new scope locally; the server-side enforcement does not require re-login.

### OAuth Refresh Race Fix After Wake-from-Sleep

Before 2.1.129, when a laptop woke from sleep with multiple CC sessions open, the OAuth refresh attempt could race itself across sessions and invalidate the active token, logging every running session out at once. CC 2.1.129 serializes the wake-time refresh.

**Impact for OrchestKit**: Long-running `/ork:implement` / `/ork:cover` / checkpoint-resume chains that span a sleep cycle no longer get killed by a phantom logout. If you still see "logged out after wake" on CC ≥ 2.1.129, it's a credential issue (expired refresh token, keychain ACL, 1Password unlock), not the race — see `doctor/references/remediation-guide.md`.

### Gateway /v1/models Discovery Now Opt-In via CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1

CC 2.1.126 through 2.1.128 automatically queried the configured gateway's `/v1/models` endpoint to populate the `/model` picker. CC 2.1.129 makes this **opt-in** — the picker will only show gateway-discovered models when `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` is set.

**Why**: The auto-discovery in 2.1.126–2.1.128 caused unexpected `/v1/models` traffic for sites that proxied via `ANTHROPIC_BASE_URL` to a gateway (LiteLLM, Bedrock-via-gateway, custom auth proxies) without intending to expose every backend model in the picker. 2.1.129 rolls discovery back to opt-in.

```bash
# Re-enable gateway model discovery for /model picker
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude
```

**Breaking for**: Anyone who relied on `/model` listing custom gateway models in 2.1.126–2.1.128 — the picker now shows only the static built-in list unless the env var is set.

**Action for OrchestKit**: None on the plugin side. `ork:setup` and `ork:llm-integration` reference the env var so users hitting "my fine-tuned model disappeared from `/model`" know the one-line fix. See also `${CLAUDE_SKILL_DIR}/../llm-integration/references/model-selection.md`.

### claude_code.pull_request.count Now Counts MCP-Filed PRs

The `claude_code.pull_request.count` OTel metric counted PRs/MRs created via the Bash tool (`gh pr create`, `glab mr create`, etc.). As of CC 2.1.129 it **also counts PRs/MRs filed via MCP tools** — e.g., GitHub MCP server's `create_pull_request`, GitLab MCP equivalents, custom MCP servers exposing PR-creation tools.

**Impact on dashboards**: PR-velocity dashboards built on this metric will see a step-function increase at the 2.1.129 cutover for any team where MCP-driven PR creation is non-trivial. Annotate the dashboard with the version bump so the apparent "spike" isn't misread as a behavioral change.

**Counter labels**: The metric still emits the same labels (`provider`, `result`); MCP-filed PRs are not specially labeled. If you need to distinguish MCP-vs-shell origins, add a derived metric in your collector that joins on tool-name from a separate `claude_code.tool.use` event stream.

**Action for OrchestKit**: None on the plugin side. The `ork:telemetry-inspect` skill enumerates this metric — see `${CLAUDE_SKILL_DIR}/../monitoring-observability/references/metrics-collection.md` for collector-side guidance.

## CC 2.1.132 Settings

### `--permission-mode` Honored on Plan-Mode Resume

Before 2.1.132, the `--permission-mode` flag was silently ignored when resuming a plan-mode session via `-p --continue` or `--resume`, and `ExitPlanMode` did not re-apply plan mode for the rest of the same session. Both gaps closed the wrong way (more permissive than declared), so this is a security-relevant fix, not just UX.

```bash
# At our floor (CC ≥ 2.1.183): plan mode survives resume as declared
claude --resume <session-id> --permission-mode plan
```

**Impact for OrchestKit**: Skills that drive plan-mode workflows (`ork:implement`, `ork:fix-issue`, `ork:brainstorm`) and the checkpoint-resume / chain-patterns flows that re-enter sessions with `--resume` no longer leak past plan-mode constraints. No setting change — the floor in `engines.claudeCode` already guarantees the fix.

### MCP Unauthorized Connector Status Visibility

Before 2.1.132, claude.ai MCP connectors that returned `401 Unauthorized` were displayed in `/mcp` as `failed`, masking the real cause (the user just needs to authorize). Headless `-p` mode also retried these non-transient 4xx auth failures as if they were network blips. CC 2.1.132 splits the two: connectors needing auth show as `needs auth` and `-p` stops retrying them.

```
$ claude  /mcp
  github       connected · 12 tools
  notion       needs auth     ← was "failed" pre-2.1.132
  myserver     connected · tools fetch failed
```

**Impact for OrchestKit**: `/ork:doctor` and `mcp-visual-output` skills can rely on `/mcp` status text to distinguish auth-required from genuinely broken servers. No config change at our floor.

## CC 2.1.133 Settings

### Parallel-Session Refresh-Token Race Fix

Before 2.1.133, when multiple CC sessions shared the same credentials and a refresh-token rotation fired in one session, the other sessions could race against it and end up using the now-invalidated token — all of them dead-ending at `401 Unauthorized` simultaneously. CC 2.1.133 serializes the rotation so concurrent sessions see the same fresh token.

**Impact for OrchestKit**: OrchestKit's worktree-isolation workflow (see `chain-patterns/references/worktree-agent-pattern.md`) routinely runs concurrent CC sessions against the same machine credentials — one per worktree per agent. Before 2.1.133, a single refresh-token race could 401 every session at once mid-run, killing in-flight `/ork:implement`, `/ork:cover`, and `/ork:verify` chains. No setting change required — the floor in `engines.claudeCode` (≥ 2.1.183) already guarantees the fix is active.

If you ever do hit a "all sessions 401 at the same moment" symptom on a supported floor, the cause is no longer this race — see `${CLAUDE_SKILL_DIR}/../doctor/references/remediation-guide.md` for recovery steps.

### Remote Control Stop/Interrupt Now Cancels CLI Session

Before 2.1.133, pressing **Stop** in claude.ai's Remote Control surface (the web-side stop/interrupt button) did not fully cancel the underlying CLI session the same way a local `Esc` keypress would. The CLI was nominally interrupted but queued messages never advanced after the user had aborted a stuck tool call or prompt — the session stayed wedged until manually killed.

CC 2.1.133 makes the Remote Control stop path identical to local `Esc`: the current tool/prompt aborts, the message queue resumes, and the session is immediately usable again.

**Impact for OrchestKit**: No OrchestKit skill currently drives a Remote Control flow, so there's no end-user-facing change today. The fix matters as forward-compat for any future agentation/`channels`-style surface that exposes a remote stop button — any OrchestKit chain that gets driven from claude.ai now interrupts cleanly without leaving a hung CLI side.

### MCP OAuth Honors HTTP(S)_PROXY / NO_PROXY / mTLS

Before 2.1.133, CC's MCP OAuth client opened HTTP connections directly to the OAuth endpoints regardless of `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, or mTLS client-certificate settings. The MCP server itself was reachable via the proxy (because the MCP transport layer respected it) but every OAuth step bypassed it — discovery (`/.well-known/oauth-authorization-server`), **dynamic client registration (DCR)**, the initial token exchange, and every subsequent refresh.

CC 2.1.133 routes the entire MCP OAuth flow through the same proxy/mTLS configuration as other HTTP traffic.

```bash
# Enterprise behind a corporate proxy with mTLS to internal MCP servers
export HTTPS_PROXY=http://proxy.corp.example.com:3128
export NO_PROXY=localhost,127.0.0.1,.internal.example.com
export NODE_EXTRA_CA_CERTS=/etc/ssl/corp-ca-bundle.pem
# mTLS client cert + key for the OAuth endpoint
export CLAUDE_CODE_MCP_CLIENT_CERT=/etc/ssl/claude-client.pem
export CLAUDE_CODE_MCP_CLIENT_KEY=/etc/ssl/claude-client.key
claude
```

**Impact for OrchestKit**: Direct hit on enterprise MCP deployments behind corporate proxies — the `mcp-patterns` skill (the OrchestKit in-tree equivalent of `building-mcp-server-on-cloudflare`) can now confidently document an enterprise OAuth flow without warning users away on proxy/mTLS environments. If you support MCP-server connectivity guidance in a customer skill, drop the "proxy-aware OAuth requires manual workaround" caveat for CC ≥ 2.1.133. Also relevant to `mcp-config.md` (see CC 2.1.133 changes section there).

### `--add-dir` / SDK `additionalDirectories` Works for Windows Mapped Network Drives

Before 2.1.133, passing a Windows **mapped network drive** path (e.g., `Z:\\share\\project`, `\\\\server\\share`) via `claude --add-dir` or the SDK's `additionalDirectories` resulted in every subsequent `Read`/`Write`/`Edit` against that directory being denied at the permission layer — the path matched the allowlist textually but failed an internal "is real local filesystem" check that misidentified mapped drives.

```powershell
# Before 2.1.133 — denied even though --add-dir accepted it
claude --add-dir Z:\share\project
# Read tool on Z:\share\project\file.ts → "path not in allowed directories"

# At our floor (CC ≥ 2.1.183) — works as documented
claude --add-dir Z:\share\project
# Read/Write/Edit succeed
```

**Impact for OrchestKit**: Windows users running CC against shared team drives — common in Citrix/VDI corporate setups, dev-shared NAS mounts, and OneDrive/SharePoint-as-drive workflows — can now use `--add-dir` and the SDK's `additionalDirectories` without a UNC-vs-letter workaround. No OrchestKit skill change required — the fix is implicit at our floor.

### `worktree.baseRef` Setting — Default Changed to `"fresh"` ⚠ behavior change

CC 2.1.133 adds the `worktree.baseRef` setting (`"fresh"` | `"head"`) that controls where `--worktree`, `EnterWorktree`, and agent-isolation worktrees branch from. **The default is `"fresh"`**, which means new worktrees branch from `origin/<default-branch>` — **not** from your local `HEAD`.

This is a regression for OrchestKit users. From CC 2.1.128 through 2.1.132, `EnterWorktree` branched from local `HEAD`, which is what OrchestKit's worktree-isolation pattern (`chain-patterns/references/worktree-agent-pattern.md`) relies on: unpushed commits in the parent worktree need to be visible to spawned agents. With the new `"fresh"` default, those unpushed commits are silently dropped when the worktree is created.

**Recommended OrchestKit setting** — in `.claude/settings.json`:

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

```json
// All three forms re-acquire the 2.1.128–2.1.132 behavior:
//   --worktree
//   EnterWorktree tool
//   agent-isolation worktrees (Task tool, isolation: "worktree")
{ "worktree": { "baseRef": "head" } }
```

**Choose `"fresh"` only if** you intentionally want every new worktree to start from `origin/<default>` (e.g., clean-room agent runs that should never inherit local WIP). For the common OrchestKit flow — spawn an agent in a worktree to do work on top of an in-progress local branch — `"head"` is the only correct value.

**Impact for OrchestKit**: All of `ork:implement`, `ork:cover`, `ork:fix-issue`, `ork:verify`, and any custom skill that calls `Agent(... isolation: "worktree")` is affected. Without `worktree.baseRef: "head"`, agents start from origin and miss every unpushed local commit — `tsc` will fail with "cannot find module" for code you just wrote, tests will run against stale source, and PRs will appear empty of your in-progress work. `ork:doctor` flags this — see `${CLAUDE_SKILL_DIR}/../doctor/references/remediation-guide.md` ("EnterWorktree drops my unpushed commits").

### `sandbox.bwrapPath` / `sandbox.socatPath` Managed Settings (Linux/WSL)

CC 2.1.133 adds two managed-tier settings for Linux and WSL sandbox deployments: `sandbox.bwrapPath` (custom **bubblewrap** binary location) and `sandbox.socatPath` (custom **socat** binary location). These let enterprise admins point the sandbox at vendored binaries on hosts where `bwrap` / `socat` are not on `$PATH`, are at non-standard paths (e.g., `/opt/corp-tools/bin/bwrap`), or where the default-PATH copy is too old / has the wrong capability set.

```json
// /etc/claude-code/managed-settings.json (or equivalent managed path)
{
  "sandbox": {
    "bwrapPath": "/opt/corp-tools/bin/bwrap",
    "socatPath": "/opt/corp-tools/bin/socat"
  }
}
```

**Tier**: managed (admin-only) — these are not user-settable in `.claude/settings.json`. They live in `managed-settings.json` (or any of the `managed-settings.d/` fragments, CC 2.1.83+).

**Impact for OrchestKit**: None for personal use — OrchestKit doesn't ship a sandbox config. For enterprise rollouts that bundle OrchestKit with a corporate `claude` install on Linux/WSL fleets, add `sandbox.bwrapPath` / `sandbox.socatPath` to the managed-settings bundle if `bwrap` / `socat` are not on the default `$PATH` for the target hosts. macOS and native Windows are unaffected (no bwrap/socat dependency).

### `parentSettingsBehavior` Admin Key — Opt SDK `managedSettings` into Policy Merge

CC 2.1.133 adds the `parentSettingsBehavior` admin-tier key with values `"first-wins"` | `"merge"`. SDK hosts can pass a `managedSettings` block as the "parent tier" of the precedence chain — this key controls whether that parent tier participates in the merge against the admin-managed policy, or is overridden first-wins-style by the admin tier.

```json
// /etc/claude-code/managed-settings.json
{
  "parentSettingsBehavior": "merge"
  // or
  // "parentSettingsBehavior": "first-wins"
}
```

| Value | Effect |
|-------|--------|
| `"first-wins"` (default) | Admin-managed settings win — SDK-passed `managedSettings` are ignored where keys conflict |
| `"merge"` | SDK `managedSettings` participate in the precedence merge alongside the admin tier — useful when the SDK host needs to declare a stricter policy than the admin baseline |

**Impact for OrchestKit**: None for the CLI host. Relevant only for SDK consumers (`claude-code-sdk-*` integrations) that ship their own `managedSettings` and need that policy to compose with an org-level managed-settings bundle rather than be overridden by it. If you build an SDK host on top of OrchestKit, set `parentSettingsBehavior: "merge"` on the admin side so your host's `managedSettings` block isn't silently dropped.

### `Edit`/`Write` Allow Rules at Drive Root or POSIX `/` Now Match Correctly

Before 2.1.133, `Edit` and `Write` allow rules scoped to a Windows **drive root** (e.g., `Edit(C:\\**)`) or to the POSIX root (`Edit(/**)`) matched incorrectly and always fired the permission prompt anyway — the rule was syntactically valid and accepted but the path-match step misclassified the rule as not covering the target path. CC 2.1.133 fixes the match logic so these rules now behave as documented.

```json
{
  "permissions": {
    "allow": [
      "Edit(/**)",
      "Write(/**)",
      "Edit(C:\\**)",
      "Write(C:\\**)"
    ]
  }
}
```

**Impact for OrchestKit**: None for the standard OrchestKit setup — OrchestKit recommends per-project allow rules under `.claude/settings.json` for the project directory, not a system-wide drive-root grant. Relevant if you've added a drive-root rule as a workaround in `.claude/settings.local.json` to silence the prompt-every-time symptom of this bug — at our floor the workaround is no longer needed and the rule actually means what it says. Audit any `Edit(C:\\**)`-shaped rules with that history; if they were added as workarounds, narrow them now that the canonical glob form works.

### Hooks Now Receive `effort.level` Input + `$CLAUDE_EFFORT` Env

CC 2.1.133 surfaces the active effort level to every hook invocation in two new ways:

1. **`effort.level` JSON input field** — the hook stdin payload now includes the active effort as a top-level `effort.level` string (`"low"` | `"medium"` | `"high"` | `"xhigh"`).
2. **`$CLAUDE_EFFORT` environment variable** — set in the hook process env and inherited by anything the hook spawns. Bash tool invocations also see `$CLAUDE_EFFORT`, so shell commands can branch on it without going through the hook.

```typescript
// PreToolUse hook reading effort from JSON stdin
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf-8'));
const effort = input.effort?.level ?? process.env.CLAUDE_EFFORT ?? 'medium';

if (effort === 'low') {
  // Skip expensive validation — user signaled fast iteration
  process.exit(0);
}
```

```bash
# Bash tool / hook script reading effort directly
if [ "${CLAUDE_EFFORT:-medium}" = "xhigh" ]; then
  # Run the full audit suite — user explicitly opted in
  npm run test:all
else
  npm run test:quick
fi
```

**Impact for OrchestKit**: Direct hit on `src/hooks/src/**` — every OrchestKit hook can now be effort-aware. Concrete opportunities:

- **`quality-gates`** hooks can gate expensive correctness checks (full type-check, security scan, integration suite) to `high` / `xhigh` and skip them on `low` for fast iteration.
- **`ci-debug`**, **`assess`**, and **`verify`** chains can scale the number of parallel agents spawned with effort level.
- **`pre-commit`** style gates can downgrade strict checks to advisory at `low` and enforce blocking at `high`.

No setting change required — the JSON field and env var are always present at our floor (CC ≥ 2.1.183). Hook authors should treat absence as `medium` for forward compat.

### `/effort` Now Session-Scoped (No Cross-Session Leak)

Before 2.1.133, running `/effort high` (or any effort change) in one CC session could **silently bump the effort level of every other concurrent session** on the same machine — the effort state was stored in a shared global rather than per-session. A related bug also caused IDE-driven effort changes (the VSCode/JetBrains effort picker) to be silently dropped when another session held the lock.

CC 2.1.133 makes `/effort` session-local: each session has its own effort state, IDE effort changes are reliably applied to the active session, and concurrent sessions no longer trample each other.

```bash
# Session A
/effort xhigh
# → Session A is now xhigh

# Session B (concurrent, started before or after)
/effort low
# → Session B is now low; Session A stays at xhigh (was previously also forced to low)
```

**Impact for OrchestKit**: Direct hit on OrchestKit's worktree-isolation workflow — running parallel `/ork:implement` and `/ork:verify` in separate worktrees with different effort levels (e.g., `xhigh` for the implement run, `medium` for verify) now works as expected. Before 2.1.133, the second `/effort` call would silently retarget the first session, defeating the whole point of per-task effort tuning. Combined with the new `effort.level` hook input (#1702), this makes effort-aware hooks safe to deploy without worrying about cross-session contamination. No setting change required; the floor in `engines.claudeCode` (≥ 2.1.183) already guarantees the fix.

### Subagents Now Discover Project/User/Plugin Skills

Before 2.1.133, subagents spawned via the **Task tool** could not discover skills from any source — project (`.claude/skills/`), user (`~/.claude/skills/`), or plugin (e.g., OrchestKit's bundled skills). The Skill tool inside a subagent saw an empty registry even when the parent session could list dozens of skills. This was a **direct regression** for OrchestKit because every agent in `src/agents/*` that delegates work via Task and relies on a Skill call inside the subagent was broken at the discovery step.

CC 2.1.133 restores documented behavior: subagents inherit the full skill registry (project + user + plugin tiers) and can invoke any skill the parent session sees.

```typescript
// Inside a subagent body (e.g., src/agents/backend-system-architect.md):
// Before 2.1.133: this would fail — Skill not found
// At our floor (CC ≥ 2.1.183): works as documented
Skill({ name: 'ork:architecture-patterns' });
```

**Impact for OrchestKit**: **Direct, immediate** — every OrchestKit agent in `src/agents/*` that uses `skills:` in its frontmatter relies on this discovery path. Before 2.1.133, Task-delegated work in `ork:implement`, `ork:cover`, `ork:verify`, `ork:fix-issue`, `ork:review-pr`, and `ork:explore` could silently fall back to non-skill behavior because the Skill tool returned "skill not found" inside the subagent. At our floor the fix is implicit — no agent-frontmatter or settings change is required. If you maintain custom agents that worked around this by inlining skill content into the agent body, you can now revert to a clean `Skill({ name: ... })` call.

## CC 2.1.136 Settings

### `settings.autoMode.hard_deny` — Unconditional Auto-Mode Block Tier

CC 2.1.136 adds a new permission-classifier tier: `settings.autoMode.hard_deny`. Rules in this list **block unconditionally** — regardless of user intent, regardless of any matching `allow` entry, regardless of permission mode. This is stronger than the existing auto-mode deny list (which a user-confirmed allow can override) and is the right home for patterns that should never run, full stop.

```json
// .claude/settings.json
{
  "autoMode": {
    "hard_deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf $HOME*)",
      "Bash(git push --force origin main)",
      "Bash(git push --force origin master)",
      "Bash(git reset --hard origin/main)",
      "Bash(curl * | sh)",
      "Bash(curl * | bash)",
      "Bash(wget * | sh)"
    ]
  }
}
```

| Tier | Behavior | Override path |
|------|----------|---------------|
| `permissions.deny` | Blocks; user can re-issue with explicit allow | Bypassable with allow rule or `--permission-mode acceptEdits` |
| `autoMode.deny` (classifier) | Blocks in auto mode only; user prompt in default mode | Bypassable with allow rule |
| `autoMode.hard_deny` (NEW) | Blocks unconditionally; allow rules ignored | **None** — only way around is removing the rule |

**Impact for OrchestKit**: Direct hit on `src/settings/*.settings.json` and the `permission-design`-style guidance. The recommended OrchestKit baseline should promote a small set of catastrophic patterns from `autoMode.deny` to `autoMode.hard_deny` — specifically the ones that no real workflow should ever need to override interactively. Audit existing classifier rules: anything documented as "deny unless user explicitly confirms" stays in `autoMode.deny`; anything documented as "never run, period" (destructive recursive removes, force-push to default branch, pipe-to-shell from network) should move to `hard_deny`. Skills documenting permission patterns (`security-patterns`, `permission-design` if added) should cover the new tier.

### Plan Mode Now Blocks Writes Even With Matching `Edit(...)` Allow Rule ⚠ behavior change

Before 2.1.136, plan mode had a security gap: if a user had an `Edit(<path>)` allow rule defined for normal sessions, that rule **bypassed plan mode's no-write contract** — the rule's allow effect leaked into plan mode and let writes through silently. Plan mode is supposed to be a read-only / proposal-only context; the bypass meant a session running in plan mode could still mutate files if the path matched any persisted allow rule.

CC 2.1.136 fixes the bypass: plan mode now blocks writes regardless of allow rules. The only way to write in plan mode is to exit plan mode (`ExitPlanMode`) first.

```bash
# Pre-2.1.136 (BROKEN): plan mode + Edit(src/**) allow rule = writes go through
claude --permission-mode plan
# Edit on src/foo.ts → silently allowed by the Edit(src/**) rule

# At our floor (CC ≥ 2.1.183, includes 2.1.136 fix): plan mode blocks writes
claude --permission-mode plan
# Edit on src/foo.ts → blocked by plan mode (allow rule has no effect)
```

**Impact for OrchestKit**: Security-relevant fix, not just UX. Skills that drive plan-mode workflows (`ork:implement`, `ork:fix-issue`, `ork:brainstorm`) can now rely on plan mode actually being read-only — pre-2.1.136 a session-scoped `Edit(...)` allow rule could turn a "let me think first" into "let me silently rewrite". No setting change required at our floor (≥ 2.1.183). If a skill or agent body has language saying "Edit allow rules bypass plan mode" (a workaround documented for the broken behavior), that text is now wrong and should be removed — `ExitPlanMode` is the only path to writes in plan mode.

### `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL` — Re-Enable Session Quality Survey for OTEL Capture

CC 2.1.136 adds `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL=1` to re-enable the in-session feedback survey for enterprises that capture survey responses via OpenTelemetry. The survey is normally suppressed in enterprise / OTEL-emitting deployments to avoid noise; this env var opts back in when the org actually wants to ingest the responses.

```bash
# Enterprise deployment that captures CC OTEL traces and wants survey signal
export CLAUDE_CODE_ENABLE_OTEL=1
export CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL=1
claude
```

**Impact for OrchestKit**: None for personal use — OrchestKit doesn't ship an OTEL config. Relevant for enterprise rollouts that bundle OrchestKit with a corporate `claude` install and pipe CC telemetry to an internal OTEL collector. If you maintain such a deployment and want survey responses in your telemetry stream alongside the existing tool-use traces, set the env var on the host that launches `claude` (managed-env or shell init, not in OrchestKit's per-project config).

### `AskUserQuestion` Preserves Multi-Select Array Answers ⚠ behavior change

Before 2.1.136, `AskUserQuestion` with `multiSelect: true` silently **discarded** the answer when the runtime supplied it as an array (the documented shape). The question dispatched, the user clicked their selections, but the agent received no usable answer — effectively a soft hang on multi-select questions. CC 2.1.136 fixes the array path so multi-select answers are preserved end-to-end.

```typescript
// Multi-select question that now works at our floor (CC ≥ 2.1.183)
AskUserQuestion({
  questions: [{
    question: 'Which test tiers should I generate?',
    header: 'Test tiers',
    multiSelect: true,
    options: [
      { label: 'Unit', description: 'Vitest unit tests' },
      { label: 'Integration', description: 'Testcontainers + real DB' },
      { label: 'E2E', description: 'Playwright user flows' },
    ],
  }],
});
// Pre-2.1.136: returned answer object had multi-select silently dropped
// At our floor: returned answer is the full string[] of selected labels
```

**Impact for OrchestKit**: Direct hit on any skill or agent that uses `AskUserQuestion` with `multiSelect: true`. The agent runtime relied on this — pre-2.1.136 a multi-select call would silently produce no answer and the agent would have to fall back to single-select or guess. At our floor the fix is implicit — no skill or agent frontmatter change required. If a skill body or agent description currently warns "don't use multiSelect, it drops answers" (a workaround for the pre-2.1.136 bug), that warning is stale and should be removed. The `ork:elicit` flow specifically benefits — questionnaires that branched on a single-select-only workaround can now use multiSelect natively.

## CC 2.1.152 Settings

### `--fallback-model` Now Switches for the Whole Session

When the primary model is not found (e.g. a pinned model ID that no longer resolves, or a gateway that dropped it), CC 2.1.152 switches to your configured `--fallback-model` for the **rest of the session** instead of erroring on every request. Previously a missing primary model failed each request individually.

**Action for OrchestKit**: Set a `--fallback-model` (or the `ANTHROPIC_SMALL_FAST_MODEL` / model settings your gateway supports) so a renamed or de-listed primary degrades gracefully rather than bricking the session. Pairs with the gateway model-discovery note above — if `/model` lists fewer models than expected, a fallback keeps long `ork:implement`/`ork:brainstorm` runs alive. No plugin-side change required.

> **Related 2.1.152 items** (full table in `${CLAUDE_SKILL_DIR}/../doctor/references/version-compatibility.md`): `permissionMode: "auto"` no longer needs opt-in consent; the sandbox-enabled warning now shows in condensed startup; and a new `MessageDisplay` hook event can transform/hide assistant text (ork ships no MessageDisplay hook — recognized in the `HookEvent` union for future use).

## CC 2.1.172–179 Settings

Settings introduced since the 2.1.152 entries above, current to the adoption head (`latest_known` 2.1.179). Bugfix-only releases (2.1.171/173/177/179) add no settings.

### `availableModels` Enforcement Tightened (2.1.172 / 2.1.176)

`availableModels` (an allowlist of model IDs/aliases) existed earlier, but its enforcement hardened: CC 2.1.172 applies the allowlist to **subagent model overrides, the agent-dispatch picker, and the advisor model**; CC 2.1.176 closes two bypasses — alias picks can **no longer be redirected to a blocked model via `ANTHROPIC_DEFAULT_*_MODEL`** env vars, and `/fast` **refuses to toggle** when it would switch to a model outside the allowlist.

```json
{ "availableModels": ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] }
```

**Action for OrchestKit**: ork's `model-cost-advisor` hook is allowlist-aware (PR #2420) — when an agent's pinned tier is excluded it emits a **visible warning** instead of letting CC silently substitute a weaker model (a correctness trap for capability-pinned agents like `security-auditor`). ork agents use bare aliases, so they survive the picker fix; no frontmatter change needed.

### `enforceAvailableModels` Managed Setting (2.1.175)

A **managed** setting (managed-settings.json only): when enabled, the `availableModels` allowlist also constrains the **Default** model (a Default that would resolve to a disallowed model falls back to the first allowed model), and user/project settings can **no longer widen** a managed `availableModels` list.

```json
{ "enforceAvailableModels": true }
```

**Action for OrchestKit**: handled by the same `model-cost-advisor` hardening (PR #2420) — the advisor detects `enforceAvailableModels` and notes Default is constrained too. No plugin-side change required; relevant to orgs that centrally restrict tiers.

### `wheelScrollAccelerationEnabled` (2.1.174)

Disables mouse-wheel scroll acceleration in fullscreen (`tui: fullscreen`) mode for users who find accelerated scroll jumpy.

```json
{ "wheelScrollAccelerationEnabled": false }
```

**Action for OrchestKit**: UX-only, no plugin surface. Mention for users on fullscreen TUI.

### `language` — Session-Title Localization (2.1.176)

CC 2.1.176 generates session titles in the **language of the conversation**; set `language` to pin a specific language for titles.

```json
{ "language": "ja" }
```

**Action for OrchestKit**: ork's haiku session auto-rename hook (`session-identity.ts`, PR #2449) builds an English title prompt; issue #2443 will thread this `language` setting into `buildGeneratorPrompt` so the prompt-bar title matches CC's localized session-list title. Until then, set `language` and expect a minor English/localized mismatch in the prompt bar.

### `footerLinksRegexes` (2.1.176)

Regex-matched link badges in the footer row, configurable via user or managed settings — turns matching tokens in the footer into clickable link badges.

```json
{ "footerLinksRegexes": [{ "pattern": "ORK-\\d+", "url": "https://github.com/yonatangross/orchestkit/issues/$1" }] }
```

**Action for OrchestKit**: ork ships no footer/statusline surface, so nothing to integrate — informational. Users can wire issue/PR badges themselves.

### `Tool(param:value)` Permission Rules (2.1.178)

Permission rules now match a tool's **input parameters** (not just its name), with `*` wildcard support. Syntax: `Tool(param:value)`. The canonical example from the changelog is `Agent(model:opus)` to block any subagent spawned with Opus.

```json
{ "permissions": { "deny": ["Agent(model:opus)", "Agent(model:fable)"] } }
```

**Action for OrchestKit**: ork stays **docs-only** here — it does NOT add param-deny rules to the committed `src/settings/ork.settings.json` (a publicly distributed plugin must not silently constrain a user's model choice). Critically, this native syntax does **not** replace ork's model hooks: `Tool(param:value)` is a *static* allow/deny gate, whereas `subagent-start/model-cost-advisor.ts` reads agent frontmatter at runtime + warns when a pinned tier is excluded by `availableModels`, and `pretool/task/fable-spend-consent.ts` issues an interactive consent prompt with an `ORK_FABLE_OK` bypass. The 2.1.178 subtraction pass (`shared/rules/cc-native-first.md`) confirmed both as **KEEP** — orthogonal, not redundant. Users wanting a hard block (no prompt) can add `Agent(model:…)` deny rules in their own settings.

### MCP `disallowedTools` Enforced in Subagents (2.1.178)

CC 2.1.178 fixes a bug where MCP server-level specs (`mcp__server`, `mcp__server__*`, `mcp__*`) listed in an agent's `disallowedTools` were **silently ignored** when the agent ran as a subagent. They are now enforced at spawn.

```yaml
# agent frontmatter — now actually blocks all Tavily tools in the subagent
disallowedTools: [mcp__tavily, mcp__tavily__*]
```

**Action for OrchestKit**: agent authors can now rely on `disallowedTools: [mcp__*]` to scope MCP access in spawned subagents (e.g. deny expensive/untrusted MCP servers to a background agent). ork had **no workaround** for the old bug, so nothing is retired — see `.claude/rules/agent-authoring.md`.

### Nested `.claude/skills` + Closest-Wins Precedence (2.1.178)

Skills in nested `.claude/skills/` directories now load when you work on files there; on a name clash the nested skill appears as `<dir>:<name>` so both stay reachable. More broadly, the agent / workflow / output-style **closest to the working directory wins** on a name collision, and project-scope workflow saves now target the closest existing `.claude/workflows/`.

**Action for OrchestKit**: informational for monorepo users — a package can host its own `packages/api/.claude/skills/` without colliding with the root. ork ships its skills via the `ork` plugin, not `.claude/skills`, so no packaging change.

### Workflow Keyword Now Explicit-Phrase Only (2.1.178)

The dynamic-workflow trigger now fires **only** on explicit phrases like "run a workflow" or "workflow:" (with a purple-shimmer highlight) — a bare mention of the word "workflow" no longer launches one.

**Action for OrchestKit**: removes accidental triggers from skill descriptions and docs that merely mention "workflow". Complements the 2.1.157 keyword-trigger toggle; no plugin change needed. (Also in 2.1.178: auto-mode now runs the classifier on a subagent spawn *before* launch, closing a gap where a subagent could request a blocked action without review — a platform safety improvement, no frontmatter change.)

## CC 2.1.181 Settings

### `/config key=value` — Set Any Setting From the Prompt

CC 2.1.181 adds `/config key=value` syntax to set any setting directly from the prompt, without opening the `/config` menu or editing a settings file by hand:

```
/config thinking=false
/config model=opus
```

Works in **interactive**, **`-p`** (headless), and **Remote Control**.

**One-off vs. durable — the distinction OrchestKit must preserve:** `/config key=value` writes a single setting value. It is the fast path for an **ad-hoc, one-off** change. It does **not** create automation. A durable "whenever X happens, do Y" behavior still requires a **hook in `settings.json`** — the harness executes hooks, the model does not, so a setting value can't stand in for one. When a user asks to flip one setting now, reach for `/config key=value`; when they ask for a recurring on-event behavior, route to the hook flow in the `configure` (update-config) skill.

**Action for OrchestKit**: docs-only. No change to the committed `src/settings/ork.settings.json` — this is a user-facing convenience, not a plugin surface. Mention it in `update-config` as the quick path for single ad-hoc settings, while keeping hook-based automation as the answer for "from now on / each time / whenever" requests.
