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
