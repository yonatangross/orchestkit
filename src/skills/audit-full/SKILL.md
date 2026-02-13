---
name: audit-full
license: MIT
compatibility: "Claude Code 2.1.34+. Requires memory MCP server."
description: "Full-codebase audit using 1M context window. Security, architecture, and dependency analysis in a single pass. Use when you need whole-project analysis."
argument-hint: "[scope]"
context: fork
version: 1.0.0
author: OrchestKit
tags: [security, architecture, audit, dependencies, 1m-context, cross-file]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Bash, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [security-scanning, security-patterns, architecture-patterns, quality-gates]
complexity: max
metadata:
  category: document-asset-creation
  mcp-server: memory
---

# Full-Codebase Audit

Single-pass whole-project analysis leveraging Opus 4.6's extended context window. Loads entire codebases (~50K LOC) into context for cross-file vulnerability detection, architecture review, and dependency analysis.

## Quick Start

```bash
/audit-full                          # Full audit (all modes)
/audit-full security                 # Security-focused audit
/audit-full architecture             # Architecture review
/audit-full dependencies             # Dependency audit
```

> **Opus 4.6**: Uses `complexity: max` for extended thinking across entire codebases. 1M context (beta, Tier 4+) enables cross-file reasoning that chunked approaches miss.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify audit scope:

```python
AskUserQuestion(
  questions=[
    {
      "question": "What type of audit do you want to run?",
      "header": "Audit mode",
      "options": [
        {"label": "Full audit (Recommended)", "description": "Security + architecture + dependencies in one pass"},
        {"label": "Security audit", "description": "Cross-file vulnerability analysis, data flow tracing, OWASP mapping"},
        {"label": "Architecture review", "description": "Pattern consistency, coupling analysis, dependency violations"},
        {"label": "Dependency audit", "description": "License compliance, CVE checking, version currency"}
      ],
      "multiSelect": false
    },
    {
      "question": "What should be audited?",
      "header": "Scope",
      "options": [
        {"label": "Entire codebase", "description": "Load all source files into context"},
        {"label": "Specific directory", "description": "Focus on a subdirectory (e.g., src/api/)"},
        {"label": "Changed files only", "description": "Audit only files changed vs main branch"}
      ],
      "multiSelect": false
    }
  ]
)
```

**Based on answers, adjust workflow:**
- **Full audit**: All 3 domains, maximum context usage
- **Security only**: Focus token budget on source + config files
- **Architecture only**: Focus on module boundaries, imports, interfaces
- **Dependency only**: Focus on lock files, manifests, import maps
- **Changed files only**: Use `git diff --name-only main...HEAD` to scope

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

### Run Token Estimation

```bash
# Use the estimation script
bash ${CLAUDE_PLUGIN_ROOT}/src/skills/audit-full/scripts/estimate-tokens.sh /path/to/project
```

### Manual Estimation Rules

| File Type | Tokens per Line (approx) |
|-----------|-------------------------|
| TypeScript/JavaScript | ~8 tokens/line |
| Python | ~7 tokens/line |
| JSON/YAML config | ~5 tokens/line |
| Markdown docs | ~6 tokens/line |
| CSS/SCSS | ~6 tokens/line |

### Budget Allocation

| Context Size | Available for Code | Fits LOC (approx) |
|-------------|-------------------|-------------------|
| 200K (standard) | ~150K tokens | ~20K LOC |
| 1M (beta) | ~800K tokens | ~100K LOC |

### Auto-Exclusion List

Always exclude from loading:
- `node_modules/`, `vendor/`, `.venv/`, `__pycache__/`
- `dist/`, `build/`, `.next/`, `out/`
- `*.min.js`, `*.map`, `*.lock` (read lock files separately for deps audit)
- Binary files, images, fonts
- Test fixtures and snapshots (unless auditing tests)
- Generated files (protobuf, graphql codegen)

### If Codebase Exceeds Budget

1. **Priority loading**: Entry points first, then imported modules
2. **Directory scoping**: Ask user to narrow to specific directories
3. **Fallback**: Recommend `/ork:verify` for chunked multi-agent approach

```python
# Fallback suggestion
AskUserQuestion(
  questions=[{
    "question": "Codebase exceeds context window. How to proceed?",
    "header": "Too large",
    "options": [
      {"label": "Narrow scope", "description": "Audit specific directories only"},
      {"label": "Use /ork:verify instead", "description": "Chunked multi-agent approach (works with any context size)"},
      {"label": "Priority loading", "description": "Load entry points + critical paths only"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 2: Load Codebase into Context

### Loading Strategy

1. **Glob all source files** matching inclusion patterns
2. **Sort by priority**: entry points → core modules → utilities → config
3. **Read files in parallel** using multiple Read tool calls per message
4. **Track loaded tokens** to stay within budget

### Inclusion Patterns (by language)

```bash
# TypeScript/JavaScript
**/*.ts **/*.tsx **/*.js **/*.jsx
**/package.json **/tsconfig.json

# Python
**/*.py
**/pyproject.toml **/setup.cfg **/requirements*.txt

# Config
**/.env.example **/docker-compose*.yml **/Dockerfile
**/*.yaml **/*.yml (non-lock)
```

### Reading Pattern

Read files in batches of 10-15 per message for efficiency:

```python
# Batch 1: Entry points and config
Read("src/index.ts")
Read("src/app.ts")
Read("package.json")
Read("tsconfig.json")
# ... up to 15 files

# Batch 2: Core modules
Read("src/api/routes.ts")
Read("src/db/connection.ts")
# ... next batch
```

---

## STEP 3: Audit Analysis

With codebase loaded, perform the selected audit mode(s).

### Security Audit

See `references/security-audit-guide.md` for the full checklist.

Key cross-file analysis patterns:
1. **Data flow tracing**: Track user input from entry point → processing → storage
2. **Auth boundary verification**: Ensure all protected routes check auth
3. **Secret detection**: Scan for hardcoded credentials, API keys, tokens
4. **Injection surfaces**: SQL, command, template injection across file boundaries
5. **OWASP Top 10 mapping**: Classify findings by OWASP category

### Architecture Review

See `references/architecture-review-guide.md` for the full guide.

Key analysis patterns:
1. **Dependency direction**: Verify imports flow inward (clean architecture)
2. **Circular dependencies**: Detect import cycles across modules
3. **Layer violations**: Business logic in controllers, DB in routes, etc.
4. **Pattern consistency**: Same problem solved differently across codebase
5. **Coupling analysis**: Count cross-module imports, identify tight coupling

### Dependency Audit

See `references/dependency-audit-guide.md` for the full guide.

Key analysis patterns:
1. **Known CVEs**: Check versions against known vulnerabilities
2. **License compliance**: Identify copyleft licenses in proprietary code
3. **Version currency**: Flag significantly outdated dependencies
4. **Transitive risk**: Identify deep dependency chains
5. **Unused dependencies**: Detect installed but never imported packages

---

## STEP 4: Generate Report

Use the report template from `assets/audit-report-template.md`.

### Report Structure

```markdown
# Audit Report: {project-name}
**Date:** {date} | **Mode:** {mode} | **Files loaded:** {count} | **LOC:** {loc}

## Executive Summary
{1-3 sentences: overall health, critical findings count}

## Findings

| # | Severity | Category | File(s) | Finding | Remediation |
|---|----------|----------|---------|---------|-------------|
| 1 | CRITICAL | Security | src/auth.ts:42 | ... | ... |

## Severity Breakdown
- CRITICAL: {n} (must fix before deploy)
- HIGH: {n} (fix within sprint)
- MEDIUM: {n} (fix within quarter)
- LOW: {n} (track and address)

## Architecture Diagram
{ASCII diagram of module dependencies}

## Recommendations
{Prioritized action items}
```

### Severity Classification

See `assets/severity-matrix.md` for classification criteria.

### Completion Checklist

Before finalizing the report, verify with `checklists/audit-completion.md`.

---

## When NOT to Use

| Situation | Use Instead |
|-----------|-------------|
| Small targeted check (1-5 files) | Direct Read + analysis |
| CI/CD automated scanning | `security-scanning` skill |
| Multi-agent graded verification | `/ork:verify` |
| Exploring unfamiliar codebase | `/ork:explore` |
| Context window < 200K tokens | `/ork:verify` (chunked approach) |

---

## Related Skills

- `security-scanning` — Automated scanner integration (npm audit, Semgrep, etc.)
- `security-patterns` — Security architecture patterns and OWASP vulnerability classification
- `architecture-patterns` — Architectural pattern reference
- `quality-gates` — Quality assessment criteria
- `verify` — Chunked multi-agent verification (fallback for large codebases)

## References

- [Security Audit Guide](references/security-audit-guide.md) — Cross-file vulnerability patterns
- [Architecture Review Guide](references/architecture-review-guide.md) — Pattern and coupling analysis
- [Dependency Audit Guide](references/dependency-audit-guide.md) — CVE, license, currency checks
- [Token Estimation](references/token-estimation.md) — File type ratios and budget planning
- [Audit Report Template](assets/audit-report-template.md) — Structured output format
- [Severity Matrix](assets/severity-matrix.md) — Finding classification criteria
- [Audit Completion Checklist](checklists/audit-completion.md) — Pre-report verification
- [Token Estimation Script](scripts/estimate-tokens.sh) — Automated LOC → token estimation
