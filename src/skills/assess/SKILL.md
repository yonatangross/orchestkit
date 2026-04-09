---
name: assess
license: MIT
compatibility: "Claude Code 2.1.76+. Requires memory MCP server."
description: "Assesses and rates quality 0-10 with pros/cons analysis. Use when evaluating code, designs, or approaches."
context: fork
version: 1.4.0
author: OrchestKit
tags: [assessment, evaluation, quality, comparison, pros-cons, rating]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, ToolSearch, mcp__memory__search_nodes, Bash]
skills: [code-review-playbook, quality-gates, architecture-decision-record, memory, chain-patterns]
argument-hint: "[code-path-or-topic]"
complexity: high
persuasion-type: guidance
effort: high
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Read"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/assessment-baseline-loader"
      once: true
metadata:
  category: document-asset-creation
  mcp-server: memory
triggers:
  keywords: [assess, asses, rate, evaluate, grade, score, compare, "how good", "how bad", "red flags", "trade-offs", "pros and cons", "good enough"]
  examples:
    - "rate this code from 0 to 10"
    - "is this approach good enough for production?"
    - "evaluate the trade-offs between Redis vs Postgres"
  anti-triggers: [fix, implement, build, test, commit, review pr, explore]
---

# Assess

Comprehensive assessment skill for answering "is this good?" with structured evaluation, scoring, and actionable recommendations.

## Quick Start

```bash
/ork:assess backend/app/services/auth.py
/ork:assess our caching strategy
/ork:assess --model=opus the current database schema
/ork:assess frontend/src/components/Dashboard
```

---

## Argument Resolution

```python
TARGET = "$ARGUMENTS"  # Full argument string, e.g., "backend/app/services/auth.py"
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)

# Model override detection (CC 2.1.72)
MODEL_OVERRIDE = None
for token in "$ARGUMENTS".split():
    if token.startswith("--model="):
        MODEL_OVERRIDE = token.split("=", 1)[1]  # "opus", "sonnet", "haiku"
        TARGET = TARGET.replace(token, "").strip()
```

Pass `MODEL_OVERRIDE` to all Agent() calls via `model=MODEL_OVERRIDE` when set. Accepts symbolic names (`opus`, `sonnet`, `haiku`) or full IDs (`claude-opus-4-6`) per CC 2.1.74.

---

## STEP -1: MCP Probe + Resume Check

> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")`

```python
# 1. Probe MCP servers (once at skill start)
ToolSearch(query="select:mcp__memory__search_nodes")

# 2. Store capabilities
Write(".claude/chain/capabilities.json", {
  "memory": probe_memory.found,
  "skill": "assess",
  "timestamp": now()
})

# 3. Check for resume
state = Read(".claude/chain/state.json")  # may not exist
if state.skill == "assess" and state.status == "in_progress":
    last_handoff = Read(f".claude/chain/{state.last_handoff}")
```

### Phase Handoffs

| Phase | Handoff File | Contents |
|-------|-------------|----------|
| 0 | `00-intent.json` | Dimensions, target, mode |
| 1 | `01-baseline.json` | Initial codebase scan results |
| 2 | `02-evaluation.json` | Per-dimension scores + evidence |
| 3 | `03-report.json` | Final report, grade, recommendations |

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify assessment dimensions:

```python
AskUserQuestion(
  questions=[{
    "question": "What dimensions to assess?",
    "header": "Dimensions",
    "options": [
      {"label": "Full assessment (Recommended)", "description": "All dimensions: quality, maintainability, security, performance", "markdown": "```\nFull Assessment (7 phases)\n──────────────────────────\n  Dimensions scored 0-10:\n  ┌─────────────────────────────┐\n  │ Correctness      ████████░░ │\n  │ Maintainability  ██████░░░░ │\n  │ Security         █████████░ │\n  │ Performance      ███████░░░ │\n  │ Testability      ██████░░░░ │\n  │ Architecture     ████████░░ │\n  │ Documentation    █████░░░░░ │\n  └─────────────────────────────┘\n  + Pros/cons + alternatives\n  + Effort estimates + report\n  Agents: 4 parallel evaluators\n```"},
      {"label": "Code quality only", "description": "Readability, complexity, best practices", "markdown": "```\nCode Quality Focus\n──────────────────\n  Dimensions scored 0-10:\n  ┌─────────────────────────────┐\n  │ Correctness      ████████░░ │\n  │ Maintainability  ██████░░░░ │\n  │ Testability      ██████░░░░ │\n  └─────────────────────────────┘\n  Skip: security, performance\n  Agents: 1 code-quality-reviewer\n  Output: Score + best practice gaps\n```"},
      {"label": "Security focus", "description": "Vulnerabilities, attack surface, compliance", "markdown": "```\nSecurity Focus\n──────────────\n  ┌──────────────────────────┐\n  │ OWASP Top 10 check       │\n  │ Dependency CVE scan       │\n  │ Auth/AuthZ flow review    │\n  │ Data flow tracing         │\n  │ Secrets detection         │\n  └──────────────────────────┘\n  Agent: security-auditor\n  Output: Vuln list + severity\n          + remediation steps\n```"},
      {"label": "Quick score", "description": "Just give me a 0-10 score with brief notes", "markdown": "```\nQuick Score\n───────────\n  Single pass, ~2 min:\n\n  Read target ──▶ Score ──▶ Done\n                  7.2/10\n\n  Output:\n  ├── Composite score (0-10)\n  ├── Grade (A-F)\n  ├── 3 strengths\n  └── 3 improvements\n  No agents, no deep analysis\n```"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full assessment**: All 7 phases, parallel agents
- **Code quality only**: Skip security and performance phases
- **Security focus**: Prioritize security-auditor agent
- **Quick score**: Single pass, brief output

---

## STEP 0b: Select Orchestration Mode

Load details: `Read("${CLAUDE_SKILL_DIR}/references/orchestration-mode.md")` for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

---

## Task Management (CC 2.1.16)

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Assess: {target}",
  description="Comprehensive evaluation with quality scores and recommendations",
  activeForm="Assessing {target}"
)

# 2. Create subtasks for each assessment phase
TaskCreate(subject="Understand target and gather context", activeForm="Understanding target")   # id=2
TaskCreate(subject="Discover scope and build file list", activeForm="Discovering scope")        # id=3
TaskCreate(subject="Rate quality across 7 dimensions", activeForm="Rating quality")             # id=4
TaskCreate(subject="Analyze pros and cons", activeForm="Analyzing pros/cons")                   # id=5
TaskCreate(subject="Compare alternatives", activeForm="Comparing alternatives")                 # id=6
TaskCreate(subject="Generate improvement suggestions", activeForm="Generating suggestions")     # id=7
TaskCreate(subject="Compile assessment report", activeForm="Compiling report")                  # id=8

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Scope needs target understanding
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Rating needs scoped file list
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Pros/cons needs quality scores
TaskUpdate(taskId="6", addBlockedBy=["4"])  # Alternatives need quality scores
TaskUpdate(taskId="7", addBlockedBy=["5", "6"])  # Suggestions need analysis
TaskUpdate(taskId="8", addBlockedBy=["7"])  # Report needs suggestions

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```

---

## What This Skill Answers

| Question | How It's Answered |
|----------|-------------------|
| "Is this good?" | Quality score 0-10 with reasoning |
| "What are the trade-offs?" | Structured pros/cons list |
| "Should we change this?" | Improvement suggestions with effort |
| "What are the alternatives?" | Comparison with scores |
| "Where should we focus?" | Prioritized recommendations |

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Target Understanding** | Read code/design, identify scope | Context summary |
| **1.5. Scope Discovery** | Build bounded file list | Scoped file list |
| **2. Quality Rating** | 7-dimension scoring (0-10) | Scores with reasoning |
| **3. Pros/Cons Analysis** | Strengths and weaknesses | Balanced evaluation |
| **4. Alternative Comparison** | Score alternatives | Comparison matrix |
| **5. Improvement Suggestions** | Actionable recommendations | Prioritized list |
| **6. Effort Estimation** | Time and complexity estimates | Effort breakdown |
| **7. Assessment Report** | Compile findings | Final report |

---

## Phase 1: Target Understanding

Identify what's being assessed and gather context:

```python
# PARALLEL - Gather context
Read(file_path="$ARGUMENTS[0]")  # If file path
Grep(pattern="$ARGUMENTS[0]", output_mode="files_with_matches")
mcp__memory__search_nodes(query="$ARGUMENTS[0]")  # Past decisions
```

---

## Phase 1.5: Scope Discovery

Load `Read("${CLAUDE_SKILL_DIR}/references/scope-discovery.md")` for the full file discovery, limit application (MAX 30 files), and sampling priority logic. **Always include the scoped file list** in every agent prompt.

### Progressive Output (CC 2.1.76)

Output results **incrementally** as each evaluation phase completes:

| After Phase | Show User |
|-------------|-----------|
| 1. Target Understanding | Scope summary, file list, context |
| 1.5. Scope Discovery | Bounded file list (max 30 files) |
| 2. Quality Rating | Each dimension's score as the evaluating agent returns |
| 3. Pros/Cons | Balanced evaluation summary |

For Phase 2 parallel agents, show each dimension's score **as soon as the evaluating agent returns** — don't wait for all 4 agents. If any dimension scores below 4/10, flag it immediately as a priority concern requiring user attention.

---

## Phase 2: Quality Rating (7 Dimensions)

Rate each dimension 0-10 with weighted composite score. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")` for dimensions, weights, grade interpretation, and per-dimension criteria. Load `Read("${CLAUDE_SKILL_DIR}/references/quality-model.md")` for assess-specific overrides.

Load `Read("${CLAUDE_SKILL_DIR}/references/agent-spawn-definitions.md")` for Task Tool mode spawn patterns and Agent Teams alternative.

**Composite Score:** Weighted average of all 7 dimensions (see quality-model.md).

---

## Phases 3-7: Analysis, Comparison & Report

Load `Read("${CLAUDE_SKILL_DIR}/references/phase-templates.md")` for output templates for pros/cons, alternatives, improvements, effort, and the final report.

See also: `Read("${CLAUDE_SKILL_DIR}/references/alternative-analysis.md")` | `Read("${CLAUDE_SKILL_DIR}/references/improvement-prioritization.md")`

---

## Grade Interpretation

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")` for grade thresholds and scoring criteria.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 7 dimensions | Comprehensive coverage | All quality aspects without overwhelming |
| 0-10 scale | Industry standard | Easy to understand and compare |
| Parallel assessment | 4 agents (7 dimensions) | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 scale | Simple prioritization math |

---

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| complexity-metrics (load `${CLAUDE_SKILL_DIR}/rules/complexity-metrics.md`) | HIGH | 7-criterion scoring (1-5), complexity levels, thresholds |
| complexity-breakdown (load `${CLAUDE_SKILL_DIR}/rules/complexity-breakdown.md`) | HIGH | Task decomposition strategies, risk assessment |

## Related Skills

- `ork:verify` - Post-implementation verification
- `ork:code-review-playbook` - Code review patterns
- `ork:quality-gates` - Task complexity assessment, gate patterns

---

**Version:** 1.4.0 (March 2026) — Added progressive output for incremental evaluation results
