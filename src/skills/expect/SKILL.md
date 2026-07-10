---
name: expect
license: MIT
compatibility: "Claude Code 2.1.206+. Requires agent-browser >= 0.25.0 (Rust-native, no Playwright)."
description: "Diff-aware AI browser testing — analyzes git changes, generates targeted test plans, and executes them via agent-browser (Rust daemon + CDP, ARIA-tree-first). Reads git diff to determine what changed, maps changes to affected pages via route map, generates a test plan scoped to the diff, and runs it with pass/fail reporting. Use when testing UI changes, verifying PRs before merge, running regression checks on changed components, or validating that recent code changes don't break the user-facing experience."
argument-hint: "[-m <instruction>] [--target unstaged|branch|commit] [--flow <slug>] [-y]"
context: fork
version: 1.1.0
author: OrchestKit
tags: [testing, browser, e2e, diff-aware, regression, visual, accessibility, ai-testing]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, ToolSearch, WebFetch, Monitor, PushNotification]
skills: [testing-e2e, chain-patterns, memory]
complexity: high
persuasion-type: guidance
effort: high
model: sonnet
metadata:
  category: testing
  milestone: M99
  upstream-package: agent-browser
  upstream-version-tested: "0.31.1"
triggers:
  keywords: [expect, "test my changes", "browser test", "diff test", "test what I changed", "test the UI", "visual regression", "check my changes"]
  examples:
    - "test my changes before I push"
    - "expect — run browser tests on what I changed"
    - "test the login flow after my auth refactor"
    - "run visual regression on the dashboard"
  anti-triggers: [cover, "unit test", "generate tests", verify, implement, "npm test"]
paths: [".expect/**", "**/*.test.{ts,tsx}", "agent-browser.json"]
invocation_hooks:
  - "command -v agent-browser >/dev/null 2>&1 || echo 'Warning: agent-browser not installed — run npm install -g agent-browser'"
---

# Expect — Diff-Aware AI Browser Testing

Analyze git changes, generate targeted test plans, and execute them via AI-driven browser automation.

> **Note:** If `disableSkillShellExecution` is enabled (CC 2.1.91), the agent-browser install check won't run. Verify it's installed: `npx agent-browser --version`.

```bash
/ork:expect                              # Auto-detect changes, test affected pages
/ork:expect -m "test the checkout flow"  # Specific instruction
/ork:expect --flow login                 # Replay a saved test flow
/ork:expect --target branch              # Test all changes on current branch vs main
/ork:expect -y                           # Skip plan review, run immediately
```

**Core principle:** Only test what changed. Git diff drives scope — no wasted cycles on unaffected pages.


## Argument Resolution

```python
ARGS = "[-m <instruction>] [--target unstaged|branch|commit] [--flow <slug>] [-y]"

# Parse from full argument string
import re
raw = ""  # Full argument string from CC

INSTRUCTION = None
TARGET = "unstaged"  # Default: test unstaged changes
FLOW = None
SKIP_REVIEW = False

# Extract -m "instruction"
m_match = re.search(r'-m\s+["\']([^"\']+)["\']|-m\s+(\S+)', raw)
if m_match:
    INSTRUCTION = m_match.group(1) or m_match.group(2)

# Extract --target
t_match = re.search(r'--target\s+(unstaged|branch|commit)', raw)
if t_match:
    TARGET = t_match.group(1)

# Extract --flow
f_match = re.search(r'--flow\s+(\S+)', raw)
if f_match:
    FLOW = f_match.group(1)

# Extract -y
if '-y' in raw.split():
    SKIP_REVIEW = True
```


## STEP 0: MCP Probe + Prerequisite Check

```python
# memory is alwaysLoad in .mcp.json (CC 2.1.121+, #1541) — probe below kept as fallback for older CC:
ToolSearch(query="select:mcp__memory__search_nodes")

# Verify agent-browser is available (Rust-native, no Playwright)
Bash("command -v agent-browser || npx agent-browser --version")
# If missing: "Install agent-browser: npm i -g agent-browser"

# Load agent-browser's own self-serving skill/workflow docs (required since 0.25.x)
Bash("agent-browser skills get agent-browser")
```


## CRITICAL: Task Management

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Expect: test changed code",
  description="Diff-aware browser testing pipeline",
  activeForm="Running diff-aware browser tests"
)

# 2. Create subtasks for each pipeline phase
TaskCreate(subject="Check fingerprint (skip if unchanged)", activeForm="Checking fingerprint")  # id=2
TaskCreate(subject="Scan git diff and classify changes", activeForm="Scanning diff")            # id=3
TaskCreate(subject="Map changes to routes/URLs", activeForm="Mapping routes")                   # id=4
TaskCreate(subject="Generate AI test plan", activeForm="Generating test plan")                   # id=5
TaskCreate(subject="Execute tests via agent-browser", activeForm="Executing browser tests")     # id=6
TaskCreate(subject="Compile test report", activeForm="Compiling report")                        # id=7

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Diff scan needs fingerprint check
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Route map needs diff results
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Test plan needs route map
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Execution needs test plan
TaskUpdate(taskId="7", addBlockedBy=["6"])  # Report needs execution results

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```


## Pipeline Overview

```
Git Diff → Route Map → Fingerprint Check → Test Plan → Execute → Report
```

| Phase | What | Output | Reference |
|-------|------|--------|-----------|
| **1. Fingerprint** | SHA-256 hash of changed files | Skip if unchanged since last run | `references/fingerprint.md` |
| **2. Diff Scan** | Parse git diff, classify changes | ChangesFor data (files, components, routes) | `references/diff-scanner.md` |
| **3. Route Map** | Map changed files to affected pages/URLs | Scoped page list | `references/route-map.md` |
| **4. Test Plan** | Generate AI test plan from diff + route map | Markdown test plan with steps | `references/test-plan.md` |
| **5. Execute** | Run test plan via agent-browser | Pass/fail per step, screenshots | `references/execution.md` |
| **6. Report** | Aggregate results, artifacts, exit code | Structured report + artifacts | `references/report.md` |


## Phase 1: Fingerprint Check

Check if the current changes have already been tested:

```python
Read(".expect/fingerprints.json")  # Previous run hashes
# Compare SHA-256 of changed files against stored fingerprints
# If match: "No changes since last test run. Use --force to re-run."
# If no match or --force: continue to Phase 2
```

Load: `Read("${CLAUDE_SKILL_DIR}/references/fingerprint.md")`


## Phase 2: Diff Scan

Analyze git changes based on `--target`:

```python
if TARGET == "unstaged":
    diff = Bash("git diff")
    files = Bash("git diff --name-only")
elif TARGET == "branch":
    diff = Bash("git diff main...HEAD")
    files = Bash("git diff main...HEAD --name-only")
elif TARGET == "commit":
    diff = Bash("git diff HEAD~1")
    files = Bash("git diff HEAD~1 --name-only")
```

Classify each changed file into 3 levels:
1. **Direct** — the file itself changed
2. **Imported** — a file that imports the changed file
3. **Routed** — the page/route that renders the changed component

Load: `Read("${CLAUDE_SKILL_DIR}/references/diff-scanner.md")`


## Phase 3: Route Map

Map changed files to testable URLs using `.expect/config.yaml`:

```yaml
# .expect/config.yaml
base_url: http://localhost:3000
route_map:
  "src/components/Header.tsx": ["/", "/about", "/pricing"]
  "src/app/auth/**": ["/login", "/signup", "/forgot-password"]
  "src/app/dashboard/**": ["/dashboard"]
```

If no route map exists, infer from Next.js App Router / Pages Router conventions.

Load: `Read("${CLAUDE_SKILL_DIR}/references/route-map.md")`


## Phase 4: Test Plan Generation

Build an AI test plan scoped to the diff, using the scope strategy for the current target:

```python
scope_strategy = get_scope_strategy(TARGET)  # See references/scope-strategy.md

prompt = f"""
{scope_strategy}

Changes: {diff_summary}
Affected pages: {affected_urls}
Instruction: {INSTRUCTION or "Test that the changes work correctly"}

Generate a test plan with:
1. Page-level checks (loads, no console errors, correct content)
2. Interaction tests (forms, buttons, navigation affected by the diff)
3. Visual regression (compare ARIA snapshots if saved)
4. Accessibility (axe-core scan on affected pages)
"""
```

If `--flow` specified, load saved flow from `.expect/flows/{slug}.yaml` instead of generating.

If NOT `--y`, present plan to user via `AskUserQuestion` for review before executing.

Load: `Read("${CLAUDE_SKILL_DIR}/references/test-plan.md")`


## Phase 5: Execution

### agent-browser Quick Primer

> Floor is `>= 0.25.0`; current tested release is **0.31.1** (see `upstream-version-tested`). Commands below hold across this range. 0.30+ adds `agent-browser read` (agent-readable text extraction) and the `--restore` / `--namespace` session-restore workflow for stable, isolated browser state across agent runs.


| Area | Command | Notes |
|------|---------|-------|
| Snapshot | `agent-browser snapshot -i` | ARIA tree w/ `@eN` refs. `-C`/`--cursor` was removed in 0.22 |
| Semantic locator | `agent-browser find --role button "Continue"` | Stable alternative to `@eN` refs |
| Interaction | `fill @e1 "..."`, `click @e2`, `press Enter`, `drag @e1 @e2`, `upload @e1 file.pdf` | All take ARIA refs |
| Waits | `wait --load networkidle`, `wait --text "Success"`, `wait --fn "window.ready"` | Event-driven, never sleep-based |
| Network | `network route "*analytics*" --abort`, `network route "https://api/*" --body '{...}'` | Intercept + stub |
| State | `state save/load auth.json`, `--session-name <name>` | Persist auth across runs |
| Vault | `vault store github_pat`, `vault load github_pat` | Encrypted credential store |
| Diff | `diff snapshot`, `diff screenshot --baseline /tmp/x.png` | ARIA + pixel diffing |
| Capture | `screenshot --annotate`, `pdf`, `record start/stop` | Evidence artifacts |
| Dashboard | `agent-browser dashboard start` *(0.25+)* | Browser-side runtime inspector on :4848 |

### Run the test plan

```python
expect_task = Agent(
  subagent_type="ork:expect-agent",
  prompt=f"""Execute this test plan:
  {test_plan}

  For each step:
  1. Navigate to the URL
  2. Execute the test action
  3. Take a screenshot on failure
  4. Report PASS/FAIL with evidence
  """,
  run_in_background=True,
  model="sonnet",
  max_turns=50
)

# Stream agent-browser progress line-by-line instead of polling (CC 2.1.98+)
# Each stdout line from agent-browser arrives as a notification — useful for
# catching a failing step early rather than waiting for the full plan.
# Full pattern: Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/monitor-patterns.md")
Monitor(pid=expect_task.agent_id)

# For long test plans (>3 min typical), notify on completion — requires
# Remote Control + "Push when Claude decides" config (CC 2.1.110+).
# Skip silently if the user doesn't have Remote Control enabled.
if test_plan_duration_estimate > 180:
    PushNotification(
        message=f"ork:expect complete — {passed}/{total} steps passed on {len(affected_urls)} pages",
        status="proactive"
    )
```

Load: `Read("${CLAUDE_SKILL_DIR}/references/execution.md")`


## Phase 6: Report

```
/ork:expect Report
═══════════════════════════════════════
Target: unstaged (3 files changed)
Pages tested: 4
Duration: 45s

Results:
  ✓ /login — form renders, submit works
  ✓ /signup — validation triggers on empty fields
  ✗ /dashboard — chart component crashes (TypeError)
  ✓ /settings — preferences save correctly

3 passed, 1 failed

Artifacts:
  .expect/reports/2026-03-26T16-30-00.json
  .expect/screenshots/dashboard-error.png
```

Load: `Read("${CLAUDE_SKILL_DIR}/references/report.md")`


## Saved Flows

Reusable test sequences stored in `.expect/flows/`:

```yaml
# .expect/flows/login.yaml
name: Login Flow
steps:
  - navigate: /login
  - fill: { selector: "#email", value: "test@example.com" }
  - fill: { selector: "#password", value: "password123" }
  - click: button[type="submit"]
  - assert: { url: "/dashboard" }
  - assert: { text: "Welcome back" }
```

Run with: `/ork:expect --flow login`


## Auto-trigger after UI edits (M125 #2)

When the dev stack is live (`/ork:dev`), saving any `.tsx`, `.jsx`, `.css`, or `.scss` file (and Next.js route files like `app/**/page.tsx`, `pages/**/*.tsx`) emits a nudge to run `/ork:expect <route>`. The hook (`posttool/ui-change-detector`) is **default-on** and:

- skips silently if `/ork:dev` hasn't booted (no agent-browser session to attach to);
- enforces a 30-second cooldown per route to prevent spam on rapid saves;
- honors `.claude/state/expect-skip.<sessionId>` as a per-session opt-out (write any content);
- honors `ORK_EXPECT_AUTO=0` for an env-level kill switch.

Route resolution: `app/dashboard/page.tsx` → `/dashboard`, `pages/settings.tsx` → `/settings`, component / global-style edits → `/` (home as proxy). Route groups like `app/(marketing)/pricing/page.tsx` strip to `/pricing`.

## ARIA snapshot recording (M125 #6)

After a passing run, the `posttool/expect/snapshot-recorder` hook persists the captured ARIA tree to `.claude/state/expect-snapshots/<route-slug>/<parent-commit>.json`. Subsequent `/ork:expect <route> --diff` runs compare against the most recent prior snapshot for that route — surfaces structural regressions (added/removed buttons, label changes, hierarchy shifts) without needing a baseline screenshot.

For the snapshot recorder to fire, the expect run output must contain `RUN_COMPLETED|passed`, `ROUTE|<route>`, and `ARIA|<json-summary>` tags. The agent-browser-driven flow already emits these.


## When NOT to Use

- **Unit tests** — use `/ork:cover` instead
- **API-only changes** — no browser UI to test
- **Generated files** — skip build artifacts, lock files
- **Docs-only changes** — unless you want to verify docs site rendering


## Quality Bar

Done means all of these hold:
- Test-plan scope is derived from the git diff for the chosen `--target` — no unaffected page appears in the plan.
- Every changed file maps to at least one tested route (via `.expect/config.yaml` or inferred convention) OR is explicitly excluded as API-only, generated, or docs-only.
- Fingerprint check runs first; a diff unchanged since the last run skips execution instead of re-testing.
- Unless `-y` is passed, the plan is presented for review before any browser action runs.
- Each executed step reports PASS or FAIL with evidence (screenshot on failure), and the report's pass/fail totals match the steps actually run.
- The report's exit code is non-zero whenever any step failed.

## Related Skills

- `agent-browser` — Browser automation engine (required dependency)
- `ork:cover` — Test suite generation (unit/integration/e2e)
- `ork:verify` — Grade existing test quality
- `testing-e2e` — Playwright patterns and best practices


## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `fingerprint.md` | SHA-256 gating logic |
| `diff-scanner.md` | Git diff parsing + 3-level classification |
| `route-map.md` | File-to-URL mapping conventions |
| `test-plan.md` | AI test plan generation prompt templates |
| `execution.md` | agent-browser orchestration patterns |
| `report.md` | Report format + artifact storage |
| `config-schema.md` | .expect/config.yaml full schema |
| `aria-diffing.md` | ARIA snapshot comparison for semantic diffing |
| `scope-strategy.md` | Test depth strategy per target mode |
| `saved-flows.md` | Markdown+YAML flow format, adaptive replay |
| `rrweb-recording.md` | rrweb DOM replay integration |
| `human-review.md` | AskUserQuestion plan review gate |
| `ci-integration.md` | GitHub Actions workflow + pre-push hooks |
| `research.md` | millionco/expect architecture analysis |


**Version:** 1.0.0 (March 2026) — Initial scaffold, M99 milestone
