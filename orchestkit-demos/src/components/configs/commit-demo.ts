/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:commit skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const commitDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "commit",
  skillCommand: "/ork:commit",
  hook: "Conventional commits in seconds",
  primaryColor: "#06b6d4",
  secondaryColor: "#22c55e",
  accentColor: "#f59e0b",

  phases: [
    { name: "Analyze", shortName: "Analyze" },
    { name: "Diff", shortName: "Diff" },
    { name: "Generate", shortName: "Generate" },
    { name: "Commit", shortName: "Commit" },
  ],

  // SIMPLE LEVEL - Single file change
  simple: {
    name: "Simple",
    description: "fix typo in README",
    inputCount: 1,
    files: [
      {
        name: "README.md",
        status: "modified",
        lines: 2,
      },
    ],
    references: [
      { name: "conventional-commits", status: "loaded", category: "git" },
    ],
    claudeResponse: [
      "Analyzing changes:",
      "",
      "• 1 file modified",
      "• 2 lines changed",
      "• Type: docs (documentation)",
    ],
    codeSnippet: `git commit -m "docs: fix typo in installation section

Corrected 'instal' to 'install' in README.md

Co-Authored-By: Claude <noreply@anthropic.com>"`,
    completionTime: "2s",
    metrics: {
      Format: "Conventional",
      Type: "docs",
    },
  },

  // MEDIUM LEVEL - Multiple related files
  medium: {
    name: "Medium",
    description: "add user validation",
    inputCount: 5,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          { name: "validators/user.ts", status: "modified", lines: 45 },
          { name: "schemas/user.ts", status: "modified", lines: 23 },
          { name: "api/users.ts", status: "modified", lines: 12 },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "validators.test.ts", status: "modified", lines: 67 },
        ],
      },
    ],
    references: [
      { name: "conventional-commits", status: "loaded", category: "git" },
      { name: "semantic-versioning", status: "loaded", category: "release" },
    ],
    claudeResponse: [
      "Analyzing changes:",
      "",
      "• 4 files modified",
      "• 147 lines changed",
      "• Type: feat (new feature)",
      "• Scope: validation",
    ],
    codeSnippet: `git commit -m "feat(validation): add comprehensive user input validation

- Add Zod schemas for user registration and profile
- Implement email, password strength validators
- Add rate limiting checks for API endpoints
- Include 12 new test cases for edge cases

BREAKING CHANGE: User registration now requires email verification

Co-Authored-By: Claude <noreply@anthropic.com>"`,
    completionTime: "4s",
    metrics: {
      Format: "Conventional",
      Type: "feat",
      Breaking: "Yes",
    },
  },

  // ADVANCED LEVEL - Large refactor
  advanced: {
    name: "Advanced",
    description: "refactor auth system",
    inputCount: 12,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "middleware.ts", status: "modified", lines: 89 },
              { name: "jwt.service.ts", status: "modified", lines: 156 },
              { name: "oauth.provider.ts", status: "completed", lines: 234 },
              { name: "session.store.ts", status: "writing", lines: 78 },
            ],
          },
          {
            name: "api/",
            status: "completed",
            children: [
              { name: "auth.routes.ts", status: "modified", lines: 45 },
              { name: "users.routes.ts", status: "modified", lines: 23 },
            ],
          },
        ],
      },
      {
        name: "tests/",
        status: "completed",
        children: [
          { name: "auth/", status: "completed", children: [
            { name: "jwt.test.ts", status: "completed", lines: 123 },
            { name: "oauth.test.ts", status: "writing", lines: 89 },
          ]},
        ],
      },
      {
        name: "docs/",
        status: "pending",
        children: [
          { name: "AUTH.md", status: "pending", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "conventional-commits", status: "loaded", category: "git" },
      { name: "semantic-versioning", status: "loaded", category: "release" },
      { name: "changelog-generator", status: "loading", category: "docs" },
    ],
    claudeResponse: [
      "Analyzing changes:",
      "",
      "• 12 files modified",
      "• 837 lines changed",
      "• Type: refactor",
      "• Scope: auth",
      "• Breaking changes detected",
      "• Suggests version bump: major",
    ],
    codeSnippet: `git commit -m "refactor(auth)!: modernize authentication architecture

Complete overhaul of authentication system:

Features:
- Migrate from session-based to JWT + refresh tokens
- Add OAuth 2.0 providers (Google, GitHub, Microsoft)
- Implement PKCE flow for public clients
- Add token rotation and revocation

Security:
- Enforce HTTPS-only cookies for refresh tokens
- Add rate limiting per user and IP
- Implement audit logging for auth events

BREAKING CHANGE: Session-based auth removed. All clients must
migrate to JWT-based authentication. See docs/AUTH.md for guide.

Closes #234, #256, #278

Co-Authored-By: Claude <noreply@anthropic.com>"`,
    completionTime: "8s",
    metrics: {
      Format: "Conventional",
      Type: "refactor",
      Breaking: "Yes",
      Issues: "3",
    },
  },

  summaryTitle: "📊 COMMIT GENERATED",
  summaryTagline: "Conventional commits. Every time. Automatically.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default commitDemoConfig;
