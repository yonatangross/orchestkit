# .expect/config.yaml Schema

Project-level configuration for /ork:expect.

## Full Schema

```yaml
# .expect/config.yaml

# Base URL for the application under test
base_url: http://localhost:3000

# Dev server start command (optional — expect can start it for you)
dev_command: npm run dev
dev_ready_pattern: "ready on"  # Pattern in stdout that signals server is ready
dev_timeout: 30                # Seconds to wait for dev server

# File-to-URL route mapping
route_map:
  "src/components/Header.tsx": ["/", "/about", "/pricing"]
  "src/app/auth/**": ["/login", "/signup", "/forgot-password"]
  "src/app/dashboard/**": ["/dashboard"]
  "src/app/settings/**": ["/settings"]

# Test parameters for dynamic routes
test_params:
  slug: "test-post"
  id: "1"
  username: "testuser"

# Auth configuration for protected pages
auth:
  strategy: cookie          # cookie | bearer | basic
  login_url: /login
  credentials:
    email: test@example.com
    password: from_env:TEST_PASSWORD  # Read from environment variable

# ARIA snapshot settings
aria_snapshots:
  enabled: true
  storage: .expect/snapshots/
  diff_threshold: 0.1  # 10% change tolerance before flagging

# Accessibility settings
accessibility:
  enabled: true
  standard: wcag2aa     # wcag2a | wcag2aa | wcag2aaa
  ignore_rules: []      # axe-core rule IDs to skip

# Report settings
reports:
  storage: .expect/reports/
  keep_last: 10         # Number of reports to retain
  screenshots: on_fail  # always | on_fail | never

# Jev shadow (SHADOW ONLY, see references/jev-shadow.md)
# Runs one Jev request per step when ORK_EXPECT_JEV_SHADOW is truthy.
# Every key below has a shipped fallback in the skill's
# jev-shadow.defaults.yaml; set this section to override it wholesale.
jev_shadow:
  endpoint: "https://api.typesafe.ai/v1/systemone"
  model: "jev-1.13.0"       # pinned: a shadow comparison needs a fixed model
  element_cap: 60           # max interactive elements per request (ref+role+name)
  name_max_chars: 80        # per-name truncation after redaction
  context_max_chars: 300    # per-field truncation for goal and last verify
  latency_budget_ms: 400    # abort budget for the one request per step
  thresholds:
    low_confidence: 0.5     # Choice confidence below this flags the pick
    goal_reached: 0.7       # noul >= threshold raises the matching flag
    page_changed_as_expected: 0.7
    blocked: 0.7

# Files to ignore in diff scanning
ignore_patterns:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "*.md"
  - "*.json"
  - "package-lock.json"
  - ".env*"
```

## Minimal Config

```yaml
base_url: http://localhost:3000
```

Everything else has sensible defaults or is inferred from the framework.

## Environment Variable Injection

Use `from_env:VAR_NAME` syntax for sensitive values:

```yaml
auth:
  credentials:
    password: from_env:TEST_PASSWORD
    api_key: from_env:TEST_API_KEY
```
