# /loop Recipes for CI Automation

CC 2.1.71 introduced the `/loop` command for recurring prompts within a session. These recipes pair `/loop` with OrchestKit skills for continuous monitoring.

## Deploy Watcher

Monitor GitHub Actions workflow status after pushing:

```
/loop 2m gh run list --limit 1 --json status,conclusion,name | Summarize CI status. Alert if failed.
```

## Health Monitor

Poll a health endpoint until it returns healthy:

```
/loop 30s curl -sf https://api.example.com/health && echo "HEALTHY" || echo "UNHEALTHY"
```

## TDD Mode

Continuously run related tests while developing:

```
/loop 10s npm test -- --findRelatedTests src/auth/ 2>&1 | tail -5
```

## PR Review Queue

Check for new PRs needing review:

```
/loop 15m gh pr list --state open --json number,title,updatedAt,reviewDecision --jq '.[] | select(.reviewDecision != "APPROVED")'
```

## Drift Detection

Run doctor checks periodically to detect config drift:

```
/loop 1h Run /ork:doctor --json --category=5 and alert on any FAIL results
```

## Dependency Audit

Check for new vulnerabilities on a longer interval:

```
/loop 6h npm audit --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.metadata?.vulnerabilities||'clean')"
```

## Build Watcher

Watch for build completion after triggering a workflow:

```
/loop 1m gh run list --workflow=ci.yml --limit 1 --json status,conclusion | Check if CI completed. Stop looping when done.
```

## Cost Control Tips

- Use short intervals (30s-2m) only for active monitoring (deploys, builds)
- Use longer intervals (15m-6h) for background awareness (PR queue, audits)
- `/loop` runs within the current session — it stops when the session ends
- Each iteration costs tokens — Haiku-level prompts recommended for frequent loops
