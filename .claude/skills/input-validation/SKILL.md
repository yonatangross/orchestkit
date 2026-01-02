---
name: input-validation
description: Input validation and sanitization patterns. Use when validating user input, preventing injection attacks, implementing allowlists, or sanitizing HTML/SQL/command inputs.
---

# Input Validation

Validate and sanitize all untrusted input.

## When to Use

- Processing user input
- Query parameters
- Form submissions
- API request bodies

## Validation Principles

1. **Never trust user input**
2. **Validate on server-side** (client-side is UX only)
3. **Use allowlists** (not blocklists)
4. **Validate type, length, format, range**

## Pydantic Validation

```python
from pydantic import BaseModel, EmailStr, Field, constr

class UserCreate(BaseModel):
    email: EmailStr
    name: constr(min_length=2, max_length=100)
    age: int = Field(ge=0, le=150)

# Usage
try:
    user = UserCreate(**request.json)
except ValidationError as e:
    return {"errors": e.errors()}, 400
```

## Allowlist Validation

```python
def validate_sort_column(column: str) -> str:
    allowed = ['name', 'email', 'created_at']
    if column not in allowed:
        raise ValueError("Invalid sort column")
    return column

# For SQL - prevents injection
order_by = validate_sort_column(request.args.get('sort'))
query = f"SELECT * FROM users ORDER BY {order_by}"
```

## HTML Sanitization

```python
from markupsafe import escape

@app.route('/comment', methods=['POST'])
def create_comment():
    # Escape HTML to prevent XSS
    content = escape(request.form['content'])
    db.execute("INSERT INTO comments (content) VALUES (?)", [content])
```

## TypeScript/Zod Validation

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(150),
});

// Validate
const result = UserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
```

## URL Validation

```python
from urllib.parse import urlparse

ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com']

def validate_url(url: str) -> str:
    parsed = urlparse(url)

    if parsed.scheme not in ['http', 'https']:
        raise ValueError("Invalid scheme")

    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError("Domain not allowed")

    return url
```

## File Upload Validation

```python
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

def validate_upload(file):
    # Check extension
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Invalid file type")

    # Check size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_SIZE:
        raise ValueError("File too large")

    # Check magic bytes (actual content)
    header = file.read(8)
    file.seek(0)
    if not is_valid_image_header(header):
        raise ValueError("Invalid file content")
```

## Security Headers

```python
@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Validation library | Pydantic (Python), Zod (TS) |
| Strategy | Allowlist over blocklist |
| Location | Server-side always |
| Error messages | Generic (don't leak info) |

## Common Mistakes

- Client-side only validation
- Blocklist instead of allowlist
- Not validating file content
- Trusting Content-Type header

## Related Skills

- `owasp-top-10` - Injection prevention
- `auth-patterns` - User input in auth
- `type-safety-validation` - Zod patterns
