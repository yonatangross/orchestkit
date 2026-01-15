# Security Questions

## Purpose

Security questions prevent authorization bypasses, data leaks, and tenant isolation failures.

## Question Framework

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY ASSESSMENT                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │    WHO      │   │    WHAT     │   │    HOW      │       │
│  └─────┬───────┘   └──────┬──────┘   └──────┬──────┘       │
│        │                  │                  │              │
│  Who can access?    What data?         How enforced?        │
│  Roles/perms?       Sensitivity?       At what layer?       │
│  Tenant scope?      PII involved?      Audit trail?         │
│        │                  │                  │              │
│        └──────────────────┼──────────────────┘              │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   ATTACKS   │   │  FALLBACK   │   │   AUDIT     │       │
│  └─────┬───────┘   └──────┬──────┘   └──────┬──────┘       │
│        │                  │                  │              │
│  What vectors?      What if fails?     What to log?         │
│  Injection?         Deny by default?   Who reviews?         │
│  IDOR?              Error messages?    Retention?           │
│        │                  │                  │              │
│        └──────────────────┴──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Questions

### Authorization

| Question | Why Ask | SkillForge Example |
|----------|---------|-------------------|
| Who can access this? | Define authZ rules | Owner only, or shared? |
| What roles have access? | RBAC implementation | admin, user, viewer |
| Is tenant isolation enforced? | Multi-tenant security | Every query has tenant_id |
| What if auth fails? | Error handling | 403 Forbidden, not 500 |
| Can users access others' data? | IDOR prevention | Check owner before access |

### Data Sensitivity

| Question | Why Ask | SkillForge Example |
|----------|---------|-------------------|
| Does this involve PII? | Compliance (GDPR) | User email in analysis? |
| What's the sensitivity level? | Encryption needs | API keys = highest |
| Should it be logged? | Audit vs privacy | Log access, not content |
| What's the retention policy? | Data lifecycle | Delete after 90 days? |
| Who can export this? | Data exfiltration | Only admins can bulk export |

### Attack Vectors

| Vector | Question | Mitigation |
|--------|----------|------------|
| Injection | User input in query? | Parameterized queries |
| IDOR | ID in URL/body? | Check ownership |
| XSS | User content displayed? | Sanitize output |
| CSRF | State-changing action? | CSRF tokens |
| Privilege escalation | Role in request? | Server-side role check |

## SkillForge-Specific Checks

### Multi-Tenant Isolation

```
EVERY database query MUST answer:

□ Does the query include tenant_id filter?
□ Is tenant_id from JWT (not user input)?
□ Is there a test for cross-tenant access?
□ Is RLS enabled on the table?
```

### LLM Security

```
For any LLM feature, verify:

□ No user_id/tenant_id in prompt
□ No document_id/analysis_id in prompt
□ Output validated for hallucinated IDs
□ User content sanitized before prompt
□ PII detection on input/output
```

### API Endpoint Security

```python
# Every endpoint should have:

@router.get("/analyses/{id}")
async def get_analysis(
    id: UUID,
    ctx: RequestContext = Depends(get_request_context),  # ✓ Auth
    db: AsyncSession = Depends(get_db),
):
    # ✓ Tenant isolation in query
    analysis = await db.execute(
        """
        SELECT * FROM analyses
        WHERE id = :id
          AND tenant_id = :tenant_id  -- REQUIRED
          AND user_id = :user_id       -- For user-owned resources
        """,
        {"id": id, "tenant_id": ctx.tenant_id, "user_id": ctx.user_id}
    )

    if not analysis:
        raise HTTPException(404)  # ✓ Don't leak existence

    # ✓ Audit log
    logger.audit("analysis.accessed", analysis_id=id, user_id=ctx.user_id)

    return analysis
```

## Security Checklist by Layer

### Layer 1: Input Validation
- [ ] All inputs validated with Pydantic
- [ ] Size limits on text fields
- [ ] File upload validation (type, size)
- [ ] Rate limiting configured

### Layer 2: Authorization
- [ ] Every endpoint has auth check
- [ ] Permission check before action
- [ ] Resource ownership verified
- [ ] Admin actions require admin role

### Layer 3: Data Access
- [ ] All queries parameterized
- [ ] Tenant filter on every query
- [ ] No raw SQL with user input
- [ ] Sensitive data encrypted

### Layer 4: Output
- [ ] Error messages don't leak info
- [ ] PII redacted from logs
- [ ] Sensitive fields not in response
- [ ] Headers configured (CORS, CSP)

## Red Flags

```
⚠️ "It's an internal API"
   → Internal APIs get exposed. Secure by default.

⚠️ "Only admins will use this"
   → Admin credentials get compromised. Least privilege.

⚠️ "We trust the frontend"
   → Never trust client input. Server validates everything.

⚠️ "It's behind authentication"
   → AuthN ≠ AuthZ. Just because they're logged in...

⚠️ "That would never happen"
   → Assume attackers WILL try everything.
```

## Example Assessment

```markdown
## Feature: Share analysis with team members

### Security Assessment

**Who can access:**
- Owner can share
- Recipients can view (not edit)
- Only within same tenant

**Attack vectors:**
- IDOR: User tries to share to user in different tenant
  → Check recipient is in same tenant
- Privilege escalation: Viewer tries to edit
  → Check permission on every action
- Information disclosure: Shared analysis leaks via URL
  → Use non-guessable share tokens

**Implementation:**
- Share creates ShareToken with expiry
- ShareToken scoped to tenant
- Recipient verified in same tenant
- Read-only access flag on share
- Audit log on share creation and access

**Tests required:**
- Cross-tenant share blocked
- Expired share rejected
- View-only can't edit
- Share token not guessable
```
