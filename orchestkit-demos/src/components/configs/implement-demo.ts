/**
 * Sample configuration for TriTerminalRace demo
 * Showcasing the /ork:implement skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const implementDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "implement",
  skillCommand: "/ork:implement",
  hook: "Add auth in seconds, not hours",
  primaryColor: "#8b5cf6",
  secondaryColor: "#22c55e",
  accentColor: "#f59e0b",

  phases: [
    { name: "Analyze", shortName: "Analyze" },
    { name: "Load Refs", shortName: "Refs" },
    { name: "Plan", shortName: "Plan" },
    { name: "Write Code", shortName: "Write" },
    { name: "Test", shortName: "Test" },
  ],

  // SIMPLE LEVEL - JWT Only
  simple: {
    name: "Simple",
    description: "add JWT auth",
    inputCount: 1,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "middleware.ts", status: "completed", lines: 45 },
            ],
          },
          {
            name: "tests/",
            status: "completed",
            children: [{ name: "auth.test.ts", status: "completed", lines: 32 }],
          },
        ],
      },
    ],
    references: [
      { name: "auth-patterns", status: "loaded", category: "security" },
      { name: "jwt-validation", status: "loaded", category: "auth" },
    ],
    claudeResponse: [
      "I'll create a simple JWT middleware with:",
      "",
      "• Token validation",
      "• Expiry checking",
      "• User extraction",
    ],
    codeSnippet: `export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};`,
    completionTime: "8s",
    metrics: {
      Coverage: "100%",
      Tests: "4",
    },
  },

  // MEDIUM LEVEL - OAuth + JWT
  medium: {
    name: "Medium",
    description: "add OAuth + JWT auth",
    inputCount: 3,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "middleware.ts", status: "completed", lines: 67 },
              { name: "jwt.service.ts", status: "completed", lines: 89 },
              { name: "oauth.provider.ts", status: "writing", lines: 124 },
            ],
          },
          {
            name: "tests/",
            status: "completed",
            children: [
              { name: "auth.test.ts", status: "completed", lines: 56 },
              { name: "oauth.test.ts", status: "writing", lines: 78 },
            ],
          },
          {
            name: "config/",
            status: "pending",
            children: [{ name: "auth.config.ts", status: "pending", lines: 0 }],
          },
        ],
      },
    ],
    references: [
      { name: "auth-patterns", status: "loaded", category: "security" },
      { name: "oauth-providers", status: "loaded", category: "auth" },
      { name: "session-management", status: "loading", category: "state" },
    ],
    claudeResponse: [
      "Creating multi-provider OAuth system with:",
      "",
      "• Google OAuth 2.0",
      "• GitHub OAuth",
      "• JWT session layer",
      "• Refresh tokens",
    ],
    codeSnippet: `export class JWTService {
  constructor(private config: JWTConfig) {}

  async sign(payload: TokenPayload): Promise<string> {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.expiresIn || '1h'
    });
  }

  async verify(token: string): Promise<TokenPayload> {
    return jwt.verify(token, this.config.secret) as TokenPayload;
  }
}`,
    completionTime: "23s",
    metrics: {
      Coverage: "96%",
      Tests: "18",
    },
  },

  // ADVANCED LEVEL - OAuth + JWT + MFA
  advanced: {
    name: "Advanced",
    description: "add OAuth+JWT+MFA auth",
    inputCount: 8,
    files: [
      {
        name: "src/",
        status: "completed",
        children: [
          {
            name: "auth/",
            status: "completed",
            children: [
              { name: "middleware.ts", status: "completed", lines: 89 },
              { name: "jwt.service.ts", status: "completed", lines: 112 },
              { name: "oauth.provider.ts", status: "completed", lines: 156 },
              { name: "mfa.service.ts", status: "writing", lines: 134 },
              { name: "session.store.ts", status: "pending", lines: 0 },
            ],
          },
          {
            name: "tests/",
            status: "completed",
            children: [
              { name: "auth.test.ts", status: "completed", lines: 78 },
              { name: "oauth.test.ts", status: "completed", lines: 92 },
              { name: "mfa.test.ts", status: "writing", lines: 64 },
            ],
          },
          {
            name: "config/",
            status: "completed",
            children: [
              { name: "auth.config.ts", status: "completed", lines: 45 },
              { name: "providers.ts", status: "pending", lines: 0 },
            ],
          },
        ],
      },
    ],
    references: [
      { name: "auth-patterns", status: "loaded", category: "security" },
      { name: "oauth-providers", status: "loaded", category: "auth" },
      { name: "mfa-patterns", status: "loaded", category: "2fa" },
      { name: "audit-logging", status: "loading", category: "compliance" },
      { name: "session-management", status: "pending", category: "state" },
    ],
    claudeResponse: [
      "Enterprise auth stack with full MFA:",
      "",
      "• TOTP authenticator",
      "• SMS backup codes",
      "• Hardware key support",
      "• Session management",
      "• Audit logging",
    ],
    codeSnippet: `export class MFAService {
  async generateTOTP(userId: string): Promise<TOTPSecret> {
    const secret = speakeasy.generateSecret({
      name: \`App:\${userId}\`,
      length: 32
    });
    await this.store.saveTOTPSecret(userId, secret.base32);
    return { secret: secret.base32, qrCode: secret.otpauth_url };
  }

  async verifyTOTP(userId: string, token: string): Promise<boolean> {
    const secret = await this.store.getTOTPSecret(userId);
    return speakeasy.totp.verify({ secret, token, encoding: 'base32' });
  }
}`,
    completionTime: "47s",
    metrics: {
      Coverage: "94%",
      Tests: "42",
    },
  },

  summaryTitle: "📊 IMPLEMENTATION COMPLETE",
  summaryTagline: "Same skill. Different complexity. Production ready.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default implementDemoConfig;
