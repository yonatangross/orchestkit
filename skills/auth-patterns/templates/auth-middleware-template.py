"""
Authentication Middleware Template

Copy this template for Flask/FastAPI authentication setup.
Replace placeholders with actual implementations.
"""

import os
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# =============================================================================
# Configuration
# =============================================================================

JWT_SECRET = os.environ.get("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

ph = PasswordHasher()


# =============================================================================
# Password Hashing
# =============================================================================

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


# =============================================================================
# JWT Tokens
# =============================================================================

def create_access_token(
    user_id: str,
    roles: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "type": "access",
        "roles": roles or [],
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> dict | None:
    """Verify and decode access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_from_header(authorization: str) -> str | None:
    """Extract token from Authorization header."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


# =============================================================================
# Flask Middleware
# =============================================================================

# Uncomment for Flask:
#
# from flask import request, g, abort
#
# @app.before_request
# def authenticate_request():
#     """Authenticate request before processing."""
#     g.current_user = None
#     
#     token = get_token_from_header(request.headers.get("Authorization"))
#     if token:
#         payload = verify_access_token(token)
#         if payload:
#             g.current_user = get_user_by_id(payload["sub"])
#
#
# def login_required(f):
#     """Decorator to require authentication."""
#     @wraps(f)
#     def wrapper(*args, **kwargs):
#         if not g.current_user:
#             abort(401)
#         return f(*args, **kwargs)
#     return wrapper
#
#
# def require_role(*roles):
#     """Decorator to require specific role(s)."""
#     def decorator(f):
#         @wraps(f)
#         def wrapper(*args, **kwargs):
#             if not g.current_user:
#                 abort(401)
#             if not any(role in g.current_user.roles for role in roles):
#                 abort(403)
#             return f(*args, **kwargs)
#         return wrapper
#     return decorator


# =============================================================================
# FastAPI Middleware
# =============================================================================

# Uncomment for FastAPI:
#
# from fastapi import Depends, HTTPException, status
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
#
# security = HTTPBearer()
#
# async def get_current_user(
#     credentials: HTTPAuthorizationCredentials = Depends(security)
# ):
#     """Dependency to get current authenticated user."""
#     payload = verify_access_token(credentials.credentials)
#     if not payload:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid or expired token",
#         )
#     
#     user = await get_user_by_id(payload["sub"])
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="User not found",
#         )
#     
#     return user
#
#
# def require_role(*roles):
#     """Dependency factory to require specific role(s)."""
#     async def role_checker(user = Depends(get_current_user)):
#         if not any(role in user.roles for role in roles):
#             raise HTTPException(
#                 status_code=status.HTTP_403_FORBIDDEN,
#                 detail="Insufficient permissions",
#             )
#         return user
#     return role_checker


# =============================================================================
# Rate Limiting Helper
# =============================================================================

def create_rate_limiter(redis_client, key_prefix: str, limit: int, window_seconds: int):
    """Create a rate limiter using Redis."""
    def check_rate_limit(identifier: str) -> bool:
        """Check if rate limit exceeded. Returns True if allowed."""
        key = f"{key_prefix}:{identifier}"
        current = redis_client.incr(key)
        
        if current == 1:
            redis_client.expire(key, window_seconds)
        
        return current <= limit
    
    return check_rate_limit

# Usage:
# login_limiter = create_rate_limiter(redis, "login", limit=5, window_seconds=60)
# if not login_limiter(request.remote_addr):
#     abort(429)  # Too Many Requests


# =============================================================================
# Secure Headers
# =============================================================================

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}

# Flask:
# @app.after_request
# def add_security_headers(response):
#     for header, value in SECURITY_HEADERS.items():
#         response.headers[header] = value
#     return response

# FastAPI:
# from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
# from starlette.middleware import Middleware
# 
# @app.middleware("http")
# async def add_security_headers(request, call_next):
#     response = await call_next(request)
#     for header, value in SECURITY_HEADERS.items():
#         response.headers[header] = value
#     return response
