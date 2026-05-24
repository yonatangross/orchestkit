---
name: audit-full
license: MIT
compatibility: "Claude Code 2.1.148+. Requires memory MCP server."
description: "Single-pass codebase analysis leveraging Opus 4.6 1M context for comprehensive security scanning, architecture review, and dependency auditing. Loads entire codebases for cross-file pattern detection and generates structured audit reports with severity-ranked findings. Use when you need whole-project analysis before releases or security reviews."
argument-hint: "[scope]"
context: fork
version: 1.2.0
author: OrchestKit
tags: [security, architecture, audit, dependencies, 1m-context, cross-file]
user-invocable: false
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Bash, Task, TaskCreate, TaskUpdate, TaskList, PushNotification, mcp__memory__search_nodes]
skills: [security-patterns, architecture-patterns, quality-gates]
complexity: max
persuasion-type: discipline
effort: high
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

> **Opus 4.6 / 4.7**: Uses `complexity: max` for extended thinking across entire codebases. 1M context (GA) enables cross-file reasoning that chunked approaches miss. On Opus 4.7, prefers `xhigh` effort for one additional cross-file pattern sweep.

> **1M Context Required:** If `CLAUDE_CODE_DISABLE_1M_CONTEXT` is set, audit-full cannot perform full-codebase analysis. Check: `echo $CLAUDE_CODE_DISABLE_1M_CONTEXT` — if non-empty, either unset it (`unset CLAUDE_CODE_DISABLE_1M_CONTEXT`) or use `/ork:verify` for chunked analysis instead.

> **Effort (CC 2.1.111+):** `xhigh` (Opus 4.7 only) adds a second pass that re-reads cross-module boundaries specifically looking for patterns the first pass normalized over. Silently falls back to `high` on other models; `/ork:doctor` warns on mismatch.

> **Switching to Opus (CC 2.1.144+):** `/model` now affects the current session only — pick Opus for this audit without it persisting. Press `d` in the picker only if you want it as the default for new sessions too.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify audit scope using the interactive dialog.

Load: `Read("${CLAUDE_SKILL_DIR}/references/audit-scope-dialog.md")` for the full AskUserQuestion dialog with mode options (Full/Security/Architecture/Dependencies) and scope options (Entire codebase/Specific directory/Changed files).

---

## CRITICAL: Task Management is MANDATORY

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Full-codebase audit",
  description="Single-pass audit using extended context",
  activeForm="Running full-codebase audit"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Estimate token budget and plan loading", activeForm="Estimating token budget")  # id=2
TaskCreate(subject="Load codebase into context", activeForm="Loading codebase")                    # id=3
TaskCreate(subject="Run audit analysis", activeForm="Analyzing codebase")                          # id=4
TaskCreate(subject="Generate audit report", activeForm="Generating report")                        # id=5

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Loading needs budget estimate
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Analysis needs codebase loaded
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Report needs analysis done

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
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

### Progressive Output (CC 2.1.76)

Output findings **incrementally** as each audit mode completes — don't batch until the report:

1. **Security findings first** — show critical/high vulnerabilities immediately, don't wait for architecture review
2. **Architecture findings** — show dependency direction violations, circular deps as they surface
3. **Dependency findings** — show CVE matches, license compliance issues

For multi-mode audits (Full), each mode's findings appear as they complete. This lets users act on critical security findings while architecture analysis is still running.

---

## STEP 4: Generate Report

Load the report template: `Read("${CLAUDE_SKILL_DIR}/assets/audit-report-template.md")`.

Report structure and severity classification: `Read("${CLAUDE_SKILL_DIR}/references/report-structure.md")` for finding table format, severity breakdown (CRITICAL/HIGH/MEDIUM/LOW with timelines), and architecture diagram conventions.

Severity matrix: `Read("${CLAUDE_SKILL_DIR}/assets/severity-matrix.md")` for classification criteria.

### Completion Checklist

Before finalizing the report, verify with `Read("${CLAUDE_SKILL_DIR}/checklists/audit-completion.md")`.

### PushNotification on Completion (CC 2.1.110+)

A full-codebase 1M-context audit typically runs 15–60 minutes on medium projects and can exceed that on large ones. **After the report file is written and the completion checklist passes, call `PushNotification`** so the finding counts are visible even if the user walked away.

```python
PushNotification(
  title="ork:audit-full complete",
  body=f"{SCOPE}: {critical}C/{high}H/{medium}M/{low}L findings · report at {report_path}"
)
```

Full rule: `Read("/Users/yonatangross/coding/yonatangross/orchestkit/plugins/ork/skills/chain-patterns/rules/push-notification-on-completion.md")`.

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

## Notes for whole-codebase passes

> **Oversized reads (CC 2.1.144+):** When loading large files, Read returns a `[PARTIAL view]` truncated first page instead of a hard error if the whole-file read exceeds the token limit. Detect that notice and re-read with explicit `offset`/`limit` to page through the rest — a partial read silently omits code an audit must not miss.

> **When context fills (CC 2.1.141+):** Use the rewind menu's "Summarize up to here" to compress earlier turns while keeping recent findings, instead of restarting the audit. Reactive compaction (CC 2.1.142+) sizes the first summarize to the actual overflow, so a wasted second pass mid-turn is now rare.

---

## Running unattended with /goal

Set a completion condition with `/goal` (CC 2.1.139+) and this skill will keep working across turns until the condition is met. Works in interactive, `-p`, and Remote Control. The overlay panel shows live elapsed / turns / tokens.

**Example completion condition for this skill:**

```
/goal until findings.critical == 0 OR no_new_critical_for_3_turns
```

Stops when: zero critical issues remain across 3 consecutive passes, or a structural anti-pattern budget is reached. Compatible with claude.ai Remote Control runs.

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
