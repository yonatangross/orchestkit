# Audit Report Template

Use this structure for all audit reports.

## Template

```markdown
# Audit Report: {project-name}

**Date:** {YYYY-MM-DD}
**Auditor:** Claude Opus 4.6 via /ork:audit-full
**Mode:** {Full | Security | Architecture | Dependencies}
**Scope:** {Entire codebase | Directory: path/ | Changed files only}

## Summary

| Metric | Value |
|--------|-------|
| Files loaded | {count} |
| Lines of code | {loc} |
| Estimated tokens | {tokens} |
| Context utilization | {percentage}% |

### Findings Overview

| Severity | Count |
|----------|-------|
| CRITICAL | {n} |
| HIGH | {n} |
| MEDIUM | {n} |
| LOW | {n} |
| **Total** | **{total}** |

**Overall Health Score: {0-10}/10**

## Findings

### CRITICAL

#### F-001: {Finding title}
- **Category:** {Security | Architecture | Dependency}
- **OWASP:** {A01-A10 if applicable}
- **File(s):** `{file:line}`, `{file:line}`
- **Description:** {What the issue is}
- **Impact:** {What could happen if exploited/unfixed}
- **Evidence:**
  ```{language}
  {relevant code snippet}
  ```
- **Remediation:**
  ```{language}
  {fixed code snippet}
  ```
- **Effort:** {Low | Medium | High}

### HIGH

#### F-002: {Finding title}
{same structure as above}

### MEDIUM

#### F-003: {Finding title}
{same structure as above}

### LOW

#### F-004: {Finding title}
{same structure as above}

## Architecture Overview

{ASCII diagram of module dependencies with violations marked}

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  routes   │────▶│ services │────▶│  repos   │
└──────────┘     └──────────┘     └──────────┘
                       │
                       ▼
                 ┌──────────┐
                 │  domain  │
                 └──────────┘

Violations: {list any dependency direction violations}
```

## Dependency Summary

| Package | Current | Latest | Status | Risk |
|---------|---------|--------|--------|------|
| {name} | {ver} | {ver} | {Current/Stale/Outdated/EOL} | {severity} |

## Recommendations

### Immediate (This Sprint)
1. {Fix critical findings F-001, F-002}

### Short-term (This Quarter)
1. {Address high findings}
2. {Update outdated dependencies}

### Long-term (Backlog)
1. {Architecture improvements}
2. {Pattern consolidation}

## Appendix

### Files Analyzed
{list of all files loaded into context}

### Methodology
- Single-pass analysis using Opus 4.6 extended context
- Cross-file data flow tracing
- OWASP Top 10 mapping
- Clean architecture layering check
```

## Report Quality Checklist

Before delivering the report:
- [ ] Every finding has file:line references
- [ ] Every finding has a remediation suggestion
- [ ] Severity classifications match the severity matrix
- [ ] Architecture diagram reflects actual dependencies
- [ ] Recommendations are prioritized by impact and effort
- [ ] No false positives left unverified
