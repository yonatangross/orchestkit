---
title: "Form UX"
impact: "HIGH"
impactDescription: "Poor form UX — placeholder-only labels, keystroke validation, system-blaming errors — increases abandonment and error rates by 40-60% based on eye-tracking research"
tags: [form-ux, fitts-law, poka-yoke, error-handling, label-placement, touch-targets, react-hook-form, zod, smart-defaults]
---

## Form UX

Cognitive science principles for form design: Fitts's Law for target acquisition, top-aligned labels for fastest completion, Poka-Yoke error prevention, and smart defaults. Each principle maps to a specific, testable implementation rule.

### Fitts's Law: Target Size and Placement

**Incorrect:**
```tsx
// Small inline submit on mobile — tiny target, wrong position for LTR reading
<div className="flex items-center gap-2">
  <Input name="email" />
  <button className="px-2 py-1 text-sm">Go</button>  {/* ~32px touch target */}
</div>
```

**Correct:**
```tsx
// Full-width on mobile, 44px min touch target, primary action at completion position
<form className="space-y-4">
  <Input name="email" label="Email" />
  <div className="flex justify-end gap-3">
    {/* Destructive action: smaller, positioned left (away from primary) */}
    <button type="button" className="text-sm text-destructive px-3 py-2">
      Cancel
    </button>
    {/* Primary action: full-width on mobile, bottom-right on desktop */}
    <button
      type="submit"
      className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] px-6 py-2 bg-primary text-white rounded"
    >
      Submit
    </button>
  </div>
</form>
```

**Touch target rules:**
- Mobile: minimum 44×44px (Apple HIG / WCAG 2.5.5)
- Desktop: minimum 24×24px
- Destructive actions (Delete, Cancel): smaller targets, position away from primary
- Primary action: bottom-right for LTR layouts (natural completion position)

### Label Placement: Top-Aligned

**Incorrect:** `<input placeholder="Enter your email" />` — placeholder disappears on focus, fails a11y.

**Correct:**
```tsx
// Explicit <label>, hint via aria-describedby, mark optional (not required)
<div className="space-y-1">
  <label htmlFor="email" className="block text-sm font-medium">Email</label>
  <input id="email" type="email" className="w-full border rounded px-3 py-2"
    aria-describedby="email-hint" />
  <p id="email-hint" className="text-xs text-muted-foreground">We'll send your receipt here</p>
</div>
<div className="space-y-1">
  <label htmlFor="phone" className="block text-sm font-medium">
    Phone <span className="text-muted-foreground font-normal">(optional)</span>
  </label>
  <input id="phone" type="tel" className="w-full border rounded px-3 py-2" />
</div>
```

**Key rules:** top-aligned labels are fastest (NNG eye-tracking); never placeholder-only; mark optional fields not required ones; group with `<fieldset>` + `<legend>`.

### Error Handling: Poka-Yoke (Mistake-Proofing) with React Hook Form + Zod

**Incorrect:**
```tsx
// Keystroke validation + blame-the-user error messages
<input
  onChange={(e) => {
    if (!e.target.value.includes('@')) setError('Invalid email')  // Fires while typing!
  }}
/>
{error && <p className="text-red-500">Invalid email</p>}  {/* No field name, no fix suggestion */}
```

**Correct:**
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Enter a valid email address (e.g. name@company.com)'),
  phone: z.string().regex(/^\+?[\d\s-]{7,}$/, 'Enter a phone number (e.g. +1 555 0100)').optional(),
})

type FormValues = z.infer<typeof schema>

function ContactForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        {/* Use correct input type — enables mobile keyboard, browser validation hints */}
        <input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="w-full border rounded px-3 py-2 aria-[invalid=true]:border-destructive"
        />
        {errors.email && (
          // Blame the system, not the user; name field + cause + fix
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 py-2 bg-primary text-white rounded disabled:opacity-50">
        {isSubmitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
```

**Error message formula:** "[Field] — [cause] — [fix]"
- "We couldn't verify this email — check for typos or try a different address" (system blame, fix given)
- NOT: "Invalid email" (user blame, no fix)

**Key rules (Smart Defaults — Postel's Law):**
- Pre-fill sensible defaults — never start from zero
- Use `<select>` / radio for known options — constrain inputs to prevent errors at the source
- Validate on `blur`, NOT `keydown` — keystroke validation fires while the user is still typing
- Remember prior choices in multi-step flows (`sessionStorage` or URL state)
- Context-aware defaults: country from locale, date format from region

References:
- https://www.nngroup.com/articles/web-form-design/ (NNG form research)
- https://react-hook-form.com/docs (React Hook Form)
- https://zod.dev (Zod validation)
- https://www.w3.org/WAI/WCAG21/Understanding/target-size.html (WCAG 2.5.5 Touch Targets)
