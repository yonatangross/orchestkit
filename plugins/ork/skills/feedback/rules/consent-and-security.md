---
title: Consent Management and Security Rules
impact: HIGH
impactDescription: "Enforces GDPR consent requirements and blocks dangerous commands from auto-approval"
tags: consent, security, gdpr, privacy
---

# Consent Management and Security Rules

## Consent Management

Consent is managed per GDPR requirements:

1. **Explicit opt-in required** - No data shared until you actively consent
2. **Audit trail** - All consent actions logged in `consent-log.json`
3. **Easy revocation** - Opt-out is as easy as opt-in
4. **Version tracking** - Consent version tracked for policy changes

## Security Note

The following commands are NEVER auto-approved regardless of learning:
- `rm -rf`, `sudo`, `chmod 777`
- Commands with `--force` or `--no-verify`
- Commands involving passwords, secrets, or credentials

## Analytics Data Sharing

Anonymous analytics include only aggregated, non-identifiable data:

| Data Type | What's Included | What's NOT Included |
|-----------|-----------------|---------------------|
| Skills | Usage counts, success rates | File paths, code content |
| Agents | Spawn counts, success rates | Project names, decisions |
| Hooks | Trigger/block counts | Command content, paths |

The following are **blocked by design** and never included in analytics:

- Project names, paths, or directory structure
- File contents, code, or diffs
- Decision content or context
- User identity, email, or credentials
- Memory data
- URLs, IP addresses, or hostnames
- Any strings that could identify the project or user

**Incorrect — Auto-approving dangerous commands:**
```bash
# Pre-push hook auto-approves all commands
git push --force origin main  # DANGEROUS
rm -rf /important/directory    # DESTRUCTIVE
```

**Correct — Blocking dangerous commands from auto-approval:**
```bash
# Security check in hook
if [[ "$cmd" =~ (rm -rf|sudo|chmod 777|--force|--no-verify) ]]; then
  echo "BLOCKED: Command requires manual approval"
  exit 1
fi
```
