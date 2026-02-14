---
title: "Browser: Auth Security"
category: browser
impact: CRITICAL
impactDescription: "Hardcoded credentials, logged tokens, or insecure state files lead to credential leaks and account compromise"
tags: [auth, security, credentials, sessions]
---

## Browser: Auth Security

Never hardcode credentials or log auth tokens. Use environment variables for secrets, store session state files with restrictive permissions, and clean up auth artifacts after use.

**Incorrect:**
```bash
# Hardcoding credentials in scripts
PASSWORD="hardcoded-password"
agent-browser fill @e2 "$PASSWORD"

# Logging auth tokens or session data to stdout
agent-browser eval "document.cookie"
echo "Session token: $(agent-browser eval 'localStorage.getItem(\"token\")')"

# Storing auth state with default (world-readable) permissions
agent-browser state save /tmp/auth-state.json
# File is now readable by any user on the system

# No cleanup — state file persists indefinitely
```

**Correct:**
```bash
# Use environment variables for all credentials
agent-browser open https://app.example.com/login
agent-browser wait --load networkidle
agent-browser snapshot -i

# Fill credentials from env vars (never hardcoded)
agent-browser fill @e1 "$APP_EMAIL"
agent-browser fill @e2 "$APP_PASSWORD"
agent-browser click @e3

agent-browser wait --url "**/dashboard"
```

```bash
# Store state files securely with restrictive permissions
STATE_FILE="$HOME/.config/agent-browser/auth-state.json"
mkdir -p "$(dirname "$STATE_FILE")"

agent-browser state save "$STATE_FILE"
chmod 600 "$STATE_FILE"  # Owner read/write only

# Clean up state files when done
trap 'rm -f "$STATE_FILE"' EXIT
```

```bash
# For 2FA/MFA, use headed mode; handle session expiry gracefully
AGENT_BROWSER_HEADED=1 agent-browser open https://secure-site.com/login
echo "Please complete authentication manually..."
agent-browser wait --url "**/authenticated"
agent-browser state save "$STATE_FILE"
chmod 600 "$STATE_FILE"

# Detect expired sessions and re-authenticate
CURRENT_URL=$(agent-browser get url)
[[ "$CURRENT_URL" == *"/login"* ]] && rm -f "$STATE_FILE"  # Re-trigger login
```

**Key rules:**
- Never hardcode passwords, API keys, or tokens in scripts -- always use environment variables
- Never log, echo, or print auth tokens, cookies, or session data to stdout/stderr
- Set `chmod 600` on all saved state files immediately after creation
- Store state files in a secure directory (`$HOME/.config/`) rather than world-readable `/tmp/`
- Use `trap 'rm -f "$STATE_FILE"' EXIT` to clean up auth artifacts when the script exits
- Use headed mode (`AGENT_BROWSER_HEADED=1`) for 2FA/MFA flows that require manual interaction

Reference: `references/auth-flows.md` (Security Considerations, Secure State Files)
