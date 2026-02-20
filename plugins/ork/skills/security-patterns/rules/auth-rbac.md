---
title: Enforce role-based access control with multi-factor authentication and rate limiting
category: auth
impact: CRITICAL
impactDescription: "Prevents unauthorized access through role-based permissions, multi-factor authentication, and rate limiting"
tags: rbac, mfa, totp, rate-limiting, permissions
---

# Role-Based Access Control & Multi-Factor Authentication

## Role-Based Access Control

```python
from functools import wraps
from flask import abort, g

def require_role(*roles):
    """Decorator to require specific role(s)."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.current_user:
                abort(401)
            if not any(role in g.current_user.roles for role in roles):
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

def require_permission(permission: str):
    """Decorator to require specific permission."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not g.current_user:
                abort(401)
            if not g.current_user.has_permission(permission):
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.route('/admin/users')
@require_role('admin')
def admin_users():
    return get_all_users()

@app.route('/api/patients/<id>')
@require_permission('patients:read')
def get_patient(id):
    return get_patient_by_id(id)
```

## FastAPI RBAC

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = verify_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user

def require_role(*roles):
    async def role_checker(user = Depends(get_current_user)):
        if not any(role in user.roles for role in roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        return user
    return role_checker
```

## Multi-Factor Authentication (TOTP)

```python
import pyotp
import qrcode
from io import BytesIO
import base64

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def get_totp_provisioning_uri(secret: str, email: str, issuer: str = "MyApp") -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)

def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
```

## Complete Login Flow with MFA

```python
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    email = request.json.get('email')
    password = request.json.get('password')

    user = User.query.filter_by(email=email).first()

    # Don't reveal if user exists
    if not user or not verify_password(user.password_hash, password):
        return {"error": "Invalid credentials"}, 401

    if user.mfa_enabled:
        mfa_token = create_mfa_pending_token(user.id)
        return {"mfa_required": True, "mfa_token": mfa_token}

    return issue_tokens(user)
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Login | 5 per minute |
| Password reset | 3 per hour |
| MFA verify | 5 per minute |
| Registration | 10 per hour |
| API general | 100 per minute |

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(app, key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="redis://localhost:6379")

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    pass

@app.route('/api/auth/password-reset', methods=['POST'])
@limiter.limit("3 per hour")
def password_reset():
    return {"message": "If email exists, reset link sent"}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| MFA method | Passkeys > TOTP > SMS |
| Rate limit | 5 attempts per minute |
| Error messages | Generic "Invalid credentials" |
| Account lockout | After 10 failed attempts |
| Backup codes | 10 one-time use codes |

**Incorrect — Direct role checks in routes leak user enumeration information:**
```python
@app.route('/admin/users')
def admin_users():
    if 'admin' not in current_user.roles:
        return {"error": "You are not an admin"}, 403  # Reveals role info
    return get_all_users()
```

**Correct — Generic error messages and proper RBAC decorator prevent enumeration:**
```python
@app.route('/admin/users')
@require_role('admin')
def admin_users():
    return get_all_users()
# Returns 403 Forbidden with no role details exposed
```
