---
title: Validate input with server-side schemas using Zod and Pydantic with allowlist patterns
category: validation
impact: HIGH
impactDescription: "Prevents malicious input through server-side schema validation using Zod and Pydantic with allowlist patterns"
tags: input-validation, zod, pydantic, schema-validation, allowlist
---

# Input Schema Validation

## Core Principles

1. **Never trust user input**
2. **Validate on server-side** (client-side is UX only)
3. **Use allowlists** (not blocklists)
4. **Validate type, length, format, range**

## Zod v4 Schema

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.coerce.number().int().min(0).max(150),
  role: z.enum(['user', 'admin']).default('user'),
});

const result = UserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten() });
}
```

## Type Coercion (v4)

```typescript
// Query params come as strings - coerce to proper types
z.coerce.number()  // "123" -> 123
z.coerce.boolean() // "true" -> true
z.coerce.date()    // "2024-01-01" -> Date
```

## Pydantic (Python)

```python
from pydantic import BaseModel, EmailStr, Field, field_validator

class User(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=150)

    @field_validator('name')
    @classmethod
    def strip_and_title(cls, v: str) -> str:
        return v.strip().title()
```

## Express Middleware

```typescript
function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

app.post('/api/users', validateBody(CreateUserSchema), async (req, res) => {
  const user = req.body;  // fully typed and validated
});
```

## Query Parameter Validation

```typescript
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
```

## Anti-Patterns

```typescript
// NEVER rely on client-side validation only
if (formIsValid) submit();  // No server validation

// NEVER use blocklists
const blocked = ['password', 'secret'];  // Easy to miss fields

// NEVER build queries with string concat
"SELECT * FROM users WHERE name = '" + name + "'"  // SQL injection

// ALWAYS validate server-side
const result = schema.safeParse(req.body);

// ALWAYS use allowlists
const allowed = ['name', 'email', 'createdAt'];

// ALWAYS use parameterized queries
db.query('SELECT * FROM users WHERE name = ?', [name]);
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Validation library | Zod (TS), Pydantic (Python) |
| Strategy | Allowlist over blocklist |
| Location | Server-side always |
| Error messages | Generic (don't leak info) |

**Incorrect — Trusting client-side validation allows attackers to bypass checks:**
```typescript
// Client-side only
const email = document.getElementById('email').value;
if (email.includes('@')) {
  await fetch('/api/users', { method: 'POST', body: JSON.stringify({ email }) });
}
// Attacker can bypass with curl/Postman
```

**Correct — Server-side schema validation with Zod ensures all input is validated:**
```typescript
app.post('/api/users', validateBody(z.object({
  email: z.string().email(),
})), async (req, res) => {
  // req.body.email is validated regardless of client
});
```
