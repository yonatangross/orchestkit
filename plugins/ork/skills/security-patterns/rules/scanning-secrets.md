---
title: Secret Detection
impact: CRITICAL
impactDescription: "Committed secrets (API keys, credentials) are immediately exposed in git history — rotation required even after removal"
tags: scanning, secrets, trufflehog, gitleaks, detect-secrets, credentials
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
