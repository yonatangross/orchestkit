---
title: Security Interrogation
impact: HIGH
impactDescription: "Missing security analysis in ADRs leads to vulnerabilities discovered post-deployment — retrofit security is 10x more expensive"
tags: security, authorization, tenant-isolation, attack-surface, pii, architecture, interrogation
---

## Security Interrogation

Security questions to ask before any architectural decision. Prevents gaps from being discovered after deployment.

### Core Security Questions

| Question | Red Flag Answer |
|----------|-----------------|
| Who can access this data/feature? | "Everyone" |
| How is tenant isolation enforced? | "We trust the frontend" |
| What happens if authorization fails? | "Return 403" (no detail) |
| What attack vectors does this introduce? | "None" |
| Is there PII involved? | "I don't think so" |

### Assessment Template

```markdown
### Security Assessment for: [Feature/Decision]

- **Access control:** [Who can access? Role-based? Resource-based?]
- **Tenant isolation:** [How is data scoped per tenant?]
- **Authorization check:** [Where is authZ enforced? API layer? DB query?]
- **Attack vectors:** [Injection? IDOR? Rate abuse? Privilege escalation?]
- **PII handling:** [What PII exists? Encryption? Retention?]
- **Audit trail:** [Are access/changes logged?]
```

### Example Assessment

```markdown
### Security Assessment for: Document Tagging

- **Access control:** User can only see/manage their own tags
- **Tenant isolation:** All tag queries MUST include tenant_id filter
- **Authorization check:** Middleware verifies user owns document before tag CRUD
- **Attack vectors:** Tag injection (limit length, sanitize), IDOR on document_id
- **PII handling:** Tags might contain PII — treat as sensitive, encrypt at rest
- **Audit trail:** Log tag creation/deletion with user_id and timestamp
```

### Security Enforcement Layers

| Layer | Enforcement | Example |
|-------|-------------|---------|
| **API Gateway** | Rate limiting, auth token validation | JWT verification |
| **Middleware** | Role/permission check | `require_permission("tag:write")` |
| **Service** | Business rule authorization | Verify user owns document |
| **Database** | Row-level security, tenant filter | `WHERE tenant_id = ?` |
| **Query** | Parameterized queries | No string interpolation |

### Anti-Patterns

```python
# NEVER trust frontend for authorization
def get_tags(request):
    doc_id = request.params["doc_id"]
    return db.query(f"SELECT * FROM tags WHERE doc_id = '{doc_id}'")
    # WRONG: No auth check, SQL injection, no tenant filter

# CORRECT
def get_tags(request):
    doc_id = request.params["doc_id"]
    user = authenticate(request)
    doc = db.get(Document, doc_id)
    if doc.tenant_id != user.tenant_id:
        raise ForbiddenError()
    return db.query("SELECT * FROM tags WHERE doc_id = %s AND tenant_id = %s",
                    [doc_id, user.tenant_id])
```

### Key Rules

- Tenant isolation must be enforced at the **database query level**, not just UI
- Authorization checks happen at **every layer**, not just the API gateway
- Assume **every input is malicious** — validate at system boundaries
- PII requires **encryption at rest** and **retention policy**
- Every access control decision must be **auditable**
- "Everyone can access" is almost always the **wrong answer**
