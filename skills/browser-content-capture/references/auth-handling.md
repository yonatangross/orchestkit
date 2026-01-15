# Authentication Handling

Patterns for accessing login-protected content using browser automation.

## Table of Contents

1. [Authentication Methods](#authentication-methods)
2. [Form-Based Login](#form-based-login)
3. [OAuth/SSO Flows](#oauthsso-flows)
4. [Session Management](#session-management)
5. [Security Considerations](#security-considerations)

---

## Authentication Methods

### Method Comparison

| Method | Use Case | Complexity | User Involvement |
|--------|----------|------------|------------------|
| Form login | Username/password sites | Low | Credentials needed |
| OAuth popup | Google/GitHub login | Medium | User must complete |
| SSO redirect | Enterprise sites | High | User must complete |
| Cookie injection | Reuse existing session | Low | Pre-export cookies |
| Chrome extension | User's live session | None | Already logged in |

### Decision Tree

```
Protected content needed
         │
         ▼
    User has active session in Chrome?
         │
    ├─ Yes ──► Use Claude Chrome Extension
    │          (inherits user's cookies)
    │
    └─ No ──► Check login type
                   │
         ├─ Simple form ──► browser_fill_form
         ├─ OAuth popup ──► Pause for user
         └─ SSO ──► Pause for user
```

---

## Form-Based Login

### Basic Login Flow

```python
# 1. Navigate to login page
mcp__playwright__browser_navigate(url="https://app.example.com/login")

# 2. Wait for form to load
mcp__playwright__browser_wait_for(selector="form")

# 3. Fill credentials
mcp__playwright__browser_fill_form(
    selector="form",
    values={
        "email": "user@example.com",
        "password": "your-password"
    }
)

# 4. Submit form
mcp__playwright__browser_click(selector="button[type='submit']")

# 5. Wait for redirect to dashboard
mcp__playwright__browser_wait_for(selector=".dashboard", timeout=10000)

# 6. Now navigate to protected content
mcp__playwright__browser_navigate(url="https://app.example.com/private-docs")
```

### Handle Different Form Structures

```python
# Separate submit button
mcp__playwright__browser_type(selector="#username", text="user@example.com")
mcp__playwright__browser_type(selector="#password", text="password")
mcp__playwright__browser_click(selector="#login-button")

# Form with CSRF token (handled automatically by browser)
mcp__playwright__browser_fill_form(
    selector="form[action='/login']",
    values={"username": "user", "password": "pass"}
)

# Multi-step login (email first, then password)
mcp__playwright__browser_type(selector="#email", text="user@example.com")
mcp__playwright__browser_click(selector="#next-button")
mcp__playwright__browser_wait_for(selector="#password")
mcp__playwright__browser_type(selector="#password", text="password")
mcp__playwright__browser_click(selector="#login-button")
```

### Handle Login Errors

```python
# Check for error messages after login attempt
error = mcp__playwright__browser_evaluate(script="""
    const error = document.querySelector('.error-message, .alert-error, [role="alert"]');
    return error ? error.innerText : null;
""")

if error:
    print(f"Login failed: {error}")
    # Handle error - maybe wrong credentials
```

---

## OAuth/SSO Flows

### Google OAuth

```python
# 1. Click "Sign in with Google"
mcp__playwright__browser_click(selector="[data-provider='google']")

# 2. PAUSE - User must complete OAuth flow in popup
# This cannot be automated due to security measures
print("Please complete Google sign-in in the browser popup...")

# 3. Wait for redirect back to app
mcp__playwright__browser_wait_for(selector=".dashboard", timeout=60000)

# 4. Continue with protected content
mcp__playwright__browser_navigate(url="https://app.example.com/docs")
```

### GitHub OAuth

```python
# Similar pattern - click OAuth button, pause for user
mcp__playwright__browser_click(selector=".github-login")
print("Please complete GitHub sign-in...")
mcp__playwright__browser_wait_for(selector=".logged-in", timeout=60000)
```

### Enterprise SSO (SAML/OIDC)

```python
# SSO typically redirects to identity provider
mcp__playwright__browser_click(selector=".sso-login")

# User completes SSO at identity provider
print("Please complete SSO authentication...")

# Wait for redirect back
mcp__playwright__browser_wait_for(
    selector=".authenticated",
    timeout=120000  # SSO can be slow
)
```

---

## Session Management

### Check Login State

```python
# Verify if already logged in
is_logged_in = mcp__playwright__browser_evaluate(script="""
    // Check for common logged-in indicators
    const hasLogout = document.querySelector('[href*="logout"], .logout-button');
    const hasProfile = document.querySelector('.user-avatar, .profile-menu');
    const hasDashboard = document.querySelector('.dashboard, [data-authenticated]');
    return !!(hasLogout || hasProfile || hasDashboard);
""")

if is_logged_in:
    print("Already logged in, proceeding to content...")
else:
    print("Need to authenticate first...")
```

### Persist Session Across Captures

When doing multiple captures, maintain login state:

```python
# Session persists within browser instance
# Navigate to different protected pages without re-login

pages = [
    "https://app.example.com/docs/intro",
    "https://app.example.com/docs/guide",
    "https://app.example.com/docs/api"
]

for page_url in pages:
    mcp__playwright__browser_navigate(url=page_url)
    mcp__playwright__browser_wait_for(selector=".content")
    content = mcp__playwright__browser_evaluate(
        script="document.querySelector('.content').innerText"
    )
    # Process content...
```

### Handle Session Expiry

```python
# Check if session expired (redirected to login)
current_url = mcp__playwright__browser_evaluate(script="window.location.href")

if "/login" in current_url or "/signin" in current_url:
    print("Session expired, need to re-authenticate")
    # Trigger login flow again
```

---

## Security Considerations

### Never Store Credentials in Code

```python
# BAD - Don't do this
password = "hardcoded-password"

# GOOD - Prompt user or use environment
import os
password = os.environ.get("APP_PASSWORD")
# Or use AskUserQuestion tool to prompt
```

### Use Claude Chrome Extension for Sensitive Sites

For sites with:
- 2FA/MFA requirements
- CAPTCHA challenges
- Device verification
- Biometric authentication

**Use the Chrome extension instead** - it inherits the user's existing authenticated session.

```python
# Start Claude Code with Chrome integration
# claude --chrome

# Then simply navigate - user's cookies are available
mcp__playwright__browser_navigate(url="https://app.example.com/private")
```

### Handle Password Managers

Some sites detect automation and block password managers:

```python
# Type slowly to avoid detection
mcp__playwright__browser_evaluate(script="""
    const input = document.querySelector('#password');
    const password = 'user-provided-password';
    for (const char of password) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
    }
""")
```

### Respect Terms of Service

- Only access content you're authorized to access
- Don't bypass paywalls or access restrictions
- Don't scrape at rates that could harm the service
- Store credentials securely (environment variables, not code)

---

## Common Sites

### GitHub Private Repos

```python
# Use GitHub OAuth or Chrome extension with logged-in session
mcp__playwright__browser_navigate(url="https://github.com/org/private-repo")
mcp__playwright__browser_wait_for(selector=".repository-content")
```

### Confluence/Jira

```python
# Usually requires SSO
mcp__playwright__browser_navigate(url="https://company.atlassian.net/wiki/...")
# User completes SSO...
mcp__playwright__browser_wait_for(selector=".wiki-content")
```

### Notion

```python
# Notion uses custom auth
mcp__playwright__browser_navigate(url="https://notion.so/workspace/...")
# Use Chrome extension for authenticated access
```
