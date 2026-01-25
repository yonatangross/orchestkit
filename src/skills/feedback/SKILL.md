---
name: feedback
description: Manage the OrchestKit feedback system that learns from your usage. Use when providing feedback, reporting issues, suggesting improvements.
context: inherit
version: 1.2.0
author: OrchestKit
tags: [feedback, learning, patterns, metrics, privacy, analytics, consent]
user-invocable: true
allowedTools: [Read, Write, Edit, Grep, Glob]
---

# Feedback - Manage Learning System

View and manage the OrchestKit feedback system that learns from your usage.

## Overview

- Checking feedback system status
- Pausing/resuming learning
- Resetting learned patterns
- Exporting feedback data
- Managing privacy settings
- Enabling/disabling anonymous analytics sharing
- Viewing privacy policy

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
/feedback privacy            # View privacy policy
/feedback export-analytics   # Export anonymous analytics for review
```

## Subcommands

### status (default)

Show the current feedback system state.

**Output:**
```
Feedback System Status
-----------------------------
Learning: Enabled
Anonymous sharing: Disabled
Data retention: 90 days

Learned Patterns:
- Auto-approves: npm install, npm test, git push (3 commands)
- Code style: async/await preferred, TypeScript strict mode

Agent Performance:
- backend-architect: 94% success (28 spawns) [improving]
- test-generator: 72% success (18 spawns) [declining]

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
Feedback learning paused

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
Feedback learning resumed

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
WARNING: This will clear all learned patterns:

- 5 auto-approve permission rules
- 3 code style preferences
- Agent performance history

Your preferences (enabled, sharing, retention) will be kept.

To confirm, respond with exactly: RESET
To cancel, respond with anything else.
```

**Output (after confirmation):**
```
Feedback data reset

- Cleared 5 permission patterns
- Cleared 3 style preferences
- Cleared agent metrics

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
Exported feedback data to:
   .claude/feedback/export-2026-01-14.json

Contains:
- 5 learned permission patterns
- 3 code style preferences
- 8 skill usage metrics
- 4 agent performance records

File size: 12 KB
```

### settings

Show current settings with option to change.

**Output:**
```
Feedback Settings
-----------------------------
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

### opt-in

Enable anonymous analytics sharing. Records GDPR-compliant consent.

**Action:**
1. Record consent in consent-log.json with timestamp and policy version
2. Set shareAnonymized = true in preferences
3. Confirm to user

**Output:**
```
Anonymous analytics sharing enabled.

What we share (anonymized):
  - Skill usage counts and success rates
  - Agent performance metrics
  - Hook trigger counts

What we NEVER share:
  - Your code or file contents
  - Project names or paths
  - Personal information
  - mem0 memory data

Disable anytime: /feedback opt-out
```

### opt-out

Disable anonymous analytics sharing. Revokes consent.

**Action:**
1. Record revocation in consent-log.json with timestamp
2. Set shareAnonymized = false in preferences
3. Confirm to user

**Output:**
```
Anonymous analytics sharing disabled.

Your feedback data stays completely local.
No usage data is shared.

Re-enable anytime: /feedback opt-in
```

### privacy

Display the full privacy policy for anonymous analytics.

**Action:**
1. Display comprehensive privacy documentation
2. Show what's collected, what's never collected
3. Explain data protection measures

**Output:**
```
═══════════════════════════════════════════════════════════════════
              ORCHESTKIT ANONYMOUS ANALYTICS PRIVACY POLICY
═══════════════════════════════════════════════════════════════════

WHAT WE COLLECT (only with your consent)
────────────────────────────────────────────────────────────────────

  ✓ Skill usage counts        - e.g., "api-design used 45 times"
  ✓ Skill success rates       - e.g., "92% success rate"
  ✓ Agent spawn counts        - e.g., "backend-architect spawned 8 times"
  ✓ Agent success rates       - e.g., "88% tasks completed successfully"
  ✓ Hook trigger counts       - e.g., "git-branch-protection triggered 120 times"
  ✓ Hook block counts         - e.g., "blocked 5 potentially unsafe commands"
  ✓ Plugin version            - e.g., "4.12.0"
  ✓ Report date               - e.g., "2026-01-14" (date only, no time)


WHAT WE NEVER COLLECT
────────────────────────────────────────────────────────────────────

  ✗ Your code or file contents
  ✗ Project names, paths, or directory structure
  ✗ User names, emails, or any personal information
  ✗ IP addresses (stripped at network layer)
  ✗ mem0 memory data or conversation history
  ✗ Architecture decisions or design documents
  ✗ API keys, tokens, or credentials
  ✗ Git history or commit messages
  ✗ Any data that could identify you or your projects


YOUR RIGHTS
────────────────────────────────────────────────────────────────────

  • Opt-out anytime:     /feedback opt-out
  • View your data:      /feedback export-analytics
  • Check status:        /feedback status
  • View this policy:    /feedback privacy
```

### export-analytics

Export anonymous analytics data to a file for review before sharing.

**Usage:**
```
/feedback export-analytics [path]
```

If no path is provided, exports to `.claude/feedback/analytics-exports/` with a timestamp.

**Output:**
```
Analytics exported to: .claude/feedback/analytics-exports/analytics-export-20260114-120000.json

Contents preview:
-----------------
Date: 2026-01-14
Plugin Version: 4.12.0

Summary:
  Skills used: 8
  Skill invocations: 45
  Agents used: 3
  Agent spawns: 12
  Hooks configured: 5

Please review the exported file before sharing.
```

**Export Format:**
```json
{
  "timestamp": "2026-01-14",
  "plugin_version": "4.12.0",
  "skill_usage": {
    "api-design-framework": { "uses": 12, "success_rate": 0.92 }
  },
  "agent_performance": {
    "backend-system-architect": { "spawns": 8, "success_rate": 0.88 }
  },
  "hook_metrics": {
    "git-branch-protection": { "triggered": 45, "blocked": 3 }
  },
  "summary": {
    "unique_skills_used": 8,
    "unique_agents_used": 3,
    "hooks_configured": 5,
    "total_skill_invocations": 45,
    "total_agent_spawns": 12
  },
  "metadata": {
    "exported_at": "2026-01-14T12:00:00Z",
    "format_version": "1.0",
    "note": "Review before sharing"
  }
}
```

## What We Share (When Opted In)

Anonymous analytics include only aggregated, non-identifiable data:

| Data Type | What's Included | What's NOT Included |
|-----------|-----------------|---------------------|
| Skills | Usage counts, success rates | File paths, code content |
| Agents | Spawn counts, success rates | Project names, decisions |
| Hooks | Trigger/block counts | Command content, paths |

## What We NEVER Share

The following are **blocked by design** and never included in analytics:

- Project names, paths, or directory structure
- File contents, code, or diffs
- Decision content or context
- User identity, email, or credentials
- mem0 memory data
- URLs, IP addresses, or hostnames
- Any strings that could identify the project or user

## Consent Management

Consent is managed per GDPR requirements:

1. **Explicit opt-in required** - No data shared until you actively consent
2. **Audit trail** - All consent actions logged in `consent-log.json`
3. **Easy revocation** - Opt-out is as easy as opt-in
4. **Version tracking** - Consent version tracked for policy changes

## Security Note

The following commands are NEVER auto-approved regardless of learning:
- `rm -rf`, `sudo`, `chmod 777`
- Commands with `--force` or `--no-verify`
- Commands involving passwords, secrets, or credentials


## Related Skills
- skill-evolution: Evolve skills based on feedback
## File Locations

See `references/file-locations.md` for storage details.

### Analytics & Consent Files

```
.claude/feedback/
├── preferences.json           # User preferences including shareAnonymized
├── consent-log.json          # GDPR consent audit trail (opt-in/opt-out history)
├── metrics.json              # Source data for analytics
└── analytics-exports/        # Exported analytics for review
    └── analytics-export-*.json
```

### Privacy Policy

See `references/privacy-policy.md` for full privacy documentation.