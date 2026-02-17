---
name: configure
license: MIT
compatibility: "Claude Code 2.1.34+."
description: "Configures OrchestKit settings. Use when customizing MCP servers, plugin options, or preferences."
argument-hint: "[preset-name]"
context: inherit
version: 1.0.0
author: OrchestKit
tags: [configuration, setup, wizard, customization]
user-invocable: true
allowed-tools: [Bash, Read, Grep, Glob]
complexity: low
metadata:
  category: workflow-automation
---

# OrchestKit Configuration

Interactive setup for customizing your OrchestKit installation.

## Quick Start

```bash
/configure
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

**Product Agents (6):**
- market-intelligence
- product-strategist
- requirements-translator
- ux-researcher
- prioritization-analyst
- business-case-builder

**Technical Agents (14):**
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
- metrics-architect
- rapid-ui-designer
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

## Step 5: Configure MCPs (Optional)

All MCPs disabled by default. Enable selectively:

| MCP | Purpose |
|-----|---------|
| context7 | Library documentation |
| sequential-thinking | Complex reasoning |
| memory | Cross-session persistence |
| playwright | Browser automation |

## Step 6: CC 2.1.7 Settings (New)

Configure CC 2.1.7-specific features:

### Turn Duration Display

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

## Step 9: Optional Integrations

Use AskUserQuestion to offer optional third-party integrations:

### Agentation (UI Annotation Tool)

```
Enable Agentation UI annotation tool? [y/N]: y
```

[Agentation](https://agentation.dev) lets you annotate your app's UI in the browser and have Claude pick up the feedback automatically.

**When enabled, perform these steps (idempotent — skip any step already done):**

1. **Install dependencies** (check `package.json` first):
   ```bash
   npm install -D agentation agentation-mcp
   ```

2. **Add MCP server to `.mcp.json`** (skip if `agentation` key already exists):
   ```json
   {
     "mcpServers": {
       "agentation": {
         "command": "npx",
         "args": ["-y", "agentation-mcp", "server"],
         "disabled": false
       }
     }
   }
   ```

3. **Enable MCP server in Claude Code settings** — add `"agentation"` to the `enabledMcpjsonServers` array in `.claude/settings.local.json` (create file if missing, skip if already listed):
   ```json
   {
     "enabledMcpjsonServers": ["agentation"]
   }
   ```

4. **Scaffold wrapper component** — create a dev-only client component (skip if file already exists). Use the project's component directory (e.g. `src/components/`, `components/`, or `app/components/`):
   ```tsx
   // agentation-wrapper.tsx
   "use client";

   import { Agentation } from "agentation";

   export function AgentationWrapper() {
     if (process.env.NODE_ENV !== "development") return null;
     return <Agentation endpoint="http://localhost:4747" webhookUrl="http://localhost:4747" />;
   }
   ```
   Then instruct the user to add `<AgentationWrapper />` to their root layout.

5. **CSP update** (only if the project has a Content-Security-Policy): add `http://localhost:4747` to the `connect-src` directive for development mode only.

## Step 10: Preview & Save

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
- doctor: Diagnose configuration issues
## References

- [Presets](references/presets.md)
- [MCP Configuration](references/mcp-config.md)