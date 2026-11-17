# Calling prompt-focus from Claude Code

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" report
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" daily
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" demo ~/Desktop/prompt-focus-demo.html
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" selftest
```

Open the page for the user: `open ~/.claude/prompt-focus/report.html` (macOS) or `xdg-open` (Linux).

A daily row from cron, 04:20 local time:

```text
20 4 * * * mkdir -p ~/.claude/prompt-focus && python3 /path/to/skills/prompt-focus/scripts/prompt_focus.py daily >> ~/.claude/prompt-focus/daily.log 2>&1
```
