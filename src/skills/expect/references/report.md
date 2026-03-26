# Report Generator

Aggregate execution results into a structured report with artifacts and exit codes.

## Report Format (JSON)

```json
{
  "timestamp": "2026-03-26T16:30:00Z",
  "target": "unstaged",
  "duration_ms": 45000,
  "files_changed": 3,
  "pages_tested": 4,
  "results": [
    {
      "page": "/login",
      "level": "direct",
      "steps": 5,
      "passed": 5,
      "failed": 0,
      "status": "pass"
    },
    {
      "page": "/dashboard",
      "level": "routed",
      "steps": 3,
      "passed": 2,
      "failed": 1,
      "status": "fail",
      "failures": [
        {
          "step": 2,
          "description": "Chart component renders",
          "error": "TypeError: Cannot read properties of undefined (reading 'map')",
          "screenshot": ".expect/screenshots/dashboard-step2-fail.png"
        }
      ]
    }
  ],
  "summary": {
    "total_steps": 15,
    "passed": 13,
    "failed": 2,
    "pass_rate": 0.867
  }
}
```

## Console Output

```
/ork:expect Report
═══════════════════════════════════════
Target: unstaged (3 files changed)
Pages tested: 4
Duration: 45s

Results:
  ✓ /login — 5/5 steps passed
  ✓ /signup — 3/3 steps passed
  ✗ /dashboard — 2/3 steps passed (chart component crash)
  ✓ /settings — 4/4 steps passed

13 passed, 2 failed (86.7%)

Artifacts:
  .expect/reports/2026-03-26T16-30-00.json
  .expect/screenshots/dashboard-step2-fail.png
```

## Exit Code Convention

| Scenario | Exit Suggestion |
|----------|----------------|
| All pass | "All tests passed. Safe to push." |
| Some fail | "2 tests failed. Fix before pushing." |
| No changes | "No changes detected. Nothing to test." |
| Execution error | "Test execution failed. Check agent-browser logs." |

## Post-Run Actions

1. Update `.expect/fingerprints.json` with current file hashes
2. Save report to `.expect/reports/{iso-timestamp}.json`
3. If memory MCP available, persist critical failures to knowledge graph
4. Suggest next steps based on results
