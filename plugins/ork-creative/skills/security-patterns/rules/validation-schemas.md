---
title: "Validation: Advanced Schemas & File Validation"
category: validation
impact: HIGH
impactDescription: "Ensures secure file uploads and polymorphic data validation through magic byte checking and discriminated unions"
tags: file-validation, discriminated-unions, magic-bytes, upload-security
---

# Advanced Schemas & File Validation

## Discriminated Unions

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
```

## File Upload Validation

```typescript
const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  ]),
  size: z.number().max(10 * 1024 * 1024, 'File must be under 10MB'),
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

const SafeUrlSchema = z.string()
  .url()
  .refine(
    (url) => {
      const { hostname, protocol } = new URL(url);
      return protocol === 'https:' &&
        (ALLOWED_DOMAINS as readonly string[]).includes(hostname);
    },
    { message: 'URL must be HTTPS and from allowed domains' }
  );
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

function SignupForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(SignupSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      <input type="password" {...register('password')} />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

## Allowlist Pattern

```typescript
// Only allow specific sort columns
const SortColumnSchema = z.enum(['name', 'email', 'createdAt', 'updatedAt']);

// Dynamic allowlist factory
function createAllowlistSchema<T extends string>(allowed: readonly T[]) {
  return z.enum(allowed as [T, ...T[]]);
}
```

## Python Discriminated Union

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Union

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
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| File validation | Check magic bytes, not just extension |
| URL validation | HTTPS + domain allowlist |
| Polymorphic data | Discriminated unions |
| Form validation | Zod + React Hook Form |

**Incorrect — Trusting file extension or MIME type allows malicious file uploads:**
```typescript
if (file.name.endsWith('.png') && file.type === 'image/png') {
  await uploadFile(file);  // Can be spoofed by renaming .exe to .png
}
```

**Correct — Validating magic bytes ensures file content matches declared type:**
```typescript
const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);
const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E;
if (isPNG) {
  await uploadFile(file);  // Verified actual PNG file
}
```
