# Zod v4 API Reference

## Installation

```bash
npm install zod@latest
```

## Basic Types

```typescript
import { z } from 'zod';

// Primitives
const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const dateSchema = z.date();
const bigintSchema = z.bigint();

// String validations
z.string().min(1)           // Non-empty
z.string().max(100)         // Max length
z.string().email()          // Email format
z.string().url()            // URL format
z.string().uuid()           // UUID format
z.string().regex(/pattern/) // Custom pattern
z.string().trim()           // Trim whitespace
z.string().toLowerCase()    // Lowercase

// Number validations
z.number().int()            // Integer only
z.number().positive()       // > 0
z.number().nonnegative()    // >= 0
z.number().min(0)           // >= 0
z.number().max(100)         // <= 100
z.number().finite()         // Not Infinity
```

## Type Coercion (v4 Feature)

Automatically coerce input to desired type:

```typescript
// Coerce to string
const stringSchema = z.coerce.string();
stringSchema.parse(123);        // "123"
stringSchema.parse(true);       // "true"

// Coerce to number
const numberSchema = z.coerce.number();
numberSchema.parse("123");      // 123
numberSchema.parse("3.14");     // 3.14

// Coerce to boolean
const booleanSchema = z.coerce.boolean();
booleanSchema.parse("true");    // true
booleanSchema.parse("1");       // true
booleanSchema.parse("");        // false

// Coerce to date
const dateSchema = z.coerce.date();
dateSchema.parse("2024-01-01"); // Date object
dateSchema.parse(1704067200000); // Date object

// Coerce to bigint
const bigintSchema = z.coerce.bigint();
bigintSchema.parse("9007199254740991"); // BigInt
```

## Objects

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().positive().optional(),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.coerce.date(),
});

// Infer TypeScript type
type User = z.infer<typeof UserSchema>;

// Parse and validate
const user = UserSchema.parse(data);

// Safe parse (no throw)
const result = UserSchema.safeParse(data);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.errors);
}
```

## Discriminated Unions (Recommended)

More efficient than regular unions:

```typescript
const ShapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('circle'),
    radius: z.number().positive(),
  }),
  z.object({
    type: z.literal('rectangle'),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  z.object({
    type: z.literal('triangle'),
    base: z.number().positive(),
    height: z.number().positive(),
  }),
]);

type Shape = z.infer<typeof ShapeSchema>;

// Usage
const circle = ShapeSchema.parse({ type: 'circle', radius: 5 });
```

## Transforms

Transform data during validation:

```typescript
// Transform to uppercase
const uppercaseSchema = z.string().transform(s => s.toUpperCase());
uppercaseSchema.parse("hello"); // "HELLO"

// Compute derived field
const UserInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
}).transform(data => ({
  ...data,
  fullName: `${data.firstName} ${data.lastName}`,
}));

// Parse string to object
const jsonSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON",
    });
    return z.NEVER;
  }
});
```

## Refinements

Custom validation logic:

```typescript
// Simple refinement
const passwordSchema = z.string()
  .min(8)
  .refine(
    (val) => /[A-Z]/.test(val),
    { message: "Must contain uppercase letter" }
  )
  .refine(
    (val) => /[0-9]/.test(val),
    { message: "Must contain number" }
  );

// Super refinement (multiple issues)
const formSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });
  }
});
```

## Async Refinements

For async validation (e.g., database checks):

```typescript
const usernameSchema = z.string()
  .min(3)
  .refine(
    async (username) => {
      const exists = await checkUsernameExists(username);
      return !exists;
    },
    { message: "Username already taken" }
  );

// Must use parseAsync
const result = await usernameSchema.parseAsync("newuser");
```

## Error Handling

```typescript
import { z, ZodError } from 'zod';

try {
  UserSchema.parse(invalidData);
} catch (error) {
  if (error instanceof ZodError) {
    // Formatted errors
    console.log(error.format());
    
    // Flat errors
    console.log(error.flatten());
    
    // Issues array
    error.issues.forEach(issue => {
      console.log(issue.path, issue.message);
    });
  }
}

// Custom error map
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: `Expected ${issue.expected}, received ${issue.received}` };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

## React Hook Form Integration

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const FormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof FormSchema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Pydantic Comparison (Python)

```python
from pydantic import BaseModel, EmailStr, Field, field_validator

class User(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=150)
    
    @field_validator('name')
    @classmethod
    def name_must_be_title_case(cls, v: str) -> str:
        return v.title()

# Usage
user = User(email="test@example.com", name="john doe", age=25)
print(user.name)  # "John Doe"
```

## External Links

- [Zod Documentation](https://zod.dev)
- [Zod v4 Changelog](https://github.com/colinhacks/zod/releases)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)
- [Pydantic Documentation](https://docs.pydantic.dev/)
