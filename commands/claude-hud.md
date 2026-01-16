---
description: Configure Claude Code statusline with context window monitoring
allowed-tools: Read, Edit, Write, AskUserQuestion
---

# Claude HUD - Status Line Configuration

Load and follow the skill instructions from the `skills/claude-hud/SKILL.md` file.

Configure Claude Code's statusline to display:
- Context window usage percentage
- Session cost tracking
- Turn duration (CC 2.1.7)
- Effective context window metrics

## Visual States
- GREEN (< 60%): Normal operation
- YELLOW (60-80%): Watch usage
- ORANGE (80-95%): Consider compacting
- RED (> 95%): COMPACT NOW

## Arguments
- No arguments: Show configuration options and current status
