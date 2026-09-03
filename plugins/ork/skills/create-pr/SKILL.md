---
name: create-pr
license: MIT
compatibility: "Claude Code 2.1.251+. Requires memory MCP server, gh CLI."
description: "Creates GitHub pull requests with pre-flight validation, conventional title formatting, and structured summary generation. Runs parallel checks (tests, lint, type-check, security) before opening. Supports feature, bugfix, refactor, and hotfix PR types with milestone assignment via gh CLI. Invoke only if the operator named it; an everyday `gh pr create` stays plain tooling. Use when opening PRs or submitting code for review."
argument-hint: "[title]"
context: fork
# user-typed commands stay interactive; CC >= 2.1.218 backgrounds forks by default (#3093)
background: false
version: 2.6.0
author: OrchestKit
tags: [git, github, pull-request, pr, code-review]
user-invocable: true
disable-model-invocation: false
allowed-tools: [AskUserQuestion, Bash, Read, Write, Agent, TaskCreate, TaskUpdate, Skill, mcp__memory__search_nodes, CronCreate, CronDelete]
skills: [review-pr, memory, chain-patterns]
complexity: medium
persuasion-type: guidance
metadata:
  category: workflow-automation
  mcp-server: memory
triggers:
  keywords: ["create pr", "create a pr", "crate a", "pull request", "open pr", "open a pr", "make a pr", "submit pr", "push and pr", "push this up", "coderabbit harvest"]
  examples:
    - "create a pull request for this feature"
    - "open a PR against the default branch"
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

> **CC ≥ 2.1.119 multi-host note (M122):** PR creation works against GitHub, GitLab, Bitbucket, and GitHub Enterprise. Detect the target host from the configured remote (`git remote -v`) and branch on the host family for the right CLI:
>
> | Host family | CLI |
> |---|---|
> | github / github-enterprise | `gh pr create` (with `GH_HOST=<host>` for GHE) |
> | gitlab / gitlab-self | `glab mr create` |
> | bitbucket | `bb pr create` |
>
> Custom enterprise URLs: `prUrlTemplate` setting (see `src/skills/configure/` and `src/skills/chain-patterns/references/pr-from-platform.md`).

## Argument Resolution

```python
TITLE = "$ARGUMENTS"  # Optional PR title, e.g., "Add user authentication"
# If provided, use as PR title. If empty, generate from branch/commits.
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)
```

## Base Branch Resolution

Derive the base branch from the remote. Never hardcode `dev` or `main`; repos differ.

```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
BASE=${BASE:-main}   # ref missing (fresh/shallow clone)? run: git remote set-head origin -a
```

Every `$BASE` below refers to this value.

---

## STEP 0: Verify User Intent

**BEFORE creating tasks**, clarify PR type:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of PR is this?",
    "header": "PR Type",
    "options": [
      {"label": "Feature (Recommended)", "description": "Full validation: security + quality + tests"},
      {"label": "Bug fix", "description": "Focus on test verification"},
      {"label": "Refactor", "description": "Code quality review, skip security"},
      {"label": "Quick", "description": "Skip validation, just create PR"}
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

### Optional pre-flight: `claude ultrareview` (CC 2.1.120+, #1542)

If `claude ultrareview --help` succeeds, optionally run it before opening the PR and surface findings in the PR body's `## Pre-flight` section. The CLI subcommand returns structured `--json` output that can be filtered to high/medium severity for the body and full results posted as a follow-up comment.

```bash
if claude ultrareview --help >/dev/null 2>&1; then
  claude ultrareview "origin/$BASE..HEAD" --json > /tmp/ultra.json
  # Bucket by severity, put HIGH in PR body, MEDIUM/LOW as comment
fi
```

Skip on CC < 2.1.120 (the subcommand doesn't exist there). The `.github/workflows/ultrareview.yml` workflow runs the same command on PR open as a backstop, so this pre-flight is purely a feedback-loop accelerant.

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

# 4. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```

---

## Workflow

### Phase 1: Pre-Flight Checks

Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/rules/preflight-validation.md")` for the full checklist.

```bash
BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]] && echo "Cannot PR from dev/main" && exit 1
[[ -n $(git status --porcelain) ]] && echo "Uncommitted changes" && exit 1

git fetch origin
git rev-parse --verify "origin/$BRANCH" &>/dev/null || git push -u origin "$BRANCH"
```

### Phase 2: Parallel Validation (Feature/Bug fix PRs)

Launch agents in ONE message. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/references/parallel-validation.md")` for full agent configs.

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
git log --oneline "origin/$BASE..HEAD"
git diff "origin/$BASE...HEAD" --stat
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

> **CC 2.1.183 — `attribution.sessionUrl`:** Web and Remote Control sessions append a claude.ai session link to the PR body. For public repos where that link should not be exposed, set `attribution.sessionUrl: false` (`/config attribution.sessionUrl=false`) before creating the PR. ork's agent-attribution sections above are independent of this setting.

### Phase 4: Create PR

Follow `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/rules/pr-title-format.md")` and `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/rules/pr-body-structure.md")`. Use HEREDOC pattern from `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/references/pr-body-templates.md")`.

Include agent attribution sections (from Phase 3b) after the Test Plan section in the PR body.

```bash
TYPE="feat"  # Determine: feat/fix/refactor/docs/test/chore
gh pr create --base "$BASE" \
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

> **Requires** the `playground` plugin (external): `/plugin marketplace add anthropics/claude-plugins-official && /plugin install playground`

**First classify the archetype** — a feature PR must not ship as a flat dashboard.
`Read("${CLAUDE_PLUGIN_ROOT}/shared/rules/playground-visual-standard.md")` and apply its §0 routing rule:

- **Visual PR** (adds/changes a user-facing feature, flow, or a prioritization/decision surface) →
  **USER-STORY PLAYER** or **DECISION BOARD**. Build to the standard: adapt the matching exemplar at
  `${CLAUDE_PLUGIN_ROOT}/shared/assets/playground-exemplars/` (`user-story-player.template.html`
  or `decision-board.template.html`), and bring full design firepower (the `frontend-design` skill /
  the `ork:frontend-ui-developer` agent). When delegating to `playground:playground`, brief it with the
  **archetype + persona + tokens** — never hand it a pre-built HTML blob.
- **Non-visual PR** (infra/CI/refactor/config/docs) → **DASHBOARD** — the default summary below is fine.

```python
BRANCH=$(git branch --show-current)
BRANCH_DIR = BRANCH.replace("/", "--")  # feat/foo → feat--foo

# Invoke the playground skill with a summary of the PR changes.
# For a VISUAL PR, set archetype/persona/exemplar per playground-visual-standard.md instead of this default.
Skill("playground:playground", args=f"""
  {PR_TITLE} — visualize the key changes in this PR.
  Archetype: <user-story-player | decision-board | dashboard> per playground-visual-standard.md §0.
  For visual archetypes: follow that standard's tokens/glass/motion and adapt the matching exemplar.
  Show: architecture/data flow, before/after, key components changed; presets for the main change areas.
  Dark glass theme, OrchestKit brand accents.
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

Resolve the head SHA first, and pin the link to it:

```bash
Bash("git rev-parse HEAD")   # -> {HEAD_SHA}
```

Add a "Live Preview" section to the PR body:

```markdown
## Live Preview

**[Open Interactive Playground](https://github.com/{OWNER}/{REPO}/blob/{HEAD_SHA}/docs/{BRANCH_DIR}/playground.html)**
```

> **First-party link only.** Do not wrap the URL in `htmlpreview.github.io` or any
> other render proxy. A proxy serves the repo's HTML from an origin the project does
> not control, with none of its CSP applied. The plain blob link shows source rather
> than a rendered page; that is the accepted trade-off for not handing a third party
> the content. To get a *rendered* first-party page, publish the playground to the
> Lab instead (`docs/site/lab-manifest.json` + `docs/site/scripts/generate-lab-data.mjs`),
> which serves it under the site's own `/lab` CSP.

> **Pin the SHA, never the branch.** GitHub deletes the head branch on merge, so a
> `blob/{BRANCH}/` URL returns 404 the moment the PR lands. That silently broke the
> playground link on every merged PR through #3147. A commit SHA stays reachable
> indefinitely because GitHub retains `refs/pull/<N>/head`, so the same URL works
> during review and after merge. Verified: branch form 404, SHA form 200, on a PR
> whose branch was already deleted.

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

### CodeRabbit harvest (after checks green, before merge or auto-merge)

CodeRabbit reviews expire unread: on Yonatan-HQ/platform (last 80 PRs, measured 2026-09-02)
23 of the 24 PRs it reviewed merged with every thread still open. This phase reads the threads
once, refutes each, and closes every one with a stated outcome. Run it after CI is green and
before `gh pr merge` or arming `--auto`. Skip only when the repo has no `.coderabbit.yaml` or
the PR is still a draft.

```bash
H="${CLAUDE_PLUGIN_ROOT}/skills/create-pr/scripts/coderabbit-harvest.sh"
PR_NUMBER=$(gh pr view --json number -q .number)
bash "$H" "$PR_NUMBER" --unresolved > /tmp/cr-threads.json   # ONE GraphQL call, coderabbitai only
jq length /tmp/cr-threads.json                                  # 0 → see below, then merge
```

A zero here is ambiguous: CodeRabbit read the diff and found nothing, or CodeRabbit never
saw the PR. Both print `0`, and the phase treats both as clean, so a repo the app cannot
reach passes this gate on every PR forever. Measured on this repo 2026-09-03: a valid
`.coderabbit.yaml` had been on `main` since 2026-08-25 while CodeRabbit had posted zero
comments in the repo's entire history and ignored an explicit `@coderabbitai review`, so
the app is either uninstalled on the `yonatangross` account or disabled account-side.
Note what that verdict does NOT say: absence never proves absence from a session, only the
settings page separates those two. The first time a repo's harvest returns zero,
disambiguate with
`Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/references/coderabbit-zero-reviews.md")`:
it carries the two-endpoint query, the positive control that keeps a zero honest, and the
operator steps for the installation grant. Editing `.coderabbit.yaml` cannot fix an app
that was never installed.

For each unresolved thread, spawn a refuter in ONE message: an isolated `Agent` (no
`team_name`), `subagent_type="ork:code-quality-reviewer"` (`ork:security-auditor` for a
security category). Give it `path`, `line`, `title`, `body`, and the diff slice
`git diff origin/$BASE...HEAD -- <path>`; instruct it to REFUTE the finding against that diff
and return `{"refuted": true|false, "reason": "<one sentence>"}`, defaulting to `refuted: true`
when the failure scenario cannot be reproduced. Refuters never edit files.

| Outcome | Action on the branch | Reply on the thread |
|---|---|---|
| Survived (`refuted: false`) | Fix in the same branch, commit, push | `Fixed in <sha>: <one line>` |
| Refuted (`refuted: true`) | Nothing | `Dismissed: <the one-sentence reason>` |

```bash
bash "$H" "$PR_NUMBER" --reply "$THREAD_ID" "Fixed in $(git rev-parse --short HEAD): <what changed>"
bash "$H" "$PR_NUMBER" --resolve "$THREAD_ID"       # every thread, fixed or dismissed
bash "$H" "$PR_NUMBER" --unresolved | jq length     # must print 0 before proceeding
```

A fix push re-runs CI, so re-verify green afterwards. CodeRabbit may post new threads on the
fix commit; give those exactly one more pass, then dismiss the rest with `Deferred to #<issue>`
and a filed issue, so the phase terminates instead of looping.

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
5. **Respect the `gh` rate-limit hint (CC ≥ 2.1.116)** — when the Bash tool surfaces a GitHub rate-limit hint after a `gh` call (e.g. in a `/loop 5m gh pr checks …` watcher), **stop the loop and wait for reset** — do not blind-retry. See `ork:github-operations` for the full guidance.

## Next Steps (suggest to user after PR creation)

```
/ork:review-pr {PR_NUMBER}                # Self-review before requesting reviews
/loop 5m gh pr checks {PR_NUMBER}         # Watch CI until green
/loop 1h gh pr view {PR_NUMBER} --json reviewDecision  # Monitor review status
```

## Verification Gate

Before claiming PR is ready, apply: `Read("${CLAUDE_PLUGIN_ROOT}/shared/rules/verification-gate.md")`. All tests must pass with fresh evidence. All CI checks green. No "should be fine."

## Quality Bar

Done means all of these hold:
- PR opened from a feature branch with a clean working tree against the correct base (`$BASE`, derived from `origin/HEAD`, or the detected host equivalent)
- Title uses conventional `type(#issue): ...` format matching the change
- Body carries Summary, Changes, and Test Plan sections; every closed issue has its own `Closes #N` keyword
- Pre-flight validation for the chosen PR type passed locally before creation (skipped only for the Quick type)
- Playground HTML exists at docs/{branch-dir}/*.html and the body links it (required for non-bot PRs)
- `gh pr view --json url` returns the created PR URL
- Every CodeRabbit thread on the PR is resolved, with a reply naming the fix sha or the dismissal reason (`scripts/coderabbit-harvest.sh --unresolved` prints `[]`)

## Related Skills

- `ork:commit` — Create commits before PRs
- `ork:review-pr` — Review PRs after creation

## Picker fallback (#1795)

If the `AskUserQuestion` picker stalls (schema break, not a CC input bug — orchestkit#1795, now guarded by tests/skills/structure/test-askuserquestion-schema.sh), set `ORK_ASK_FALLBACK=text` before starting CC. The `lifecycle/ask-fallback-injector` hook injects a reminder telling the assistant to pose options inline as a numbered list and ask the user to reply with the option number.

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/create-pr/references/<file>")`:
| File | Content |
|------|---------|
| `references/pr-body-templates.md` | PR body templates |
| `references/parallel-validation.md` | Parallel validation agent configs |
| `references/ci-integration.md` | CI integration patterns |
| `references/multi-commit-pr.md` | Multi-commit PR guidance |
| `assets/pr-template.md` | PR template (legacy) |
| `scripts/coderabbit-harvest.sh` | CodeRabbit threads: read (one GraphQL call), `--reply`, `--resolve` |
| `references/coderabbit-zero-reviews.md` | Harvest returned zero: reviewed clean, or never reviewed? |
