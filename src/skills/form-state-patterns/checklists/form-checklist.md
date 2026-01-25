# Form State Patterns Implementation Checklist

Comprehensive checklist for production-ready forms with React Hook Form v7 + Zod.

## Schema & Validation

### Zod Schema Setup
- [ ] Zod schema defined with all fields
- [ ] Custom error messages for all validations
- [ ] Type inferred from schema: `type FormData = z.infer<typeof schema>`
- [ ] Schema exported for reuse (server validation, API types)

### Field Validation
- [ ] String fields: `.min()`, `.max()`, `.email()`, `.url()` as needed
- [ ] Number fields: `.min()`, `.max()`, `.positive()`, `.int()` as needed
- [ ] Date fields: `.date()` or `z.coerce.date()` for date strings
- [ ] Optional fields: `.optional()` or `.nullable()` as appropriate
- [ ] Array fields: `.array().min(1)` for required arrays
- [ ] Enum fields: `z.enum()` for controlled sets

### Cross-Field Validation
- [ ] `.refine()` used for dependent field validation
- [ ] `path` specified in refine for correct error placement
- [ ] `.superRefine()` for complex multi-field logic

```typescript
// ✅ CORRECT: Password confirmation with path
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], // Error appears on confirmPassword
});
```

### Async Validation
- [ ] Async refine used sparingly (not on every keystroke)
- [ ] Debounce or `mode: 'onBlur'` for async validation
- [ ] Loading indicator during async validation
- [ ] Error handling for network failures

## Form Hook Setup

### useForm Configuration
- [ ] `zodResolver` configured: `resolver: zodResolver(schema)`
- [ ] `defaultValues` provided for ALL fields
- [ ] `mode` set appropriately:
  - `onBlur` - Large forms, async validation (recommended)
  - `onChange` - Real-time validation (use sparingly)
  - `onSubmit` - Minimal validation UX
  - `onTouched` - Validate after first blur, then onChange
- [ ] `reValidateMode` matches UX needs

```typescript
// ✅ CORRECT: Complete setup
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {
    email: '',
    password: '',
    rememberMe: false,
  },
  mode: 'onBlur',
});
```

### Form Element
- [ ] `noValidate` attribute on `<form>` (Zod handles validation)
- [ ] `onSubmit={handleSubmit(onSubmit)}` properly attached
- [ ] Form has proper structure (fieldsets for groups)

## Field Registration

### register() Usage
- [ ] All inputs use `{...register('fieldName')}`
- [ ] Number inputs: `{ valueAsNumber: true }`
- [ ] Date inputs: `{ valueAsDate: true }` when appropriate
- [ ] Checkbox: `type="checkbox"` with boolean defaultValue

### Controller for Third-Party Components
- [ ] `Controller` used for non-native inputs (date pickers, rich text, etc.)
- [ ] `field.value`, `field.onChange`, `field.onBlur` properly passed
- [ ] `fieldState.error` used for error display

```typescript
// ✅ CORRECT: Controller integration
<Controller
  name="eventDate"
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

## Accessibility

### Labels & Inputs
- [ ] All inputs have associated `<label>` elements
- [ ] Labels use `htmlFor` matching input `id`
- [ ] OR inputs wrapped in `<label>` elements
- [ ] Placeholder is NOT a substitute for labels

### Error States
- [ ] Invalid inputs have `aria-invalid="true"`
- [ ] Error messages have `role="alert"`
- [ ] `aria-describedby` links input to error message
- [ ] Error messages have unique IDs

```typescript
// ✅ CORRECT: Accessible input with error
<label htmlFor="email">Email</label>
<input
  id="email"
  {...register('email')}
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <p id="email-error" role="alert">
    {errors.email.message}
  </p>
)}
```

### Focus Management
- [ ] Focus moves to first error on submit failure
- [ ] Focus trapped in modal forms
- [ ] Focus returns to trigger after modal close
- [ ] Skip links for long forms

### Screen Readers
- [ ] Required fields marked with `aria-required="true"`
- [ ] Form sections use `fieldset` and `legend`
- [ ] Progress announced in multi-step forms
- [ ] Submit result announced (success/failure)

## User Experience

### Loading States
- [ ] Submit button shows loading indicator during `isSubmitting`
- [ ] Button disabled during submission
- [ ] Form inputs disabled during submission (optional)
- [ ] Clear loading state on error

### Feedback
- [ ] Success message shown after submit
- [ ] Error summary at top for multiple errors (optional)
- [ ] Individual field errors near fields
- [ ] Toast/notification for async operations

### Form Reset
- [ ] Form reset after successful submit (if appropriate)
- [ ] Confirm before leaving with unsaved changes
- [ ] Clear server errors on new submit attempt

### Field UX
- [ ] Autofocus on first field
- [ ] Tab order is logical
- [ ] Password visibility toggle
- [ ] Input masks for phone/credit card (optional)

## Performance

### Re-render Optimization
- [ ] `mode: 'onBlur'` for large forms
- [ ] `Controller` only for components that need it
- [ ] `useWatch` for specific field subscriptions
- [ ] `useFormContext` in deeply nested components

### Avoid These (Performance Killers)
- [ ] NOT watching entire form: `watch()` without arguments
- [ ] NOT re-rendering on every keystroke unnecessarily
- [ ] NOT using controlled inputs when uncontrolled works
- [ ] NOT creating new functions in render (use useCallback)

```typescript
// ❌ BAD: Watches entire form, re-renders on any change
const allValues = watch();

// ✅ GOOD: Watch specific fields
const email = watch('email');

// ✅ BETTER: useWatch for isolated re-renders
const email = useWatch({ control, name: 'email' });
```

## Field Arrays

### useFieldArray Setup
- [ ] `useFieldArray` used for dynamic field lists
- [ ] `control` passed from useForm
- [ ] `name` matches schema array field

### Rendering
- [ ] `key={field.id}` used (NOT index!)
- [ ] `fields.map()` for iteration
- [ ] Index used for register path: `items.${index}.name`

```typescript
// ✅ CORRECT: Field array with proper key
{fields.map((field, index) => (
  <div key={field.id}> {/* Use field.id, NOT index */}
    <input {...register(`items.${index}.name`)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
))}
```

### Operations
- [ ] `append()` adds new items
- [ ] `remove()` removes by index
- [ ] `move()` for reordering (drag & drop)
- [ ] `swap()` for adjacent swaps
- [ ] `insert()` for specific position
- [ ] `prepend()` for adding at start

### Validation
- [ ] Min/max array length in schema
- [ ] Individual item validation
- [ ] Error display per item

## Server Actions (React 19 / Next.js)

### Action Setup
- [ ] `'use server'` directive at top of file
- [ ] Action receives `FormData` or validated data
- [ ] Zod validation on server side
- [ ] Return type includes errors and success

```typescript
// ✅ CORRECT: Server action with validation
'use server';

export async function submitForm(formData: FormData) {
  const result = schema.safeParse({
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  await saveToDatabase(result.data);
  return { success: true };
}
```

### useActionState Usage
- [ ] `useActionState` hook used (React 19)
- [ ] Initial state provided
- [ ] `isPending` used for loading state
- [ ] Server errors displayed in UI

```typescript
// ✅ CORRECT: useActionState integration
'use client';

function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitForm, null);

  return (
    <form action={formAction}>
      <input name="email" />
      {state?.errors?.email && <span>{state.errors.email[0]}</span>}
      <button disabled={isPending}>
        {isPending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

## Multi-Step Forms (Wizards)

### State Management
- [ ] `FormProvider` wraps entire wizard
- [ ] Single useForm instance for all steps
- [ ] Step state managed separately from form

### Step Validation
- [ ] `trigger(stepFields)` validates current step before proceeding
- [ ] Only proceed if validation passes
- [ ] Show errors on current step

### Navigation
- [ ] Back button doesn't lose data
- [ ] Progress indicator shows current step
- [ ] Optional: step completion indicators
- [ ] Optional: jump to completed steps

```typescript
// ✅ CORRECT: Step validation before proceeding
const nextStep = async () => {
  const isValid = await methods.trigger(stepFields[currentStep]);
  if (isValid) setCurrentStep((s) => s + 1);
};
```

### Persistence (Optional)
- [ ] Save progress to localStorage/sessionStorage
- [ ] Restore progress on page reload
- [ ] Clear saved data on successful submit

## File Uploads

### Validation
- [ ] File type validation with `refine`
- [ ] File size validation
- [ ] File count validation for multiple uploads

```typescript
// ✅ CORRECT: File validation schema
const fileSchema = z
  .instanceof(FileList)
  .refine((files) => files.length === 1, 'File required')
  .refine((files) => files[0]?.size <= 5_000_000, 'Max 5MB')
  .refine(
    (files) => ['image/jpeg', 'image/png'].includes(files[0]?.type),
    'Only JPEG or PNG'
  );
```

### UX
- [ ] Preview for images
- [ ] File name display
- [ ] Remove/clear button
- [ ] Progress indicator for large uploads
- [ ] Drag and drop support (optional)

## Error Handling

### Client-Side
- [ ] Validation errors displayed per field
- [ ] Form-level errors displayed appropriately
- [ ] Errors cleared on successful submit

### Server-Side
- [ ] Server errors mapped to fields when possible
- [ ] Generic errors shown in toast/banner
- [ ] Network errors handled gracefully
- [ ] Rate limiting errors shown appropriately

### setError Usage
- [ ] `setError` used for server-returned errors
- [ ] `clearErrors` called on retry/resubmit
- [ ] Error type specified: `'server'` or custom

```typescript
// ✅ CORRECT: Server error handling
const onSubmit = async (data: FormData) => {
  try {
    clearErrors(); // Clear previous errors
    const result = await submitToServer(data);
    if (!result.success && result.fieldErrors) {
      Object.entries(result.fieldErrors).forEach(([field, message]) => {
        setError(field as keyof FormData, { type: 'server', message });
      });
    }
  } catch (error) {
    setError('root', { type: 'server', message: 'Network error' });
  }
};
```

## Testing Checklist

### Unit Tests
- [ ] Schema validation tested with valid data
- [ ] Schema validation tested with invalid data
- [ ] Custom error messages verified
- [ ] Transform/preprocess logic tested

### Component Tests
- [ ] Form renders correctly
- [ ] Validation errors display
- [ ] Submit triggers callback with correct data
- [ ] Loading states work correctly
- [ ] Field arrays add/remove correctly

### Integration Tests
- [ ] End-to-end form submission
- [ ] Server error handling
- [ ] Multi-step navigation
- [ ] Accessibility (a11y) automated checks

## Security Checklist

- [ ] Server-side validation (never trust client)
- [ ] CSRF protection (Next.js handles automatically)
- [ ] Rate limiting on form submissions
- [ ] Sanitize inputs before database storage
- [ ] No sensitive data in error messages
- [ ] Honeypot field for spam prevention (optional)
