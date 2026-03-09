# Phase 8: Keybindings

Check for existing keybindings and offer to install recommended shortcuts:

```python
# Check existing keybindings
Bash(command="cat ~/.claude/keybindings.json 2>/dev/null || echo '[]'")
```

Prompt the user:

```python
AskUserQuestion(questions=[{
  "question": "Install recommended keybindings for top OrchestKit skills?",
  "header": "Keyboard shortcuts",
  "options": [
    {"label": "Yes, install keybindings (Recommended)", "description": "Adds 5 shortcuts: commit, verify, implement, explore, review-pr"},
    {"label": "Skip", "description": "No keyboard shortcuts"}
  ],
  "multiSelect": false
}])
```

If **Yes**: write or merge into `~/.claude/keybindings.json`:

```json
[
  {"key": "ctrl+shift+c", "command": "/ork:commit", "description": "Git commit with validation"},
  {"key": "ctrl+shift+v", "command": "/ork:verify", "description": "Run verification suite"},
  {"key": "ctrl+shift+i", "command": "/ork:implement", "description": "Implement feature"},
  {"key": "ctrl+shift+e", "command": "/ork:explore", "description": "Deep codebase exploration"},
  {"key": "ctrl+shift+r", "command": "/ork:review-pr", "description": "Review pull request"}
]
```

If the file already exists, **merge** — read existing entries, add only keybindings whose `key` is not already bound, then write back. Never overwrite user-defined bindings.
