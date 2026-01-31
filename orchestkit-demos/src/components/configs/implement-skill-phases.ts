/**
 * SkillPhaseDemo Config for /ork:implement
 *
 * Config for the new phase-centric template where all 3 complexity levels
 * progress through the SAME PHASE at the SAME TIME.
 *
 * VISUALIZATION OPTIONS:
 * - summaryVisualization: "graph" (default) - Network graph showing architecture
 * - summaryVisualization: "pipeline" - Linear pipeline flow showing stages
 */

import type { z } from "zod";
import type { skillPhaseDemoSchema } from "../SkillPhaseDemo";

export const implementSkillPhasesConfig: z.infer<typeof skillPhaseDemoSchema> = {
  skillName: "Implement",
  skillCommand: "/ork:implement",
  hook: "Add auth in seconds, not hours",
  tagline: "Same skill. Any complexity. Production ready.",
  primaryColor: "#8b5cf6",

  // Switch between "graph" (network diagram) and "pipeline" (linear flow)
  // summaryVisualization: "graph", // default - shows interconnected architecture
  // summaryVisualization: "pipeline", // alternative - shows linear stages

  levelDescriptions: {
    simple: "JWT validation",
    medium: "OAuth providers",
    advanced: "MFA + audit",
  },

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
          "Loading skill references...",
          "⚙️ auth-patterns",
          "⚙️ jwt-validation",
        ],
      },
      medium: {
        lines: [
          "Loading skill references...",
          "⚙️ auth-patterns",
          "⚙️ oauth-providers",
          "⚙️ session-management",
        ],
      },
      advanced: {
        lines: [
          "Loading skill references...",
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
          "Creating implementation plan...",
          "• Token validation",
          "• Expiry checking",
          "• User extraction",
        ],
      },
      medium: {
        lines: [
          "Creating implementation plan...",
          "• Google OAuth flow",
          "• GitHub OAuth flow",
          "• Refresh token handling",
          "• Session management",
        ],
      },
      advanced: {
        lines: [
          "Creating implementation plan...",
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
        code: `export function authMiddleware(req, res, next) {
  const token = extractToken(req);
  const user = verifyToken(token);
  req.user = user;
  next();
}`,
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
        code: `class OAuthProvider {
  async authenticate(provider: string) {
    const config = this.configs[provider];
    return this.exchange(config, code);
  }
}`,
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
        code: `class MFAService {
  generateTOTP(secret: string) {
    return totp.generate(secret);
  }
  verifyTOTP(token: string, secret: string) {
    return totp.verify({ token, secret });
  }
}`,
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
      files: [
        "middleware.ts",
        "auth.test.ts",
      ],
      stats: {
        files: 2,
        tests: 4,
        coverage: "100%",
      },
    },
    medium: {
      title: "OAuth Integration",
      features: [
        "Google OAuth",
        "GitHub OAuth",
        "Refresh token flow",
        "Session management",
      ],
      files: [
        "middleware.ts",
        "jwt.service.ts",
        "oauth.provider.ts",
        "oauth.test.ts",
      ],
      stats: {
        files: 4,
        tests: 18,
        coverage: "96%",
      },
    },
    advanced: {
      title: "Enterprise MFA",
      features: [
        "TOTP authenticator",
        "SMS backup codes",
        "Hardware key support",
        "Audit logging",
      ],
      files: [
        "middleware.ts",
        "jwt.service.ts",
        "oauth.provider.ts",
        "mfa.service.ts",
        "session.store.ts",
        "mfa.test.ts",
      ],
      stats: {
        files: 6,
        tests: 42,
        coverage: "94%",
      },
    },
  },
};

export default implementSkillPhasesConfig;
