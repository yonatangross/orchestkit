/**
 * Common Zod Schema Patterns
 *
 * Reusable validation schemas for typical application needs.
 */

import { z } from 'zod'

// ====================
// Common Base Schemas
// ====================

export const EmailSchema = z.string().email().toLowerCase().trim()

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .refine((pass) => /[A-Z]/.test(pass), 'Must contain uppercase letter')
  .refine((pass) => /[a-z]/.test(pass), 'Must contain lowercase letter')
  .refine((pass) => /[0-9]/.test(pass), 'Must contain number')
  .refine((pass) => /[^A-Za-z0-9]/.test(pass), 'Must contain special character')

export const UuidSchema = z.string().uuid()

export const UrlSchema = z.string().url()

export const DateStringSchema = z.string().datetime().transform(str => new Date(str))

export const PhoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format (E.164)'
)

export const SlugSchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase with hyphens only')

// ====================
// Pagination Schemas
// ====================

export const CursorPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  cursor: z.string().optional(),
})

export const OffsetPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
})

export const PagePaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
})

// ====================
// User Schemas
// ====================

export const UserCreateSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
})

export const UserUpdateSchema = UserCreateSchema.partial().omit({ password: true })

export const UserLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
})

export const UserResponseSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  name: z.string(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type UserCreate = z.infer<typeof UserCreateSchema>
export type UserUpdate = z.infer<typeof UserUpdateSchema>
export type UserLogin = z.infer<typeof UserLoginSchema>
export type UserResponse = z.infer<typeof UserResponseSchema>

// ====================
// API Request/Response Schemas
// ====================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.date().default(() => new Date()),
})

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      timestamp: z.date().default(() => new Date()),
    }),
  })

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorSchema,
})

// Discriminated union for API responses
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    ApiSuccessSchema(dataSchema),
    ApiErrorResponseSchema,
  ])

// Usage example:
// const UserApiResponse = ApiResponseSchema(UserResponseSchema)

// ====================
// File Upload Schemas
// ====================

export const FileUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  type: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i), // MIME type
  url: UrlSchema,
})

export const ImageUploadSchema = FileUploadSchema.extend({
  type: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

// ====================
// Search and Filter Schemas
// ====================

export const SearchSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
  ])).optional(),
  sort: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  }).optional(),
  pagination: CursorPaginationSchema.or(OffsetPaginationSchema),
})

// ====================
// Date Range Schemas
// ====================

export const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  data => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
)

export const TimestampRangeSchema = z.object({
  from: z.number().int().positive(),
  to: z.number().int().positive(),
}).refine(
  data => data.to >= data.from,
  {
    message: 'To timestamp must be after or equal to from timestamp',
    path: ['to'],
  }
)

// ====================
// Address Schemas
// ====================

export const AddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(100),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  postalCode: z.string().min(3).max(10),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
})

// ====================
// Nested Object Schemas
// ====================

export const PostCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  excerpt: z.string().max(500).optional(),
  published: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(50)).max(10),
  metadata: z.object({
    readTime: z.number().int().positive().optional(),
    featuredImage: ImageUploadSchema.optional(),
  }).optional(),
  author: z.object({
    id: UuidSchema,
    name: z.string(),
  }),
})

export type PostCreate = z.infer<typeof PostCreateSchema>

// ====================
// Discriminated Union Schemas
// ====================

export const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    to: EmailSchema,
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal('sms'),
    to: PhoneSchema,
    message: z.string().min(1).max(160),
  }),
  z.object({
    type: z.literal('push'),
    userId: UuidSchema,
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(200),
  }),
])

export type Notification = z.infer<typeof NotificationSchema>

// ====================
// Payment Schemas
// ====================

export const PaymentSchema = z.object({
  amount: z.number().positive().multipleOf(0.01), // Cents precision
  currency: z.string().length(3).toUpperCase(), // ISO 4217
  method: z.enum(['card', 'paypal', 'stripe', 'bank_transfer']),
  metadata: z.record(z.string()).optional(),
})

export const CardPaymentSchema = PaymentSchema.extend({
  method: z.literal('card'),
  cardDetails: z.object({
    number: z.string().regex(/^\d{13,19}$/),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(new Date().getFullYear()),
    cvv: z.string().regex(/^\d{3,4}$/),
  }),
})

// ====================
// Recursive Schemas
// ====================

type Category = {
  id: string
  name: string
  children?: Category[]
}

export const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: UuidSchema,
    name: z.string().min(1).max(100),
    children: z.array(CategorySchema).optional(),
  })
)

// ====================
// Environment Variable Schemas
// ====================

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().url().or(z.literal('*')),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Env = z.infer<typeof EnvSchema>

// Validate environment variables at startup
export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }

  return result.data
}

// ====================
// Form Validation Schemas
// ====================

export const ContactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: EmailSchema,
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(2000),
  consent: z.boolean().refine(val => val === true, {
    message: 'You must accept the privacy policy',
  }),
})

export type ContactForm = z.infer<typeof ContactFormSchema>

// ====================
// Async Validation Example
// ====================

export const UniqueEmailSchema = z.string()
  .email()
  .refine(async (email) => {
    // Simulate DB check
    // const exists = await db.user.findUnique({ where: { email } })
    // return !exists
    return true
  }, {
    message: 'Email already exists',
  })

// ====================
// Custom Transform Examples
// ====================

export const TrimmedStringSchema = z.string().transform(s => s.trim())

export const CommaSeparatedSchema = z.string()
  .transform(s => s.split(',').map(item => item.trim()).filter(Boolean))

export const JsonStringSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str)
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid JSON',
    })
    return z.NEVER
  }
})

// ====================
// Error Formatting Utility
// ====================

export function formatZodError(error: z.ZodError): Record<string, string> {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join('.')
    acc[path] = issue.message
    return acc
  }, {} as Record<string, string>)
}

// Usage:
// const result = UserCreateSchema.safeParse(data)
// if (!result.success) {
//   const errors = formatZodError(result.error)
//   // { "email": "Invalid email", "password": "Must contain uppercase" }
// }
