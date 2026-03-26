# Report Generator (#1176)

Aggregate execution results into structured reports with CI-compatible exit codes.

## Report Sections

### 1. Summary
```
/ork:expect Report
═══════════════════════════════════════
Target: branch (5 files changed)
Pages tested: 4
Duration: 45s
Result: 13 passed, 2 failed (86.7%)
```

### 2. Step Details
```
/login (Direct — auth form changed)
  ✓ Step 1: Page loads (0.8s)
  ✓ Step 2: Form renders with email + password (0.3s)
  ✗ Step 3: Submit empty form → validation [app-bug]
    Expected: validation errors shown
    Actual: form submitted with no validation
    Screenshot: .expect/screenshots/login-step3.png
  ✓ Step 4: Fill valid credentials → redirect (1.2s)

/dashboard (Routed — renders auth-dependent header)
  ✓ Step 1: Page loads (0.5s)
  ✓ Step 2: User name in header (0.2s)
```

### 3. ARIA Diff (if snapshots exist)
```
ARIA Changes: /login
  + Added: textbox "Confirm Password"
  - Removed: link "Forgot Password?"
  ~ Changed: button "Sign In" → "Log In"
  Change score: 15% (threshold: 10%) — FLAGGED
```

### 4. Artifacts
```
Artifacts:
  .expect/reports/2026-03-26T16-30-00.json
  .expect/screenshots/login-step3.png
```

### 5. Fingerprint
Updated on success, unchanged on failure.

## Output Formats

### Terminal (Default)
Colored output with pass/fail symbols, failure details, and artifact paths.

### CI Mode (GitHub Actions)
When running in CI (`CI=true` or `GITHUB_ACTIONS=true`):

```
::error file=src/components/LoginForm.tsx,line=1::Login form validation missing — expected error messages on empty submit
::warning file=src/app/login/page.tsx::ARIA snapshot changed by 15%% (threshold 10%%)
```

### JSON Report
```json
{
  "version": 1,
  "timestamp": "2026-03-26T16:30:00Z",
  "target": "branch",
  "duration_ms": 45000,
  "files_changed": 5,
  "pages_tested": 4,
  "results": [
    {
      "page": "/login",
      "level": "direct",
      "steps": [
        {"id": "login-1", "title": "Page loads", "status": "passed", "duration_ms": 800},
        {"id": "login-3", "title": "Submit empty form", "status": "failed",
         "category": "app-bug", "error": "No validation errors shown",
         "screenshot": ".expect/screenshots/login-step3.png"}
      ]
    }
  ],
  "aria_diffs": [
    {"page": "/login", "change_score": 0.15, "changes": ["+textbox 'Confirm Password'", "-link 'Forgot Password?'"]}
  ],
  "summary": {
    "total_steps": 15,
    "passed": 13,
    "failed": 2,
    "pass_rate": 0.867
  }
}
```

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | All passed | Every step passed, or fingerprint matched (skip) |
| `1` | Tests failed | At least one `app-bug` or `selector-drift` failure |
| `0` + warning | Skipped | `env-issue`, `auth-blocked`, or `missing-test-data` |

## Report Retention

- Keep last N reports (default 10, configurable in config.yaml)
- Auto-delete oldest when limit exceeded
- Reports are gitignored (`.expect/reports/` in `.gitignore`)
- Screenshots are gitignored (`.expect/screenshots/`)

## Post-Report Actions

1. Update fingerprint if all passed (`scripts/fingerprint.sh save`)
2. Persist critical failures to memory graph (if MCP available)
3. Suggest next steps:
   - All passed → "Safe to push."
   - Failed → "Fix {N} failures before pushing."
   - Skipped → "Resolve environment issues and re-run."
