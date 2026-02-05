# Input Validation Checklist

## Core Principles

- [ ] **Never trust user input** - validate everything
- [ ] **Validate server-side** - client-side is UX only
- [ ] **Use allowlists** - not blocklists
- [ ] **Validate type, length, format, range**
- [ ] **Sanitize output** - escape when rendering

## Schema Definition

- [ ] Define schema for all API endpoints
- [ ] Use strict types (no `any`)
- [ ] Set reasonable min/max lengths
- [ ] Use enums for fixed value sets
- [ ] Add custom error messages
- [ ] Handle optional vs required properly

## String Validation

- [ ] Trim whitespace where appropriate
- [ ] Set maximum length (prevent DoS)
- [ ] Use regex for format validation
- [ ] Escape HTML for display
- [ ] Validate email with proper regex
- [ ] Validate URLs against allowlist domains

## Number Validation

- [ ] Use integer for IDs
- [ ] Set min/max bounds
- [ ] Handle NaN and Infinity
- [ ] Use coercion for query params

## File Validation

- [ ] Check file extension
- [ ] Validate MIME type
- [ ] **Verify magic bytes** (actual content)
- [ ] Set maximum file size
- [ ] Scan for malware (production)
- [ ] Generate new filename (no user input)

## Database Query Safety

- [ ] Use parameterized queries
- [ ] Allowlist sort columns
- [ ] Validate pagination limits
- [ ] Escape identifiers if dynamic

## Error Messages

- [ ] Generic errors for users
- [ ] Detailed errors in logs only
- [ ] Don't reveal system internals
- [ ] Don't reveal valid usernames/emails

## Validation Libraries

### TypeScript/JavaScript
```typescript
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import DOMPurify from 'dompurify';
```

### Python
```python
from pydantic import BaseModel, EmailStr, Field
from markupsafe import escape
```

## Common Patterns

### Allowlist (✅ Do)
```typescript
const allowed = ['name', 'email', 'createdAt'];
if (!allowed.includes(sortColumn)) throw new Error('Invalid');
```

### Blocklist (❌ Don't)
```typescript
const blocked = ['password', 'secret'];
if (blocked.includes(field)) throw new Error('Invalid');
// Problem: Forgets to block new sensitive fields
```

## Type Coercion

- [ ] Use `z.coerce.*` for query parameters
- [ ] Handle empty strings appropriately
- [ ] Consider timezone for dates
- [ ] Parse numbers from strings safely

## Async Validation

- [ ] Use for uniqueness checks (email, username)
- [ ] Rate limit async validations
- [ ] Cache validation results where appropriate
- [ ] Handle race conditions

## Security Headers

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Review Checklist

Before PR:

- [ ] All endpoints have input validation
- [ ] Server-side validation implemented
- [ ] Allowlists used instead of blocklists
- [ ] Error messages don't leak info
- [ ] File uploads validate content, not just extension
- [ ] SQL queries use parameterized statements
- [ ] HTML output is escaped
- [ ] Maximum lengths set on all strings

## Common Vulnerabilities to Prevent

| Vulnerability | Prevention |
|--------------|------------|
| SQL Injection | Parameterized queries |
| XSS | HTML escaping, CSP |
| Path Traversal | Validate/sanitize paths |
| SSRF | URL allowlist |
| ReDoS | Avoid complex regex |
| Buffer Overflow | Length limits |
