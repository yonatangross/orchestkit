# Phase 3: Safety Check

Use `AskUserQuestion` to confirm installation scope:

```python
AskUserQuestion(questions=[{
  "question": "How should OrchestKit be installed?",
  "header": "Install scope",
  "options": [
    {"label": "User-only (Recommended)", "description": "Plugin loads only for you. Invisible to teammates. Safe for enterprise.", "markdown": "```\nUser-Only Install\n─────────────────\n~/.claude/\n  └── plugins/\n        └── ork/    ← only YOU see this\n\nTeammates: unaffected\nGit:       nothing committed\nEnterprise: safe, no repo changes\n```"},
    {"label": "Project-wide", "description": "Adds to .claude/plugins — loads for everyone in this repo.", "markdown": "```\nProject-Wide Install\n────────────────────\nyour-repo/\n  └── .claude/\n        └── plugins/\n              └── ork/  ← everyone sees this\n\nTeammates: auto-loaded for all\nGit:       committed to repo\nRequires:  team buy-in\n```"},
    {"label": "Already installed", "description": "Skip installation, just configure.", "markdown": "```\nSkip to Configure\n─────────────────\n✓ Plugin already installed\n→ Jump to Phase 4: Skill recommendations\n→ Then Phase 5: MCP setup\n→ Then Phase 6: Readiness score\n```"}
  ],
  "multiSelect": false
}])
```

## Conflict Detection

Check for existing OrchestKit installs or conflicting plugins:

```python
Grep(pattern="ork", path="~/.claude/settings.json", output_mode="content")
Glob(pattern="~/.claude/plugins/ork*")
```

Report: "No conflicts detected" or "Found existing ork install — version {version}."
