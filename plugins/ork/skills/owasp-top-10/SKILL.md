---
name: owasp-top-10
description: OWASP Top 10 security vulnerabilities and mitigations. Use when conducting security audits, implementing security controls, or reviewing code for common vulnerabilities.
tags: [security, owasp, vulnerabilities, audit]
context: fork
agent: security-auditor
allowed-tools:
  - Read
  - Grep
  - Glob
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# OWASP Top 10

Protect against the most critical web security risks.

## 1. Broken Access Control

```python
# ❌ Bad: No authorization check
@app.route('/api/users/<user_id>')
def get_user(user_id):
    return db.query(f"SELECT * FROM users WHERE id = {user_id}")

# ✅ Good: Verify user can access resource
@app.route('/api/users/<user_id>')
@login_required
def get_user(user_id):
    if current_user.id != user_id and not current_user.is_admin:
        abort(403)
    return db.query("SELECT * FROM users WHERE id = ?", [user_id])
```

## 2. Cryptographic Failures

```python
# ❌ Bad: Weak hashing
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()

# ✅ Good: Strong hashing
from argon2 import PasswordHasher
ph = PasswordHasher()
password_hash = ph.hash(password)
```

## 3. Injection

```python
# ❌ Bad: SQL injection vulnerable
query = f"SELECT * FROM users WHERE email = '{email}'"

# ✅ Good: Parameterized query
query = "SELECT * FROM users WHERE email = ?"
db.execute(query, [email])
```

## 4. Insecure Design

- No rate limiting on login
- Sequential/guessable IDs
- No CAPTCHA on sensitive operations

**Fix:** Use UUIDs, implement rate limiting, threat model early.

## 5. Security Misconfiguration

```python
# ❌ Bad: Debug mode in production
app.debug = True

# ✅ Good: Environment-based config
app.debug = os.getenv('FLASK_ENV') == 'development'
```

## 6. Vulnerable Components

```bash
# Scan for vulnerabilities
npm audit
pip-audit

# Fix vulnerabilities
npm audit fix
```

## 7. Authentication Failures

```python
# ✅ Strong password requirements
def validate_password(password):
    if len(password) < 12:
        return "Password must be 12+ characters"
    if not re.search(r"[A-Z]", password):
        return "Must contain uppercase"
    if not re.search(r"[0-9]", password):
        return "Must contain number"
    return None
```

## JWT Security (OWASP Best Practices)

```python
import jwt
import hashlib
import secrets
from datetime import datetime, timezone, timedelta

# ❌ Bad: Trust algorithm from header
payload = jwt.decode(token, SECRET, algorithms=jwt.get_unverified_header(token)['alg'])

# ✅ Good: Hardcode expected algorithm (prevents algorithm confusion attacks)
def verify_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=['HS256'],  # NEVER read from header
            options={
                'require': ['exp', 'iat', 'iss', 'aud'],  # Required claims
            }
        )

        # Validate issuer and audience
        if payload['iss'] != EXPECTED_ISSUER:
            raise jwt.InvalidIssuerError()
        if payload['aud'] != EXPECTED_AUDIENCE:
            raise jwt.InvalidAudienceError()

        return payload
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"Invalid token: {e}")

# Token sidejacking protection (OWASP recommended)
def create_protected_token(user_id: str, response) -> str:
    """Create token with user context to prevent sidejacking."""
    # Generate random fingerprint
    fingerprint = secrets.token_urlsafe(32)

    # Store fingerprint hash in token (not raw value)
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
        '__Secure-Fgp',  # Cookie prefix for extra security
        fingerprint,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=900  # 15 min
    )

    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')
```

**JWT Security Checklist:**
- [ ] Hardcode algorithm (never read from header)
- [ ] Validate: exp, iat, iss, aud claims
- [ ] Short expiry (15 min - 1 hour)
- [ ] Use refresh token rotation for longer sessions
- [ ] Implement token denylist for logout/revocation

## 8. Data Integrity Failures

```html
<!-- Use SRI for CDN scripts -->
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

## 9. Logging Failures

```python
# ✅ Log security events
@app.route('/login', methods=['POST'])
def login():
    user = authenticate(email, password)
    if user:
        logger.info(f"Successful login: {email}")
    else:
        logger.warning(f"Failed login: {email}")
```

## 10. SSRF (Server-Side Request Forgery)

```python
# ❌ Bad: Fetch any URL
response = requests.get(user_provided_url)

# ✅ Good: Allowlist domains
ALLOWED = ['api.example.com']
if urlparse(url).hostname not in ALLOWED:
    abort(400)
```

## Quick Checklist

- [ ] Authorization on all endpoints
- [ ] Passwords hashed with bcrypt/argon2
- [ ] Parameterized queries only
- [ ] Rate limiting enabled
- [ ] Debug mode off in production
- [ ] Dependencies scanned regularly
- [ ] Security events logged

## Related Skills

- `auth-patterns` - Authentication implementation
- `input-validation` - Sanitization patterns
- `security-scanning` - Automated scanning

## Capability Details

### injection
**Keywords:** sql injection, command injection, injection, parameterized
**Solves:**
- Prevent SQL injection
- Fix command injection
- Use parameterized queries

### access-control
**Keywords:** access control, authorization, idor, privilege
**Solves:**
- Fix broken access control
- Prevent IDOR vulnerabilities
- Implement authorization checks

### owasp-fixes
**Keywords:** fix, mitigation, example, vulnerability
**Solves:**
- OWASP vulnerability fixes
- Mitigation examples
- Code fix patterns
