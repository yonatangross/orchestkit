---
description: "Configures OrchestKit plugin settings, MCP servers, hook permissions, and keybindings. Use when customizing plugin behavior or managing settings."
allowed-tools: [Bash, Read, Grep, Glob]
---

# Auto-generated from skills/configure/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# OrchestKit Configuration

Interactive setup for customizing your OrchestKit installation.

## Quick Start

```bash
/ork:configure
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
- `ork:doctor`: Diagnose configuration issues
## References

- [Presets](references/presets.md)
- [MCP Configuration](references/mcp-config.md)
- [HTTP Hooks](references/http-hooks.md) — CC 2.1.63+ observability hooks (Langfuse, Datadog, custom endpoints)
