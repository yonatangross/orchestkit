---
title: Prevent JWT algorithm confusion, token sidejacking, CSRF, and session timing attacks
category: owasp
impact: CRITICAL
impactDescription: "Prevents JWT algorithm confusion, token sidejacking, CSRF, and timing attacks through secure authentication patterns"
tags: jwt-security, csrf, timing-attacks, session-security, owasp
---

# Authentication & Session Attacks

## JWT Algorithm Confusion

```python
# VULNERABLE: Algorithm read from token header
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, SECRET_KEY, algorithms=[header['alg']])
# Attacker can set alg="none" or use public key as HMAC secret

# SAFE: Hardcode expected algorithm
def verify_jwt(token: str) -> dict:
    payload = jwt.decode(
        token, SECRET_KEY,
        algorithms=['HS256'],  # NEVER read from header
        options={'require': ['exp', 'iat', 'iss', 'aud']},
    )

    if payload['iss'] != EXPECTED_ISSUER:
        raise jwt.InvalidIssuerError()
    if payload['aud'] != EXPECTED_AUDIENCE:
        raise jwt.InvalidAudienceError()

    return payload
```

## Token Sidejacking Protection (OWASP)

```python
def create_protected_token(user_id: str, response) -> str:
    """Token with fingerprint to prevent sidejacking."""
    fingerprint = secrets.token_urlsafe(32)

    payload = {
        'user_id': user_id,
        'fingerprint': hashlib.sha256(fingerprint.encode()).hexdigest(),
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
        'iat': datetime.now(timezone.utc),
        'iss': ISSUER,
        'aud': AUDIENCE,
    }

    # Send raw fingerprint as hardened cookie
    response.set_cookie(
        '__Secure-Fgp', fingerprint,
        httponly=True, secure=True,
        samesite='Strict', max_age=900,
    )

    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')
```

## CSRF Protection

```python
# VULNERABLE: No CSRF protection
@app.post("/transfer")
async def transfer_money(to_account: str = Form(...), amount: float = Form(...)):
    perform_transfer(to_account, amount)

# SAFE: CSRF token validation
def verify_csrf_token(request: Request, csrf_token: str = Form(...)):
    if request.session.get("csrf_token") != csrf_token:
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

@app.post("/transfer")
async def transfer_money(
    to_account: str = Form(...), amount: float = Form(...),
    _: None = Depends(verify_csrf_token),
):
    perform_transfer(to_account, amount)
```

```python
# Alternative: SameSite cookies
response.set_cookie(
    key="session_id", value=session_token,
    httponly=True, secure=True,
    samesite="strict",  # Key CSRF protection
)
```

## Timing Attack Prevention

```python
# VULNERABLE: Character-by-character comparison
def check_password(stored_hash: str, provided_hash: str) -> bool:
    for a, b in zip(stored_hash, provided_hash):
        if a != b:
            return False  # Early exit reveals info
    return True

# SAFE: Constant-time comparison
import hmac
def check_password_secure(stored_hash: str, provided_password: str) -> bool:
    provided_hash = hashlib.sha256(provided_password.encode()).hexdigest()
    return hmac.compare_digest(stored_hash, provided_hash)

# Better: Use a proper library
from argon2 import PasswordHasher
ph = PasswordHasher()
ph.verify(stored_hash, password)  # Handles timing safely
```

## Security Misconfiguration

```python
# VULNERABLE: Debug mode in production
app.debug = True

# SAFE: Environment-based config
app.debug = os.getenv('FLASK_ENV') == 'development'

# VULNERABLE: CORS allow all
CORS(app, origins="*", allow_credentials=True)

# SAFE: Explicit origins
CORS(app, origins=["https://app.example.com"], allow_credentials=True)
```

## Vulnerable Components

```bash
# Scan for vulnerabilities
npm audit
pip-audit

# Fix vulnerabilities
npm audit fix
```

## JWT Security Checklist

- [ ] Hardcode algorithm (never read from header)
- [ ] Validate: exp, iat, iss, aud claims
- [ ] Short expiry (15 min - 1 hour)
- [ ] Use refresh token rotation for longer sessions
- [ ] Implement token denylist for logout/revocation

## Detection

```bash
# JWT algorithm confusion
grep -rn "get_unverified_header\|algorithms=\[" --include="*.py" .

# Missing SameSite cookies
grep -rn "set_cookie\|setCookie" --include="*.py" . | grep -v "samesite"

# CSRF exempt decorators
grep -rn "@csrf_exempt" --include="*.py" .

# Timing attack vulnerable comparisons
semgrep --config "p/python-security-audit" .
```

**Incorrect — reading JWT algorithm from untrusted token header:**
```python
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, SECRET_KEY, algorithms=[header['alg']])
```

**Correct — hardcoding expected algorithm with claim validation:**
```python
payload = jwt.decode(
    token, SECRET_KEY,
    algorithms=['HS256'],
    options={'require': ['exp', 'iat', 'iss', 'aud']},
)
```

## Summary

| Vulnerability | Bandit ID | Fix |
|---------------|-----------|-----|
| SQL Injection | B608 | Parameterized queries |
| JWT Algorithm | B105 | Hardcode algorithm |
| Timing Attack | B303 | hmac.compare_digest |
| XSS | N/A | textContent, escape() |
| CSRF | N/A | SameSite cookies, tokens |
