---
name: configure
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Configures OrchestKit plugin settings, MCP servers, hook permissions, and keybindings. Use when customizing plugin behavior or managing settings."
argument-hint: "[preset-name]"
context: inherit
version: 1.0.0
author: OrchestKit
tags: [configuration, setup, wizard, customization]
user-invocable: true
disable-model-invocation: true
allowed-tools: [Bash, Read, Grep, Glob]
complexity: low
model: haiku
metadata:
  category: workflow-automation
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
| **Complete** | 78 | 20 | 92 | Everything |
| **Standard** | 78 | 0 | 92 | Skills, no agents |
| **Lite** | 10 | 0 | 92 | Essential only |
| **Hooks-only** | 0 | 0 | 92 | Just safety |
| **Monorepo** | 78 | 20 | 92 | Complete + monorepo detection |

## Step 2: Customize Skill Categories

Categories available:
- AI/ML (26 skills)
- Backend (15 skills)
- Frontend (8 skills)
- Testing (13 skills)
- Security (7 skills)
- DevOps (4 skills)
- Planning (6 skills)

## Step 3: Customize Agents

**Product Agents (2):**
- market-intelligence
- product-strategist

**Technical Agents (12):**
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

## Step 5: Configure MCPs (Optional)

All 5 MCPs ship **enabled by default**. Tavily requires an API key; agentation requires a local package install.

| MCP | Purpose | Default | Requires |
|-----|---------|---------|----------|
| context7 | Library documentation | enabled | Nothing |
| memory | Cross-session persistence | enabled | Nothing |
| sequential-thinking | Structured reasoning for subagents | enabled | Nothing |
| tavily | Web search + extraction | enabled | API key (free tier: app.tavily.com) |
| agentation | UI annotation tool | enabled | `npm install agentation-mcp` |

> **Why all enabled?** OrchestKit ships 30+ Sonnet/Haiku subagents. While Opus 4.6 has native extended thinking, Sonnet and Haiku do not — they benefit from sequential-thinking. Tavily and agentation are used by specific agents (see `mcpServers` in agent frontmatter). CC's MCPSearch auto-defers schemas when overhead exceeds 10% of context, so token cost is managed automatically.

> **Background agents:** MCP tools are NOT available in background subagents (hard CC platform limitation). Agents that need MCP tools must run in the foreground.

**Already have these MCPs installed globally?** If Tavily or memory are already in your `~/.claude/mcp.json`, skip enabling them here to avoid duplicate entries. OrchestKit agents will use whichever instance Claude Code resolves first.

**Opt out of claude.ai MCP servers (CC 2.1.63+):** Claude Code may load MCP servers from claude.ai by default. To disable this and only use locally-configured MCPs:

```bash
export ENABLE_CLAUDEAI_MCP_SERVERS=false
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) to persist across sessions. This only affects MCP servers sourced from claude.ai — locally-configured MCPs in `.mcp.json` and `~/.claude/mcp.json` are unaffected.

## Steps 6-8: CC Version-Specific Settings

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/configure/references/cc-version-settings.md")` for full configuration options.

Covers CC 2.1.7 (turn duration, MCP deferral threshold, effective context window), CC 2.1.20 (task deletion, PR enrichment, agent permissions, monorepo detection, team distribution), and CC 2.1.23 (spinner verbs customization).

## Step 9: Webhook & Telemetry Configuration

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

1. Ask for webhook URL:
```python
AskUserQuestion(questions=[{
  "question": "What is your webhook endpoint URL?",
  "header": "Webhook URL",
  "options": [
    {"label": "Custom URL", "description": "Enter your API endpoint (e.g., https://api.example.com/hooks)"}
  ],
  "multiSelect": false
}])
```

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

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/configure/references/http-hooks.md")` for architecture details.

## Step 10: Optional Integrations

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/configure/references/integrations.md")` for full integration setup steps.

Covers Agentation UI annotation tool (npm install, MCP config, component scaffold, CSP updates). All steps are idempotent.

## Step 11: Preview & Save

> **Tip (CC 2.1.69+):** After saving configuration changes, run `/reload-plugins` to activate them without restarting your session.

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

## Related Skills
- `ork:doctor`: Diagnose configuration issues
## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/configure/references/<file>")`:
| File | Content |
|------|---------|
| `references/presets.md` | Preset definitions |
| `references/mcp-config.md` | MCP configuration |
| `references/http-hooks.md` | CC 2.1.63+ observability hooks (Langfuse, Datadog, custom endpoints) |
| `references/cc-version-settings.md` | CC 2.1.7, 2.1.20, 2.1.23 version-specific settings |
| `references/integrations.md` | Optional third-party integrations (Agentation) |