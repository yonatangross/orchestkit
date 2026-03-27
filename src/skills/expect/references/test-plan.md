# AI Test Plan Generation — buildExecutionPrompt (#1169)

Core prompt template that generates test plans from diff context using AI agents.

## Prompt Template (8 Sections)

```python
def build_execution_prompt(
    diff_data: dict,
    scope_strategy: str,
    coverage_context: str,
    saved_flow: str | None = None,
    instruction: str | None = None,
) -> str:
    return f"""
You are a QA engineer executing browser tests via agent-browser.

═══════════════════════════════════════════════════════════════
SECTION 1: DIFF CONTEXT
═══════════════════════════════════════════════════════════════

Changed files ({diff_data['summary']['total']} total):
{format_files(diff_data['files'])}

File stats (by magnitude):
{format_stats(diff_data['stats'])}

Diff preview:
{diff_data['preview']}

Recent commits:
{format_context(diff_data['context'])}

═══════════════════════════════════════════════════════════════
SECTION 2: SCOPE STRATEGY
═══════════════════════════════════════════════════════════════

{scope_strategy}

═══════════════════════════════════════════════════════════════
SECTION 3: COVERAGE CONTEXT
═══════════════════════════════════════════════════════════════

{coverage_context}

Files WITH existing tests are lower priority — focus on files WITHOUT test coverage.

═══════════════════════════════════════════════════════════════
SECTION 4: AGENT-BROWSER TOOL DOCS
═══════════════════════════════════════════════════════════════

Available commands (use via agent-browser skill):
- snapshot: Capture current page accessibility tree
- click <selector>: Click an element
- fill <selector> <value>: Type into an input
- select <selector> <option>: Select dropdown option
- screenshot [filename]: Take screenshot (auto on failure)
- eval <js>: Run JavaScript in page context
- navigate <url>: Go to URL
- wait <ms>: Wait for specified milliseconds
- assert_text <text>: Assert text is visible on page
- assert_url <pattern>: Assert current URL matches pattern

═══════════════════════════════════════════════════════════════
SECTION 5: INTERACTION PATTERN
═══════════════════════════════════════════════════════════════

Follow this pattern for every page:

1. Navigate to URL
2. Take ARIA snapshot (accessibility tree)
3. Use ARIA roles/names as selectors — NOT CSS selectors
   Prefer: click "Submit" (by accessible name)
   Avoid: click "#btn-submit-form-1" (brittle CSS)
4. Batch related assertions together
5. Screenshot only on failure (not every step)

When interacting with forms:
- Fill all fields before submitting
- Check validation messages after submit
- Verify redirect/state change after success

═══════════════════════════════════════════════════════════════
SECTION 6: STATUS PROTOCOL
═══════════════════════════════════════════════════════════════

Report every step using this exact format:

  STEP_START|<step-id>|<step-title>
  STEP_DONE|<step-id>|<short-summary>

On failure:
  ASSERTION_FAILED|<step-id>|<why-it-failed>

At the end:
  RUN_COMPLETED|passed|<summary>
  RUN_COMPLETED|failed|<summary>

Example:
  STEP_START|login-1|Navigate to /login
  STEP_DONE|login-1|Page loaded, form visible
  STEP_START|login-2|Fill email and password
  STEP_DONE|login-2|Fields filled
  STEP_START|login-3|Submit form
  ASSERTION_FAILED|login-3|Expected redirect to /dashboard, got /login with error "Invalid credentials"
  RUN_COMPLETED|failed|2 passed, 1 failed — login form validation error

═══════════════════════════════════════════════════════════════
SECTION 7: ANTI-RABBIT-HOLE HEURISTICS
═══════════════════════════════════════════════════════════════

CRITICAL — follow these rules to avoid wasting time:

1. Do NOT repeat the same failing action more than ONCE without new evidence.
   If click "Submit" fails, do not try clicking it again. Investigate why.

2. If 4 consecutive actions fail, STOP and report.
   Output: RUN_COMPLETED|failed|Stopped after 4 consecutive failures

3. Categorize every failure into one of these types:
   - app-bug: The application has a real bug (test found something!)
   - env-issue: Server not running, wrong URL, network error
   - auth-blocked: Need login but no credentials available
   - missing-test-data: Form requires data that doesn't exist
   - selector-drift: UI changed, saved selectors don't match
   - agent-misread: AI misinterpreted the page structure

4. If you detect env-issue or auth-blocked, skip remaining steps
   on that page and move to the next page.

5. Total time limit: 5 minutes per page. If a page takes longer, skip.

═══════════════════════════════════════════════════════════════
SECTION 8: USER INSTRUCTION / SAVED FLOW
═══════════════════════════════════════════════════════════════

{format_instruction_or_flow(instruction, saved_flow)}
"""
```

## Helper Functions

```python
def format_files(files: list) -> str:
    return "\n".join(
        f"  [{f['status'].upper()[0]}] {f['path']} ({f['type']})"
        for f in files
    )

def format_stats(stats: list) -> str:
    sorted_stats = sorted(stats, key=lambda s: s['magnitude'], reverse=True)
    return "\n".join(
        f"  +{s['added']} -{s['removed']} ({s['magnitude']} lines) {s['path']}"
        for s in sorted_stats[:12]
    )

def format_context(commits: list) -> str:
    return "\n".join(f"  {c}" for c in commits)

def format_instruction_or_flow(instruction, saved_flow):
    if saved_flow:
        return f"""REPLAYING SAVED FLOW:
{saved_flow}

Adapt if UI has changed since the flow was saved. If a step no longer
matches the page structure, use the ARIA snapshot to find the equivalent
element and continue."""

    if instruction:
        return f"""USER INSTRUCTION:
{instruction}

Generate a test plan that addresses this instruction, scoped to the
changed files from Section 1."""

    return """No specific instruction. Generate a test plan that verifies
the changed code works correctly and doesn't break existing functionality.
Focus on the most impactful changes (highest magnitude from Section 1)."""
```

## Coverage Context Generation

Cross-reference changed files with existing test files:

```python
def generate_coverage_context(changed_files: list, project_dir: str) -> str:
    covered = []
    uncovered = []

    for f in changed_files:
        # Check for co-located test
        test_patterns = [
            f.replace('.tsx', '.test.tsx'),
            f.replace('.ts', '.test.ts'),
            f.replace('.ts', '.spec.ts'),
            f.replace('src/', 'src/__tests__/'),
        ]
        has_test = any(os.path.exists(os.path.join(project_dir, t)) for t in test_patterns)

        if has_test:
            covered.append(f)
        else:
            uncovered.append(f)

    lines = []
    if uncovered:
        lines.append(f"Files WITHOUT test coverage ({len(uncovered)}) — HIGH PRIORITY:")
        lines.extend(f"  ⚠ {f}" for f in uncovered)
    if covered:
        lines.append(f"\nFiles WITH existing tests ({len(covered)}) — lower priority:")
        lines.extend(f"  ✓ {f}" for f in covered)

    return "\n".join(lines)
```

## Status Protocol Parsing

Parse agent output to extract structured results:

```python
import re

def parse_status_lines(output: str) -> dict:
    steps = []
    final_status = None

    for line in output.split('\n'):
        line = line.strip()

        if line.startswith('STEP_START|'):
            parts = line.split('|', 2)
            steps.append({"id": parts[1], "title": parts[2], "status": "running"})

        elif line.startswith('STEP_DONE|'):
            parts = line.split('|', 2)
            step = next((s for s in steps if s['id'] == parts[1]), None)
            if step:
                step['status'] = 'passed'
                step['summary'] = parts[2]

        elif line.startswith('ASSERTION_FAILED|'):
            parts = line.split('|', 2)
            step = next((s for s in steps if s['id'] == parts[1]), None)
            if step:
                step['status'] = 'failed'
                step['error'] = parts[2]

        elif line.startswith('RUN_COMPLETED|'):
            parts = line.split('|', 2)
            final_status = {"result": parts[1], "summary": parts[2]}

    passed = sum(1 for s in steps if s['status'] == 'passed')
    failed = sum(1 for s in steps if s['status'] == 'failed')

    return {
        "steps": steps,
        "passed": passed,
        "failed": failed,
        "final": final_status,
    }
```
