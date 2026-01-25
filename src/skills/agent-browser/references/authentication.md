# Authentication Flows

Patterns for handling login, OAuth, MFA, and authenticated sessions.

## Basic Login Flow

```bash
#!/bin/bash
# Standard username/password login

# Navigate to login page
agent-browser open https://app.example.com/login

# Get snapshot to find form elements
agent-browser snapshot -i

# Fill credentials (refs from snapshot)
agent-browser fill @e1 "user@example.com"    # Email field
agent-browser fill @e2 "password123"          # Password field

# Submit
agent-browser click @e3                        # Submit button

# Wait for redirect
agent-browser wait navigation

# Verify login success
agent-browser get url
# Should be: https://app.example.com/dashboard
```

## OAuth Flow

```bash
#!/bin/bash
# OAuth login (e.g., "Login with Google")

agent-browser open https://app.example.com/login
agent-browser snapshot -i

# Click OAuth button
agent-browser click @e4  # "Login with Google"

# Wait for OAuth popup/redirect
agent-browser wait navigation

# Now on Google's login page
agent-browser snapshot -i
agent-browser fill @e1 "user@gmail.com"
agent-browser click @e2  # Next
agent-browser wait 2000
agent-browser snapshot -i
agent-browser fill @e1 "password"
agent-browser click @e2  # Sign in

# Wait for redirect back to app
agent-browser wait navigation
```

## Save & Reuse Authentication

```bash
#!/bin/bash
# Save auth state for reuse across sessions

STATE_FILE="$HOME/.config/agent-browser/app-auth.json"

login_and_save() {
    agent-browser open https://app.example.com/login
    agent-browser snapshot -i
    agent-browser fill @e1 "$APP_USERNAME"
    agent-browser fill @e2 "$APP_PASSWORD"
    agent-browser click @e3
    agent-browser wait navigation

    # Save authenticated state
    agent-browser save "$STATE_FILE"
    echo "Auth state saved to $STATE_FILE"
}

use_saved_auth() {
    if [[ -f "$STATE_FILE" ]]; then
        agent-browser load "$STATE_FILE"
        agent-browser open https://app.example.com/dashboard
        return 0
    else
        return 1
    fi
}

# Main flow
if ! use_saved_auth; then
    login_and_save
fi
```

## MFA / 2FA Handling

### TOTP (Authenticator App)

```bash
#!/bin/bash
# Requires: oathtool for TOTP generation

TOTP_SECRET="YOUR_BASE32_SECRET"

# After password login, handle MFA
agent-browser snapshot -i
# Look for MFA input field

# Generate TOTP code
MFA_CODE=$(oathtool --totp -b "$TOTP_SECRET")

# Enter code
agent-browser fill @e1 "$MFA_CODE"
agent-browser click @e2  # Verify button

agent-browser wait navigation
```

### SMS/Email Code (Manual)

```bash
#!/bin/bash
# When automation can't access the code

agent-browser snapshot -i
echo "MFA code required. Enter the code sent to your device:"
read MFA_CODE

agent-browser fill @e1 "$MFA_CODE"
agent-browser click @e2
agent-browser wait navigation
```

## Session Token Extraction

```bash
#!/bin/bash
# Extract auth tokens for API use

# After login
agent-browser eval "localStorage.getItem('authToken')"
# Returns: "eyJhbGciOiJIUzI1NiIs..."

# Or from cookies
agent-browser eval "document.cookie"

# Or from specific storage
agent-browser eval "sessionStorage.getItem('jwt')"
```

## Logout

```bash
#!/bin/bash
# Proper logout

agent-browser open https://app.example.com/settings
agent-browser snapshot -i
agent-browser click @e5  # Logout button
agent-browser wait navigation

# Clear saved state
rm -f "$STATE_FILE"
```

## Security Best Practices

### 1. Never Hardcode Credentials

```bash
# WRONG
agent-browser fill @e1 "hardcoded@email.com"

# CORRECT - Use environment variables
agent-browser fill @e1 "$APP_USERNAME"
```

### 2. Secure State Files

```bash
# Set restrictive permissions
chmod 600 "$STATE_FILE"

# Store in secure location
STATE_FILE="$HOME/.config/agent-browser/auth-state.json"
mkdir -p "$(dirname "$STATE_FILE")"
```

### 3. Clean Up After Use

```bash
# Delete state files with sensitive data
trap 'rm -f "$STATE_FILE"' EXIT
```

### 4. Handle Token Expiry

```bash
# Check if session is still valid
agent-browser open https://app.example.com/api/me
agent-browser get text body

if [[ $(agent-browser get url) == *"/login"* ]]; then
    # Session expired, re-authenticate
    rm -f "$STATE_FILE"
    login_and_save
fi
```

## Captcha Handling

agent-browser cannot solve captchas automatically. Options:

1. **Use captcha-solving services** (external API)
2. **Use accounts without captcha** (trusted devices)
3. **Manual intervention** (pause for human input)

```bash
#!/bin/bash
# Pause for manual captcha solving

agent-browser snapshot -i
if agent-browser get text body | grep -q "captcha"; then
    echo "Captcha detected. Please solve manually in the browser."
    echo "Press Enter when done..."
    AGENT_BROWSER_HEADED=1 agent-browser open "$(agent-browser get url)"
    read
fi
```
