---
name: feedback
description: Manage the SkillForge feedback system that learns from your usage
context: inherit
version: 1.0.0
author: SkillForge
tags: [feedback, learning, patterns, metrics, privacy]
---

# Feedback - Manage Learning System

View and manage the SkillForge feedback system that learns from your usage.

## When to Use

- Checking feedback system status
- Pausing/resuming learning
- Resetting learned patterns
- Exporting feedback data
- Managing privacy settings

## Usage

```
/feedback                    # Same as status
/feedback status             # Show current state
/feedback pause              # Pause learning
/feedback resume             # Resume learning
/feedback reset              # Clear learned patterns
/feedback export             # Export feedback data
/feedback settings           # Show/edit settings
/feedback opt-in             # Enable anonymous sharing
/feedback opt-out            # Disable anonymous sharing
```

## Subcommands

### status (default)

Show the current feedback system state.

**Output:**
```
📊 Feedback System Status
────────────────────────────
Learning: Enabled
Anonymous sharing: Disabled
Data retention: 90 days

Learned Patterns:
• Auto-approves: npm install, npm test, git push (3 commands)
• Code style: async/await preferred, TypeScript strict mode

Agent Performance:
• backend-architect: 94% success (28 spawns) ↑
• test-generator: 72% success (18 spawns) ↓

Context Savings: ~8k tokens/session (estimated)

Storage: .claude/feedback/ (45 KB)
```

### pause

Temporarily pause all learning without clearing data.

**Action:**
1. Set `pausedUntil` in preferences to a far future date
2. Confirm to user

**Output:**
```
⏸️ Feedback learning paused

Your existing patterns are preserved.
Resume with: /feedback resume
```

### resume

Resume paused learning.

**Action:**
1. Clear `pausedUntil` in preferences
2. Confirm to user

**Output:**
```
▶️ Feedback learning resumed

The system will continue learning from your usage.
```

### reset

Clear all learned patterns (requires confirmation).

**Action:**
1. Show what will be deleted
2. Ask for confirmation (user must type "RESET")
3. If confirmed, clear patterns file but keep preferences

**Output (before confirmation):**
```
⚠️ This will clear all learned patterns:

• 5 auto-approve permission rules
• 3 code style preferences
• Agent performance history

Your preferences (enabled, sharing, retention) will be kept.

To confirm, respond with exactly: RESET
To cancel, respond with anything else.
```

**Output (after confirmation):**
```
✓ Feedback data reset

• Cleared 5 permission patterns
• Cleared 3 style preferences
• Cleared agent metrics

Learning will start fresh from now.
```

### export

Export all feedback data to a JSON file.

**Action:**
1. Read all feedback files
2. Combine into single export
3. Write to `.claude/feedback/export-{date}.json`

**Output:**
```
📦 Exported feedback data to:
   .claude/feedback/export-2026-01-14.json

Contains:
• 5 learned permission patterns
• 3 code style preferences
• 8 skill usage metrics
• 4 agent performance records

File size: 12 KB
```

### settings

Show current settings with option to change.

**Output:**
```
⚙️ Feedback Settings
────────────────────────────
enabled:              true   (master switch)
learnFromEdits:       true   (learn from code edits)
learnFromApprovals:   true   (learn from permissions)
learnFromAgentOutcomes: true (track agent success)
shareAnonymized:      false  (share anonymous stats)
retentionDays:        90     (data retention period)

To change a setting, use:
  /feedback settings <key> <value>

Example:
  /feedback settings retentionDays 30
```

### opt-in / opt-out

Enable or disable anonymous analytics sharing.

**opt-in Output:**
```
📊 Anonymous Analytics Enabled

What we share (anonymized):
• Skill usage counts and success rates
• Agent performance metrics
• Hook trigger counts

What we NEVER share:
• Your code or file contents
• Project names or paths
• Personal information

Disable anytime: /feedback opt-out
```

**opt-out Output:**
```
🔒 Anonymous Analytics Disabled

Your feedback data stays completely local.
No usage data is shared.

Re-enable anytime: /feedback opt-in
```

## Security Note

The following commands are NEVER auto-approved regardless of learning:
- `rm -rf`, `sudo`, `chmod 777`
- Commands with `--force` or `--no-verify`
- Commands involving passwords, secrets, or credentials

## File Locations

See `references/file-locations.md` for storage details.