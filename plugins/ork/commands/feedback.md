---
description: "Manages OrchestKit feedback system. Use when providing feedback or viewing usage analytics."
allowed-tools: [Read, Write, Edit, Grep, Glob]
---

# Auto-generated from skills/feedback/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


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

| Subcommand | Description |
|------------|-------------|
| `status` (default) | Show current feedback system state, learned patterns, agent performance |
| `pause` | Temporarily pause learning without clearing data |
| `resume` | Resume paused learning |
| `reset` | Clear all learned patterns (requires "RESET" confirmation) |
| `export` | Export all feedback data to `.claude/feedback/export-{date}.json` |
| `settings` | Show/edit settings (usage: `/feedback settings <key> <value>`) |
| `opt-in` | Enable anonymous analytics sharing (GDPR-compliant consent) |
| `opt-out` | Disable anonymous analytics sharing (revokes consent) |
| `privacy` | Display the full privacy policy |
| `export-analytics` | Export anonymous analytics to file for review before sharing |

**Output:** Each subcommand displays formatted status, confirmation prompts, or exported file paths. See [Subcommand Reference](references/subcommand-reference.md) for detailed actions and expected output for each subcommand.

## Consent and Security

See [Consent and Security Rules](rules/consent-and-security.md) for GDPR consent management, security restrictions, and analytics data sharing policies.

## Related Skills

- skill-evolution: Evolve skills based on feedback

## File Locations

See [File Locations](references/file-locations.md) for storage details.

See [Privacy Policy](references/privacy-policy.md) for full privacy documentation.
