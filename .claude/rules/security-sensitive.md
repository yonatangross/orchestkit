---
paths:
  - "src/hooks/**"
  - "bin/git-hooks/**"
  - ".github/workflows/**"
  - ".gitleaks.toml"
---

# Security-Sensitive File Rules

## Hook Input Validation
- Hook inputs are **untrusted** — validate before parsing or acting on them
- Sanitize `tool_input` fields (especially Bash command strings) before logging
- No `eval()`, no dynamic `require()`, no string interpolation into shell commands

## Secrets
- Never include secrets in hook output, `additionalContext`, or log messages
- HMAC-verify webhook payloads before processing external data
- `npm run test:security` MUST pass before committing any file matching these paths
