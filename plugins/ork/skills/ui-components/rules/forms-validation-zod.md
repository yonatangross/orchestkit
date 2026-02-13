---
title: Zod Validation & Server Actions
impact: HIGH
impactDescription: "Client-only validation is bypassable and Yup has weaker TypeScript inference — Zod provides type-safe schemas that work on both client and server"
tags: zod, validation, server-actions, useActionState, react-19, schema
---

## Zod Validation & Server Actions

Type-safe validation with Zod schemas shared between client forms and React 19 Server Actions.

**Incorrect — client-only validation without server check:**
```tsx
// WRONG: Client validation only — bypassable with DevTools
function ContactForm() {
  const handleSubmit = (e: FormEvent) => {
    if (!email.includes('@')) return; // Client-only, easily bypassed!
    fetch('/api/contact', { body: JSON.stringify({ email }) });
  };
}
```

**Correct — shared Zod schema for client AND server:**
```typescript
// schemas/contact.ts — Shared validation (client + server)
import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type ContactForm = z.infer<typeof contactSchema>;
```

**Server Action with Zod validation (React 19):**
```typescript
// actions.ts
'use server';
import { contactSchema } from '@/schemas/contact';

export async function submitContact(formData: FormData) {
  const result = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  await saveContact(result.data);
  return { success: true };
}

// Component with useActionState
'use client';
import { useActionState } from 'react';
import { submitContact } from './actions';

function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContact, null);

  return (
    <form action={formAction}>
      <input name="name" />
      {state?.errors?.name && <span role="alert">{state.errors.name[0]}</span>}

      <input name="email" />
      {state?.errors?.email && <span role="alert">{state.errors.email[0]}</span>}

      <textarea name="message" />
      {state?.errors?.message && <span role="alert">{state.errors.message[0]}</span>}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

**Advanced Zod patterns:**
```typescript
// Async validation (username availability)
const usernameSchema = z.object({
  username: z.string()
    .min(3, 'At least 3 characters')
    .refine(async (value) => {
      const available = await checkUsernameAvailability(value);
      return available;
    }, 'Username already taken'),
});

// Use mode: 'onBlur' to avoid async validation on every keystroke
useForm({ resolver: zodResolver(usernameSchema), mode: 'onBlur' });

// Transform + validate
const priceSchema = z.object({
  price: z.string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive('Must be positive')),
});

// Discriminated union for conditional fields
const paymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('card'), cardNumber: z.string().length(16) }),
  z.object({ method: z.literal('paypal'), paypalEmail: z.string().email() }),
]);
```

**Key rules:**
- Share Zod schemas between client and server — single source of truth
- Always validate on server even if client validation passes (never trust client)
- Use `safeParse` (not `parse`) for server actions to return errors instead of throwing
- Use `z.infer<typeof schema>` for automatic TypeScript types
- Async validation: combine with `mode: 'onBlur'` to avoid excessive API calls
- Custom error messages in every `.email()`, `.min()`, `.refine()` call
