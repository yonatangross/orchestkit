---
name: auth-patterns
description: Authentication and authorization patterns. Use when implementing login flows, JWT tokens, session management, password security, OAuth 2.1, Passkeys/WebAuthn, or role-based access control.
context: fork
agent: security-auditor
version: 2.0.0
tags: [security, authentication, oauth, passkeys, 2026]
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - Bash
author: OrchestKit
user-invocable: false
---

# Authentication Patterns

Implement secure authentication with OAuth 2.1, Passkeys, and modern security standards.

## Overview

- Login/signup flows
- JWT token management
- Session security
- OAuth 2.1 with PKCE
- Passkeys/WebAuthn
- Multi-factor authentication
- Role-based access control

## Quick Reference

### Password Hashing (Argon2id)

```python
from argon2 import PasswordHasher
ph = PasswordHasher()
password_hash = ph.hash(password)
ph.verify(password_hash, password)
```

### JWT Access Token

```python
import jwt
from datetime import datetime, timedelta, timezone
payload = {
    'user_id': user_id,
    'type': 'access',
    'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
}
token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
```

### OAuth 2.1 with PKCE (Required)

```python
import hashlib, base64, secrets
code_verifier = secrets.token_urlsafe(64)
digest = hashlib.sha256(code_verifier.encode()).digest()
code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
```

### Session Security

```python
app.config['SESSION_COOKIE_SECURE'] = True      # HTTPS only
app.config['SESSION_COOKIE_HTTPONLY'] = True    # No JS access
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
```

## Token Expiry (2026 Guidelines)

| Token Type | Expiry | Storage |
|------------|--------|---------|
| Access | 15 min - 1 hour | Memory only |
| Refresh | 7-30 days | HTTPOnly cookie |

## Anti-Patterns (FORBIDDEN)

```python
# ❌ NEVER store passwords in plaintext
user.password = request.form['password']

# ❌ NEVER use implicit OAuth grant
response_type=token  # Deprecated in OAuth 2.1

# ❌ NEVER skip rate limiting on login
@app.route('/login')  # No rate limit!

# ❌ NEVER reveal if email exists
return "Email not found"  # Information disclosure

# ✅ ALWAYS use Argon2id or bcrypt
password_hash = ph.hash(password)

# ✅ ALWAYS use PKCE
code_challenge=challenge&code_challenge_method=S256

# ✅ ALWAYS rate limit auth endpoints
@limiter.limit("5 per minute")

# ✅ ALWAYS use generic error messages
return "Invalid credentials"
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Password hash | **Argon2id** > bcrypt |
| Access token expiry | 15 min - 1 hour |
| Refresh token expiry | 7-30 days with rotation |
| Session cookie | HTTPOnly, Secure, SameSite=Strict |
| Rate limit | 5 attempts per minute |
| MFA | Passkeys > TOTP > SMS |
| OAuth | 2.1 with PKCE (no implicit) |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/oauth-2.1-passkeys.md](references/oauth-2.1-passkeys.md) | OAuth 2.1, PKCE, Passkeys/WebAuthn |
| [examples/auth-implementations.md](examples/auth-implementations.md) | Complete implementation examples |
| [checklists/auth-checklist.md](checklists/auth-checklist.md) | Security checklist |
| [scripts/auth-middleware-template.py](scripts/auth-middleware-template.py) | Flask/FastAPI middleware |

## Related Skills

- `owasp-top-10` - Security fundamentals
- `input-validation` - Data validation
- `api-design-framework` - API security

## Capability Details

### password-hashing
**Keywords:** password, hashing, bcrypt, argon2, hash
**Solves:**
- Securely hash passwords with modern algorithms
- Configure appropriate cost factors
- Migrate legacy password hashes

### jwt-tokens
**Keywords:** JWT, token, access token, claims, jsonwebtoken
**Solves:**
- Generate and validate JWT access tokens
- Implement proper token expiration
- Handle token refresh securely

### oauth2-pkce
**Keywords:** OAuth, PKCE, OAuth 2.1, authorization code, code verifier
**Solves:**
- Implement OAuth 2.1 with PKCE flow
- Secure authorization for SPAs and mobile apps
- Handle OAuth provider integration

### passkeys-webauthn
**Keywords:** passkey, WebAuthn, FIDO2, passwordless, biometric
**Solves:**
- Implement passwordless authentication
- Configure WebAuthn registration and login
- Support cross-device passkeys

### session-management
**Keywords:** session, cookie, session storage, logout, invalidate
**Solves:**
- Manage user sessions securely
- Implement session invalidation on logout
- Handle concurrent sessions

### role-based-access
**Keywords:** RBAC, role, permission, authorization, access control
**Solves:**
- Implement role-based access control
- Define permission hierarchies
- Check authorization in routes
