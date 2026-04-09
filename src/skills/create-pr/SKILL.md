---
name: create-pr
license: MIT
compatibility: "Claude Code 2.1.76+. Requires memory MCP server, gh CLI."
description: "Creates GitHub pull requests with validation. Use when opening PRs or submitting code for review."
argument-hint: "[title]"
context: fork
agent: git-operations-engineer
version: 2.5.0
author: OrchestKit
tags: [git, github, pull-request, pr, code-review]
user-invocable: true
disable-model-invocation: true
allowed-tools: [AskUserQuestion, Bash, Task, TaskCreate, TaskUpdate, Skill, mcp__memory__search_nodes, CronCreate, CronDelete]
skills: [commit, review-pr, memory, chain-patterns, playground]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory
triggers:
  keywords: ["create pr", "create a pr", "crate a", "pull request", "open pr", "open a pr", "make a pr", "submit pr", "push and pr", "push this up"]
  examples:
    - "create a pull request for this feature"
    - "open a PR against dev"
    - "this is ready for review, make a PR"
  anti-triggers: [commit, review pr, merge, rebase, push]
---

# Create Pull Request

Comprehensive PR creation with validation. All output goes directly to GitHub PR.

## Quick Start

```bash
/ork:create-pr
/ork:create-pr "Add user authentication"
```

## Argument Resolution

```python
TITLE = "$ARGUMENTS"  # Optional PR title, e.g., "Add user authentication"
# If provided, use as PR title. If empty, generate from branch/commits.
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)
```

---

## STEP 0: Verify User Intent

**BEFORE creating tasks**, clarify PR type:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of PR is this?",
    "header": "PR Type",
    "options": [
      {"label": "Feature (Recommended)", "description": "Full validation: security + quality + tests", "markdown": "```\nFeature PR\n──────────\n  Pre-flight ──▶ 3 agents ──▶ Tests ──▶ PR\n  ┌────────────┐ ┌─────────────────────┐\n  │ Branch OK? │ │ security-auditor    │\n  │ Clean tree?│ │ test-generator      │\n  │ Remote?    │ │ code-quality-review │\n  └────────────┘ └─────────────────────┘\n  Full validation, ~5 min\n```"},
      {"label": "Bug fix", "description": "Focus on test verification", "markdown": "```\nBug Fix PR\n──────────\n  Pre-flight ──▶ test-generator ──▶ Tests ──▶ PR\n\n  Agent: test-generator only\n  Verifies regression test exists\n  ~2 min\n```"},
      {"label": "Refactor", "description": "Code quality review, skip security", "markdown": "```\nRefactor PR\n───────────\n  Pre-flight ──▶ code-quality ──▶ Tests ──▶ PR\n\n  Agent: code-quality-reviewer only\n  Checks: no behavior change,\n  complexity reduction, patterns\n  ~2 min\n```"},
      {"label": "Quick", "description": "Skip validation, just create PR", "markdown": "```\nQuick PR (~30s)\n───────────────\n  Pre-flight ──▶ PR\n\n  No agents, no tests\n  Just create the PR\n```"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Feature**: Full Phase 2 with 3 parallel agents + local tests
- **Bug fix**: Phase 2 with test-generator only + local tests
- **Refactor**: Phase 2 with code-quality-reviewer only + local tests
- **Quick**: Skip Phase 2, jump to Phase 3

### Progressive Output (CC 2.1.76)

Output results **incrementally** during PR creation:

| After Step | Show User |
|------------|-----------|
| Pre-flight | Branch status, remote sync result |
| Each agent | Agent validation result as it returns |
| Tests | Test results, lint/typecheck status |
| PR created | PR URL, CI status link |

For feature PRs with 3 parallel agents, show each agent's result **as it returns** — don't wait for all agents before running local tests.

---

## STEP 1: Create Tasks (MANDATORY)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(subject="Create PR for {branch}", description="PR creation with validation", activeForm="Creating pull request")

# 2. Create subtasks for each phase
TaskCreate(subject="Pre-flight checks", activeForm="Running pre-flight checks")        # id=2
TaskCreate(subject="Run validation agents", activeForm="Validating with agents")       # id=3
TaskCreate(subject="Run local tests", activeForm="Running local tests")                # id=4
TaskCreate(subject="Create PR on GitHub", activeForm="Creating GitHub PR")             # id=5
TaskCreate(subject="Generate PR playground", activeForm="Generating playground")       # id=6

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Agents need pre-flight to pass
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Tests run after agent validation
TaskUpdate(taskId="5", addBlockedBy=["4"])  # PR creation needs tests to pass
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Playground after PR (needs title/summary)

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```

---

## Workflow

### Phase 1: Pre-Flight Checks

Load: `Read("${CLAUDE_SKILL_DIR}/rules/preflight-validation.md")` for the full checklist.

```bash
BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]] && echo "Cannot PR from dev/main" && exit 1
[[ -n $(git status --porcelain) ]] && echo "Uncommitted changes" && exit 1

git fetch origin
git rev-parse --verify "origin/$BRANCH" &>/dev/null || git push -u origin "$BRANCH"
```

### Phase 2: Parallel Validation (Feature/Bug fix PRs)

Launch agents in ONE message. Load `Read("${CLAUDE_SKILL_DIR}/references/parallel-validation.md")` for full agent configs.

| PR Type | Agents to launch |
|---------|-----------------|
| Feature | security-auditor + test-generator + code-quality-reviewer |
| Bug fix | test-generator only |
| Refactor | code-quality-reviewer only |
| Quick | None |

After agents complete, run local validation:

```bash
# Adapt to project stack
npm run lint && npm run typecheck && npm test -- --bail
# or: ruff check . && pytest tests/unit/ -v --tb=short -x
```

### Phase 3: Gather Context

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oE '[0-9]+' | head -1)
git log --oneline dev..HEAD
git diff dev...HEAD --stat
```

### Phase 3b: Agent Attribution (automatic)

Before creating the PR, check for the branch activity ledger at `.claude/agents/activity/{branch}.jsonl`.
If it exists, generate agent attribution sections for the PR body:

1. Read `.claude/agents/activity/{branch}.jsonl` (one JSON object per line, full branch history)
2. Deduplicate by agent type (keep the entry with longest duration for each agent)
3. Generate the following sections to append to the PR body:
   - **Badge row**: shields.io badges for agent count, tests generated, vulnerabilities
   - **Agent Team Sheet**: Markdown table with Agent, Role, Stage (Lead/⚡ Parallel/Follow-up), Time
   - **Credits Roll**: Collapsible `<details>` section grouped by execution stage (Lead/Parallel/Follow-up)
4. Each agent entry has: `agent` (type), `stage` (0=lead, 1=parallel, 2=follow-up), `duration_ms`, `summary`

If the ledger doesn't exist or is empty, skip this step — create PR normally.

### Phase 4: Create PR

Follow `Read("${CLAUDE_SKILL_DIR}/rules/pr-title-format.md")` and `Read("${CLAUDE_SKILL_DIR}/rules/pr-body-structure.md")`. Use HEREDOC pattern from `Read("${CLAUDE_SKILL_DIR}/references/pr-body-templates.md")`.

Include agent attribution sections (from Phase 3b) after the Test Plan section in the PR body.

```bash
TYPE="feat"  # Determine: feat/fix/refactor/docs/test/chore
gh pr create --base dev \
  --title "$TYPE(#$ISSUE): Brief description" \
  --body "$(cat <<'EOF'
## Summary
[1-2 sentence description]

## Changes
- [Change 1]
- [Change 2]

## Test Plan
- [x] Unit tests pass
- [x] Lint/type checks pass

## Agent Team Sheet
| Agent | Role | Stage | Time |
|-------|------|-------|------|
| 🏗️ **backend-system-architect** | API design | Lead | 2m14s |
| 🛡️ **security-auditor** | Dependency audit | ⚡ Parallel | 0m42s |
| 🧪 **test-generator** | 47 tests, 94% coverage | ⚡ Parallel | 2m01s |

<details>
<summary><strong>🎬 Agent Credits</strong> — 3 agents collaborated on this PR</summary>

**Lead**
- 🏗️ **backend-system-architect** — API design (2m14s)

**⚡ Parallel** (ran simultaneously)
- 🛡️ **security-auditor** — Dependency audit (0m42s)
- 🧪 **test-generator** — 47 tests, 94% coverage (2m01s)

---
<sub>Orchestrated by <a href="https://github.com/yonatangross/orchestkit">OrchestKit</a> — 3 agents, 4m57s total</sub>

</details>

Closes #$ISSUE

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Phase 4b: Generate PR Playground (REQUIRED — CI blocks without it)

Generate an interactive HTML playground visualizing the PR's changes. CI validates `docs/{branch-name}/*.html` exists.

```python
BRANCH=$(git branch --show-current)
BRANCH_DIR = BRANCH.replace("/", "--")  # feat/foo → feat--foo

# Invoke the playground skill with a summary of the PR changes
Skill("playground:playground", args=f"""
  {PR_TITLE} — visualize the key changes in this PR.
  Show: architecture/data flow, before/after, key components changed.
  Include presets for the main change areas.
  Dark theme with purple/violet OrchestKit brand colors.
""")

# The playground skill writes to a temp path — move it to the correct location
# Ensure file lands at: docs/{branch-dir}/<name>.html
Bash(f"mkdir -p docs/{BRANCH_DIR}")
Bash(f"mv /tmp/*.html docs/{BRANCH_DIR}/playground.html 2>/dev/null || true")

# Force-add (docs/feat--*/ is gitignored by design)
Bash(f"git add -f docs/{BRANCH_DIR}/")
Bash(f'git commit -m "docs: add PR playground for {BRANCH}"')
Bash(f"git push origin {BRANCH}")
```

Add a "Live Preview" section to the PR body:

```markdown
## Live Preview

**[Open Interactive Playground](https://htmlpreview.github.io/?https://github.com/{OWNER}/{REPO}/blob/{BRANCH}/docs/{BRANCH_DIR}/playground.html)**
```

> **Why required:** CI Stage 1d (`playground-check`) blocks merge if `docs/{branch-dir}/*.html` is missing. Bot PRs (dependabot, release-please) are exempt.

### Phase 5: Verify

```bash
PR_URL=$(gh pr view --json url -q .url)
echo "PR created: $PR_URL"
```

### CI Monitoring (CC 2.1.71)

After PR creation, schedule CI status monitoring:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="*/5 * * * *",
  prompt="Check CI for PR #{pr_number}: gh pr checks {pr_number} --repo {repo}.
    All pass → CronDelete this job, report success.
    Any fail → alert with failure details."
)
```

### Handoff File

Write PR details for downstream skills:

```python
Write(".claude/chain/pr-created.json", JSON.stringify({
  "phase": "create-pr", "pr_number": N, "pr_url": "...",
  "branch": "...", "files_changed": [...], "related_issues": [...]
}))
```

---

## Rules

1. **NO junk files** — Don't create files in repo root
2. **Run validation locally** — Don't spawn agents for lint/test
3. **All content goes to GitHub** — PR body via `gh pr create --body`
4. **Keep it simple** — One command to create PR

## Next Steps (suggest to user after PR creation)

```
/ork:review-pr {PR_NUMBER}                # Self-review before requesting reviews
/loop 5m gh pr checks {PR_NUMBER}         # Watch CI until green
/loop 1h gh pr view {PR_NUMBER} --json reviewDecision  # Monitor review status
```

## Related Skills

- `ork:commit` — Create commits before PRs
- `ork:review-pr` — Review PRs after creation

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `references/pr-body-templates.md` | PR body templates |
| `references/parallel-validation.md` | Parallel validation agent configs |
| `references/ci-integration.md` | CI integration patterns |
| `references/multi-commit-pr.md` | Multi-commit PR guidance |
| `assets/pr-template.md` | PR template (legacy) |
