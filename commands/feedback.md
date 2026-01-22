---
description: Manage the OrchestKit feedback system that learns from your usage
allowed-tools: Read, Edit, Write, Bash, AskUserQuestion
---

# Feedback System Manager

Load and follow the skill instructions from the `skills/feedback/SKILL.md` file.

Execute the `/ork:feedback` workflow to manage the learning system:
- `status` - Show current feedback system state
- `pause` - Temporarily pause learning
- `resume` - Resume paused learning
- `reset` - Clear all learned patterns (requires confirmation)
- `export` - Export feedback data to JSON
- `settings` - Show/edit settings
- `opt-in` - Enable anonymous analytics sharing
- `opt-out` - Disable anonymous analytics sharing
- `privacy` - View privacy policy
- `export-analytics` - Export anonymous analytics for review

## Arguments
- Subcommand: One of the commands above (default: status)
