# Security Tool Configurations

Production-ready configurations for security scanning tools.

---

## Bandit (Python)

### Configuration File
```toml
# pyproject.toml
[tool.bandit]
exclude_dirs = ["tests", "venv", ".venv", "migrations"]
skips = ["B101"]  # Skip assert warnings (acceptable in tests)

# Severity and confidence levels
# -ll = low severity and above, -ii = low confidence and above
# Production: use -lll (medium+) -iii (medium+)

[tool.bandit.assert_used]
skips = ["*_test.py", "*test_*.py"]
```

### CLI Usage
```bash
# Basic scan with JSON output
bandit -r src/ -f json -o bandit-report.json

# High severity only (CI pipeline)
bandit -r src/ -ll -ii -f json -o bandit-report.json

# Exclude tests and show line numbers
bandit -r src/ --exclude tests/ -n 3 -f txt

# Specific checks only
bandit -r src/ -t B608,B602,B301  # SQL injection, subprocess, pickle

# Generate config baseline
bandit -r src/ -f json | python -c "import json,sys; print(json.dumps({'exclude': list(set([r['filename'] for r in json.load(sys.stdin)['results']]))})" > .bandit.baseline
```

### High-Priority Rules
| Rule | Description | Severity |
|------|-------------|----------|
| B102 | exec_used | HIGH |
| B301 | pickle | HIGH |
| B303 | md5/sha1 for passwords | HIGH |
| B602 | subprocess_popen_with_shell_equals_true | HIGH |
| B608 | hardcoded_sql_expressions | HIGH |
| B105 | hardcoded_password_string | MEDIUM |

### Detection
```bash
# Find SQL injection vulnerabilities
bandit -r . -t B608 --format json | jq '.results[] | {file: .filename, line: .line_number, code: .code}'

# Find command injection
bandit -r . -t B602,B603,B604 --format json

# Count by severity
bandit -r . -f json | jq '.metrics._totals'
```

---

## Semgrep

### Configuration File
```yaml
# .semgrep.yaml
rules:
  # Custom SQL injection rule
  - id: custom-sql-injection
    pattern-either:
      - pattern: |
          $QUERY = f"SELECT ... {$VAR} ..."
          $CURSOR.execute($QUERY)
      - pattern: |
          $CURSOR.execute(f"SELECT ... {$VAR} ...")
    message: "Potential SQL injection. Use parameterized queries."
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-89"
      owasp: "A03:2021"

  # Hardcoded secrets
  - id: hardcoded-api-key
    patterns:
      - pattern: $VAR = "..."
      - metavariable-regex:
          metavariable: $VAR
          regex: "(api_key|apikey|api_secret|secret_key|auth_token)"
      - metavariable-regex:
          metavariable: $...
          regex: "[a-zA-Z0-9]{20,}"
    message: "Hardcoded API key detected. Use environment variables."
    severity: ERROR
    languages: [python, javascript, typescript]

  # Insecure JWT
  - id: jwt-algorithm-from-header
    pattern: |
      jwt.decode($TOKEN, $SECRET, algorithms=[jwt.get_unverified_header($TOKEN)['alg']])
    message: "JWT algorithm confusion vulnerability. Hardcode the expected algorithm."
    severity: ERROR
    languages: [python]
```

### CLI Usage
```bash
# Run with auto config (OWASP rules)
semgrep --config auto --json > semgrep-results.json

# Specific rule packs
semgrep --config "p/python" --config "p/security-audit" .

# CI mode (fail on findings)
semgrep --config auto --error --json -o results.json

# Ignore paths
semgrep --config auto --exclude "tests/*" --exclude "*.test.js" .

# Only specific severity
semgrep --config auto --severity ERROR .
```

### Rule Packs (2026)
```bash
# Security-focused packs
semgrep --config p/security-audit     # General security
semgrep --config p/owasp-top-ten      # OWASP Top 10
semgrep --config p/sql-injection      # SQL injection
semgrep --config p/xss                # Cross-site scripting
semgrep --config p/secrets            # Hardcoded secrets
semgrep --config p/jwt                # JWT vulnerabilities

# Language-specific
semgrep --config p/python             # Python security
semgrep --config p/javascript         # JavaScript security
semgrep --config p/typescript         # TypeScript security
semgrep --config p/react              # React security
```

### Detection
```bash
# Count findings by severity
semgrep --config auto --json . | jq '[.results[] | .extra.severity] | group_by(.) | map({severity: .[0], count: length})'

# Export findings with file locations
semgrep --config auto --json . | jq '.results[] | {rule: .check_id, file: .path, line: .start.line, message: .extra.message}'
```

---

## npm audit / pip-audit

### npm audit
```bash
# Basic audit
npm audit

# JSON output for parsing
npm audit --json > npm-audit.json

# Production dependencies only
npm audit --omit=dev

# Specific severity threshold
npm audit --audit-level=high

# Auto-fix (use with caution)
npm audit fix

# Force major version updates (breaking changes possible)
npm audit fix --force
```

### npm audit parsing
```bash
# Count vulnerabilities by severity
npm audit --json | jq '.metadata.vulnerabilities'

# List critical/high packages
npm audit --json | jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical" or .value.severity == "high") | {package: .key, severity: .value.severity, via: .value.via}'

# CI gate script
#!/bin/bash
CRITICAL=$(npm audit --json | jq '.metadata.vulnerabilities.critical')
HIGH=$(npm audit --json | jq '.metadata.vulnerabilities.high')

if [ "$CRITICAL" -gt 0 ]; then
    echo "BLOCKED: $CRITICAL critical vulnerabilities"
    exit 1
fi

if [ "$HIGH" -gt 5 ]; then
    echo "BLOCKED: $HIGH high vulnerabilities (threshold: 5)"
    exit 1
fi

echo "PASSED: Security scan"
exit 0
```

### pip-audit
```bash
# Install
pip install pip-audit

# Basic scan
pip-audit

# JSON output
pip-audit --format=json -o pip-audit.json

# Scan requirements file
pip-audit -r requirements.txt

# Scan with fix suggestions
pip-audit --fix --dry-run

# Ignore specific vulnerabilities
pip-audit --ignore-vuln PYSEC-2024-1234

# Strict mode (fail on any finding)
pip-audit --strict
```

### pip-audit parsing
```bash
# Count vulnerabilities
pip-audit --format=json | jq '. | length'

# List affected packages
pip-audit --format=json | jq '.[] | {name: .name, version: .version, vulns: [.vulns[].id]}'

# CI gate script
#!/bin/bash
VULN_COUNT=$(pip-audit --format=json 2>/dev/null | jq '. | length')

if [ "$VULN_COUNT" -gt 0 ]; then
    echo "BLOCKED: $VULN_COUNT vulnerable packages"
    pip-audit  # Show details
    exit 1
fi

echo "PASSED: No vulnerable packages"
exit 0
```

---

## Secret Detection

### Gitleaks Configuration
```yaml
# .gitleaks.toml
title = "Gitleaks config"

[allowlist]
description = "Global allowlist"
paths = [
    '''(.*)?test(.*)''',
    '''(.*)fixtures(.*)''',
    '''package-lock\.json''',
]

[[rules]]
id = "aws-access-key"
description = "AWS Access Key ID"
regex = '''(?i)aws_access_key_id\s*=\s*['"]?([A-Z0-9]{20})['"]?'''
secretGroup = 1
keywords = ["aws"]

[[rules]]
id = "generic-api-key"
description = "Generic API Key"
regex = '''(?i)(api_key|apikey|api-key)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?'''
secretGroup = 2

[[rules]]
id = "private-key"
description = "Private Key"
regex = '''-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'''
```

### Gitleaks CLI
```bash
# Scan repository
gitleaks detect --source . --report-format json --report-path gitleaks.json

# Scan specific commit range
gitleaks detect --source . --log-opts="HEAD~10..HEAD"

# Pre-commit hook mode
gitleaks protect --staged

# Verbose output
gitleaks detect --source . --verbose

# Baseline (ignore existing secrets)
gitleaks detect --source . --baseline-path .gitleaks-baseline.json
```

### TruffleHog
```bash
# Scan git repository
trufflehog git file://. --json > trufflehog.json

# Scan GitHub repository
trufflehog github --repo=https://github.com/org/repo --json

# Only verified secrets (reduces false positives)
trufflehog git file://. --only-verified

# Scan specific commit range
trufflehog git file://. --since-commit=abc123

# Scan filesystem (not git)
trufflehog filesystem --directory=. --json
```

### detect-secrets
```bash
# Install
pip install detect-secrets

# Generate baseline
detect-secrets scan > .secrets.baseline

# Audit baseline (mark false positives)
detect-secrets audit .secrets.baseline

# Scan with baseline (only new secrets)
detect-secrets scan --baseline .secrets.baseline

# Pre-commit hook
detect-secrets-hook --baseline .secrets.baseline
```

### Secret Pattern Reference
```regex
# AWS Access Key
AKIA[0-9A-Z]{16}

# AWS Secret Key
[A-Za-z0-9/+=]{40}

# GitHub Token (classic)
ghp_[a-zA-Z0-9]{36}

# GitHub Token (fine-grained)
github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}

# JWT Token
eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*

# Generic API Key
(?i)(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?

# Private Key Header
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----

# Database Connection String
(?i)(postgres|mysql|mongodb)://[^:]+:[^@]+@
```

### Detection
```bash
# Combined scan script
#!/bin/bash
echo "=== Secret Detection ==="

# Gitleaks
gitleaks detect --source . --report-format json --report-path gitleaks.json 2>/dev/null
GITLEAKS_COUNT=$(cat gitleaks.json 2>/dev/null | jq '. | length' || echo 0)

# TruffleHog (verified only)
trufflehog git file://. --only-verified --json 2>/dev/null > trufflehog.json
TRUFFLEHOG_COUNT=$(cat trufflehog.json 2>/dev/null | jq -s '. | length' || echo 0)

echo "Gitleaks: $GITLEAKS_COUNT findings"
echo "TruffleHog (verified): $TRUFFLEHOG_COUNT findings"

if [ "$GITLEAKS_COUNT" -gt 0 ] || [ "$TRUFFLEHOG_COUNT" -gt 0 ]; then
    echo "BLOCKED: Secrets detected"
    exit 1
fi

echo "PASSED: No secrets detected"
exit 0
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for secret scanning

      - name: Python Security (Bandit + pip-audit)
        run: |
          pip install bandit pip-audit
          bandit -r src/ -ll -ii -f json -o bandit.json || true
          pip-audit --format=json -o pip-audit.json || true

      - name: JavaScript Security (npm audit)
        run: |
          npm audit --json > npm-audit.json || true

      - name: SAST (Semgrep)
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets

      - name: Secret Detection (Gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            bandit.json
            pip-audit.json
            npm-audit.json
```

### Pre-commit Configuration
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.7
    hooks:
      - id: bandit
        args: ["-r", "src/", "-ll", "-ii"]
        exclude: ^tests/

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/semgrep/semgrep
    rev: v1.52.0
    hooks:
      - id: semgrep
        args: ["--config", "auto", "--error"]
```

---

## Summary Table

| Tool | Language | Type | Install |
|------|----------|------|---------|
| Bandit | Python | SAST | `pip install bandit` |
| Semgrep | Multi | SAST | `pip install semgrep` |
| npm audit | JS/TS | Deps | Built-in |
| pip-audit | Python | Deps | `pip install pip-audit` |
| Gitleaks | All | Secrets | `brew install gitleaks` |
| TruffleHog | All | Secrets | `pip install trufflehog` |
| detect-secrets | All | Secrets | `pip install detect-secrets` |

## Related Skills

- `owasp-top-10` - Vulnerability context
- `devops-deployment` - CI/CD integration
- `defense-in-depth` - Security layers