/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:feedback skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const feedbackDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "feedback",
  skillCommand: "/ork:feedback",
  hook: "Your patterns. Your control. Privacy-first learning.",
  primaryColor: "#ec4899",
  secondaryColor: "#06b6d4",
  accentColor: "#22c55e",

  phases: [
    { name: "Check Status", shortName: "Status" },
    { name: "Analyze Patterns", shortName: "Patterns" },
    { name: "Show Settings", shortName: "Settings" },
    { name: "Export/Action", shortName: "Action" },
  ],

  // SIMPLE LEVEL - View feedback status
  simple: {
    name: "Simple",
    description: "check feedback status",
    inputCount: 1,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "preferences.json", status: "completed", lines: 23 },
          { name: "patterns.json", status: "completed", lines: 89 },
        ],
      },
    ],
    references: [
      { name: "file-locations", status: "loaded", category: "storage" },
      { name: "privacy-policy", status: "loaded", category: "privacy" },
    ],
    claudeResponse: [
      "Checking feedback system status:",
      "",
      "• Reading preferences",
      "• Counting learned patterns",
      "• Calculating context savings",
    ],
    codeSnippet: `FEEDBACK SYSTEM STATUS
═══════════════════════════════════════════════════════════════

Learning: Enabled
Anonymous sharing: Disabled
Data retention: 90 days

Learned Patterns:
├─ Auto-approves: npm install, npm test, git push (3 commands)
├─ Code style: async/await preferred, TypeScript strict mode
└─ Preferences: Cursor-based pagination, connection pooling

Agent Performance:
┌───────────────────────────┬─────────┬────────┬─────────────┐
│ Agent                     │ Success │ Spawns │ Trend       │
├───────────────────────────┼─────────┼────────┼─────────────┤
│ backend-system-architect  │     94% │     28 │ ↑ improving │
│ database-engineer         │     91% │     23 │ → stable    │
│ test-generator            │     72% │     18 │ ↓ declining │
└───────────────────────────┴─────────┴────────┴─────────────┘

Context Savings: ~8k tokens/session (estimated)
Storage: .claude/feedback/ (45 KB)

Commands:
  /feedback settings      # View/edit settings
  /feedback pause         # Pause learning
  /feedback export        # Export all data`,
    completionTime: "2s",
    metrics: {
      Patterns: "3",
      Agents: "3",
      Storage: "45 KB",
    },
  },

  // MEDIUM LEVEL - Manage settings and export
  medium: {
    name: "Medium",
    description: "manage feedback settings",
    inputCount: 4,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "preferences.json", status: "writing", lines: 45 },
          { name: "patterns.json", status: "completed", lines: 156 },
          { name: "metrics.json", status: "completed", lines: 89 },
          { name: "consent-log.json", status: "completed", lines: 23 },
        ],
      },
    ],
    references: [
      { name: "file-locations", status: "loaded", category: "storage" },
      { name: "privacy-policy", status: "loaded", category: "privacy" },
      { name: "consent-management", status: "loading", category: "gdpr" },
    ],
    claudeResponse: [
      "Managing feedback settings:",
      "",
      "• Current settings loaded",
      "• Privacy options displayed",
      "• Export functionality ready",
      "• Consent audit trail active",
    ],
    codeSnippet: `FEEDBACK SETTINGS
═══════════════════════════════════════════════════════════════

Current Settings:
┌─────────────────────────┬─────────┬────────────────────────────────┐
│ Setting                 │ Value   │ Description                    │
├─────────────────────────┼─────────┼────────────────────────────────┤
│ enabled                 │ true    │ Master switch for learning     │
│ learnFromEdits          │ true    │ Learn from code edits          │
│ learnFromApprovals      │ true    │ Learn from permissions         │
│ learnFromAgentOutcomes  │ true    │ Track agent success            │
│ shareAnonymized         │ false   │ Share anonymous stats          │
│ retentionDays           │ 90      │ Data retention period          │
└─────────────────────────┴─────────┴────────────────────────────────┘

To change: /feedback settings <key> <value>
Example: /feedback settings retentionDays 30

LEARNED PATTERNS:
───────────────────────────────────────────────────────────────

Permission Patterns (Auto-Approve):
├─ npm install (approved 47 times, no rejections)
├─ npm test (approved 89 times, no rejections)
├─ git push (approved 23 times, 1 rejection)
└─ npm run build (approved 34 times, no rejections)

Code Style Preferences:
├─ async/await over .then() chains (detected 156 times)
├─ TypeScript strict mode (always used)
├─ Cursor-based pagination (used 12 times, offset 0 times)
└─ Connection pooling (pool_size=10, max_overflow=20)

Agent Preferences:
├─ backend-system-architect: Preferred for API design
├─ database-engineer: Preferred for schema changes
└─ test-generator: Preferred for unit tests

EXPORT DATA:
───────────────────────────────────────────────────────────────

/feedback export
  → Exported to: .claude/feedback/export-2026-01-30.json

Contains:
├─ 4 learned permission patterns
├─ 4 code style preferences
├─ 8 skill usage metrics
├─ 3 agent performance records
└─ File size: 18 KB

PRIVACY CONTROLS:
───────────────────────────────────────────────────────────────

Anonymous sharing is currently DISABLED

What we would share (if enabled):
  ✓ Skill usage counts and success rates
  ✓ Agent performance metrics (anonymized)
  ✓ Hook trigger counts

What we NEVER share:
  ✗ Your code or file contents
  ✗ Project names or paths
  ✗ Personal information
  ✗ mem0 memory data

Enable with: /feedback opt-in
View policy: /feedback privacy`,
    completionTime: "6s",
    metrics: {
      Settings: "6",
      Patterns: "12",
      "Export Size": "18 KB",
    },
  },

  // ADVANCED LEVEL - Full privacy management with analytics
  advanced: {
    name: "Advanced",
    description: "enterprise privacy + analytics",
    inputCount: 12,
    files: [
      {
        name: ".claude/feedback/",
        status: "completed",
        children: [
          { name: "preferences.json", status: "completed", lines: 67 },
          { name: "patterns.json", status: "completed", lines: 456 },
          { name: "metrics.json", status: "completed", lines: 234 },
          { name: "consent-log.json", status: "completed", lines: 89 },
          { name: "analytics-exports/", status: "writing", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "file-locations", status: "loaded", category: "storage" },
      { name: "privacy-policy", status: "loaded", category: "privacy" },
      { name: "consent-management", status: "loaded", category: "gdpr" },
      { name: "analytics-schema", status: "loading", category: "analytics" },
    ],
    claudeResponse: [
      "Enterprise feedback management:",
      "",
      "• Full privacy audit",
      "• GDPR consent tracking",
      "• Analytics export preview",
      "• Security command audit",
      "• Cross-project patterns",
    ],
    codeSnippet: `ENTERPRISE FEEDBACK MANAGEMENT
══════════════════════════════════════════════════════════════════════

PRIVACY AUDIT:
───────────────────────────────────────────────────────────────────────

Consent History (GDPR Compliant):
┌────────────────────┬──────────────┬─────────────────┬───────────────┐
│ Date               │ Action       │ Policy Version  │ IP (stripped) │
├────────────────────┼──────────────┼─────────────────┼───────────────┤
│ 2026-01-15 09:23   │ OPT_IN       │ 1.2.0           │ [not stored]  │
│ 2026-01-20 14:45   │ OPT_OUT      │ 1.2.0           │ [not stored]  │
│ 2026-01-28 11:12   │ OPT_IN       │ 1.3.0           │ [not stored]  │
└────────────────────┴──────────────┴─────────────────┴───────────────┘

Current Status: OPTED IN (since 2026-01-28)

FULL PRIVACY POLICY:
═══════════════════════════════════════════════════════════════════════
              ORCHESTKIT ANONYMOUS ANALYTICS PRIVACY POLICY
═══════════════════════════════════════════════════════════════════════

WHAT WE COLLECT (only with your consent)
────────────────────────────────────────────────────────────────────────

  ✓ Skill usage counts        - e.g., "api-design used 45 times"
  ✓ Skill success rates       - e.g., "92% success rate"
  ✓ Agent spawn counts        - e.g., "backend-architect spawned 8x"
  ✓ Agent success rates       - e.g., "88% tasks completed"
  ✓ Hook trigger counts       - e.g., "git-protection triggered 120x"
  ✓ Hook block counts         - e.g., "blocked 5 unsafe commands"
  ✓ Plugin version            - e.g., "5.4.0"
  ✓ Report date               - e.g., "2026-01-30" (date only)


WHAT WE NEVER COLLECT
────────────────────────────────────────────────────────────────────────

  ✗ Your code or file contents
  ✗ Project names, paths, or directory structure
  ✗ User names, emails, or any personal information
  ✗ IP addresses (stripped at network layer)
  ✗ mem0 memory data or conversation history
  ✗ Architecture decisions or design documents
  ✗ API keys, tokens, or credentials
  ✗ Git history or commit messages

ANALYTICS EXPORT PREVIEW:
───────────────────────────────────────────────────────────────────────

Exported to: .claude/feedback/analytics-exports/analytics-2026-01-30.json

{
  "timestamp": "2026-01-30",
  "plugin_version": "5.4.0",
  "skill_usage": {
    "api-design-framework": { "uses": 45, "success_rate": 0.92 },
    "database-schema-designer": { "uses": 28, "success_rate": 0.89 },
    "implement": { "uses": 67, "success_rate": 0.94 },
    "verify": { "uses": 34, "success_rate": 0.91 },
    "commit": { "uses": 89, "success_rate": 0.97 }
  },
  "agent_performance": {
    "backend-system-architect": { "spawns": 28, "success_rate": 0.94 },
    "database-engineer": { "spawns": 23, "success_rate": 0.91 },
    "test-generator": { "spawns": 18, "success_rate": 0.72 }
  },
  "hook_metrics": {
    "git-branch-protection": { "triggered": 120, "blocked": 8 },
    "permission-patterns": { "triggered": 456, "blocked": 12 },
    "mem0-sync": { "triggered": 89, "blocked": 0 }
  },
  "summary": {
    "unique_skills_used": 23,
    "unique_agents_used": 8,
    "hooks_configured": 167,
    "total_skill_invocations": 312,
    "total_agent_spawns": 69
  }
}

SECURITY AUDIT:
───────────────────────────────────────────────────────────────────────

Commands NEVER Auto-Approved (hardcoded safety):
├─ rm -rf (any variant)
├─ sudo (any command)
├─ chmod 777
├─ Commands with --force
├─ Commands with --no-verify
├─ Commands involving passwords/secrets
└─ Commands with credential keywords

Blocked Command Attempts (Last 30 Days):
┌─────────────────────────────────────┬───────┬────────────────────────┐
│ Pattern                             │ Count │ Action                 │
├─────────────────────────────────────┼───────┼────────────────────────┤
│ rm -rf (various)                    │     3 │ BLOCKED + logged       │
│ git push --force                    │     2 │ BLOCKED + warned       │
│ chmod 777                           │     1 │ BLOCKED + logged       │
│ npm publish --force                 │     1 │ BLOCKED + warned       │
└─────────────────────────────────────┴───────┴────────────────────────┘

CROSS-PROJECT PATTERNS:
───────────────────────────────────────────────────────────────────────

Patterns learned across all projects:

Global Code Style:
├─ async/await preferred (12 projects)
├─ TypeScript strict mode (12 projects)
├─ Cursor pagination (8 projects)
└─ Connection pooling defaults (6 projects)

Project-Specific Overrides:
├─ project-legacy: Callback style allowed
├─ project-python: Type hints required
└─ project-minimal: No pooling (single-user)

FEEDBACK HEALTH:
───────────────────────────────────────────────────────────────────────
├─ Learning: ACTIVE
├─ Consent: VALID (policy 1.3.0)
├─ Data age: 45 days (within 90-day retention)
├─ Storage: 234 KB (healthy)
├─ Patterns: 67 learned (23 high-confidence)
└─ Last sync: 2 hours ago

ACTIONS:
───────────────────────────────────────────────────────────────────────
/feedback pause          # Temporarily pause learning
/feedback reset          # Clear all patterns (with confirmation)
/feedback opt-out        # Disable anonymous sharing
/feedback export         # Export all data (GDPR right to access)
/feedback delete-all     # Delete all data (GDPR right to erasure)`,
    completionTime: "18s",
    metrics: {
      Patterns: "67",
      "Consent Status": "Valid",
      "Policy Version": "1.3.0",
      "Skills Tracked": "23",
    },
  },

  summaryTitle: "FEEDBACK MANAGED",
  summaryTagline: "Your data. Your control. GDPR compliant. Privacy first.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default feedbackDemoConfig;
