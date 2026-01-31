---
name: slack-integration
description: Slack MCP server integration patterns. Use when setting up team notifications, PR alerts, or CI status updates via Slack bot token
context: fork
version: 1.0.0
author: OrchestKit
tags: [slack, notification, team, mcp, integration]
user-invocable: false
---

# Slack Integration

## Overview

Integrate Slack notifications into your Claude Code workflow using the Slack MCP server. Receive team notifications for PR lifecycle events, review completions, and CI status.

## Configuration

### Slack MCP Server Setup

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_CHANNEL": "#dev-notifications"
      }
    }
  }
}
```

### Required Bot Permissions

- `chat:write` - Post messages
- `channels:read` - List channels
- `reactions:write` - Add reactions

## PR Lifecycle Notifications

| Event | Message | When |
|-------|---------|------|
| PR Created | "PR #123 opened: Title" | After `create-pr` |
| Review Complete | "PR #123 reviewed: APPROVED" | After `review-pr` |
| PR Merged | "PR #123 merged to main" | After merge |
| CI Failed | "CI failed on PR #123" | On check failure |

## Integration with CC 2.1.20

CC 2.1.20's `/commit-push-pr` flow can auto-post to Slack:

1. Commit changes
2. Push branch
3. Create PR
4. Post Slack notification with PR link

## Usage Patterns

### Post-Review Notification

After completing a PR review:

```
mcp__slack__post_message({
  channel: "#dev-reviews",
  text: "PR #123 reviewed: APPROVED - 0 blockers, 2 suggestions"
})
```

### Post-Create Notification

After creating a PR:

```
mcp__slack__post_message({
  channel: "#dev-prs",
  text: "New PR: #123 - feat: Add user auth | 5 files, +200/-50"
})
```

## Related Skills

- `review-pr` - PR review with optional Slack notification
- `create-pr` - PR creation with optional Slack notification
- `release-management` - Release announcements
