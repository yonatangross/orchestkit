# CronCreate Monitoring Patterns

Schedule post-completion health checks that survive session end. Unlike `/loop` (user command), `CronCreate` is a tool the agent calls programmatically.

## CI Status Monitor

```python
# After creating a PR:
CronCreate(
  schedule="*/5 * * * *",    # every 5 minutes
  prompt="Check CI status for PR #{pr_number} on {owner}/{repo}.
    Run: gh pr checks {pr_number} --repo {owner}/{repo}
    If all checks pass: CronDelete this job and report 'CI passed for PR #{pr_number}'.
    If any check fails: report the failure details immediately."
)
```

## Regression Monitor

```python
# After deploying a fix:
CronCreate(
  schedule="0 */6 * * *",    # every 6 hours
  prompt="Regression check for fix deployed in PR #{pr_number}:
    1. Run: npm test
    2. If all pass and this is the 4th consecutive pass: CronDelete this job
    3. If any fail: alert with test names and error messages"
)
```

## Health Check

```python
# After deploying a feature:
CronCreate(
  schedule="0 8 * * *",      # daily at 8am
  prompt="Health check for {feature} deployed {date}:
    1. Run: gh api repos/{owner}/{repo}/actions/runs --jq '.[0].conclusion'
    2. If healthy for 7 days: CronDelete this job
    3. If errors: alert immediately"
)
```

## Best Practices

- Always include a `CronDelete` condition — don't leave crons running forever
- Use descriptive prompts so the cron agent knows what to check
- Prefer `gh` CLI over `curl` for GitHub checks (auth handled)
- Schedule frequency: CI checks every 5min, health checks every 6h, regression daily
