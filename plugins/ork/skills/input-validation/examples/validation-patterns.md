# Input Validation Patterns

## API Request Validation (TypeScript)

```typescript
import { z } from 'zod';

// Request body schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(100).transform(s => s.trim()),
  role: z.enum(['user', 'admin']).default('user'),
  metadata: z.record(z.string()).optional(),
});

type CreateUserRequest = z.infer<typeof CreateUserSchema>;

// Express middleware
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

// Usage
app.post('/api/users', validateBody(CreateUserSchema), async (req, res) => {
  const user = req.body as CreateUserRequest;
  // user is fully typed and validated
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

function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.query = result.data;
    next();
  };
}

app.get('/api/users', validateQuery(PaginationSchema), (req, res) => {
  const { page, limit, sort, order } = req.query;
  // All values are properly typed and defaulted
});
```

## Discriminated Union for Polymorphic Data

```typescript
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal('sms'),
    phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
    message: z.string().max(160),
  }),
  z.object({
    type: z.literal('push'),
    deviceToken: z.string().min(1),
    title: z.string().max(50),
    body: z.string().max(200),
  }),
]);

type Notification = z.infer<typeof NotificationSchema>;

// Type-safe handling
function sendNotification(notification: Notification) {
  switch (notification.type) {
    case 'email':
      return sendEmail(notification.email, notification.subject, notification.body);
    case 'sms':
      return sendSMS(notification.phone, notification.message);
    case 'push':
      return sendPush(notification.deviceToken, notification.title, notification.body);
  }
}
```

## Allowlist Validation

```typescript
// Only allow specific values
const SortColumnSchema = z.enum(['name', 'email', 'createdAt', 'updatedAt']);

// For dynamic allowlists
function createAllowlistSchema<T extends string>(allowed: readonly T[]) {
  return z.enum(allowed as [T, ...T[]]);
}

const allowedColumns = ['name', 'email', 'createdAt'] as const;
const DynamicSortSchema = createAllowlistSchema(allowedColumns);
```

## File Upload Validation

```typescript
const FileUploadSchema = z.object({
  file: z.object({
    name: z.string(),
    type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    size: z.number().max(5 * 1024 * 1024, 'File must be under 5MB'),
  }),
});

// Validate file content (magic bytes)
const imageMagicBytes: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

function validateFileContent(buffer: Buffer, mimeType: string): boolean {
  const expected = imageMagicBytes[mimeType];
  if (!expected) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}
```

## URL Validation with Domain Allowlist

```typescript
const ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com'] as const;

const UrlSchema = z.string()
  .url()
  .refine(
    (url) => {
      const { hostname, protocol } = new URL(url);
      return protocol === 'https:' && ALLOWED_DOMAINS.includes(hostname as any);
    },
    { message: 'URL must be HTTPS and from allowed domains' }
  );

// Usage
UrlSchema.parse('https://api.example.com/data'); // OK
UrlSchema.parse('https://evil.com/data');        // Error
UrlSchema.parse('http://api.example.com/data');  // Error (not HTTPS)
```

## Python (Pydantic) Validation

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Literal, Union

# Basic model
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=150)
    
    @field_validator('name')
    @classmethod
    def strip_and_title(cls, v: str) -> str:
        return v.strip().title()

# Discriminated union
class EmailNotification(BaseModel):
    type: Literal['email']
    email: EmailStr
    subject: str
    body: str

class SMSNotification(BaseModel):
    type: Literal['sms']
    phone: str
    message: str = Field(max_length=160)

Notification = Union[EmailNotification, SMSNotification]

# Allowlist validation
ALLOWED_COLUMNS = frozenset(['name', 'email', 'created_at'])

def validate_sort_column(column: str) -> str:
    if column not in ALLOWED_COLUMNS:
        raise ValueError(f"Invalid sort column: {column}")
    return column
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

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML input
const sanitizedHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});
```

## Form Validation with React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupForm = z.infer<typeof SignupSchema>;

function SignupForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(SignupSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span className="error">{errors.email.message}</span>}
      
      <input {...register('password')} type="password" placeholder="Password" />
      {errors.password && <span className="error">{errors.password.message}</span>}
      
      <input {...register('confirmPassword')} type="password" placeholder="Confirm" />
      {errors.confirmPassword && <span className="error">{errors.confirmPassword.message}</span>}
      
      <button type="submit">Sign Up</button>
    </form>
  );
}
```
