# Execution Engine (#1175)

Run test plans via agent-browser with session management, auth profiles, and failure handling.

## Execution Flow

```
1. Load auth profile (if configured)
2. For each page in test plan:
   a. Open URL via agent-browser
   b. Take pre-test ARIA snapshot
   c. Execute test steps with status protocol
   d. Take post-test ARIA snapshot (for diffing)
   e. On failure: categorize → retry/skip/fail
3. Close session, collect artifacts
```

## Agent Spawn

```python
Agent(
    subagent_type="general-purpose",
    prompt=build_execution_prompt(diff_data, scope_strategy, coverage_context),
    run_in_background=True,
    name="expect-runner"
)
```

## Agent-Browser Commands

| Command | Use | Example |
|---------|-----|---------|
| `open <url>` | Navigate to page | `open http://localhost:3000/login` |
| `snapshot` | Full ARIA accessibility tree | Capture page structure |
| `snapshot -i` | Interactive elements only | Find clickable/fillable elements |
| `screenshot` | Capture viewport | Auto on failure |
| `screenshot --annotate` | Labeled screenshot | Vision fallback for complex UIs |
| `click @ref` | Click by ARIA ref | `click @e15` (from snapshot refs) |
| `fill @ref <text>` | Type into input | `fill @e8 "test@example.com"` |
| `select @ref <option>` | Dropdown selection | `select @e12 "United States"` |
| `eval <js>` | Execute JavaScript | `eval document.title` |

## Auth Profiles

If `.expect/config.yaml` specifies an `auth_profile`:

```python
# Load auth before testing protected pages
Bash(f"agent-browser auth login {auth_profile}")
```

Auth profiles are managed by agent-browser's vault system — credentials are never stored in `.expect/`.

## Session Management

- **One session per run** — sequential page visits, shared auth state
- **Session timeout**: 5 minutes per page (configurable)
- **Cleanup**: agent-browser auto-closes on agent completion

## Failure Decision Tree

```
Step fails
  ├── Is it a retry-able failure? (element-not-found, timeout)
  │   ├── First attempt → wait 2s, retry once
  │   └── Second attempt → categorize and continue
  ├── Is it a page-level failure? (5xx, crash)
  │   └── Skip remaining steps on this page
  ├── Is it auth-related? (401, redirect to login)
  │   └── Skip page, mark as auth-blocked
  └── Is it an app bug? (assertion fails with evidence)
      └── Log as app-bug, screenshot, continue
```

## ARIA Snapshot Diffing Integration

```python
# Before test steps
pre_snapshot = agent_browser("snapshot")

# After test steps
post_snapshot = agent_browser("snapshot")

# Diff (see aria-diffing.md)
diff = compute_aria_diff(pre_snapshot, post_snapshot)
if diff.change_score > config.aria_snapshots.diff_threshold:
    report.add_aria_diff(page, diff)
```

## Concurrency Rules

- **Sequential pages** — no parallel browser sessions (see rules/no-parallel-browsers.md)
- **Background agent** — the runner agent runs in background, lead monitors via status protocol
- **Timeout per page**: 5 min default, configurable in config.yaml
- **Total run timeout**: 30 min default
