# Phase 3.5: Project Configuration Wizard

> Also reachable directly via `/ork:setup --configure` — skips phases 1-3.

This phase walks users through every configurable OrchestKit behaviour and writes the result to the correct project settings file. When running the full wizard, show this phase AFTER the safety/install check. When running `--configure` alone, start here.

## Step 0: Detect config target and read current settings

The write target depends on the project type:

- **Developing OrchestKit itself** (`src/settings/ork.settings.json` exists): write to `src/settings/ork.settings.json` — this is the plugin's global defaults file.
- **Any other project** (your app, client repos, etc.): write to `.claude/settings.json` — this is per-project CC settings that override plugin defaults without touching global config.

```python
# Detect config target
is_orchestkit_dev = len(Glob(pattern="src/settings/ork.settings.json")) > 0

if is_orchestkit_dev:
    config_target = "src/settings/ork.settings.json"
    existing_settings = Read(file_path="src/settings/ork.settings.json") or {}
else:
    config_target = ".claude/settings.json"
    existing_settings = Read(file_path=".claude/settings.json") or {}

# Extract current env block if present
current_env = existing_settings.get("env", {})
```

Show the user what's already set so they aren't surprised by overwrites.

## Step 1: Branch Strategy

```python
AskUserQuestion(questions=[{
  "question": "Which branches should block direct commits and pushes?",
  "header": "Protected branches",
  "options": [
    {
      "label": "main, master (Recommended)",
      "description": "Standard Git Flow defaults. Feature work goes on branches.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main,master\n\nBlocked:  git commit on main/master\n          git push to main/master\nAllowed:  feature/, fix/, issue/ branches\n```"
    },
    {
      "label": "main, master, dev",
      "description": "Adds dev as a protected integration branch.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main,master,dev\n\nBlocked:  git commit on main/master/dev\nAllowed:  feature/, fix/, issue/ branches\nBest for: teams with a long-lived dev branch\n```"
    },
    {
      "label": "main only",
      "description": "Minimal protection — only main is locked.",
      "markdown": "```\nORCHESTKIT_PROTECTED_BRANCHES=main\n\nBlocked:  git commit on main\nAllowed:  master, dev, feature/ branches\nBest for: simple solo projects\n```"
    },
    {
      "label": "Custom",
      "description": "I'll specify my own comma-separated branch list."
    }
  ],
  "multiSelect": false
}])
```

If **Custom** selected: ask for the comma-separated list inline.

Generated env var: `ORCHESTKIT_PROTECTED_BRANCHES=<value>`

## Step 2: Commit Format Enforcement

```python
AskUserQuestion(questions=[{
  "question": "How strictly should commit message format be enforced?",
  "header": "Commit scope",
  "options": [
    {
      "label": "Optional scope (Recommended)",
      "description": "Both `feat: msg` and `feat(scope): msg` are valid.",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=optional\n\nValid:    feat: Add login\n          feat(auth): Add login\n          fix(#123): Resolve crash\nBlocked:  bad commit message\n```"
    },
    {
      "label": "Required scope",
      "description": "Every commit must include a scope: `type(scope): msg`",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=required\n\nValid:    feat(auth): Add login\n          fix(#123): Resolve crash\nBlocked:  feat: Add login  ← no scope!\nBest for: large teams, monorepos\n```"
    },
    {
      "label": "Scope disabled",
      "description": "Only type+colon required. Scopes ignored in validation.",
      "markdown": "```\nORCHESTKIT_COMMIT_SCOPE=none\n\nValid:    feat: Anything\n          fix: Short message\nBlocked:  bad commit message (no type)\nBest for: solo projects, quick iteration\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_COMMIT_SCOPE=<value>`

## Step 3: Local Dev Browser Access

```python
AskUserQuestion(questions=[{
  "question": "Should agents be allowed to browse *.localhost URLs (e.g. hq-web.localhost:1355)?",
  "header": "Localhost browser",
  "options": [
    {
      "label": "Yes, allow *.localhost (Recommended)",
      "description": "RFC 6761 reserved TLD — cannot route to external hosts. Enables visual verification of local dev servers.",
      "markdown": "```\nORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=1\n\nAllowed:  hq-web.localhost:1355\n          app.localhost:3000\nBlocked:  localhost (bare, no subdomain)\n          127.0.0.1\nSafe:     *.localhost can't reach internet\n```"
    },
    {
      "label": "No, block all localhost",
      "description": "Stricter mode — blocks *.localhost AND bare localhost. Use for enterprise/sandboxed environments.",
      "markdown": "```\nORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=0\n\nBlocked:  all localhost variants\n          hq-web.localhost (even subdomains)\nBest for: enterprise, air-gapped, or\n          regulated environments\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=<value>`

## Step 4: Performance Telemetry

```python
AskUserQuestion(questions=[{
  "question": "Should OrchestKit write a token-usage snapshot at session end?",
  "header": "Perf snapshot",
  "options": [
    {
      "label": "Yes, enable perf snapshots (Recommended)",
      "description": "Writes ~/.claude/perf/snap-YYYY-MM-DD-HH.json. Used by /ork:assess and perf-compare.sh.",
      "markdown": "```\nORCHESTKIT_PERF_SNAPSHOT_ENABLED=1\n\nWrites:   ~/.claude/perf/snap-<bucket>.json\nContains: total tokens, top hooks, by-category\nUsed by:  scripts/perf-compare.sh (before/after)\n          /ork:assess (performance dimension)\n```"
    },
    {
      "label": "No, disable perf snapshots",
      "description": "Skip writing snapshot files. Useful in CI or shared environments.",
      "markdown": "```\nORCHESTKIT_PERF_SNAPSHOT_ENABLED=0\n\nNo files written at session end.\nBest for: CI pipelines, shared accounts,\n          disk-constrained environments\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_PERF_SNAPSHOT_ENABLED=<value>`

## Step 5: Log Verbosity

```python
AskUserQuestion(questions=[{
  "question": "What log level should OrchestKit hooks use?",
  "header": "Log level",
  "options": [
    {
      "label": "warn — quiet (Recommended)",
      "description": "Only warnings and errors. Minimal noise.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=warn\n\nShows:   Warnings, errors\nHides:   Debug traces, info messages\nBest for: daily use, production\n```"
    },
    {
      "label": "info — moderate",
      "description": "Key events logged. Good for onboarding.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=info\n\nShows:   Warnings, errors, key events\nHides:   Debug traces\nBest for: onboarding, monitoring behaviour\n```"
    },
    {
      "label": "debug — verbose",
      "description": "Full trace of every hook decision.",
      "markdown": "```\nORCHESTKIT_LOG_LEVEL=debug\n\nShows:   Everything\nBest for: troubleshooting, bug reports\nNote:    Use /ork:doctor for health checks\n```"
    }
  ],
  "multiSelect": false
}])
```

Generated env var: `ORCHESTKIT_LOG_LEVEL=<value>`

## Step 6: Webhook Telemetry (HTTP Hooks)

```python
AskUserQuestion(questions=[{
  "question": "Send CC hook events to an external API for observability (Langfuse traces, metrics)?",
  "header": "Webhook telemetry",
  "options": [
    {
      "label": "Yes, enable webhooks",
      "description": "Runs `generate-http-hooks` to write native CC HTTP hooks to settings.local.json.",
      "markdown": "```\nWebhook Telemetry\n-----------------\nWrites: .claude/settings.local.json\nEvents: All 19 CC hook types\nAuth:   Bearer $ORCHESTKIT_HOOK_TOKEN\n\nRequires:\n  1. A webhook URL (e.g. https://api.example.com/api/hooks)\n  2. ORCHESTKIT_HOOK_TOKEN env var set in your shell\n\nData sent: event type, session_id, tool_name,\n           cwd, model, timestamps\nNo secrets or file contents are sent.\n```"
    },
    {
      "label": "No, skip webhooks (Recommended for most users)",
      "description": "No HTTP hooks. All hook processing stays local.",
      "markdown": "```\nNo Webhook Telemetry\n--------------------\nHooks run locally only (command hooks).\nNo data sent to external APIs.\nDefault and recommended for most users.\n```"
    }
  ],
  "multiSelect": false
}])
```

If **Yes** selected, ask for the webhook URL:

```python
AskUserQuestion(questions=[{
  "question": "Webhook base URL (the API that receives CC hook events):",
  "header": "Webhook URL",
  "options": [
    {
      "label": "https://hq.yonatangross.com/api/hooks",
      "description": "Yonatan HQ production API"
    },
    {
      "label": "http://hq-api.localhost:1355/api/hooks",
      "description": "Local dev API (Portless)"
    },
    {
      "label": "Custom URL",
      "description": "I'll provide my own webhook endpoint"
    }
  ],
  "multiSelect": false
}])
```

Then run the generator:

```python
Bash(command=f"npx tsx ${{CLAUDE_PLUGIN_ROOT}}/hooks/../src/hooks/src/cli/generate-http-hooks.ts {webhook_url} --write")
```

This writes 19 HTTP hook entries to `.claude/settings.local.json`. The hooks use `Bearer $ORCHESTKIT_HOOK_TOKEN` — the user must set this env var in their shell (e.g. `.zshrc`).

Remind the user:
```
Webhook hooks written to .claude/settings.local.json
Set ORCHESTKIT_HOOK_TOKEN in your shell:
  export ORCHESTKIT_HOOK_TOKEN="your-token-here"
```

## Writing the Configuration

After all 6 steps, write (or merge) the env block into `config_target` (set in Step 0):

```python
# Merge new env values (preserving existing keys not in wizard scope)
new_env = {
  **current_env,  # preserve all keys we didn't ask about (e.g. ENABLE_TOOL_SEARCH)
  "ORCHESTKIT_PROTECTED_BRANCHES": <from step 1>,
  "ORCHESTKIT_COMMIT_SCOPE": <from step 2>,
  "ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST": <from step 3>,
  "ORCHESTKIT_PERF_SNAPSHOT_ENABLED": <from step 4>,
  "ORCHESTKIT_LOG_LEVEL": <from step 5>,
}
updated_settings = {**existing_settings, "env": new_env}

Write(file_path=config_target, content=json.dumps(updated_settings, indent=2))
```

> **Note on per-project vs global:** Writing to `.claude/settings.json` overrides the plugin defaults for THIS project only — other projects remain unaffected. Writing to `src/settings/ork.settings.json` changes the global defaults shipped with the plugin itself. Only do that when developing OrchestKit.

## Configuration Summary

After writing, present a confirmation table (use `config_target` in the header):

```
OrchestKit Configuration Written → .claude/settings.json
──────────────────────────────────────────────────────────
  Protected branches    main,master
  Commit scope          optional
  Localhost browser     allowed (RFC 6761)
  Perf snapshot         enabled
  Log level             warn

Settings are in effect immediately for this project.
Other projects using ork are unaffected.
To reconfigure: /ork:setup --configure
To see full readiness: /ork:setup --score-only
```

## Env Var Quick Reference

| Env Var | Default | Values | Effect |
|---------|---------|--------|--------|
| `ORCHESTKIT_PROTECTED_BRANCHES` | `main,master` | comma-separated branches | Blocks direct commits/pushes |
| `ORCHESTKIT_COMMIT_SCOPE` | `optional` | `optional` \| `required` \| `none` | Commit message scope enforcement |
| `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST` | `1` | `1` \| `0` | Allow `*.localhost` browser access |
| `ORCHESTKIT_PERF_SNAPSHOT_ENABLED` | `1` | `1` \| `0` | Write session token snapshots |
| `ORCHESTKIT_LOG_LEVEL` | `warn` | `debug` \| `info` \| `warn` \| `error` | Hook log verbosity |
| `ORCHESTKIT_HOOK_TOKEN` | (unset) | Bearer token string | Auth for webhook HTTP hooks |
| `ENABLE_TOOL_SEARCH` | `auto:5` | `auto:N` \| `off` | MCP tool discovery limit |
