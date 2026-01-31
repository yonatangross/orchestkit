/**
 * PhaseComparison Config for /ork:implement
 *
 * This config defines what each phase outputs at each complexity level.
 * Generated using the standard pattern for all user-invokable skills.
 */

import type { z } from "zod";
import type { phaseComparisonSchema } from "../PhaseComparison";

export const implementPhasesConfig: z.infer<typeof phaseComparisonSchema> = {
  skillName: "implement",
  skillCommand: "/ork:implement",
  hook: "Add auth in seconds, not hours",
  tagline: "Same skill. Any complexity. Production ready.",
  primaryColor: "#8b5cf6",

  phases: [
    {
      name: "Analyze",
      shortName: "Analyze",
      simple: {
        lines: [
          "Scanning codebase...",
          "Found: src/api/",
          "No existing auth detected",
          "1 endpoint to protect",
        ],
      },
      medium: {
        lines: [
          "Scanning codebase...",
          "Found: src/api/",
          "No existing auth detected",
          "3 endpoints to protect",
          "Session storage needed",
        ],
      },
      advanced: {
        lines: [
          "Scanning codebase...",
          "Found: src/api/",
          "No existing auth detected",
          "8 endpoints to protect",
          "Session + audit storage needed",
          "MFA support required",
        ],
      },
    },
    {
      name: "Load References",
      shortName: "Refs",
      simple: {
        lines: [
          "⚙️ auth-patterns",
          "⚙️ jwt-validation",
        ],
      },
      medium: {
        lines: [
          "⚙️ auth-patterns",
          "⚙️ oauth-providers",
          "⚙️ session-management",
        ],
      },
      advanced: {
        lines: [
          "⚙️ auth-patterns",
          "⚙️ oauth-providers",
          "⚙️ mfa-patterns",
          "⚙️ audit-logging",
          "⚙️ session-management",
        ],
      },
    },
    {
      name: "Plan",
      shortName: "Plan",
      simple: {
        lines: [
          "Will create:",
          "• Token validation",
          "• Expiry checking",
          "• User extraction",
        ],
      },
      medium: {
        lines: [
          "Will create:",
          "• Google OAuth flow",
          "• GitHub OAuth flow",
          "• Refresh token handling",
          "• Session management",
        ],
      },
      advanced: {
        lines: [
          "Will create:",
          "• TOTP authenticator",
          "• SMS backup codes",
          "• Hardware key support",
          "• Audit logging",
          "• Session management",
        ],
      },
    },
    {
      name: "Write Code",
      shortName: "Write",
      simple: {
        lines: [
          "Creating files:",
          "├── middleware.ts",
          "└── auth.test.ts",
          "",
          "Functions:",
          "• authMiddleware()",
          "• verifyToken()",
          "• extractUser()",
        ],
      },
      medium: {
        lines: [
          "Creating files:",
          "├── middleware.ts",
          "├── jwt.service.ts",
          "├── oauth.provider.ts",
          "└── oauth.test.ts",
          "",
          "Functions:",
          "• JWTService.sign()",
          "• JWTService.verify()",
          "• OAuthProvider.auth()",
        ],
      },
      advanced: {
        lines: [
          "Creating files:",
          "├── middleware.ts",
          "├── jwt.service.ts",
          "├── oauth.provider.ts",
          "├── mfa.service.ts",
          "├── session.store.ts",
          "└── mfa.test.ts",
          "",
          "Functions:",
          "• MFAService.generateTOTP()",
          "• MFAService.verifyTOTP()",
          "• AuditLog.record()",
        ],
      },
    },
    {
      name: "Test",
      shortName: "Test",
      simple: {
        lines: [
          "Running tests...",
          "✓ Token validation (2 tests)",
          "✓ Expiry handling (2 tests)",
          "",
          "4 tests passed",
          "100% coverage",
        ],
      },
      medium: {
        lines: [
          "Running tests...",
          "✓ JWT service (6 tests)",
          "✓ OAuth flows (8 tests)",
          "✓ Session mgmt (4 tests)",
          "",
          "18 tests passed",
          "96% coverage",
        ],
      },
      advanced: {
        lines: [
          "Running tests...",
          "✓ MFA TOTP (12 tests)",
          "✓ Backup codes (8 tests)",
          "✓ Hardware keys (6 tests)",
          "✓ Audit logging (8 tests)",
          "✓ Sessions (8 tests)",
          "",
          "42 tests passed",
          "94% coverage",
        ],
      },
    },
  ],

  summary: {
    simple: {
      title: "JWT Auth",
      features: [
        "Token validation",
        "Expiry checking",
        "User extraction",
      ],
      files: ["middleware.ts", "auth.test.ts"],
    },
    medium: {
      title: "+ OAuth",
      features: [
        "Google OAuth",
        "GitHub OAuth",
        "Refresh token flow",
        "Session management",
      ],
      files: ["middleware.ts", "jwt.service.ts", "oauth.provider.ts", "oauth.test.ts"],
    },
    advanced: {
      title: "+ MFA",
      features: [
        "TOTP authenticator",
        "SMS backup codes",
        "Hardware key support",
        "Audit logging",
      ],
      files: ["middleware.ts", "jwt.service.ts", "mfa.service.ts", "session.store.ts", "mfa.test.ts"],
    },
  },
};

export default implementPhasesConfig;
