---
title: React Hook Form Patterns
impact: HIGH
impactDescription: "Forms without proper library support re-render on every keystroke and lack validation — React Hook Form v7 provides controlled renders and type-safe validation"
tags: react-hook-form, forms, useForm, field-arrays, multi-step, file-upload
---

## React Hook Form Patterns

Production form patterns with React Hook Form v7 for controlled rendering, field arrays, wizards, and file uploads.

**Incorrect — uncontrolled form with useEffect fetch:**
```tsx
// WRONG: Fetching in useEffect, manual state management
function BadForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Manual validation on every render...
    if (!email.includes('@')) setErrors({ email: 'Invalid' });
  }, [email]);

  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
}
```

**Correct — React Hook Form with Zod resolver:**
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type UserForm = z.infer<typeof userSchema>;

function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onBlur', // Validate on blur, not every keystroke
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input
        {...register('email')}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

**Field arrays for dynamic fields:**
```tsx
import { useFieldArray } from 'react-hook-form';

function OrderForm() {
  const { control, register } = useForm({
    defaultValues: { items: [{ productId: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <>
      {fields.map((field, index) => (
        <div key={field.id}> {/* Use field.id, NOT index */}
          <input {...register(`items.${index}.productId`)} />
          <input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ productId: '', quantity: 1 })}>Add</button>
    </>
  );
}
```

**Controller for third-party components:**
```tsx
import { Controller } from 'react-hook-form';

<Controller
  name="date"
  control={control}
  render={({ field, fieldState }) => (
    <DatePicker
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  )}
/>
```

**Key rules:**
- Always provide `defaultValues` (prevents uncontrolled-to-controlled warnings)
- Use `mode: 'onBlur'` for better performance (not every keystroke)
- Use `field.id` as key in field arrays, never index
- Use `Controller` for non-native inputs (date pickers, selects, rich text)
- Add `noValidate` to form element when using Zod (disable browser validation)
- Use `aria-invalid` and `role="alert"` for accessibility
