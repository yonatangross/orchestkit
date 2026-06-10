---
name: configure
license: MIT
compatibility: "Claude Code 2.1.170+."
description: "Interactive configuration wizard for OrchestKit plugin settings including MCP server enablement, hook permissions, keybindings, and installation presets (Complete/Standard/Lite). Supports preset shortcuts, per-category skill customization, and webhook configuration. Use when customizing plugin behavior or managing settings."
argument-hint: "[preset-name]"
context: inherit
version: 1.0.1
author: OrchestKit
tags: [configuration, setup, wizard, customization]
user-invocable: false
disable-model-invocation: true
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
complexity: low
persuasion-type: collaborative
effort: low
model: haiku
metadata:
  category: workflow-automation
paths: [".claude/**", "**/.claude/**"]
---

# OrchestKit Configuration

Interactive setup for customizing your OrchestKit installation.

## Quick Start

```bash
/ork:configure
/ork:configure mcp memory
```

## Argument Resolution

```python
PRESET = "$ARGUMENTS[0]"   # Optional preset name or subcommand, e.g., "mcp"
TARGET = "$ARGUMENTS[1]"   # Optional target, e.g., "memory"
# If no arguments, run interactive wizard.
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

## Step 1: Choose Preset

Use AskUserQuestion:

| Preset | Skills | Agents | Hooks | Description |
|--------|--------|--------|-------|-------------|
| **Complete** | 91 | 31 | 96 | Everything |
| **Standard** | 91 | 0 | 96 | Skills, no agents |
| **Lite** | 10 | 0 | 96 | Essential only |
| **Hooks-only** | 0 | 0 | 96 | Just safety |
| **Monorepo** | 91 | 31 | 96 | Complete + monorepo detection |

## Step 2: Customize Skill Categories

Categories available:
- AI/ML (28 skills)
- Backend (16 skills)
- Frontend (9 skills)
- Testing (14 skills)
- Security (7 skills)
- DevOps (5 skills)
- Planning (7 skills)
- Workflow (5 skills)

## Step 3: Customize Agents

**Product Agents (2):**
- market-intelligence
- product-strategist

**Technical Agents (17):**
- backend-system-architect
- frontend-ui-developer
- database-engineer
- llm-integrator
- workflow-architect
- data-pipeline-engineer
- test-generator
- code-quality-reviewer
- security-auditor
- security-layer-auditor
- debug-investigator
- system-design-reviewer
- python-performance-engineer
- frontend-performance-engineer
- monitoring-engineer
- event-driven-architect
- infrastructure-architect

**Operations Agents (6):**
- ci-cd-engineer
- deployment-manager
- git-operations-engineer
- release-engineer
- ai-safety-auditor
- multimodal-specialist

**Research Agents (4):**
- web-research-analyst
- market-intelligence
- design-system-architect
- demo-producer

## Step 4: Configure Hooks

**Safety Hooks (Always On):**
- git-branch-protection
- file-guard
- redact-secrets

**Toggleable Hooks:**
- Productivity (auto-approve, logging)
- Quality Gates (coverage, patterns)
- Team Coordination (locks, conflicts)
- Notifications (desktop, sound)

> **CC 2.1.49 Managed Settings:** OrchestKit ships plugin `settings.json` with default hook permissions. These are *managed defaults* — users can override them in project or user settings. Enterprise admins can lock managed settings via managed profiles.

> **CC 2.1.111 — prune overbroad Bash permissions:** Since 2.1.111, read-only Bash commands with glob patterns (`ls:*`, `head:*`, `grep:*`, `wc:*`, `find:*`, etc.) no longer trigger permission prompts by default. If your `.claude/settings.local.json` has explicit `Bash(ls:*)` / `Bash(grep:*)` style allows added to silence old prompts, they are now redundant. The built-in `/less-permission-prompts` skill scans your transcripts and proposes a prune diff — run it once per project and once per user profile, then commit the accepted subset. The committed OrchestKit `src/settings/ork.settings.json` is already minimal (allow = `Read`, `Glob`, `Grep`, a small set of MCP entries) and doesn't need changes.

> **CC 2.1.129 — `Bash(mkdir *)` / `Bash(touch *)` allow rules now work for in-project paths:** previously silently rejected for project-relative paths; now honored as documented. Workaround entries enumerating explicit subpaths (`Bash(mkdir:./src/*)`, etc.) can be collapsed back to the canonical glob form. See `references/cc-version-settings.md` § CC 2.1.129.

> **CC 2.1.157 — plugin auto-load + workflow-trigger control:** Plugins in `.claude/skills` auto-load (no marketplace required); `claude plugin init <name>` scaffolds one there. The "Workflow keyword trigger" toggle in `/config` — and pressing backspace right after the keyword — stops a bare "workflow"/"ultracode" from launching a dynamic workflow. `claude agents` honors the `agent` field in `settings.json`, with `--agent <name>` to override.

> **CC 2.1.160 — write prompts for startup files & build configs:** Expect approval prompts before Claude writes shell startup files (`.zshenv`/`.zlogin`/`.bash_login`, `~/.config/git/`) or — in `acceptEdits` mode — build-tool configs that grant code execution (`.npmrc`, `bunfig.toml`, `.bazelrc`, `.pre-commit-config.yaml`, `.devcontainer/`). These are security defaults; approve them deliberately, don't pre-allow.

> **CC 2.1.141 — `ANTHROPIC_WORKSPACE_ID` for workload identity federation:** When authenticating headless/CI agents (e.g. `/ork:ci-sentinel`, `/ork:bare-eval`) through Anthropic's WIF flow, set `ANTHROPIC_WORKSPACE_ID` to scope the minted token to one workspace when the federation rule covers more than one. Without it, a multi-workspace rule mints an unscoped token.

> **CC 2.1.142 — `MCP_TOOL_TIMEOUT` for remote MCP:** the per-request timeout now actually applies to remote **HTTP/SSE** MCP servers (previously capped at 60s regardless of the configured value). Raise it (e.g. `MCP_TOOL_TIMEOUT=180000`) for long-poll tools — NotebookLM `studio_status`, knowledge-base ingest, index rebuilds — that legitimately run past 60s, so they don't silently time out and self-skip.

> **CC 2.1.169 — safe-mode + policy-enforcement fixes:** `--safe-mode` (or `CLAUDE_CODE_SAFE_MODE=1`) starts CC with ALL customizations disabled — CLAUDE.md, plugins, skills, hooks, MCP servers — the fastest way to bisect "is ork (or any plugin) causing this?" before filing a bug. Enterprise managed MCP policies (`allowedMcpServers`/`deniedMcpServers`) are now enforced on reconnect, IDE-typed configs, `--mcp-config` servers in the first post-install session, and before remote settings load — if your org sets them, previously-working unlisted servers may now be (correctly) blocked. Untrusted project settings can no longer set OTEL client-certificate paths without trust confirmation. Self-hosted runners get a `post-session` lifecycle hook (after session end, before workspace deletion) for snapshotting uncommitted work or exporting logs, plus a configurable SIGTERM→SIGKILL window (default 5s).

> **CC 2.1.166 — `fallbackModel` setting (up to 3 models):** the `fallbackModel` setting now accepts up to three models, tried in order when the primary is overloaded or unavailable, and `--fallback-model` now also applies to **interactive** sessions (not just headless). Set it for long `ork:implement` / `ork:brainstorm` runs so an overloaded primary degrades to the next model instead of stalling the run. Extends the 2.1.152 fallback note in `references/cc-version-settings.md`.

## Step 5: Configure MCPs (Optional)

All 5 MCPs ship **enabled by default**. Tavily requires an API key; agentation requires a local package install.

| MCP | Purpose | Default | Requires |
|-----|---------|---------|----------|
| context7 | Library documentation | enabled | Nothing |
| memory | Cross-session persistence | enabled | Nothing |
| sequential-thinking | Structured reasoning for subagents | enabled | Nothing |
| tavily | Web search + extraction | enabled | API key (free tier: app.tavily.com) |
| agentation | UI annotation tool | enabled | `npm install agentation-mcp` |

> **Why all enabled?** OrchestKit ships 30+ Sonnet/Haiku subagents. While Opus 4.8 has native extended thinking, Sonnet and Haiku do not — they benefit from sequential-thinking. Tavily and agentation are used by specific agents (see `mcpServers` in agent frontmatter). CC's MCPSearch auto-defers schemas when overhead exceeds 10% of context, so token cost is managed automatically.

> **Background agents:** MCP tools are NOT available in background subagents (hard CC platform limitation). Agents that need MCP tools must run in the foreground.

**Already have these MCPs installed globally?** If Tavily or memory are already in your `~/.claude/mcp.json`, skip enabling them here to avoid duplicate entries. OrchestKit agents will use whichever instance Claude Code resolves first.

**Opt out of claude.ai MCP servers (CC 2.1.63+):** Claude Code may load MCP servers from claude.ai by default. To disable this and only use locally-configured MCPs:

```bash
export ENABLE_CLAUDEAI_MCP_SERVERS=false
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) to persist across sessions. This only affects MCP servers sourced from claude.ai — locally-configured MCPs in `.mcp.json` and `~/.claude/mcp.json` are unaffected.

## Steps 6-9: CC Version-Specific Settings

Load details: `Read("${CLAUDE_SKILL_DIR}/references/cc-version-settings.md")` for full configuration options.

Covers CC 2.1.7 (MCP deferral threshold, effective context window), CC 2.1.20 (task deletion, PR enrichment, agent permissions, monorepo detection, team distribution), CC 2.1.23 (spinner verbs customization), and CC 2.1.79 (turn duration display).

### CC 2.1.119: `prUrlTemplate` (M122)

For enterprise GitLab / GitHub Enterprise / Bitbucket installations with non-standard URL shapes, set `prUrlTemplate` in `~/.claude/settings.json` (or project-level) to override URL construction in `review-pr` / `create-pr` / `fix-issue`:

```json
{
  "prUrlTemplate": "https://gitlab.acme.com/{owner}/{repo}/-/merge_requests/{n}"
}
```

Tokens: `{host}`, `{owner}`, `{repo}`, `{n}`. See `src/skills/chain-patterns/references/pr-from-platform.md` for the full host-family table and skill-side branching pattern.

## Step 10: Webhook & Telemetry Configuration

Configure dual-channel telemetry for streaming session data to HQ or your own API.

```python
AskUserQuestion(questions=[{
  "question": "Set up session telemetry?",
  "header": "Telemetry",
  "options": [
    {"label": "Full streaming (Recommended)", "description": "All 18 events stream via native HTTP + enriched summaries"},
    {"label": "Summary only", "description": "SessionEnd and worktree events only (command hooks)"},
    {"label": "Skip", "description": "No telemetry — hooks run locally only"}
  ],
  "multiSelect": false
}])
```

### If "Full streaming"

1. Ask for the webhook URL in plain text — AskUserQuestion needs ≥2 options (CC schema `minItems: 2`) and can't capture a free-form URL, so prompt directly:

   > What is your webhook endpoint URL? Reply with the full URL (e.g., `https://api.example.com/hooks`).

2. Run the HTTP hook generator:
```bash
npm run generate:http-hooks -- <webhook-url> --write
```

3. Save webhookUrl to orchestration config for command hooks:
```bash
# File: .claude/orchestration/config.json
saveConfig({ webhookUrl: "<webhook-url>" })
```

4. Remind the user to set the auth token:
```
Set ORCHESTKIT_HOOK_TOKEN in your environment (never in config files):
  export ORCHESTKIT_HOOK_TOKEN=your-secret

Two channels now active:
  Channel 1 (HTTP):    All 18 events → /cc-event (Bearer auth, zero overhead)
  Channel 2 (Command): SessionEnd → /ingest (HMAC auth, enriched data)
```

### If "Summary only"

Save webhookUrl to config and remind about env var (same as above, skip generator step).

Load `Read("${CLAUDE_SKILL_DIR}/references/http-hooks.md")` for architecture details.

## Step 11: Optional Integrations

Load details: `Read("${CLAUDE_SKILL_DIR}/references/integrations.md")` for full integration setup steps.

Covers Agentation UI annotation tool (npm install, MCP config, component scaffold, CSP updates). All steps are idempotent.

## Step 12: Preview & Save

> **Tip (CC 2.1.69+):** After saving configuration changes, run `/reload-plugins` to activate them without restarting your session.
>
> **Tip (CC 2.1.152+):** If you edited or added **skills** in a skill directory (personal `~/.claude/skills/` or project `.claude/skills/` — not plugin-packaged ones), run `/reload-skills` to re-scan and pick them up in the same session. A `SessionStart` hook can do the same by returning `reloadSkills: true`.

Save to: `~/.claude/plugins/orchestkit/config.json`

```json
{
  "version": "1.0.0",
  "preset": "complete",
  "skills": { "ai_ml": true, "backend": true, ... },
  "agents": { "product": true, "technical": true },
  "hooks": { "safety": true, "productivity": true, ... },
  "mcps": { "context7": false, ... }
}
```

## VSCode: Remote Control (CC 2.1.79+)

VSCode users can run `/remote-control` to bridge their terminal session to `claude.ai/code`. This lets you continue the same session from a browser or phone — useful for monitoring long-running configurations or agent tasks away from your desk.

## Related Skills
- `ork:doctor`: Diagnose configuration issues
## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `references/presets.md` | Preset definitions |
| `references/mcp-config.md` | MCP configuration |
| `references/http-hooks.md` | CC 2.1.63+ observability hooks (Langfuse, Datadog, custom endpoints) |
| `references/cc-version-settings.md` | CC 2.1.7, 2.1.20, 2.1.23, 2.1.79 version-specific settings |
| `references/integrations.md` | Optional third-party integrations (Agentation) |