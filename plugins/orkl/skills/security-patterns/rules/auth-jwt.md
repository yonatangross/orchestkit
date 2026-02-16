---
title: "Auth: JWT Tokens & Password Hashing"
category: auth
impact: CRITICAL
impactDescription: "Prevents credential theft through secure Argon2id password hashing and time-limited JWT tokens with rotation"
tags: jwt, password-hashing, argon2, tokens, refresh-tokens
---

# JWT Tokens & Password Hashing

## Password Hashing (Argon2id)

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=3,        # Number of iterations
    memory_cost=65536,  # 64 MB
    parallelism=4,      # Number of threads
)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password_hash: str, password: str) -> bool:
    try:
        ph.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False

def needs_rehash(password_hash: str) -> bool:
    return ph.check_needs_rehash(password_hash)
```

## JWT Access Token

```python
import os
import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

def create_access_token(user_id: str, roles: list[str] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "roles": roles or [],
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, SECRET_KEY,
            algorithms=[ALGORITHM],  # NEVER read from header
            options={'require': ['exp', 'iat', 'sub']},
        )
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

## Token Expiry Guidelines

| Token Type | Expiry | Storage |
|------------|--------|---------|
| Access | 15 min - 1 hour | Memory only |
| Refresh | 7-30 days | HTTPOnly cookie |

## Refresh Token Rotation

```python
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

def rotate_refresh_token(old_token: str, db) -> tuple[str, str]:
    old_hash = hashlib.sha256(old_token.encode()).hexdigest()

    token_record = db.query("""
        SELECT user_id, version FROM refresh_tokens
        WHERE token_hash = ? AND expires_at > NOW() AND revoked = FALSE
    """, [old_hash]).fetchone()

    if not token_record:
        raise InvalidTokenError("Refresh token invalid or expired")

    user_id, version = token_record

    # Revoke old token
    db.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?", [old_hash])

    # Create new tokens
    new_access_token = create_access_token(user_id)
    new_refresh_token = secrets.token_urlsafe(32)
    new_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()

    db.execute("""
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, version)
        VALUES (?, ?, ?, ?)
    """, [user_id, new_hash, datetime.now(timezone.utc) + timedelta(days=7), version + 1])

    return new_access_token, new_refresh_token
```

## Session Security

```python
app.config['SESSION_COOKIE_SECURE'] = True      # HTTPS only
app.config['SESSION_COOKIE_HTTPONLY'] = True    # No JS access
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
```

## Anti-Patterns

```python
# NEVER store passwords in plaintext
user.password = request.form['password']

# NEVER trust algorithm from JWT header
payload = jwt.decode(token, SECRET, algorithms=jwt.get_unverified_header(token)['alg'])

# NEVER reveal if email exists
return "Email not found"  # Information disclosure

# ALWAYS use Argon2id or bcrypt
password_hash = ph.hash(password)

# ALWAYS hardcode algorithm
payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])

# ALWAYS use generic error messages
return "Invalid credentials"
```

**Incorrect — Algorithm confusion vulnerability allows "none" algorithm attack:**
```python
# Reading algorithm from untrusted JWT header
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, SECRET_KEY, algorithms=[header['alg']])
# Attacker can set alg="none" to bypass signature verification
```

**Correct — Hardcode expected algorithm to prevent confusion attacks:**
```python
# Always specify the expected algorithm explicitly
payload = jwt.decode(
    token, SECRET_KEY,
    algorithms=['HS256'],  # Never read from header
    options={'require': ['exp', 'iat', 'sub']},
)
```
