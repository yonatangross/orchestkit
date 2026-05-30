# Phase 3: Safety Check

Use `AskUserQuestion` to confirm installation scope:

```python
AskUserQuestion(questions=[{
  "question": "How should OrchestKit be installed?",
  "header": "Install scope",
  "options": [
    {"label": "User-only (Recommended)", "description": "Plugin loads only for you. Invisible to teammates. Safe for enterprise."},
    {"label": "Project-wide", "description": "Adds to .claude/plugins — loads for everyone in this repo."},
    {"label": "Already installed", "description": "Skip installation, just configure."}
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
