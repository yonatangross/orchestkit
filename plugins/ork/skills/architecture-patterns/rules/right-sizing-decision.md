---
title: Choose the right ORM, auth, and error handling per tier to avoid unnecessary abstraction
impact: HIGH
impactDescription: "Wrong ORM, auth, or error handling choice per tier adds 200-2000 LOC of unnecessary abstraction"
tags: right-sizing, decision, orm, authentication, error-handling, testing, pragmatic
---

## Right-Sizing Decision Guide

Context-aware recommendations for ORM, auth, error handling, and testing by project tier.

**Incorrect — rolling custom auth for an MVP:**
```python
# MVP with 0 users, building custom JWT from scratch
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"])

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=15)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, SECRET_KEY)

# +200 LOC for token rotation, revocation, middleware...
```

**Correct — managed auth for MVP, custom for production:**
```python
# MVP: Use managed auth (Supabase/Clerk/Auth0)
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Auth is a solved problem — build your differentiator

# Production: JWT with proper refresh rotation
# (justified at this scale)
```

**ORM approach by tier:**

| Context | Recommendation | Anti-Pattern |
|---------|---------------|--------------|
| Interview | Raw SQL or SQLModel | Repository + Unit of Work |
| MVP | Simple ORM, models near routes | Abstract repository protocol |
| Production | ORM with repository per aggregate | Every table gets its own repo |
| Enterprise | Full repository + Unit of Work | Over-abstracting simple lookups |

**Authentication by tier:**

| Context | Recommendation | Anti-Pattern |
|---------|---------------|--------------|
| Interview | Session cookies or hardcoded key | Full OAuth2 + PKCE |
| MVP | Supabase Auth / Clerk / Auth0 | Rolling your own JWT |
| Production | JWT (15min access + 7d refresh) | No refresh tokens |
| Enterprise | OAuth2.1 + PKCE + SSO + MFA | Skipping SSO |

**Over-engineering tax (LOC overhead when applied unnecessarily):**

| Pattern | LOC Overhead | Justified When |
|---------|-------------|----------------|
| Repository pattern | +150-300/entity | 3+ consumers of same data |
| Domain exceptions | +50-100 | Multiple transports |
| Generic base repository | +100-200 | 5+ repos with shared queries |
| Unit of Work | +150-250 | Cross-aggregate transactions |
| Event sourcing | +500-2000 | Audit trail mandated |
| CQRS | +300-800 | Read/write models diverge 50%+ |

**Key rules:**
- MVP auth should use managed services (Supabase, Clerk, Auth0) — auth is a solved problem
- Interview testing needs only 3-5 smoke tests proving it works, not 80% coverage
- Error handling for interviews: try/except with clear HTTP codes, not RFC 9457
- Add abstractions only when pain appears, not preemptively
