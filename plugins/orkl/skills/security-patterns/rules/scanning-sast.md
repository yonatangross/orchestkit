---
title: Static Analysis (SAST)
impact: HIGH
impactDescription: "Skipping SAST lets SQL injection, command injection, and insecure patterns reach production — Semgrep catches what linters miss"
tags: scanning, sast, semgrep, bandit, static-analysis, code-security
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
