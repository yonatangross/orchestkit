/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:worktree-coordination skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const worktreeCoordinationDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "worktree-coordination",
  skillCommand: "/worktree-status",
  hook: "3 Claude instances. 0 merge conflicts. Perfect sync.",
  primaryColor: "#3b82f6",
  secondaryColor: "#f59e0b",
  accentColor: "#22c55e",

  phases: [
    { name: "Scan Instances", shortName: "Scan" },
    { name: "Check Locks", shortName: "Locks" },
    { name: "Sync Decisions", shortName: "Sync" },
    { name: "Detect Conflicts", shortName: "Conflicts" },
  ],

  // SIMPLE LEVEL - Check worktree status
  simple: {
    name: "Simple",
    description: "check worktree status",
    inputCount: 1,
    files: [
      {
        name: ".claude/coordination/",
        status: "completed",
        children: [
          { name: "registry.json", status: "completed", lines: 67 },
        ],
      },
    ],
    references: [
      { name: "git-workflow", status: "loaded", category: "git" },
      { name: "commit", status: "loaded", category: "git" },
    ],
    claudeResponse: [
      "Scanning active Claude instances:",
      "",
      "• Reading coordination registry",
      "• Checking heartbeats",
      "• Listing file locks",
    ],
    codeSnippet: `WORKTREE COORDINATION STATUS
═══════════════════════════════════════════════════════════════

Active Instances:
┌─────────────────────┬────────────────────────────┬──────────┬─────────┐
│ Instance ID         │ Branch                     │ Task     │ Health  │
├─────────────────────┼────────────────────────────┼──────────┼─────────┤
│ cc-auth-a1b2c3      │ feature/user-auth          │ OAuth2   │ ACTIVE  │
│ cc-api-d4e5f6       │ feature/api-v2             │ Endpoint │ ACTIVE  │
│ cc-test-g7h8i9      │ feature/test-coverage      │ Tests    │ STALE   │
└─────────────────────┴────────────────────────────┴──────────┴─────────┘

File Locks:
├─ src/auth/oauth.ts    → cc-auth-a1b2c3 (2 min ago)
├─ src/api/users.ts     → cc-api-d4e5f6 (5 min ago)
└─ No locks available for claim

⚠ 1 stale instance detected (no heartbeat > 5 min)
  Run: cc-worktree-status --clean to release orphaned locks

Commands:
  /worktree-claim <file>    # Claim file before editing
  /worktree-release <file>  # Release lock when done
  /worktree-sync            # Sync with other instances`,
    completionTime: "2s",
    metrics: {
      Instances: "3",
      Locks: "2",
      Stale: "1",
    },
  },

  // MEDIUM LEVEL - Claim files and sync decisions
  medium: {
    name: "Medium",
    description: "coordinate file locks + decisions",
    inputCount: 5,
    files: [
      {
        name: ".claude/coordination/",
        status: "completed",
        children: [
          { name: "registry.json", status: "writing", lines: 134 },
          { name: "decision-log.json", status: "completed", lines: 89 },
        ],
      },
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "auth/oauth.ts", status: "completed", lines: 234 },
          { name: "api/users.ts", status: "completed", lines: 156 },
        ],
      },
    ],
    references: [
      { name: "git-workflow", status: "loaded", category: "git" },
      { name: "commit", status: "loaded", category: "git" },
      { name: "stacked-prs", status: "loading", category: "git" },
    ],
    claudeResponse: [
      "Coordinating multi-instance work:",
      "",
      "• Claiming src/auth/session.ts",
      "• Syncing architectural decisions",
      "• Checking for merge conflicts",
      "• Publishing new decision",
    ],
    codeSnippet: `WORKTREE COORDINATION - MULTI-INSTANCE
═══════════════════════════════════════════════════════════════

FILE CLAIM: src/auth/session.ts
───────────────────────────────────────────────────────────────

Checking lock status...

┌─────────────────────────────────────────────────────────────┐
│  FILE: src/auth/session.ts                                  │
├─────────────────────────────────────────────────────────────┤
│  Previous Status: AVAILABLE                                 │
│  New Status: LOCKED                                         │
│  Holder: cc-main-j0k1l2 (this instance)                     │
│  Branch: feature/session-management                         │
│  Task: Implementing session handling                        │
│  Since: just now                                            │
├─────────────────────────────────────────────────────────────┤
│  ✓ Lock acquired successfully                               │
└─────────────────────────────────────────────────────────────┘

DECISION SYNC:
───────────────────────────────────────────────────────────────

Pulling recent decisions from other instances:

From cc-auth-a1b2c3 (feature/user-auth):
├─ [2 hours ago] "Use Passport.js for OAuth providers"
│   Rationale: Better middleware support, active community
└─ [1 hour ago] "JWT refresh tokens stored in httpOnly cookies"
    Rationale: Security best practice, XSS protection

From cc-api-d4e5f6 (feature/api-v2):
├─ [45 min ago] "API versioning via URL prefix (/api/v2/)"
│   Rationale: Clearer than header-based, easier debugging
└─ [30 min ago] "Use cursor pagination for all list endpoints"
    Rationale: Better performance at scale, consistent UX

NEW DECISION LOGGED:
───────────────────────────────────────────────────────────────

/worktree-decision "Session tokens use Redis for storage"
  --rationale "Enables horizontal scaling, built-in TTL support"

┌─────────────────────────────────────────────────────────────┐
│  Decision Published                                         │
├─────────────────────────────────────────────────────────────┤
│  ID: dec-005                                                │
│  Instance: cc-main-j0k1l2                                   │
│  Branch: feature/session-management                         │
│  Decision: Session tokens use Redis for storage             │
│  Rationale: Enables horizontal scaling, built-in TTL        │
│  Timestamp: 2026-01-30T14:32:00Z                            │
├─────────────────────────────────────────────────────────────┤
│  ✓ Visible to all 3 active instances                        │
└─────────────────────────────────────────────────────────────┘

CONFLICT CHECK:
───────────────────────────────────────────────────────────────

Running merge-tree against active branches...

feature/user-auth ↔ feature/session-management
  ✓ No conflicts detected

feature/api-v2 ↔ feature/session-management
  ⚠ Potential conflict in: src/types/user.ts
    Both branches modify UserSession interface
    Recommendation: Coordinate before merging

feature/test-coverage ↔ feature/session-management
  ✓ No conflicts detected (instance is stale anyway)`,
    completionTime: "8s",
    metrics: {
      "Lock Claimed": "1",
      "Decisions Synced": "4",
      Conflicts: "1 potential",
    },
  },

  // ADVANCED LEVEL - Enterprise multi-worktree coordination
  advanced: {
    name: "Advanced",
    description: "enterprise 5-instance coordination",
    inputCount: 15,
    files: [
      {
        name: ".claude/coordination/",
        status: "completed",
        children: [
          { name: "registry.json", status: "completed", lines: 345 },
          { name: "decision-log.json", status: "completed", lines: 234 },
          { name: "conflict-history.json", status: "completed", lines: 89 },
        ],
      },
      {
        name: "worktrees/",
        status: "completed",
        children: [
          { name: "feature-auth/", status: "completed", lines: 0 },
          { name: "feature-api/", status: "completed", lines: 0 },
          { name: "feature-ui/", status: "completed", lines: 0 },
          { name: "feature-perf/", status: "completed", lines: 0 },
          { name: "hotfix-security/", status: "writing", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "git-workflow", status: "loaded", category: "git" },
      { name: "commit", status: "loaded", category: "git" },
      { name: "stacked-prs", status: "loaded", category: "git" },
      { name: "architecture-decision-record", status: "loading", category: "docs" },
    ],
    claudeResponse: [
      "Enterprise multi-instance coordination:",
      "",
      "• 5 active worktrees",
      "• 23 file locks tracked",
      "• 12 architectural decisions",
      "• Real-time conflict detection",
      "• Priority-based lock resolution",
    ],
    codeSnippet: `ENTERPRISE WORKTREE COORDINATION
══════════════════════════════════════════════════════════════════════

INSTANCE DASHBOARD:
───────────────────────────────────────────────────────────────────────
┌─────────────────────┬────────────────────────────┬─────────────────────┬──────────┬─────────┐
│ Instance ID         │ Worktree                   │ Task                │ Locks    │ Health  │
├─────────────────────┼────────────────────────────┼─────────────────────┼──────────┼─────────┤
│ cc-auth-a1b2c3      │ worktrees/feature-auth     │ OAuth2 + Sessions   │ 4 files  │ ACTIVE  │
│ cc-api-d4e5f6       │ worktrees/feature-api      │ API v2 Endpoints    │ 6 files  │ ACTIVE  │
│ cc-ui-g7h8i9        │ worktrees/feature-ui       │ Dashboard Redesign  │ 8 files  │ ACTIVE  │
│ cc-perf-j0k1l2      │ worktrees/feature-perf     │ Query Optimization  │ 3 files  │ ACTIVE  │
│ cc-hotfix-m3n4o5    │ worktrees/hotfix-security  │ CVE-2026-1234 Fix   │ 2 files  │ PRIORITY│
└─────────────────────┴────────────────────────────┴─────────────────────┴──────────┴─────────┘

Total: 5 instances │ 23 locks │ 0 stale │ 1 priority

LOCK MAP (Visual):
───────────────────────────────────────────────────────────────────────

src/
├── auth/
│   ├── oauth.ts        [LOCKED: cc-auth-a1b2c3]
│   ├── session.ts      [LOCKED: cc-auth-a1b2c3]
│   ├── jwt.ts          [LOCKED: cc-auth-a1b2c3]
│   └── middleware.ts   [LOCKED: cc-auth-a1b2c3]
├── api/
│   ├── users.ts        [LOCKED: cc-api-d4e5f6]
│   ├── products.ts     [LOCKED: cc-api-d4e5f6]
│   ├── orders.ts       [LOCKED: cc-api-d4e5f6]
│   ├── payments.ts     [LOCKED: cc-hotfix-m3n4o5] ⚠ PRIORITY
│   ├── webhooks.ts     [LOCKED: cc-api-d4e5f6]
│   └── routes.ts       [LOCKED: cc-api-d4e5f6]
├── components/
│   ├── Dashboard.tsx   [LOCKED: cc-ui-g7h8i9]
│   ├── UserTable.tsx   [LOCKED: cc-ui-g7h8i9]
│   └── ... (6 more)    [LOCKED: cc-ui-g7h8i9]
└── db/
    ├── queries.ts      [LOCKED: cc-perf-j0k1l2]
    ├── indexes.ts      [LOCKED: cc-perf-j0k1l2]
    └── migrations/     [LOCKED: cc-perf-j0k1l2]

PRIORITY LOCK DETECTED:
───────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ HOTFIX IN PROGRESS: CVE-2026-1234                                │
├─────────────────────────────────────────────────────────────────────┤
│  Instance: cc-hotfix-m3n4o5                                         │
│  Branch: hotfix/security-cve-2026-1234                              │
│  Priority: P0 (CRITICAL)                                            │
│  Files: src/api/payments.ts, src/lib/crypto.ts                      │
│  Status: EXCLUSIVE LOCK (other instances blocked)                   │
├─────────────────────────────────────────────────────────────────────┤
│  Estimated completion: 15 minutes                                   │
│  On completion: Auto-merge to main, all worktrees rebase            │
└─────────────────────────────────────────────────────────────────────┘

DECISION TIMELINE (Last 24 Hours):
───────────────────────────────────────────────────────────────────────

[14:30] cc-hotfix-m3n4o5 (PRIORITY)
  "Patch CVE-2026-1234 in payment validation"
  Rationale: Critical security vulnerability in production

[12:15] cc-auth-a1b2c3
  "Use httpOnly + Secure cookies for refresh tokens"
  Rationale: Security best practice, prevents XSS attacks

[11:45] cc-api-d4e5f6
  "Implement cursor pagination with Relay-style connections"
  Rationale: GraphQL compatibility, better UX for infinite scroll

[10:30] cc-perf-j0k1l2
  "Add composite index on (user_id, created_at) for orders"
  Rationale: Query time reduced from 2.3s to 45ms

[09:15] cc-ui-g7h8i9
  "Use React Server Components for Dashboard"
  Rationale: Better initial load, reduced client bundle

[08:00] cc-auth-a1b2c3
  "Passport.js for OAuth, DIY for internal auth"
  Rationale: Best of both: ecosystem support + control

... 6 more decisions (run /worktree-sync --pull-decisions for full list)

CONFLICT DETECTION MATRIX:
───────────────────────────────────────────────────────────────────────

Running merge-tree analysis across all active branches...

                     │ auth    │ api     │ ui      │ perf    │ hotfix
─────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────
feature-auth         │    -    │   ✓     │   ✓     │   ✓     │   ⚠
feature-api          │   ✓     │    -    │   ✓     │   ⚠     │   ⚠
feature-ui           │   ✓     │   ✓     │    -    │   ✓     │   ✓
feature-perf         │   ✓     │   ⚠     │   ✓     │    -    │   ✓
hotfix-security      │   ⚠     │   ⚠     │   ✓     │   ✓     │    -

Legend: ✓ Clean merge │ ⚠ Potential conflict │ ✗ Definite conflict

CONFLICT DETAILS:
───────────────────────────────────────────────────────────────────────

⚠ feature-auth ↔ hotfix-security
   File: src/lib/crypto.ts
   Auth adds: encryptToken() function
   Hotfix modifies: Same file for CVE fix
   Resolution: Hotfix takes priority, auth will rebase after

⚠ feature-api ↔ feature-perf
   File: src/api/orders.ts
   API adds: new endpoint
   Perf modifies: query optimization in same file
   Resolution: Coordinate merge order (perf first, then api)

⚠ feature-api ↔ hotfix-security
   File: src/api/payments.ts
   API adds: new validation
   Hotfix modifies: Critical security patch
   Resolution: Hotfix takes priority (P0)

COORDINATION ACTIONS:
───────────────────────────────────────────────────────────────────────

Recommended merge order (after hotfix completes):
1. hotfix-security → main (IMMEDIATE, auto-merge queued)
2. feature-perf → main (clean merge)
3. feature-auth → main (rebase first)
4. feature-api → main (rebase first)
5. feature-ui → main (clean merge)

Auto-Actions Scheduled:
├─ [T+15min] Hotfix merge → Notify all instances to rebase
├─ [T+20min] Stale check → Clean orphaned locks
└─ [T+30min] Decision sync → Push to main branch README

COMMANDS:
───────────────────────────────────────────────────────────────────────
/worktree-claim <file>                # Claim file (checks priority)
/worktree-release <file>              # Release lock
/worktree-decision "<text>" --rationale "..."  # Log decision
/worktree-sync --check-conflicts      # Full conflict analysis
/worktree-sync --pull-decisions       # Get all decisions
cc-worktree-status --clean            # Remove stale instances`,
    completionTime: "25s",
    metrics: {
      Instances: "5",
      Locks: "23",
      Conflicts: "3 potential",
      Decisions: "12",
    },
  },

  summaryTitle: "WORKTREES COORDINATED",
  summaryTagline: "5 instances. 23 locks. 0 conflicts. Perfect parallel dev.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default worktreeCoordinationDemoConfig;
