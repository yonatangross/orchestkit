---
name: review-pr
license: MIT
compatibility: "Claude Code 2.1.59+. Requires memory MCP server, gh CLI."
description: "PR review with parallel specialized agents. Use when reviewing pull requests or code."
argument-hint: "[pr-number-or-branch]"
context: fork
version: 1.5.0
author: OrchestKit
tags: [code-review, pull-request, quality, security, testing]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, mcp__memory__search_nodes]
skills: [code-review-playbook, testing-patterns, memory]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Review PR

Deep code review using 6-7 parallel specialized agents.

## Quick Start

```bash
/ork:review-pr 123
/ork:review-pr feature-branch
```

> **Opus 4.6**: Parallel agents use native adaptive thinking for deeper analysis. Complexity-aware routing matches agent model to review difficulty.

---

## Argument Resolution

The PR number or branch is passed as the skill argument. Resolve it immediately:

```python
PR_NUMBER = "$ARGUMENTS[0]"  # e.g., "123" or "feature-branch" (CC 2.1.19 indexed access)

# If no argument provided, check environment
if not PR_NUMBER:
    PR_NUMBER = os.environ.get("ORCHESTKIT_PR_URL", "").split("/")[-1]

# If still empty, detect from current branch
if not PR_NUMBER:
    PR_NUMBER = "$(gh pr view --json number -q .number 2>/dev/null)"
```

Use `PR_NUMBER` consistently in all subsequent commands and agent prompts.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify review focus:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of review do you need?",
    "header": "Focus",
    "options": [
      {"label": "Full review (Recommended)", "description": "Security + code quality + tests + architecture", "markdown": "```\nFull Review (6 agents)\n──────────────────────\n  PR diff ──▶ 6 parallel agents:\n  ┌────────────┐ ┌────────────┐\n  │ Quality x2 │ │ Security   │\n  ├────────────┤ ├────────────┤\n  │ Test Gen   │ │ Backend    │\n  ├────────────┤ ├────────────┤\n  │ Frontend   │ │ (optional) │\n  └────────────┘ └────────────┘\n         ▼\n  Synthesized review comment\n  with conventional comments:\n  praise/suggestion/issue/nitpick\n```"},
      {"label": "Security focus", "description": "Prioritize security vulnerabilities", "markdown": "```\nSecurity Review\n───────────────\n  PR diff ──▶ security-auditor:\n  ┌─────────────────────────┐\n  │ Auth changes       ✓/✗ │\n  │ Input validation   ✓/✗ │\n  │ SQL/XSS/CSRF       ✓/✗ │\n  │ Secrets in diff    ✓/✗ │\n  │ Dependency risk    ✓/✗ │\n  └─────────────────────────┘\n  Output: Security-focused\n  review with fix suggestions\n```"},
      {"label": "Performance focus", "description": "Focus on performance implications", "markdown": "```\nPerformance Review\n──────────────────\n  PR diff ──▶ perf analysis:\n  ┌─────────────────────────┐\n  │ N+1 queries        ✓/✗ │\n  │ Bundle size impact  ±KB │\n  │ Render performance  ✓/✗ │\n  │ Memory leaks       ✓/✗ │\n  │ Caching gaps       ✓/✗ │\n  └─────────────────────────┘\n  Agent: frontend-performance\n  or python-performance\n```"},
      {"label": "Quick review", "description": "High-level review, skip deep analysis", "markdown": "```\nQuick Review (~2 min)\n─────────────────────\n  PR diff ──▶ Single pass\n\n  Output:\n  ├── Approve / Request changes\n  ├── Top 3 concerns\n  └── 1-paragraph summary\n  1 agent: code-quality-reviewer\n  No deep security/perf scan\n```"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full review**: All 6-7 parallel agents
- **Security focus**: Prioritize security-auditor, reduce other agents
- **Performance focus**: Add frontend-performance-engineer agent
- **Quick review**: Single code-quality-reviewer agent only

---

## STEP 0b: Select Orchestration Mode

See [Orchestration Mode Selection](references/orchestration-mode-selection.md)

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main review task IMMEDIATELY
TaskCreate(
  subject="Review PR #{number}",
  description="Comprehensive code review with parallel agents",
  activeForm="Reviewing PR #{number}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Gather PR information", activeForm="Gathering PR information")
TaskCreate(subject="Launch review agents", activeForm="Dispatching review agents")
TaskCreate(subject="Run validation checks", activeForm="Running validation checks")
TaskCreate(subject="Synthesize review", activeForm="Synthesizing review")
TaskCreate(subject="Submit review", activeForm="Submitting review")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Phase 1: Gather PR Information

```bash
# Get PR details
gh pr view $PR_NUMBER --json title,body,files,additions,deletions,commits,author

# View the diff
gh pr diff $PR_NUMBER

# Check CI status
gh pr checks $PR_NUMBER
```

### Capture Scope for Agents

```bash
# Capture changed files for agent scope injection
CHANGED_FILES=$(gh pr diff $PR_NUMBER --name-only)

# Detect affected domains
HAS_FRONTEND=$(echo "$CHANGED_FILES" | grep -qE '\.(tsx?|jsx?|css|scss)$' && echo true || echo false)
HAS_BACKEND=$(echo "$CHANGED_FILES" | grep -qE '\.(py|go|rs|java)$' && echo true || echo false)
HAS_AI=$(echo "$CHANGED_FILES" | grep -qE '(llm|ai|agent|prompt|embedding)' && echo true || echo false)
```

Pass `CHANGED_FILES` to every agent prompt in Phase 3. Pass domain flags to select which agents to spawn.

Identify: total files changed, lines added/removed, affected domains (frontend, backend, AI).

## Tool Guidance

| Task | Use | Avoid |
|------|-----|-------|
| Fetch PR diff | `Bash: gh pr diff` | Reading all changed files individually |
| List changed files | `Bash: gh pr diff --name-only` | `bash find` |
| Search for patterns | `Grep(pattern="...", path="src/")` | `bash grep` |
| Read file content | `Read(file_path="...")` | `bash cat` |
| Check CI status | `Bash: gh pr checks` | Polling APIs |

<use_parallel_tool_calls>
When gathering PR context, run independent operations in parallel:
- `gh pr view` (PR metadata), `gh pr diff` (changed files), `gh pr checks` (CI status)

Spawn all three in ONE message. This cuts context-gathering time by 60%.
For agent-based review (Phase 3), all 6 agents are independent -- launch them together.
</use_parallel_tool_calls>

## Phase 2: Skills Auto-Loading (CC 2.1.6)

**CC 2.1.6 auto-discovers skills** -- no manual loading needed!

Relevant skills activated automatically:
- `code-review-playbook` -- Review patterns, conventional comments
- `security-scanning` -- OWASP, secrets, dependencies
- `type-safety-validation` -- Zod, TypeScript strict
- `testing-patterns` -- Test adequacy, coverage gaps, rule matching

## Phase 3: Parallel Code Review (6 Agents)

### Domain-Aware Agent Selection

Only spawn agents relevant to the PR's changed domains:

| Domain Detected | Agents to Spawn |
|----------------|-----------------|
| Backend only | code-quality (x2), security-auditor, test-generator, backend-system-architect |
| Frontend only | code-quality (x2), security-auditor, test-generator, frontend-ui-developer |
| Full-stack | All 6 agents |
| AI/LLM code | All 6 + optional llm-integrator (7th) |

Skip agents for domains not present in the diff. This saves ~33% tokens on domain-specific PRs.

See [Agent Prompts -- Task Tool Mode](rules/agent-prompts-task-tool.md) for the 6 parallel agent prompts.

See [Agent Prompts -- Agent Teams Mode](rules/agent-prompts-agent-teams.md) for the mesh alternative.

See [AI Code Review Agent](rules/ai-code-review-agent.md) for the optional 7th LLM agent.

## Phase 4: Run Validation

See [Validation Commands](references/validation-commands.md)

## Phase 5: Synthesize Review

Combine all agent feedback into a structured report. See [Review Report Template](references/review-report-template.md)

## Phase 6: Submit Review

```bash
# Approve
gh pr review $PR_NUMBER --approve -b "Review message"

# Request changes
gh pr review $PR_NUMBER --request-changes -b "Review message"
```

## CC 2.1.20 Enhancements

### PR Status Enrichment

The `pr-status-enricher` hook automatically detects open PRs at session start and sets:
- `ORCHESTKIT_PR_URL` -- PR URL for quick reference
- `ORCHESTKIT_PR_STATE` -- PR state (OPEN, MERGED, CLOSED)

### Session Resume with PR Context (CC 2.1.27+)

Sessions are automatically linked when reviewing PRs. Resume later with full context:

```bash
claude --from-pr 123
claude --from-pr https://github.com/org/repo/pull/123
```

### Task Metrics (CC 2.1.30)

See [Task Metrics Template](references/task-metrics-template.md)

## Conventional Comments

Use these prefixes for comments:
- `praise:` -- Positive feedback
- `nitpick:` -- Minor suggestion
- `suggestion:` -- Improvement idea
- `issue:` -- Must fix
- `question:` -- Needs clarification

## Related Skills
- `ork:commit`: Create commits after review
- `ork:create-pr`: Create PRs for review
- `slack-integration`: Team notifications for review events

## References

- [Review Template](references/review-template.md)
- [Review Report Template](references/review-report-template.md)
- [Orchestration Mode Selection](references/orchestration-mode-selection.md)
- [Validation Commands](references/validation-commands.md)
- [Task Metrics Template](references/task-metrics-template.md)
- [Agent Prompts -- Task Tool](rules/agent-prompts-task-tool.md)
- [Agent Prompts -- Agent Teams](rules/agent-prompts-agent-teams.md)
- [AI Code Review Agent](rules/ai-code-review-agent.md)
