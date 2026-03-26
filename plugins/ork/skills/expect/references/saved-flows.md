# Saved Test Flows (#1173)

Reusable test sequences stored as Markdown+YAML files in `.expect/flows/`.

## Flow Format

```markdown
---
format_version: 1
title: "Login flow test"
slug: "login-flow-test"
target_scope: "branch"
created: "2026-03-26T12:00:00Z"
last_run: "2026-03-26T14:30:00Z"
last_result: "passed"
steps:
  - instruction: "Navigate to /login"
    expected: "Login form visible with email and password fields"
  - instruction: "Fill email with test@example.com and password with test123"
    expected: "Fields populated"
  - instruction: "Click Login button"
    expected: "Redirect to /dashboard"
  - instruction: "Verify welcome message"
    expected: "Text 'Welcome back' visible on page"
---

# Login Flow Test

Tests the standard login flow with valid credentials.

## Notes
- Requires test user: test@example.com / test123
- Dashboard should show welcome message after redirect
- Auth cookie should be set (verify via eval document.cookie)
```

## Directory Structure

```
.expect/flows/
├── login.md           # Login flow
├── checkout.md        # Checkout flow
└── signup.md          # Signup flow
```

## Running a Flow

```bash
/ork:expect --flow login          # Replay the login flow
/ork:expect --flow checkout -y    # Replay checkout, skip review
```

## Adaptive Replay

When replaying a saved flow, the agent adapts to UI changes:

1. Load flow steps from YAML frontmatter
2. For each step:
   a. Take ARIA snapshot of current page
   b. Match instruction to current UI state
   c. If element exists → execute as-is
   d. If element missing → use ARIA snapshot to find equivalent
   e. If no equivalent found → mark step as `selector-drift` failure
3. After all steps, compare results with `last_result`

## Creating Flows

Flows are created manually by the developer:

```bash
# Create a new flow file
cat > .expect/flows/login.md << 'EOF'
---
format_version: 1
title: "Login flow"
slug: "login"
steps:
  - instruction: "Navigate to /login"
    expected: "Login form visible"
  - instruction: "Fill email and password, click submit"
    expected: "Redirect to /dashboard"
---
# Login Flow
Standard login test with valid credentials.
EOF
```

Future: auto-generate flows from successful test runs by recording the steps the agent executed.

## Flow Metadata

| Field | Required | Description |
|-------|----------|-------------|
| `format_version` | Yes | Always `1` for now |
| `title` | Yes | Human-readable flow name |
| `slug` | Yes | URL-safe identifier, matches filename |
| `target_scope` | No | Recommended target mode (branch, commit, etc.) |
| `created` | No | ISO timestamp of creation |
| `last_run` | No | ISO timestamp of last execution |
| `last_result` | No | `passed` or `failed` |
| `steps` | Yes | Array of instruction+expected pairs |
