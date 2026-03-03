# Feedback Subcommand Reference

Detailed actions and expected output for each `/ork:feedback` subcommand.

## status (default)

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

## pause

Temporarily pause all learning without clearing data.

**Action:**
1. Set `pausedUntil` in preferences to a far future date
2. Confirm to user

**Output:**
```
Feedback learning paused

Your existing patterns are preserved.
Resume with: /ork:feedback resume
```

## resume

Resume paused learning.

**Action:**
1. Clear `pausedUntil` in preferences
2. Confirm to user

**Output:**
```
Feedback learning resumed

The system will continue learning from your usage.
```

## reset

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

## export

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

## settings

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
  /ork:feedback settings <key> <value>

Example:
  /ork:feedback settings retentionDays 30
```

## opt-in

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
  - Memory data

Disable anytime: /ork:feedback opt-out
```

## opt-out

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

Re-enable anytime: /ork:feedback opt-in
```

## privacy

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
  ✗ Memory data or conversation history
  ✗ Architecture decisions or design documents
  ✗ API keys, tokens, or credentials
  ✗ Git history or commit messages
  ✗ Any data that could identify you or your projects


YOUR RIGHTS
────────────────────────────────────────────────────────────────────

  • Opt-out anytime:     /ork:feedback opt-out
  • View your data:      /ork:feedback export-analytics
  • Check status:        /ork:feedback status
  • View this policy:    /ork:feedback privacy
```

## bug

File a bug report as a GitHub issue with auto-collected environment context.

**Usage:**
```
/ork:feedback bug
/ork:feedback bug Something broke when I ran /ork:verify
```

**Action:**
1. Prompt for category (skill/agent/hook/build/other) via AskUserQuestion
2. Collect description from user (or use argument if provided)
3. Auto-collect environment: OrchestKit version, CC version, OS, git branch
4. Auto-collect last skill/agent from metrics.json (if available)
5. Sanitize all context (strip PII, absolute paths, credentials)
6. Search for duplicate issues via `gh issue list --search`
7. Show issue preview and ask for confirmation
8. Create issue via `gh issue create` with structured template
9. If `gh` not authenticated, save to `.claude/feedback/pending-bugs/` for later

**Output:**
```
Bug report filed!

  Issue: #456
  URL:   https://github.com/yonatangross/orchestkit/issues/456
  Title: Bug: verify skill fails on monorepo with pnpm workspaces

Track progress or add details at the URL above.
```

**Output (gh not authenticated):**
```
Could not create GitHub issue (gh CLI not authenticated).

Bug report saved to:
  .claude/feedback/pending-bugs/bug-20260226-143000.md

To file manually:
  1. Run: gh auth login
  2. Then: gh issue create -R yonatangross/orchestkit \
       --body-file .claude/feedback/pending-bugs/bug-20260226-143000.md \
       --title "Bug: ..." --label bug
```

See [Bug Report Reference](bug-report-reference.md) for full workflow details.

## export-analytics

Export anonymous analytics data to a file for review before sharing.

**Usage:**
```
/ork:feedback export-analytics [path]
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
