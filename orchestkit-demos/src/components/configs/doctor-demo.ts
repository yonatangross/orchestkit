/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:doctor skill at 3 difficulty levels
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const doctorDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "doctor",
  skillCommand: "/ork:doctor",
  hook: "Health diagnostics for OrchestKit systems",
  primaryColor: "#ef4444",
  secondaryColor: "#3b82f6",
  accentColor: "#10b981",

  phases: [
    { name: "Scan System", shortName: "Scan" },
    { name: "Diagnose", shortName: "Diagnose" },
    { name: "Identify Issues", shortName: "Issues" },
    { name: "Generate Rx", shortName: "Prescribe" },
  ],

  // SIMPLE LEVEL - Single skill health
  simple: {
    name: "Simple",
    description: "diagnose explore skill",
    inputCount: 1,
    files: [
      {
        name: "src/skills/explore/",
        status: "completed",
        children: [
          { name: "SKILL.md", status: "completed", lines: 156 },
          { name: "references/", status: "completed", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "skill-health-checks", status: "loaded", category: "qa" },
      { name: "orchestkit-standards", status: "loaded", category: "standards" },
    ],
    claudeResponse: [
      "Running health diagnostics on explore skill:",
      "",
      "• 1 skill analyzed",
      "• 8 health dimensions",
      "• Scanning repository structure",
      "• Checking documentation",
    ],
    codeSnippet: `ORCHESTKIT HEALTH DIAGNOSTIC REPORT
────────────────────────────────────
Component: explore skill

Overall Health: 9.2/10 ✓ HEALTHY

┌─ Frontmatter Validation: 10/10
│  ✓ name: "explore"
│  ✓ description: Present and descriptive
│  ✓ tags: ["codebase", "analysis"]
│  ✓ user-invocable: true
│  ✓ agent: "backend-system-architect"
│  ✓ context: fork (required for CC 2.1.0+)
│
├─ Documentation: 9.0/10
│  ✓ Clear overview (5 paragraphs)
│  ✓ Usage examples included
│  ✓ Output format documented
│  ✓ All code samples have language tags
│  ⚠ Missing "Related Skills" section
│
├─ Structure: 10/10
│  ✓ SKILL.md exists in correct location
│  ✓ references/ folder present
│  ✓ No unnecessary files
│
├─ Completeness: 8.5/10
│  ✓ Core functionality documented
│  ✓ Common workflows covered
│  ⚠ Advanced use cases: sparse
│  ⚠ Troubleshooting section missing
│
├─ Integration: 9.5/10
│  ✓ Listed in manifests/ork.json
│  ✓ Hook system integration ready
│  ✓ Can be invoked via /ork:explore
│
├─ Code Quality: 9.0/10
│  ✓ Examples are valid TypeScript
│  ✓ No deprecated patterns used
│  ⚠ One example missing error handling
│
├─ Freshness: 8.8/10
│  ✓ Updated within 30 days
│  ✓ No deprecated dependencies
│  ⚠ One reference link is 404
│
└─ Discoverability: 9.2/10
   ✓ Clear skill name
   ✓ Appropriate tags
   ✓ Good description
   ✓ Capability details included

Diagnostic Summary:
✓ Skill is properly configured
✓ Documentation is comprehensive
✓ Ready for production use
⚠ 2 minor improvements recommended

Recommendations:
1. [LOW] Add "Related Skills" section
   Impact: Better cross-skill discovery
   Time: 15 minutes

2. [LOW] Add troubleshooting section
   Impact: Reduced support requests
   Time: 30 minutes

3. [LOW] Fix reference link (dead 404)
   Impact: Improved user experience
   Time: 5 minutes

Next scheduled check: 30 days
Status: HEALTHY - No action required`,
    completionTime: "5s",
    metrics: {
      Health: "9.2/10",
      Issues: "0",
      Warnings: "2",
    },
  },

  // MEDIUM LEVEL - Project health
  medium: {
    name: "Medium",
    description: "diagnose frontend project",
    inputCount: 8,
    files: [
      {
        name: "frontend/",
        status: "completed",
        children: [
          { name: "package.json", status: "completed", lines: 67 },
          { name: "tsconfig.json", status: "completed", lines: 45 },
          { name: "next.config.js", status: "completed", lines: 34 },
          { name: "src/", status: "completed", lines: 0 },
          { name: "tests/", status: "completed", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "project-health-standards", status: "loaded", category: "qa" },
      { name: "dependency-management", status: "loaded", category: "devops" },
      { name: "testing-requirements", status: "loading", category: "qa" },
    ],
    claudeResponse: [
      "Running comprehensive project health scan:",
      "",
      "• 8 components analyzed",
      "• 12 health dimensions",
      "• Dependency audit in progress",
      "• Test coverage analysis",
    ],
    codeSnippet: `ORCHESTKIT HEALTH DIAGNOSTIC REPORT
────────────────────────────────────
Project: frontend (Next.js 15 + React 19)

Overall Health: 7.8/10 ⚠ FAIR (Action Required)

┌─ Dependencies: 7.2/10
│  ✓ All packages latest minor versions
│  ⚠ 3 packages have available major upgrades
│     - @nextjs/bundle-analyzer: 13.x → 15.x
│     - zustand: 4.x → 5.x
│     - framer-motion: 10.x → 11.x
│  ✗ 1 package has critical security vulnerability
│     - lodash: XSS vulnerability CVE-2023-XXXX
│
├─ TypeScript: 8.5/10
│  ✓ Strict mode enabled
│  ✓ 94% of files typed
│  ⚠ 12 files with "any" types
│  ⚠ 3 implicit any errors
│
├─ Testing: 7.0/10
│  ✓ Jest configured
│  ✓ 156 test cases
│  ⚠ 73% coverage (target: 80%)
│  ⚠ No E2E tests
│  ✗ CI doesn't enforce coverage
│
├─ Code Quality: 7.6/10
│  ✓ ESLint configured (Biome 2.0)
│  ✓ Prettier formatting
│  ⚠ 24 linting warnings
│  ⚠ 3 complexity warnings (>15)
│
├─ Performance: 8.1/10
│  ✓ Bundle size: 245KB (gzipped)
│  ✓ Core Web Vitals: Good
│  ⚠ LCP: 2.8s (target: <2.5s)
│  ⚠ CLS: 0.12 (target: <0.1)
│
├─ Build: 8.3/10
│  ✓ Build time: 34s (good)
│  ✓ No build warnings
│  ⚠ No incremental builds
│
├─ Documentation: 7.4/10
│  ✓ README present
│  ⚠ Setup guide missing
│  ⚠ Architecture diagram outdated
│  ⚠ Component API docs: sparse
│
├─ Git Health: 8.8/10
│  ✓ Clean commit history
│  ✓ Main branch protected
│  ✓ PR reviews enforced
│  ⚠ 2 stale branches (>30 days)
│
├─ CI/CD: 7.9/10
│  ✓ GitHub Actions configured
│  ✓ Tests run on PR
│  ⚠ Coverage check not enforced
│  ⚠ No deployment preview
│  ⚠ Manual deploy to production
│
├─ Security: 7.5/10
│  ✗ Critical: lodash XSS vulnerability
│  ⚠ Medium: 2 dependency vulnerabilities
│  ✓ CSP headers configured
│  ✓ HTTPS enforced
│  ⚠ No SAST scanning in CI
│
├─ Monitoring: 6.8/10
│  ⚠ No error tracking (Sentry)
│  ⚠ No performance monitoring
│  ✓ Basic analytics enabled
│
└─ Accessibility: 7.2/10
   ⚠ No automated a11y testing
   ⚠ 3 WCAG violations found
   ✓ Semantic HTML used
   ⚠ Missing alt text on 12 images

Critical Issues (Action Required):
┌─ [P0] SECURITY: lodash XSS vulnerability
│       Status: Critical
│       Severity: High
│       Action: Upgrade or replace immediately
│       Fix: npm audit fix
│
├─ [P1] TESTING: No E2E tests
│       Status: High
│       Impact: Can't verify user flows
│       Action: Add Playwright E2E suite
│       Estimate: 2-3 weeks
│
└─ [P2] PERFORMANCE: LCP > 2.5s
        Status: High
        Impact: User experience degradation
        Action: Profile and optimize
        Estimate: 1 week

Warnings (Improve Soon):
• 24 linting warnings (clean up)
• Coverage: 73% → 80% target
• Update Next.js major version
• Sync zustand to v5

Status Summary:
✓ Builds successfully
✗ Has critical vulnerability
⚠ Below test coverage target
⚠ Performance below targets
✓ Git workflow good
⚠ No E2E tests

Automated Fix Available:
✓ npm audit fix (lodash)
  Cost: ~15 minutes, low risk

Manual Actions Required:
1. [CRITICAL] Fix security vulnerability (1 hour)
2. [HIGH] Add E2E tests (2 weeks)
3. [MEDIUM] Improve test coverage (1 week)
4. [MEDIUM] Optimize Core Web Vitals (1 week)
5. [LOW] Clean up linting warnings (2 hours)
6. [LOW] Update dependencies (4 hours)

Recommended Action Plan:
Week 1: Security fix + cleanup
Week 2: E2E test setup + coverage improvements
Week 3: Performance optimization
Week 4: Documentation updates

Next scheduled check: 7 days
Status: NEEDS ATTENTION - Critical issue found`,
    completionTime: "28s",
    metrics: {
      Health: "7.8/10",
      Critical: "1",
      High: "2",
      Medium: "3",
    },
  },

  // ADVANCED LEVEL - Entire system health
  advanced: {
    name: "Advanced",
    description: "diagnose full product stack",
    inputCount: 24,
    files: [
      {
        name: ".",
        status: "completed",
        children: [
          { name: "frontend/", status: "completed", lines: 0 },
          { name: "backend/", status: "completed", lines: 0 },
          { name: "packages/", status: "completed", lines: 0 },
          { name: "infrastructure/", status: "completed", lines: 0 },
          { name: "docs/", status: "completed", lines: 0 },
        ],
      },
    ],
    references: [
      { name: "system-health-standards", status: "loaded", category: "qa" },
      { name: "devops-checklist", status: "loaded", category: "devops" },
      { name: "security-audit-framework", status: "loaded", category: "security" },
      { name: "performance-standards", status: "loading", category: "perf" },
      { name: "organizational-metrics", status: "pending", category: "metrics" },
    ],
    claudeResponse: [
      "Running enterprise-grade system diagnostics:",
      "",
      "• 5 major components analyzed",
      "• 50+ health dimensions",
      "• Security audit in progress",
      "• Dependency/vulnerability scan",
      "• Performance profiling",
      "• Team velocity analysis",
    ],
    codeSnippet: `ORCHESTKIT HEALTH DIAGNOSTIC REPORT
────────────────────────────────────
System: Full Product Stack (Monorepo)

Overall Health: 7.4/10 ⚠ FAIR (Roadmap: Healthy)

COMPONENT BREAKDOWN:
┌─ Frontend (Next.js): 7.8/10 ⚠
│  Issues: lodash XSS, low E2E coverage, LCP > target
│  Status: Needs attention
│
├─ Backend (FastAPI): 8.6/10 ✓
│  Issues: None critical
│  Status: Good
│
├─ Database: 8.2/10 ✓
│  Issues: Query performance on 2 tables
│  Status: Good (minor optimizations)
│
├─ Infrastructure: 6.9/10 ⚠
│  Issues: No auto-scaling, manual deployments
│  Status: Needs attention
│
└─ Monorepo Setup: 7.1/10 ⚠
   Issues: Workspace dependencies outdated
   Status: Needs attention

CRITICAL ISSUES (5 Found):
┌─ [P0] Frontend: lodash XSS vulnerability
│       Component: frontend/package.json
│       Severity: Critical
│       CVSS: 9.8
│       Fix time: 1 hour
│       Status: Blocks release
│
├─ [P1] Infrastructure: No auto-scaling configured
│       Component: infrastructure/terraform/
│       Severity: High
│       Business impact: Can't handle traffic spike
│       Fix time: 3 days
│
├─ [P1] Backend: N+1 query in user listing
│       Component: backend/src/api/users.py
│       Severity: High
│       Performance: 500ms → 5s at scale
│       Fix time: 1 day
│
├─ [P2] Frontend: Only 73% test coverage
│       Component: frontend/tests/
│       Severity: Medium
│       Risk: Untested code paths
│       Fix time: 2 weeks
│
└─ [P2] Database: Missing indexes on 2 columns
        Component: database/migrations/
        Severity: Medium
        Query impact: 2s → 200ms
        Fix time: 2 hours

SECURITY AUDIT:
┌─ Dependency Vulnerabilities: 4 Found
│  • lodash: XSS (CRITICAL) ← Blocking release
│  • express: ReDoS (HIGH)
│  • pg: SQL injection (MEDIUM) ← Fixed in v8.5
│  • axios: XXE (MEDIUM)
│
├─ Infrastructure Security: 6/10
│  ✗ No rate limiting (DDoS vulnerable)
│  ✗ No WAF deployed
│  ✗ Secrets in git history (3 found!)
│  ✓ HTTPS enforced
│  ✓ CSP headers present
│  ✓ Regular backups enabled
│
├─ Code Security: 8/10
│  ✓ Input validation present
│  ✓ No hardcoded secrets (except git history)
│  ✓ OWASP compliance: 9/10
│  ⚠ 1 potential XSS vector in user input
│
└─ Compliance: 7/10
   ✓ GDPR: Mostly compliant
   ⚠ PCI-DSS: Not applicable (no payments)
   ⚠ SOC 2: Audit pending

PERFORMANCE METRICS:
┌─ Frontend
│  ├─ Bundle size: 245KB (good)
│  ├─ LCP: 2.8s (target: 2.5s) [90% compliance]
│  ├─ CLS: 0.12 (target: 0.1) [85% compliance]
│  └─ Lighthouse: 86/100
│
├─ Backend
│  ├─ API response: p95 = 180ms (good)
│  ├─ DB query: p99 = 250ms (has outliers)
│  ├─ Error rate: 0.12% (good)
│  └─ Availability: 99.87% (exceeds 99.9% SLA)
│
└─ Infrastructure
   ├─ CPU utilization: 45% (healthy)
   ├─ Memory: 62% (acceptable)
   ├─ Disk: 71% (monitor growth)
   └─ Network latency: 23ms p95

OPERATIONAL METRICS:
┌─ CI/CD Pipeline: 7.4/10
│  ├─ Build time: 4m 12s (good)
│  ├─ Test suite: 3m 34s (acceptable)
│  ├─ Test pass rate: 97.3% (good)
│  ├─ Coverage enforcement: NOT enabled ⚠
│  ├─ Security scanning: Basic (improve)
│  └─ Deploy frequency: 1x/week (could be 2x/week)
│
├─ Monitoring & Alerts: 7.0/10
│  ├─ Error tracking: Sentry (good)
│  ├─ Performance monitoring: Missing ⚠
│  ├─ Alert coverage: 80% of critical paths
│  ├─ On-call rotation: Weekly
│  └─ SLO tracking: Defined but not enforced
│
├─ Documentation: 6.8/10
│  ├─ README: Present but outdated
│  ├─ Architecture guide: Missing ⚠
│  ├─ API docs: Auto-generated (good)
│  ├─ Setup guide: Incomplete
│  └─ Runbook: Exists but outdated
│
└─ Team Velocity: 7.2/10
   ├─ PRs per week: 12 (good)
   ├─ Review time: avg 18 hours (good)
   ├─ Deployment confidence: 89% (good)
   ├─ Incident response: 34 min (acceptable)
   └─ Knowledge distribution: Uneven (2 single points of failure)

RISK ASSESSMENT:
High Risk:
├─ lodash XSS could be exploited immediately
├─ No auto-scaling causes cascade failure at scale
└─ Secrets in git history need remediation

Medium Risk:
├─ Low test coverage hides bugs
├─ Missing performance monitoring (blind spots)
└─ Manual deployments cause human error

Low Risk:
├─ Database indexes will be needed soon
└─ Documentation debt accumulating

ROADMAP TO HEALTHY (Target: 9.0/10):

Phase 1: CRITICAL (This Sprint)
Effort: 1 week, Cost: $8k
├─ [P0] Fix lodash XSS (1 hour) ← BLOCKING
├─ [P1] Fix express ReDoS (2 hours)
├─ [P1] Remove secrets from git history (4 hours)
├─ [P1] Add auto-scaling (2 days)
└─ [P2] Add database indexes (2 hours)
Status: BLOCKERS for production release
Metrics after fix: 8.1/10

Phase 2: HIGH (Next Sprint)
Effort: 2 weeks, Cost: $12k
├─ [P1] Fix N+1 query (1 day)
├─ [P2] Improve test coverage 73% → 85% (5 days)
├─ [P2] Add WAF + rate limiting (2 days)
└─ [P2] Setup performance monitoring (2 days)
Status: Improves stability + security
Metrics after fix: 8.6/10

Phase 3: MEDIUM (Planned)
Effort: 3 weeks, Cost: $15k
├─ Add E2E tests (2 weeks)
├─ Update documentation (1 week)
├─ Implement SLO tracking (3 days)
└─ Fix single points of failure (1 week)
Status: Increases reliability
Metrics after fix: 9.1/10

Phase 4: NICE-TO-HAVE (Future)
Effort: 2 weeks, Cost: $10k
├─ Implement advanced monitoring
├─ Add chaos engineering tests
└─ Optimize Core Web Vitals further

AUTOMATED FIXES AVAILABLE:
✓ npm audit fix (all packages) - 15 min, low risk
✓ git filter-branch (remove secrets) - 30 min, medium risk
✓ Database index creation - 5 min, low risk

PRIORITY SUMMARY:
╔════════════════════════════════════════════════════════════╗
║ BLOCKER (Fix before release):                              ║
║ • lodash XSS vulnerability                                 ║
║ Estimated fix time: 1-2 hours                              ║
║ Status: NOT STARTED - Start immediately                    ║
╚════════════════════════════════════════════════════════════╝

Next Steps:
1. [URGENT] Schedule incident response for lodash CVE
2. [TODAY] Fix secrets in git history
3. [THIS WEEK] Implement auto-scaling
4. [NEXT SPRINT] Improve test coverage + fix N+1 query

Scheduled Next Check: 7 days
System Status: NEEDS ATTENTION - Critical vulnerability blocks deployment

Health Trend: ↑ Improving (+0.2 from last month)
Team Capacity: Adequate to address phase 1 + 2
Estimated time to HEALTHY (9.0/10): 4-6 weeks`,
    completionTime: "3m 42s",
    metrics: {
      Health: "7.4/10",
      Critical: "1",
      High: "2",
      Medium: "2",
      Components: "5",
    },
  },

  summaryTitle: "🏥 DIAGNOSTICS COMPLETE",
  summaryTagline: "System health assessed. Prescription ready. Execute roadmap.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default doctorDemoConfig;
