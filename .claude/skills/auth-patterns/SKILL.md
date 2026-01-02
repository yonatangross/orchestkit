---
name: auth-patterns
description: Authentication and authorization patterns. Use when implementing login flows, JWT tokens, session management, password security, or role-based access control.
---

# Authentication Patterns

Implement secure authentication and authorization.

## When to Use

- Login/signup flows
- JWT token management
- Session security
- Role-based access control

## Password Hashing

```python
from argon2 import PasswordHasher

ph = PasswordHasher()

# Hash password
password_hash = ph.hash(password)

# Verify password
try:
    ph.verify(password_hash, password)
    # Password correct
except:
    # Password incorrect
    pass
```

**Requirements:**
- Minimum 12 characters
- Mixed case + numbers + symbols
- Use bcrypt, argon2, or scrypt
- Check against common password lists

## Session Management

```python
# Secure session cookies
app.config['SESSION_COOKIE_SECURE'] = True      # HTTPS only
app.config['SESSION_COOKIE_HTTPONLY'] = True    # No JS access
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
```

## JWT Tokens (Access Token)

```python
import jwt
from datetime import datetime, timedelta

def create_access_token(user_id: str) -> str:
    """Short-lived access token (15 min - 1 hour)."""
    payload = {
        'user_id': user_id,
        'type': 'access',
        'exp': datetime.utcnow() + timedelta(minutes=15),  # Short-lived
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

## Refresh Token Rotation (2026 Best Practice)

```python
import secrets
from datetime import datetime, timedelta

def create_refresh_token(user_id: str, db) -> str:
    """Long-lived refresh token with rotation."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Store hashed token in DB (never store plain tokens)
    db.execute("""
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, version)
        VALUES (?, ?, ?, ?)
    """, [user_id, token_hash, datetime.utcnow() + timedelta(days=7), 1])

    return token

def rotate_refresh_token(old_token: str, db) -> tuple[str, str]:
    """Rotate refresh token on use (security best practice).

    Returns: (new_access_token, new_refresh_token)
    """
    old_hash = hashlib.sha256(old_token.encode()).hexdigest()

    # Find and invalidate old token
    row = db.execute("""
        SELECT user_id, version FROM refresh_tokens
        WHERE token_hash = ? AND expires_at > NOW() AND revoked = FALSE
    """, [old_hash]).fetchone()

    if not row:
        raise InvalidTokenError("Refresh token invalid or expired")

    user_id, version = row

    # Revoke old token
    db.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?", [old_hash])

    # Create new tokens (rotation)
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id, db)

    return new_access, new_refresh

# API endpoint for token refresh
@app.route('/auth/refresh', methods=['POST'])
def refresh_tokens():
    refresh_token = request.json.get('refresh_token')
    try:
        access, refresh = rotate_refresh_token(refresh_token, db)
        return {"access_token": access, "refresh_token": refresh}
    except InvalidTokenError:
        abort(401)
```

**Token Expiry Guidelines (2026):**
| Token Type | Expiry | Storage |
|------------|--------|---------|
| Access | 15 min - 1 hour | Memory only (no persistence) |
| Refresh | 7-30 days | HTTPOnly cookie or secure storage |

## Rate Limiting

```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")  # 5 attempts per minute
def login():
    # Login logic
    pass
```

## Role-Based Access Control

```python
from functools import wraps

def require_role(role):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if current_user.role != role:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route('/admin/users')
@login_required
@require_role('admin')
def admin_users():
    return get_all_users()
```

## Multi-Factor Authentication

```python
import pyotp

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Password hash | **Argon2id** (preferred) > Argon2 > bcrypt (legacy) |
| Access token expiry | 15 min - 1 hour |
| Refresh token expiry | 7-30 days with rotation |
| Session cookie | HTTPOnly, Secure, SameSite=Strict |
| Rate limit | 5 attempts per 15 min |
| JWT algorithm | HS256 (symmetric) or RS256 (asymmetric for microservices) |

## Common Mistakes

- Storing passwords in plaintext
- No rate limiting on login
- Long-lived tokens
- Revealing if email exists
- No MFA option

## Related Skills

- `owasp-top-10` - Security fundamentals
- `input-validation` - Data validation
- `api-design-framework` - API security
