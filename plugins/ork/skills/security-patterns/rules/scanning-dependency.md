---
title: Dependency Scanning
impact: HIGH
impactDescription: "Unscanned dependencies introduce known CVEs into production — a single critical vulnerability can lead to full compromise"
tags: scanning, dependency, npm-audit, pip-audit, vulnerabilities, cve
---

## Dependency Scanning

Automate vulnerability detection in package dependencies before deployment.

**Incorrect — ignoring audit output:**
```bash
npm audit  # Runs but nobody checks the result
npm install  # Proceeds regardless of vulnerabilities
```

**Correct — automated scanning with severity gates:**
```bash
# JavaScript (npm)
npm audit --json > security-audit.json
CRITICAL=$(npm audit --json | jq '.metadata.vulnerabilities.critical')
HIGH=$(npm audit --json | jq '.metadata.vulnerabilities.high')

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo "BLOCK: $CRITICAL critical, $HIGH high vulnerabilities"
  exit 1
fi

# Auto-fix safe updates
npm audit fix
```

```bash
# Python (pip-audit)
pip-audit --format=json > security-audit.json

# Alternative: safety
safety check --json > security-audit.json
```

```bash
# Container images (Trivy)
trivy image myapp:latest --format json > trivy-scan.json
CRITICAL=$(cat trivy-scan.json | jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length')
```

**Escalation thresholds:**

| Severity | Threshold | Action |
|----------|-----------|--------|
| Critical | Any | BLOCK deployment |
| High | > 5 | BLOCK deployment |
| Moderate | > 20 | WARNING |
| Low | > 50 | WARNING |

**Key rules:**
- Run `npm audit` or `pip-audit` in CI — block on critical/high findings
- Use `--json` output for automation (not human-readable format)
- Container scanning with Trivy catches OS-level vulnerabilities npm/pip miss
- Auto-fix with `npm audit fix` only for non-breaking updates; review breaking fixes manually
