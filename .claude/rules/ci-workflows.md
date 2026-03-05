---
paths:
  - ".github/**"
---

# CI/CD Workflow Rules

## Structure
- Workflows in `.github/workflows/*.yml`
- Custom actions in `.github/actions/`
- Use minimal `permissions:` scope (principle of least privilege)

## Security
- Never echo secrets or use `set -x` in steps with secret access
- Pin action versions to SHA, not tags (supply chain safety)
- Use `GITHUB_TOKEN` scoped permissions, not PATs

## Patterns
- Cache dependencies (node_modules, pip) for speed
- Fail fast on security tests before running full suite
- Use matrix builds for cross-platform testing
