# Policy-as-Code

Define verification policies as machine-readable configuration.

## Policy Structure

```yaml
version: "1.0"
name: policy-name
description: What this policy enforces

thresholds:
  composite_minimum: 6.0
  coverage_minimum: 70

rules:
  blockers: []    # Fail verification
  warnings: []    # Note but continue
  info: []        # Informational only
```

---

## Rule Definition

### Blocker Rules (Must Pass)

```yaml
blockers:
  - dimension: security
    condition: below
    value: 5.0
    message: "Security score below minimum"

  - check: critical_vulnerabilities
    condition: above
    value: 0
    message: "Critical vulnerabilities found"

  - check: type_errors
    condition: above
    value: 0
    message: "TypeScript errors must be zero"
```

### Warning Rules (Should Fix)

```yaml
warnings:
  - dimension: code_quality
    condition: below
    value: 7.0
    message: "Code quality could be improved"

  - check: test_coverage
    condition: below
    value: 80
    message: "Coverage below recommended 80%"
```

### Info Rules (Awareness)

```yaml
info:
  - check: todo_count
    condition: above
    value: 5
    message: "Multiple TODOs found in code"
```

---

## Threshold Configuration

| Threshold | Type | Description |
|-----------|------|-------------|
| composite_minimum | float | Overall score minimum (0-10) |
| coverage_minimum | int | Test coverage percentage |
| critical_vulnerabilities | int | Max critical vulns (0) |
| high_vulnerabilities | int | Max high vulns |
| lint_errors | int | Max lint errors (0) |
| type_errors | int | Max type errors (0) |

---

## Custom Rules

```yaml
custom_rules:
  - name: no_console_log
    pattern: "console\\.log"
    file_glob: "**/*.ts"
    exclude: ["**/*.test.ts"]
    severity: warning
    message: "Remove console.log from production"
```

---

## Policy Location

Store at: `.claude/policies/verification-policy.yaml`

Multiple policies: `.claude/policies/{name}-policy.yaml`
