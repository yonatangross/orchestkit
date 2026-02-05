# Authentication Handling

Patterns for accessing login-protected content using agent-browser.

## Authentication Methods

### Method Comparison

| Method | Use Case | Complexity | User Involvement |
|--------|----------|------------|------------------|
| Form login | Username/password sites | Low | Credentials needed |
| OAuth popup | Google/GitHub login | Medium | User must complete |
| SSO redirect | Enterprise sites | High | User must complete |
| State restore | Reuse existing session | Low | Pre-export state |

### Decision Tree

```
Protected content needed
         │
         ▼
    Have saved state?
         │
    ├─ Yes ──► Load state: agent-browser state load auth.json
    │
    └─ No ──► Check login type
                   │
         ├─ Simple form ──► Fill form with refs
         ├─ OAuth popup ──► Pause for user (--headed)
         └─ SSO ──► Pause for user (--headed)
```

---

## Form-Based Login

### Basic Login Flow

```bash
# 1. Navigate to login page
agent-browser open https://app.example.com/login

# 2. Wait for form to load
agent-browser wait --load networkidle

# 3. Get form structure
agent-browser snapshot -i
# Output shows: @e1 [input] "Email", @e2 [input] "Password", @e3 [button] "Sign In"

# 4. Fill credentials
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"

# 5. Submit form
agent-browser click @e3

# 6. Wait for redirect to dashboard
agent-browser wait --url "**/dashboard"

# 7. Save state for reuse
agent-browser state save /tmp/auth-state.json

# 8. Now navigate to protected content
agent-browser open https://app.example.com/private-docs
```

### Multi-Step Login (Email then Password)

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i

# Step 1: Email
agent-browser fill @e1 "$EMAIL"
agent-browser click @e2  # Next button

# Step 2: Password
agent-browser wait --fn "document.querySelector('[type=password]') !== null"
agent-browser snapshot -i
agent-browser fill @e1 "$PASSWORD"
agent-browser click @e2  # Sign in button

agent-browser wait --url "**/dashboard"
```

### Handle Login Errors

```bash
# Check for error messages after login attempt
ERROR=$(agent-browser eval "
const err = document.querySelector('.error-message, .alert-error, [role=\"alert\"]');
err ? err.innerText : '';
")

if [[ -n "$ERROR" ]]; then
    echo "Login failed: $ERROR"
fi
```

---

## OAuth/SSO Flows

For OAuth (Google, GitHub) and SSO, use headed mode for user interaction:

```bash
# 1. Start in headed mode
AGENT_BROWSER_HEADED=1 agent-browser open https://app.example.com/login

# 2. Click OAuth button
agent-browser snapshot -i
agent-browser click @e4  # "Sign in with Google"

# 3. PAUSE - User must complete OAuth flow
echo "Please complete sign-in in the browser window..."

# 4. Wait for redirect back to app
agent-browser wait --url "**/dashboard" --timeout 120000

# 5. Save state for future sessions
agent-browser state save /tmp/oauth-state.json
```

---

## Session Management

### Save and Restore State

```bash
# SAVE: After successful login
agent-browser state save /tmp/auth-state.json

# RESTORE: In new session
agent-browser state load /tmp/auth-state.json
agent-browser open https://app.example.com/dashboard
```

### Check Login State

```bash
# Verify if already logged in
IS_LOGGED_IN=$(agent-browser eval "
const hasLogout = document.querySelector('[href*=\"logout\"], .logout-button');
const hasProfile = document.querySelector('.user-avatar, .profile-menu');
!!(hasLogout || hasProfile);
")

if [[ "$IS_LOGGED_IN" == "true" ]]; then
    echo "Already logged in"
else
    echo "Need to authenticate"
fi
```

### Handle Session Expiry

```bash
# Check if redirected to login
CURRENT_URL=$(agent-browser get url)

if [[ "$CURRENT_URL" == *"/login"* ]]; then
    echo "Session expired, re-authenticating..."
    rm -f /tmp/auth-state.json
    # Trigger login flow again
fi
```

---

## Persist Across Captures

When doing multiple captures, maintain login state:

```bash
# Login once
agent-browser open https://app.example.com/login
# ... fill credentials ...
agent-browser state save /tmp/auth.json

# Capture multiple pages (session persists)
PAGES=(
    "https://app.example.com/docs/intro"
    "https://app.example.com/docs/guide"
    "https://app.example.com/docs/api"
)

for page_url in "${PAGES[@]}"; do
    agent-browser open "$page_url"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename $page_url).txt"
done
```

---

## Security Considerations

### Never Store Credentials in Code

```bash
# BAD - Don't do this
PASSWORD="hardcoded-password"

# GOOD - Use environment variables
agent-browser fill @e2 "$APP_PASSWORD"
```

### Secure State Files

```bash
# Set restrictive permissions
chmod 600 /tmp/auth-state.json

# Store in secure location
STATE_FILE="$HOME/.config/agent-browser/auth-state.json"
mkdir -p "$(dirname "$STATE_FILE")"

# Clean up after use
trap 'rm -f "$STATE_FILE"' EXIT
```

### Handle Sensitive Sites with Headed Mode

For sites with:
- 2FA/MFA requirements
- CAPTCHA challenges
- Device verification

Use headed mode for manual completion:

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://secure-site.com/login
echo "Please complete authentication manually..."
agent-browser wait --url "**/authenticated"
agent-browser state save /tmp/secure-auth.json
```

---

## Common Sites

### GitHub Private Repos

```bash
# Use state from previous GitHub login
agent-browser state load /tmp/github-auth.json
agent-browser open https://github.com/org/private-repo
agent-browser wait --load networkidle
```

### Confluence/Jira (SSO)

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://company.atlassian.net
echo "Complete SSO authentication..."
agent-browser wait --url "**/wiki" --timeout 120000
agent-browser state save /tmp/atlassian-auth.json
```

### Notion

```bash
AGENT_BROWSER_HEADED=1 agent-browser open https://notion.so
echo "Complete Notion login..."
agent-browser wait --url "**/workspace"
agent-browser state save /tmp/notion-auth.json
```
