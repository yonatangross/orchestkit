---
name: audit-full
license: MIT
compatibility: "Claude Code 2.1.74+. Requires memory MCP server."
description: "Full-codebase audit using 1M context window. Security, architecture, and dependency analysis in a single pass. Use when you need whole-project analysis."
argument-hint: "[scope]"
context: fork
version: 1.0.0
author: OrchestKit
tags: [security, architecture, audit, dependencies, 1m-context, cross-file]
user-invocable: false
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Bash, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [security-patterns, architecture-patterns, quality-gates]
complexity: max
model: opus
metadata:
  category: document-asset-creation
  mcp-server: memory
---

# Full-Codebase Audit

Single-pass whole-project analysis leveraging Opus 4.6's extended context window. Loads entire codebases (~50K LOC) into context for cross-file vulnerability detection, architecture review, and dependency analysis.

## Quick Start

```bash
/ork:audit-full                          # Full audit (all modes)
/ork:audit-full security                 # Security-focused audit
/ork:audit-full architecture             # Architecture review
/ork:audit-full dependencies             # Dependency audit
```

> **Opus 4.6**: Uses `complexity: max` for extended thinking across entire codebases. 1M context (GA) enables cross-file reasoning that chunked approaches miss.

> **1M Context Required:** If `CLAUDE_CODE_DISABLE_1M_CONTEXT` is set, audit-full cannot perform full-codebase analysis. Check: `echo $CLAUDE_CODE_DISABLE_1M_CONTEXT` — if non-empty, either unset it (`unset CLAUDE_CODE_DISABLE_1M_CONTEXT`) or use `/ork:verify` for chunked analysis instead.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify audit scope using the interactive dialog.

Load: `Read("${CLAUDE_SKILL_DIR}/references/audit-scope-dialog.md")` for the full AskUserQuestion dialog with mode options (Full/Security/Architecture/Dependencies) and scope options (Entire codebase/Specific directory/Changed files).

---

## CRITICAL: Task Management is MANDATORY

```python
TaskCreate(
  subject="Full-codebase audit",
  description="Single-pass audit using extended context",
  activeForm="Running full-codebase audit"
)

# Phase subtasks
TaskCreate(subject="Estimate token budget and plan loading", activeForm="Estimating token budget")
TaskCreate(subject="Load codebase into context", activeForm="Loading codebase")
TaskCreate(subject="Run audit analysis", activeForm="Analyzing codebase")
TaskCreate(subject="Generate audit report", activeForm="Generating report")
```

---

## STEP 1: Estimate Token Budget

Before loading files, estimate whether the codebase fits in context.

Load: `Read("${CLAUDE_SKILL_DIR}/references/token-budget-planning.md")` for estimation rules (tokens/line by file type), budget allocation tables, auto-exclusion list, and fallback dialog when codebase exceeds budget.

Run estimation: `bash ${CLAUDE_SKILL_DIR}/scripts/estimate-tokens.sh /path/to/project`

---

## STEP 2: Load Codebase into Context

Load: `Read("${CLAUDE_SKILL_DIR}/references/report-structure.md")` for loading strategy, inclusion patterns by language (TS/JS, Python, Config), and batch reading patterns.

---

## STEP 3: Audit Analysis

With codebase loaded, perform the selected audit mode(s).

### Security Audit

Load: `Read("${CLAUDE_SKILL_DIR}/references/security-audit-guide.md")` for the full checklist.

Key cross-file analysis patterns:
1. **Data flow tracing**: Track user input from entry point → processing → storage
2. **Auth boundary verification**: Ensure all protected routes check auth
3. **Secret detection**: Scan for hardcoded credentials, API keys, tokens
4. **Injection surfaces**: SQL, command, template injection across file boundaries
5. **OWASP Top 10 mapping**: Classify findings by OWASP category

### Architecture Review

Load: `Read("${CLAUDE_SKILL_DIR}/references/architecture-review-guide.md")` for the full guide.

Key analysis patterns:
1. **Dependency direction**: Verify imports flow inward (clean architecture)
2. **Circular dependencies**: Detect import cycles across modules
3. **Layer violations**: Business logic in controllers, DB in routes, etc.
4. **Pattern consistency**: Same problem solved differently across codebase
5. **Coupling analysis**: Count cross-module imports, identify tight coupling

### Dependency Audit

Load: `Read("${CLAUDE_SKILL_DIR}/references/dependency-audit-guide.md")` for the full guide.

Key analysis patterns:
1. **Known CVEs**: Check versions against known vulnerabilities
2. **License compliance**: Identify copyleft licenses in proprietary code
3. **Version currency**: Flag significantly outdated dependencies
4. **Transitive risk**: Identify deep dependency chains
5. **Unused dependencies**: Detect installed but never imported packages

---

## STEP 4: Generate Report

Load the report template: `Read("${CLAUDE_SKILL_DIR}/assets/audit-report-template.md")`.

Report structure and severity classification: `Read("${CLAUDE_SKILL_DIR}/references/report-structure.md")` for finding table format, severity breakdown (CRITICAL/HIGH/MEDIUM/LOW with timelines), and architecture diagram conventions.

Severity matrix: `Read("${CLAUDE_SKILL_DIR}/assets/severity-matrix.md")` for classification criteria.

### Completion Checklist

Before finalizing the report, verify with `Read("${CLAUDE_SKILL_DIR}/checklists/audit-completion.md")`.

---

## When NOT to Use

| Situation | Use Instead |
|-----------|-------------|
| Small targeted check (1-5 files) | Direct Read + analysis |
| CI/CD automated scanning | `security-scanning` skill |
| Multi-agent graded verification | `/ork:verify` |
| Exploring unfamiliar codebase | `/ork:explore` |
| Codebase > 125K LOC (exceeds 1M) | `/ork:verify` (chunked approach) |

---

## Related Skills

- `security-scanning` — Automated scanner integration (npm audit, Semgrep, etc.)
- `ork:security-patterns` — Security architecture patterns and OWASP vulnerability classification
- `ork:architecture-patterns` — Architectural pattern reference
- `ork:quality-gates` — Quality assessment criteria
- `ork:verify` — Multi-agent verification (fallback for codebases exceeding 1M context)

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `references/security-audit-guide.md` | Cross-file vulnerability patterns |
| `references/architecture-review-guide.md` | Pattern and coupling analysis |
| `references/dependency-audit-guide.md` | CVE, license, currency checks |
| `references/token-estimation.md` | File type ratios and budget planning |
| `assets/audit-report-template.md` | Structured output format |
| `assets/severity-matrix.md` | Finding classification criteria |
| `checklists/audit-completion.md` | Pre-report verification |
| `scripts/estimate-tokens.sh` | Automated LOC to token estimation |
