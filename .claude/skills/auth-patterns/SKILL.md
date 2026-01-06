---
name: auth-patterns
description: Authentication and authorization patterns. Use when implementing login flows, JWT tokens, session management, password security, OAuth 2.1, Passkeys/WebAuthn, or role-based access control.
version: 2.0.0
tags: [security, authentication, oauth, passkeys, 2026]
---

# Authentication Patterns

Implement secure authentication with OAuth 2.1, Passkeys, and modern security standards.

## When to Use

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
payload = {
    'user_id': user_id,
    'type': 'access',
    'exp': datetime.utcnow() + timedelta(minutes=15),
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
| [templates/auth-middleware-template.py](templates/auth-middleware-template.py) | Flask/FastAPI middleware |

## Related Skills

- `owasp-top-10` - Security fundamentals
- `input-validation` - Data validation
- `api-design-framework` - API security
