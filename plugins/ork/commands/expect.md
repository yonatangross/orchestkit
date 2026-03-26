---
description: "Diff-aware AI browser testing — analyzes git changes, generates targeted test plans, and executes them via agent-browser. Reads git diff to determine what changed, maps changes to affected pages via route map, generates a test plan scoped to the diff, and runs it with pass/fail reporting. Use when testing UI changes, verifying PRs before merge, running regression checks on changed components, or validating that recent code changes don't break the user-facing experience."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, ToolSearch, WebFetch]
---

# Auto-generated from skills/expect/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Expect — Diff-Aware AI Browser Testing

Analyze git changes, generate targeted test plans, and execute them via AI-driven browser automation.

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
ToolSearch(query="select:mcp__memory__search_nodes")

# Verify agent-browser is available
Bash("command -v agent-browser || npx agent-browser --version")
# If missing: "Install agent-browser: npm i -g @anthropic-ai/agent-browser"
```


## CRITICAL: Task Management

```python
TaskCreate(
  subject="Expect: test changed code",
  description="Diff-aware browser testing pipeline",
  activeForm="Running diff-aware browser tests"
)
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

Run the test plan via `agent-browser`:

```python
Agent(
  subagent_type="general-purpose",
  prompt=f"""Execute this test plan using agent-browser:
  {test_plan}

  For each step:
  1. Navigate to the URL
  2. Execute the test action
  3. Take a screenshot on failure
  4. Report PASS/FAIL with evidence

  Use the agent-browser skill for all browser interactions.
  """,
  run_in_background=True
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


## When NOT to Use

- **Unit tests** — use `/ork:cover` instead
- **API-only changes** — no browser UI to test
- **Generated files** — skip build artifacts, lock files
- **Docs-only changes** — unless you want to verify docs site rendering


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


**Version:** 1.0.0 (March 2026) — Initial scaffold, M99 milestone
