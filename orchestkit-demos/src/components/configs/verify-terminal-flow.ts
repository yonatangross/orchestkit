/**
 * Configuration for TerminalFlow demo
 * Showcasing the /ork:verify skill as a single full-screen terminal session
 */

import type { TerminalFlowProps } from "../terminal-flow";

export const verifyTerminalFlowConfig: TerminalFlowProps = {
  skillName: "verify",
  skillCommand: "/ork:verify",
  hook: "6 agents validate your feature",
  primaryColor: "#22c55e",
  prompt: "~/my-project",

  scopeQuestion: "What scope should we verify?",
  scopeAnswer: "Full verification (all agents)",

  agents: [
    {
      name: "code-quality-reviewer",
      color: "#06b6d4",
      statusText: "Analyzing complexity & SOLID...",
      completedText: "2 warnings — cyclomatic > 15",
      completionFrame: 45,
    },
    {
      name: "accessibility-specialist",
      color: "#a855f7",
      statusText: "Auditing WCAG 2.2 AA...",
      completedText: "1 violation — missing aria-label",
      completionFrame: 85,
    },
    {
      name: "test-generator",
      color: "#22c55e",
      statusText: "Running 67 tests...",
      completedText: "64/67 passed — 3 flaky",
      completionFrame: 125,
    },
    {
      name: "security-auditor",
      color: "#ef4444",
      statusText: "Scanning OWASP Top 10...",
      completedText: "1 medium — missing CSRF token",
      completionFrame: 165,
    },
    {
      name: "performance-engineer",
      color: "#f59e0b",
      statusText: "Load testing p95 latency...",
      completedText: "p95: 210ms — exceeds budget",
      completionFrame: 195,
    },
    {
      name: "e2e-tester",
      color: "#3b82f6",
      statusText: "Running 12 browser scenarios...",
      completedText: "11/12 — Safari timeout",
      completionFrame: 235,
    },
  ],

  resultTitle: "VERIFICATION COMPLETE",
  score: "7/10",
  findings: [
    { label: "Tests", value: "64/67 passed — coverage 78%", severity: "warn" },
    { label: "Security", value: "1 medium (CSRF), 2 low", severity: "fail" },
    { label: "E2E", value: "11/12 — Safari payment timeout", severity: "warn" },
    { label: "A11y", value: "1 violation — aria-label", severity: "warn" },
    { label: "Performance", value: "p95: 210ms (budget: 200ms)", severity: "warn" },
    { label: "Quality", value: "Clean — no code smells", severity: "pass" },
  ],
  advisories: [
    { text: "CSRF token missing on POST /api/checkout" },
    { text: "3 flaky tests need retry logic or test fix" },
    { text: "CartSummary.tsx needs refactor (complexity 18)" },
  ],

  ctaCommand: "/ork:verify",
  ctaSubtext: "Install: claude plugin install ork",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default verifyTerminalFlowConfig;
