# Authentication Implementation Examples

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
    """Hash password with Argon2id."""
    return ph.hash(password)

def verify_password(password_hash: str, password: str) -> bool:
    """Verify password against hash."""
    try:
        ph.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False

# Check if rehash needed (parameters changed)
def needs_rehash(password_hash: str) -> bool:
    return ph.check_needs_rehash(password_hash)
```

## JWT Access Token

```python
import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

def create_access_token(user_id: str, roles: list[str] = None) -> str:
    """Create short-lived access token."""
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
    """Verify and decode access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

## Session Management

```python
from flask import Flask, session
from datetime import datetime, timedelta, timezone

app = Flask(__name__)

# Secure session configuration
app.config.update(
    SECRET_KEY=os.environ["SESSION_SECRET"],
    SESSION_COOKIE_SECURE=True,       # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,     # No JavaScript access
    SESSION_COOKIE_SAMESITE='Strict', # CSRF protection
    PERMANENT_SESSION_LIFETIME=timedelta(hours=1),
)

@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['email'], request.form['password'])
    if user:
        session.permanent = True
        session['user_id'] = user.id
        session['created_at'] = datetime.now(timezone.utc).isoformat()
        return redirect('/dashboard')
    return render_template('login.html', error='Invalid credentials')

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect('/login')
```

## Rate Limiting

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="redis://localhost:6379",
)

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")  # Strict rate limit for login
def login():
    # Login logic
    pass

@app.route('/api/auth/password-reset', methods=['POST'])
@limiter.limit("3 per hour")  # Very strict for password reset
def password_reset():
    # Always return success (don't reveal if email exists)
    return {"message": "If email exists, reset link sent"}
```

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

## Multi-Factor Authentication (TOTP)

```python
import pyotp
import qrcode
from io import BytesIO
import base64

def generate_totp_secret() -> str:
    """Generate new TOTP secret for user."""
    return pyotp.random_base32()

def get_totp_provisioning_uri(secret: str, email: str, issuer: str = "MyApp") -> str:
    """Get provisioning URI for authenticator app."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)

def get_totp_qr_code(provisioning_uri: str) -> str:
    """Generate QR code as base64 image."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    
    return base64.b64encode(buffer.getvalue()).decode()

def verify_totp(secret: str, code: str) -> bool:
    """Verify TOTP code."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Allow 1 period window

# Usage
@app.route('/api/auth/mfa/setup', methods=['POST'])
@login_required
def setup_mfa():
    secret = generate_totp_secret()
    uri = get_totp_provisioning_uri(secret, g.current_user.email)
    qr = get_totp_qr_code(uri)
    
    # Store secret temporarily until verified
    session['pending_mfa_secret'] = secret
    
    return {"qr_code": qr, "secret": secret}

@app.route('/api/auth/mfa/verify', methods=['POST'])
@login_required
def verify_mfa_setup():
    code = request.json['code']
    secret = session.get('pending_mfa_secret')
    
    if verify_totp(secret, code):
        g.current_user.mfa_secret = secret
        g.current_user.mfa_enabled = True
        db.session.commit()
        return {"success": True}
    
    return {"error": "Invalid code"}, 400
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
    
    # Check if MFA required
    if user.mfa_enabled:
        # Create temporary token for MFA step
        mfa_token = create_mfa_pending_token(user.id)
        return {"mfa_required": True, "mfa_token": mfa_token}
    
    # No MFA - issue tokens
    return issue_tokens(user)

@app.route('/api/auth/mfa', methods=['POST'])
@limiter.limit("5 per minute")
def verify_mfa():
    mfa_token = request.json.get('mfa_token')
    code = request.json.get('code')
    
    # Verify MFA pending token
    user_id = verify_mfa_pending_token(mfa_token)
    if not user_id:
        return {"error": "Invalid or expired MFA token"}, 401
    
    user = User.query.get(user_id)
    
    # Verify TOTP code
    if not verify_totp(user.mfa_secret, code):
        return {"error": "Invalid MFA code"}, 401
    
    return issue_tokens(user)

def issue_tokens(user):
    """Issue access and refresh tokens."""
    access_token = create_access_token(user.id, user.roles)
    refresh_token = create_refresh_token(user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
```
