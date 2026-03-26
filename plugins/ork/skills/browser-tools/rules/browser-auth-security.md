---
title: Secure browser automation credentials to prevent token leaks and account compromise
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

```bash
# Cookie-based session setup (v0.13) — faster than login flows
agent-browser cookies set session_id "$SESSION_TOKEN" \
  --url https://app.example.com \
  --httpOnly --secure
agent-browser open https://app.example.com/dashboard
agent-browser wait --load networkidle

# Verify cookie-based auth worked
CURRENT_URL=$(agent-browser get url)
[[ "$CURRENT_URL" == *"/dashboard"* ]] && echo "Cookie auth successful"
```

```bash
# Token management via storage
agent-browser storage local "authToken"              # Read current token
agent-browser storage local set "authToken" "$TOKEN" # Inject token
agent-browser storage session                        # Check session data
agent-browser storage local clear                    # Cleanup after test
```

```bash
# Cookie management and debugging
agent-browser cookies                    # Read all cookies (debug auth issues)
agent-browser cookies clear              # Clear all cookies (force re-auth)
```

```bash
# Human-in-the-loop for admin actions
agent-browser --confirm-interactive open https://admin.example.com
# Terminal will prompt for confirmation on each action
```

**Key rules:**
- Never hardcode passwords, API keys, or tokens in scripts -- always use environment variables
- Never log, echo, or print auth tokens, cookies, or session data to stdout/stderr
- Set `chmod 600` on all saved state files immediately after creation
- Store state files in a secure directory (`$HOME/.config/`) rather than world-readable `/tmp/`
- Use `trap 'rm -f "$STATE_FILE"' EXIT` to clean up auth artifacts when the script exits
- Use headed mode (`AGENT_BROWSER_HEADED=1`) for 2FA/MFA flows that require manual interaction
- Use `cookies set` with `--httpOnly --secure` flags for cookie-based session injection — faster than replaying login flows
- Always use `--session-name` (not `--session`) for named session persistence
- Use `cookies` to debug auth failures before re-logging in
- Use `storage local clear` and `cookies clear` in cleanup scripts to force fresh authentication
- Use `--confirm-interactive` for admin panel automation to require manual confirmation on actions
- Use `vault store`/`vault load` (v0.15) for encrypted credential persistence — requires `AGENT_BROWSER_ENCRYPTION_KEY`
- Never echo, log, or pipe `AGENT_BROWSER_ENCRYPTION_KEY` — treat it like a password
- Use `--confirm-actions` (v0.15) for native CLI-level action gating on sensitive operations
- Prefer `vault` over `state save` for auth data — vault encrypts at rest, state files are plaintext JSON
- **v0.17 breaking**: auth encryption format changed — saved auth states from v0.16.x native mode may not load; re-authenticate and re-save
- **v0.18+**: `KERNEL_API_KEY` is now optional (was required) — remove if not using external credential injection
- **v0.21+**: HAR captures contain auth tokens — never commit `.har` files, add to `.gitignore`
- **v0.17+**: auth cookies now persist on browser close — clear cookies explicitly if you need a fresh session

Reference: `references/auth-flows.md` (Security Considerations, Secure State Files)
