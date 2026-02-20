---
title: Scan dependencies for CVEs, detect committed secrets, and run SAST to catch vulnerabilities before production
impact: CRITICAL
impactDescription: "Unscanned code lets known CVEs, committed secrets, and injection vulnerabilities reach production — multi-layer scanning is essential"
tags: scanning, dependency, npm-audit, pip-audit, vulnerabilities, cve, secrets, trufflehog, gitleaks, detect-secrets, credentials, sast, semgrep, bandit, static-analysis, code-security
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

---

## Secret Detection

Prevent credentials, API keys, and tokens from being committed to repositories.

**Incorrect — relying on .gitignore alone:**
```bash
# .gitignore only prevents file-level commits, not inline secrets
echo "API_KEY=sk-live-abc123" >> config.py
git add config.py  # Secret committed — now in git history forever
```

**Correct — multi-layer secret detection:**
```bash
# TruffleHog (scans entire git history)
trufflehog git file://. --json > secrets-scan.json

# Gitleaks (fast, pre-commit friendly)
gitleaks detect --source . --report-format json

# Check results
SECRET_COUNT=$(cat secrets-scan.json | jq '. | length')
if [ "$SECRET_COUNT" -gt 0 ]; then
  echo "BLOCK: $SECRET_COUNT secrets detected!"
  exit 1
fi
```

**Pre-commit hooks (most effective layer):**
```yaml
# .pre-commit-config.yaml
repos:
  # Gitleaks — fast pattern matching
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  # detect-secrets — supports baselines for false positives
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ["--baseline", ".secrets.baseline"]
```

**Baseline for false positives:**
```bash
# Generate baseline (marks existing non-secrets)
detect-secrets scan > .secrets.baseline

# Audit false positives interactively
detect-secrets audit .secrets.baseline
```

**Key rules:**
- Use pre-commit hooks as first line of defense — catches secrets before they enter history
- TruffleHog for deep history scanning; Gitleaks for fast pre-commit checks
- If a secret is committed, rotate it immediately — removing from history is not enough
- Use `.secrets.baseline` to suppress false positives (e.g., example keys in docs)
- Run both pre-commit AND CI scanning — defense in depth

---

## Static Analysis (SAST)

Run static application security testing to catch vulnerabilities in source code.

**Incorrect — relying only on linters for security:**
```bash
# ESLint/Pylint catch style issues, not security vulnerabilities
eslint .  # Does not detect SQL injection, SSRF, or path traversal
```

**Correct — dedicated SAST tools:**
```bash
# Semgrep (multi-language, auto rules include OWASP patterns)
semgrep --config=auto --json > semgrep-results.json
CRITICAL=$(cat semgrep-results.json | jq '[.results[] | select(.extra.severity == "ERROR")] | length')

if [ "$CRITICAL" -gt 0 ]; then
  echo "BLOCK: $CRITICAL critical SAST findings"
  exit 1
fi
```

```bash
# Bandit (Python-specific)
bandit -r . -f json -o bandit-report.json
HIGH=$(cat bandit-report.json | jq '[.results[] | select(.issue_severity == "HIGH")] | length')
```

**Pre-commit integration (shift-left):**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.52.0
    hooks:
      - id: semgrep
        args: ["--config", "auto", "--error"]

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.7
    hooks:
      - id: bandit
        args: ["-c", "pyproject.toml", "-r", "."]
        exclude: ^tests/
```

**CI integration:**
```yaml
# GitHub Actions
- name: SAST scan
  run: |
    semgrep --config=auto --json > sast.json
    ERRORS=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' sast.json)
    if [ "$ERRORS" -gt 0 ]; then
      echo "::error::$ERRORS critical SAST findings"
      exit 1
    fi
```

**Key rules:**
- Use `semgrep --config=auto` for broad OWASP coverage across languages
- Bandit is Python-specific — pair with Semgrep for multi-language projects
- Run SAST in pre-commit hooks (shift-left) AND CI (enforce)
- Block on ERROR severity; WARNING findings go to review queue
