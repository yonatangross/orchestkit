# Zod Schema Patterns

Complete guide to Zod runtime validation patterns for TypeScript applications.

## Core Schema Definition

### Basic Types
```typescript
import { z } from 'zod'

// Primitives
const StringSchema = z.string()
const NumberSchema = z.number()
const BooleanSchema = z.boolean()
const DateSchema = z.date()
const BigIntSchema = z.bigint()
const UndefinedSchema = z.undefined()
const NullSchema = z.null()
const AnySchema = z.any()
const UnknownSchema = z.unknown()
const NeverSchema = z.never()
const VoidSchema = z.void()

// Special types
const LiteralSchema = z.literal('admin') // Only accepts 'admin'
const EnumSchema = z.enum(['admin', 'user', 'guest'])
const NativeEnumSchema = z.nativeEnum(UserRole) // From TypeScript enum
```

### Object Schemas
```typescript
// Basic object
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().max(120),
  role: z.enum(['admin', 'user']),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string()).optional(),
  createdAt: z.date().default(() => new Date())
})

// Infer TypeScript type
type User = z.infer<typeof UserSchema>
// {
//   id: string;
//   email: string;
//   name: string;
//   age: number;
//   role: 'admin' | 'user';
//   isActive: boolean;
//   metadata?: Record<string, string>;
//   createdAt: Date;
// }

// Partial, pick, omit
const PartialUserSchema = UserSchema.partial() // All fields optional
const UpdateUserSchema = UserSchema.pick({ name: true, email: true })
const PublicUserSchema = UserSchema.omit({ metadata: true })

// Extend schemas
const AdminSchema = UserSchema.extend({
  permissions: z.array(z.string()),
  department: z.string()
})

// Merge schemas
const TimestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date()
})
const UserWithTimestamps = UserSchema.merge(TimestampsSchema)
```

### Array and Tuple Schemas
```typescript
// Arrays
const StringArraySchema = z.array(z.string())
const NumberArraySchema = z.number().array() // Alternative syntax
const UserArraySchema = z.array(UserSchema).min(1).max(100)

// Non-empty arrays
const TagsSchema = z.array(z.string()).nonempty()

// Tuples (fixed-length arrays)
const CoordinateSchema = z.tuple([z.number(), z.number()])
// type Coordinate = [number, number]

const ResponseSchema = z.tuple([
  z.number(), // status code
  z.string(), // message
  z.unknown() // data
])

// Rest parameters
const VariadicTupleSchema = z.tuple([z.string()]).rest(z.number())
// [string, ...number[]]
```

## Transformations and Refinements

### Basic Transformations
```typescript
// Transform data after validation
const EmailSchema = z.string()
  .email()
  .transform(email => email.toLowerCase().trim())

const TimestampSchema = z.string()
  .transform(str => new Date(str))

const PriceSchema = z.number()
  .transform(cents => cents / 100) // Store cents, return dollars

// Chained transformations
const SlugSchema = z.string()
  .transform(str => str.toLowerCase())
  .transform(str => str.replace(/\s+/g, '-'))
  .transform(str => str.replace(/[^a-z0-9-]/g, ''))

// Transform with error handling
const JSONSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str)
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid JSON'
    })
    return z.NEVER
  }
})
```

### Refinements (Custom Validation)
```typescript
// Single refinement
const PasswordSchema = z.string()
  .min(8)
  .refine((pass) => /[A-Z]/.test(pass), {
    message: 'Password must contain at least one uppercase letter'
  })
  .refine((pass) => /[a-z]/.test(pass), {
    message: 'Password must contain at least one lowercase letter'
  })
  .refine((pass) => /[0-9]/.test(pass), {
    message: 'Password must contain at least one number'
  })
  .refine((pass) => /[^A-Za-z0-9]/.test(pass), {
    message: 'Password must contain at least one special character'
  })

// Multiple field refinement
const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date()
}).refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'] // Which field to attach error to
})

// Async refinement (e.g., unique email check)
const UniqueEmailSchema = z.string()
  .email()
  .refine(async (email) => {
    const exists = await db.user.findUnique({ where: { email } })
    return !exists
  }, {
    message: 'Email already exists'
  })

// Superrefine for complex validation
const PaymentSchema = z.object({
  method: z.enum(['card', 'paypal', 'bank']),
  cardNumber: z.string().optional(),
  paypalEmail: z.string().optional(),
  bankAccount: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.method === 'card' && !data.cardNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Card number is required',
      path: ['cardNumber']
    })
  }
  if (data.method === 'paypal' && !data.paypalEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PayPal email is required',
      path: ['paypalEmail']
    })
  }
})
```

## Union and Discriminated Union Patterns

### Basic Unions
```typescript
// Simple union
const StringOrNumberSchema = z.union([z.string(), z.number()])

// Nullable/Optional
const NullableStringSchema = z.string().nullable()
const OptionalStringSchema = z.string().optional()
const NullishStringSchema = z.string().nullish() // null | undefined

// Multiple types
const IdSchema = z.union([
  z.string().uuid(),
  z.number().int().positive()
])
```

### Discriminated Unions (Recommended)
```typescript
// Event types with discriminator
const EventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    x: z.number(),
    y: z.number(),
    button: z.enum(['left', 'right', 'middle'])
  }),
  z.object({
    type: z.literal('scroll'),
    offset: z.number(),
    direction: z.enum(['up', 'down'])
  }),
  z.object({
    type: z.literal('resize'),
    width: z.number(),
    height: z.number()
  })
])

type Event = z.infer<typeof EventSchema>
// Event will be a proper discriminated union

// API Response pattern
const ApiResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    data: z.unknown()
  }),
  z.object({
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string()
    })
  })
])
```

## Recursive and Lazy Schemas

```typescript
// Recursive type (e.g., nested categories)
interface Category {
  id: string
  name: string
  children?: Category[]
}

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    children: z.array(CategorySchema).optional()
  })
)

// File system tree
interface FileNode {
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

const FileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(['file', 'directory']),
    children: z.array(FileNodeSchema).optional()
  })
)
```

## Error Handling

### Parse vs SafeParse
```typescript
// .parse() - throws on error (use when you're confident)
try {
  const user = UserSchema.parse(data)
  // user is typed as User
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.issues)
  }
}

// .safeParse() - returns result object (recommended)
const result = UserSchema.safeParse(data)

if (result.success) {
  const user = result.data
  // user is typed as User
} else {
  const errors = result.error.issues
  // Handle validation errors
}
```

### Custom Error Messages
```typescript
const schema = z.object({
  email: z.string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string'
  }).email({ message: 'Invalid email format' }),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number'
  }).min(18, { message: 'Must be at least 18 years old' })
    .max(120, { message: 'Age seems unrealistic' })
})

// Custom error map for all validations
z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === 'string') {
      return { message: 'Bad type!' }
    }
  }
  return { message: ctx.defaultError }
})
```

### Formatting Errors for Users
```typescript
function formatZodErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join('.')
    acc[path] = issue.message
    return acc
  }, {} as Record<string, string>)
}

const result = UserSchema.safeParse(data)
if (!result.success) {
  const fieldErrors = formatZodErrors(result.error)
  // { "email": "Invalid email format", "age": "Must be at least 18" }
}
```

## Best Practices

### Schema Organization
```typescript
// ✅ GOOD: Reusable schemas
const EmailSchema = z.string().email().toLowerCase()
const UuidSchema = z.string().uuid()
const TimestampSchema = z.date().default(() => new Date())

const UserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  createdAt: TimestampSchema
})

// ❌ BAD: Inline schemas (hard to reuse)
const UserSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
  // ... duplicated in every schema
})
```

### Performance
```typescript
// ✅ Define schemas once (outside functions/components)
const UserSchema = z.object({ /* ... */ })

export function validateUser(data: unknown) {
  return UserSchema.safeParse(data)
}

// ❌ Don't create schemas in hot paths
export function validateUser(data: unknown) {
  const schema = z.object({ /* ... */ }) // Created every call!
  return schema.safeParse(data)
}
```

### Type Inference
```typescript
// ✅ GOOD: Infer types from schemas (single source of truth)
const UserSchema = z.object({
  id: z.string(),
  name: z.string()
})
type User = z.infer<typeof UserSchema>

// ❌ BAD: Separate type and schema (can drift apart)
interface User {
  id: string
  name: string
}
const UserSchema = z.object({
  id: z.string(),
  name: z.string()
})
```

## Comparison with Pydantic (Python)

For Python developers familiar with Pydantic:

```python
# Pydantic (Python)
from pydantic import BaseModel, EmailStr, validator

class User(BaseModel):
    id: str
    email: EmailStr
    age: int

    @validator('age')
    def validate_age(cls, v):
        if v < 18:
            raise ValueError('Must be 18+')
        return v
```

```typescript
// Zod (TypeScript) - equivalent
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  age: z.number().min(18, { message: 'Must be 18+' })
})

type User = z.infer<typeof UserSchema>
```

**Key differences:**
- Zod uses method chaining, Pydantic uses decorators
- Zod types are inferred, Pydantic types are declared
- Both provide excellent runtime validation
- Both support custom validators/refinements
