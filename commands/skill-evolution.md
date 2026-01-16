---
description: Analyze, evolve, and rollback skills based on usage patterns
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# Skill Evolution Manager

Load and follow the skill instructions from the `skills/skill-evolution/SKILL.md` file.

Enables skills to improve based on usage patterns, user edits, and success rates.

## Commands
- `/skill-evolution` - Show evolution report for all skills
- `/skill-evolution analyze <skill-id>` - Analyze specific skill patterns
- `/skill-evolution evolve <skill-id>` - Review and apply suggestions
- `/skill-evolution history <skill-id>` - Show version history
- `/skill-evolution rollback <skill-id> <version>` - Restore previous version

## Features
- Edit pattern tracking (pagination, rate limiting, error handling, types)
- Suggestion thresholds (70% to suggest, 85% for auto-apply)
- Version snapshots before changes
- Automatic rollback alerts on success rate drops

## Arguments
- Subcommand: One of the commands above (default: report)
