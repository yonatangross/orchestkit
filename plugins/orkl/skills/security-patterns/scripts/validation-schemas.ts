/**
 * Input Validation Schema Templates
 * 
 * Copy and adapt these schemas for your use case.
 */

import { z } from 'zod';

// =============================================================================
// Common Field Schemas
// =============================================================================

export const email = z.string().email();

export const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

export const uuid = z.string().uuid();

export const slug = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

export const phone = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number (E.164 format)');

export const url = z.string().url();

export const isoDate = z.coerce.date();

export const positiveInt = z.coerce.number().int().positive();

export const nonNegativeInt = z.coerce.number().int().nonnegative();


// =============================================================================
// Pagination Schema
// =============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;


// =============================================================================
// Sorting Schema Factory
// =============================================================================

export function createSortSchema<T extends string>(allowedColumns: readonly T[]) {
  return z.object({
    sortBy: z.enum(allowedColumns as [T, ...T[]]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  });
}

// Usage:
// const UserSortSchema = createSortSchema(['name', 'email', 'createdAt'] as const);


// =============================================================================
// User Schemas
// =============================================================================

export const CreateUserSchema = z.object({
  email: email,
  password: password,
  name: z.string().min(2).max(100).transform(s => s.trim()),
  role: z.enum(['user', 'admin']).default('user'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;


// =============================================================================
// Discriminated Union Example
// =============================================================================

export const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    to: email,
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
  }),
  z.object({
    type: z.literal('sms'),
    to: phone,
    message: z.string().min(1).max(160),
  }),
  z.object({
    type: z.literal('push'),
    deviceToken: z.string().min(1),
    title: z.string().max(50),
    body: z.string().max(200),
  }),
]);

export type Notification = z.infer<typeof NotificationSchema>;


// =============================================================================
// File Upload Schema
// =============================================================================

export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]),
  size: z.number().max(10 * 1024 * 1024, 'File must be under 10MB'),
});

export type FileUpload = z.infer<typeof FileUploadSchema>;


// =============================================================================
// URL with Allowlist
// =============================================================================

const ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com'] as const;

export const SafeUrlSchema = z.string()
  .url()
  .refine(
    (urlString) => {
      try {
        const { hostname, protocol } = new URL(urlString);
        return protocol === 'https:' && 
          (ALLOWED_DOMAINS as readonly string[]).includes(hostname);
      } catch {
        return false;
      }
    },
    { message: 'URL must be HTTPS and from allowed domains' }
  );


// =============================================================================
// Async Validation Example
// =============================================================================

// For async validations like uniqueness checks
export const UniqueEmailSchema = z.string()
  .email()
  .refine(
    async (email) => {
      // Replace with actual database check
      const exists = await checkEmailExists(email);
      return !exists;
    },
    { message: 'Email already registered' }
  );

async function checkEmailExists(email: string): Promise<boolean> {
  // Implement database check
  return false;
}


// =============================================================================
// Express Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';

export function validateBody<T extends z.ZodSchema>(schema: T) {
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

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid path parameters',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.params = result.data as any;
    next();
  };
}


// =============================================================================
// Usage Examples
// =============================================================================

/*
// Express route with validation
app.post(
  '/api/users',
  validateBody(CreateUserSchema),
  async (req, res) => {
    const user = req.body as CreateUserInput;
    // user is validated and typed
  }
);

app.get(
  '/api/users',
  validateQuery(PaginationSchema),
  async (req, res) => {
    const { page, limit } = req.query;
    // page and limit are numbers with defaults
  }
);
*/
