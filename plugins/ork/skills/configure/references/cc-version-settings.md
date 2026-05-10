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
# At our floor (CC ≥ 2.1.138): plan mode survives resume as declared
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
