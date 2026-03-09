# CC Version-Specific Settings

## Step 6: CC 2.1.7 Settings

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
