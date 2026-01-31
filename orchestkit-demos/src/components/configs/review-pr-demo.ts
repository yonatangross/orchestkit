/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:review-pr skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const reviewPRDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "review-pr",
  skillCommand: "/ork:review-pr",
  hook: "Expert PR review in minutes",
  primaryColor: "#f97316",
  secondaryColor: "#8b5cf6",
  accentColor: "#22c55e",

  phases: [
    { name: "Fetch PR", shortName: "Fetch" },
    { name: "Spawn Agents", shortName: "Spawn" },
    { name: "Security", shortName: "Security" },
    { name: "Quality", shortName: "Quality" },
    { name: "Performance", shortName: "Perf" },
    { name: "Synthesize", shortName: "Report" },
  ],

  // SIMPLE LEVEL - Small PR
  simple: {
    name: "Simple",
    description: "PR #42: Fix button styling",
    inputCount: 2,
    files: [
      {
        name: "src/components/Button.tsx",
        status: "completed",
        lines: 8,
      },
      {
        name: "src/styles/button.css",
        status: "completed",
        lines: 12,
      },
    ],
    references: [
      { name: "code-review-playbook", status: "loaded", category: "review" },
      { name: "css-patterns", status: "loaded", category: "frontend" },
    ],
    claudeResponse: [
      "Reviewing PR #42:",
      "",
      "• 2 files changed",
      "• +15 / -5 lines",
      "• Category: UI/Styling",
      "",
      "Spawning 6 review agents...",
    ],
    codeSnippet: `PR REVIEW SUMMARY
─────────────────
PR #42: Fix button styling

✓ Security:    No issues
✓ Quality:     Clean code
✓ Performance: No impact
✓ Tests:       Coverage maintained

VERDICT: ✅ APPROVE

Comments: 0 blocking, 1 suggestion
"Consider using CSS variables for colors"`,
    completionTime: "12s",
    metrics: {
      Verdict: "APPROVE",
      Issues: "0",
      Suggestions: "1",
    },
  },

  // MEDIUM LEVEL - Feature PR
  medium: {
    name: "Medium",
    description: "PR #156: Add search feature",
    inputCount: 8,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "features/search/",
            status: "completed",
            children: [
              { name: "SearchBar.tsx", status: "completed", lines: 89 },
              { name: "SearchResults.tsx", status: "completed", lines: 134 },
              { name: "useSearch.ts", status: "completed", lines: 67 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "search.ts", status: "completed", lines: 45 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "search.test.ts", status: "completed", lines: 178 },
        ],
      },
    ],
    references: [
      { name: "code-review-playbook", status: "loaded", category: "review" },
      { name: "react-patterns", status: "loaded", category: "frontend" },
      { name: "api-design", status: "loading", category: "backend" },
    ],
    claudeResponse: [
      "Reviewing PR #156:",
      "",
      "• 8 files changed",
      "• +513 / -23 lines",
      "• Category: Feature",
      "",
      "Spawning 6 review agents:",
      "• 🔒 security-auditor",
      "• 📝 code-quality-reviewer",
      "• ⚡ performance-engineer",
    ],
    codeSnippet: `PR REVIEW SUMMARY
─────────────────
PR #156: Add search feature

⚠ Security:    1 medium (input sanitization)
✓ Quality:     Good patterns
⚠ Performance: 2 suggestions (debounce, memo)
✓ Tests:       92% coverage

VERDICT: 🔄 REQUEST CHANGES

Blocking issues:
1. [P1] Sanitize search input before API call
   File: api/search.ts:23

Suggestions:
1. Add debounce to search input (300ms)
2. Memoize SearchResults component`,
    completionTime: "35s",
    metrics: {
      Verdict: "CHANGES",
      Blocking: "1",
      Suggestions: "2",
    },
  },

  // ADVANCED LEVEL - Large refactor PR
  advanced: {
    name: "Advanced",
    description: "PR #289: Auth system overhaul",
    inputCount: 24,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "AuthProvider.tsx", status: "completed", lines: 234 },
              { name: "useAuth.ts", status: "completed", lines: 189 },
              { name: "jwt.service.ts", status: "completed", lines: 156 },
              { name: "oauth/", status: "completed", children: [
                { name: "google.ts", status: "completed", lines: 89 },
                { name: "github.ts", status: "completed", lines: 78 },
                { name: "microsoft.ts", status: "writing", lines: 92 },
              ]},
              { name: "mfa.service.ts", status: "writing", lines: 134 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "auth.routes.ts", status: "completed", lines: 178 },
              { name: "session.routes.ts", status: "completed", lines: 89 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "auth/", status: "completed", children: [
            { name: "provider.test.tsx", status: "completed", lines: 345 },
            { name: "jwt.test.ts", status: "completed", lines: 267 },
            { name: "oauth.test.ts", status: "writing", lines: 234 },
            { name: "mfa.test.ts", status: "pending", lines: 0 },
          ]},
          { name: "e2e/", status: "pending", children: [
            { name: "auth-flow.spec.ts", status: "pending", lines: 0 },
          ]},
        ],
      },
    ],
    references: [
      { name: "code-review-playbook", status: "loaded", category: "review" },
      { name: "auth-patterns", status: "loaded", category: "security" },
      { name: "owasp-auth", status: "loaded", category: "security" },
      { name: "jwt-best-practices", status: "loading", category: "security" },
      { name: "mfa-patterns", status: "pending", category: "security" },
    ],
    claudeResponse: [
      "Reviewing PR #289:",
      "",
      "• 24 files changed",
      "• +2,847 / -1,234 lines",
      "• Category: Refactor (Breaking)",
      "",
      "Spawning 7 review agents:",
      "• 🔒 security-auditor (OAuth focus)",
      "• 📝 code-quality-reviewer",
      "• ⚡ performance-engineer",
      "• 🧪 test-generator (coverage)",
      "• 📚 documentation-specialist",
      "• 🏗️ backend-system-architect",
    ],
    codeSnippet: `PR REVIEW SUMMARY
─────────────────
PR #289: Auth system overhaul

🔴 Security:    2 critical, 3 medium
⚠ Quality:     4 suggestions
⚠ Performance: 1 concern (token refresh)
⚠ Tests:       Coverage dropped 89% → 76%
⚠ Breaking:    Migration guide needed

VERDICT: 🔴 REQUEST CHANGES

Critical issues:
1. [P0] JWT secret exposed in config
   File: jwt.service.ts:12
2. [P0] Missing CSRF protection on logout
   File: auth.routes.ts:67

Medium issues:
1. [P1] Refresh token rotation not implemented
2. [P1] OAuth state parameter not validated
3. [P1] MFA bypass possible via API

Missing:
- E2E tests for auth flow
- Migration guide for breaking changes
- Rate limiting on auth endpoints`,
    completionTime: "2m 15s",
    metrics: {
      Verdict: "CHANGES",
      Critical: "2",
      Medium: "3",
      Coverage: "76%",
    },
  },

  summaryTitle: "📊 PR REVIEW COMPLETE",
  summaryTagline: "6 expert agents. Comprehensive review. Zero blind spots.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default reviewPRDemoConfig;
