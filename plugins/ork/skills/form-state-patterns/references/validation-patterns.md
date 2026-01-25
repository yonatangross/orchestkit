# Advanced Zod Validation Patterns

Comprehensive guide to Zod validation for React Hook Form.

## Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         React Hook Form + Zod Flow                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Input ──► register() ──► Internal State ──► zodResolver ──► Errors   │
│                                      │                              │        │
│                                      ▼                              ▼        │
│                              handleSubmit()            formState.errors      │
│                                      │                                       │
│                                      ▼                                       │
│                               onSubmit(data)  ◄── data is typed & validated │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Basic Schema Patterns

### String Validation

```typescript
const stringSchema = z.object({
  // Required string with length constraints
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),

  // Email with custom message
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),

  // Optional string
  bio: z.string().max(500).optional(),

  // Nullable string (can be null)
  middleName: z.string().nullable(),

  // String with regex pattern
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),

  // URL validation
  website: z.string().url('Please enter a valid URL').optional(),

  // Trim whitespace and transform
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
});
```

### Number Validation

```typescript
const numberSchema = z.object({
  // Integer with range
  age: z.number()
    .int('Age must be a whole number')
    .min(0, 'Age cannot be negative')
    .max(150, 'Invalid age'),

  // Decimal with precision
  price: z.number()
    .positive('Price must be positive')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),

  // Coerce from string input
  quantity: z.coerce.number()
    .int()
    .min(1, 'Minimum quantity is 1')
    .max(100, 'Maximum quantity is 100'),

  // Optional number with default
  discount: z.number().min(0).max(100).default(0),
});
```

### Date Validation

```typescript
const dateSchema = z.object({
  // Coerce from string input
  birthDate: z.coerce.date()
    .max(new Date(), 'Birth date cannot be in the future'),

  // Date range
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// ISO date string
const isoDateSchema = z.string()
  .datetime({ message: 'Invalid date format' })
  .transform((val) => new Date(val));
```

### Enum and Union Validation

```typescript
// String enum
const roleSchema = z.enum(['admin', 'user', 'guest'], {
  errorMap: () => ({ message: 'Please select a valid role' }),
});

// Native enum
enum Status {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}
const statusSchema = z.nativeEnum(Status);

// Union type
const idSchema = z.union([
  z.string().uuid(),
  z.number().int().positive(),
]);

// Literal union (simpler for small sets)
const prioritySchema = z.union([
  z.literal('low'),
  z.literal('medium'),
  z.literal('high'),
]);
```

## Cross-Field Validation

### Password Confirmation

```typescript
const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword'], // Error shows on confirmPassword field
  }
);
```

### Date Range Validation

```typescript
const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
).refine(
  (data) => {
    const diffDays = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 365;
  },
  {
    message: 'Date range cannot exceed 1 year',
    path: ['endDate'],
  }
);
```

### Multiple Cross-Field Refinements

```typescript
const orderSchema = z.object({
  shippingMethod: z.enum(['standard', 'express', 'overnight']),
  deliveryDate: z.coerce.date().optional(),
  specialInstructions: z.string().optional(),
}).refine(
  (data) => {
    if (data.shippingMethod === 'overnight') {
      return data.deliveryDate !== undefined;
    }
    return true;
  },
  {
    message: 'Delivery date is required for overnight shipping',
    path: ['deliveryDate'],
  }
).refine(
  (data) => {
    if (data.shippingMethod === 'express' && data.specialInstructions) {
      return data.specialInstructions.length <= 100;
    }
    return true;
  },
  {
    message: 'Special instructions limited to 100 chars for express shipping',
    path: ['specialInstructions'],
  }
);
```

## Conditional Fields (Discriminated Unions)

### Payment Method Selection

```typescript
const paymentSchema = z.discriminatedUnion('method', [
  // Credit Card
  z.object({
    method: z.literal('card'),
    cardNumber: z.string()
      .regex(/^\d{16}$/, 'Card number must be 16 digits'),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int().min(2024).max(2040),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3-4 digits'),
    cardholderName: z.string().min(2),
  }),

  // PayPal
  z.object({
    method: z.literal('paypal'),
    email: z.string().email('Please enter a valid PayPal email'),
  }),

  // Bank Transfer
  z.object({
    method: z.literal('bank'),
    iban: z.string()
      .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/, 'Invalid IBAN format')
      .min(15)
      .max(34),
    bankName: z.string().min(2),
    swiftCode: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
  }),

  // Crypto
  z.object({
    method: z.literal('crypto'),
    walletAddress: z.string().min(26).max(62),
    network: z.enum(['ethereum', 'bitcoin', 'polygon']),
  }),
]);

type PaymentData = z.infer<typeof paymentSchema>;
// PaymentData is a union type with proper discrimination
```

### Contact Method Selection

```typescript
const contactSchema = z.discriminatedUnion('preferredContact', [
  z.object({
    preferredContact: z.literal('email'),
    email: z.string().email(),
    emailFrequency: z.enum(['daily', 'weekly', 'monthly']),
  }),
  z.object({
    preferredContact: z.literal('phone'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    callTime: z.enum(['morning', 'afternoon', 'evening']),
  }),
  z.object({
    preferredContact: z.literal('mail'),
    address: z.object({
      street: z.string().min(5),
      city: z.string().min(2),
      postalCode: z.string().min(3),
      country: z.string().min(2),
    }),
  }),
]);
```

## Async Validation

### Username Availability

```typescript
import { z } from 'zod';
import { debounce } from 'lodash-es';

// API call
const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
  const data = await res.json();
  return data.available;
};

// Debounced version
const debouncedCheck = debounce(checkUsernameAvailable, 300);

// Schema with async validation
const signupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores')
    .refine(
      async (username) => {
        if (username.length < 3) return true; // Skip check if too short
        return await debouncedCheck(username);
      },
      { message: 'Username is already taken' }
    ),
  email: z.string().email(),
  password: z.string().min(8),
});

// Use with mode: 'onBlur' for best UX
const { register } = useForm({
  resolver: zodResolver(signupSchema),
  mode: 'onBlur', // Validates on blur, not every keystroke
});
```

### Email Domain Validation

```typescript
const checkCompanyDomain = async (email: string): Promise<boolean> => {
  const domain = email.split('@')[1];
  const res = await fetch(`/api/validate-domain?domain=${domain}`);
  const data = await res.json();
  return data.valid;
};

const corporateEmailSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .refine(
      async (email) => {
        // Skip validation for free email providers
        const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
        const domain = email.split('@')[1];
        if (freeDomains.includes(domain)) {
          return false; // Will show error
        }
        return await checkCompanyDomain(email);
      },
      { message: 'Please use your company email address' }
    ),
});
```

## Transform and Preprocess

### Data Transformation

```typescript
const formSchema = z.object({
  // Trim and normalize
  name: z.string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ' ')), // Normalize spaces

  // Convert to lowercase
  email: z.string().email().toLowerCase(),

  // Parse number from string
  age: z.string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0).max(150)),

  // Parse date from string
  birthDate: z.string()
    .transform((val) => new Date(val))
    .pipe(z.date().max(new Date(), 'Cannot be in future')),

  // Currency string to cents
  price: z.string()
    .regex(/^\d+(\.\d{2})?$/, 'Invalid price format')
    .transform((val) => Math.round(parseFloat(val) * 100)), // Store as cents

  // Phone number normalization
  phone: z.string()
    .transform((val) => val.replace(/\D/g, '')) // Remove non-digits
    .pipe(z.string().min(10).max(15)),
});
```

### Preprocessing Input

```typescript
const searchSchema = z.object({
  query: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val.trim().toLowerCase();
      }
      return val;
    },
    z.string().min(1, 'Search query is required')
  ),

  // Handle empty strings as undefined
  optionalField: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(5).optional()
  ),
});
```

## File Validation

### Single File Upload

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const avatarSchema = z.object({
  avatar: z
    .instanceof(FileList)
    .refine((files) => files.length === 1, 'Please select a file')
    .refine((files) => files[0].size <= MAX_FILE_SIZE, 'Max file size is 5MB')
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files[0].type),
      'Only JPEG, PNG, WebP, and GIF are accepted'
    )
    .transform((files) => files[0]), // Extract single file
});
```

### Multiple File Upload

```typescript
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const documentsSchema = z.object({
  documents: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, 'At least one file is required')
    .refine((files) => files.length <= MAX_FILES, `Maximum ${MAX_FILES} files`)
    .refine(
      (files) => {
        const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
        return totalSize <= MAX_TOTAL_SIZE;
      },
      'Total file size must be less than 50MB'
    )
    .refine(
      (files) => Array.from(files).every((f) => ACCEPTED_DOC_TYPES.includes(f.type)),
      'Only PDF and Word documents are accepted'
    )
    .transform((files) => Array.from(files)),
});
```

## Array Validation

### Field Array with Constraints

```typescript
const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1).max(100),
  notes: z.string().max(200).optional(),
});

const orderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required')
    .max(50, 'Maximum 50 items per order')
    .refine(
      (items) => {
        // Check for duplicate products
        const productIds = items.map((i) => i.productId);
        return new Set(productIds).size === productIds.length;
      },
      { message: 'Duplicate products are not allowed' }
    )
    .refine(
      (items) => {
        // Check total quantity
        const total = items.reduce((sum, i) => sum + i.quantity, 0);
        return total <= 500;
      },
      { message: 'Total quantity cannot exceed 500' }
    ),
  couponCode: z.string().optional(),
});
```

## Partial and Pick/Omit

### Update Forms (Partial Schema)

```typescript
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2),
  avatar: z.string().url().optional(),
  settings: z.object({
    notifications: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
  }),
});

// All fields optional (for PATCH updates)
const updateUserSchema = userSchema.partial();

// Specific fields optional
const profileUpdateSchema = userSchema.pick({
  name: true,
  avatar: true,
}).partial();

// Deep partial (nested objects too)
const deepUpdateSchema = userSchema.deepPartial();

// Omit sensitive fields
const publicUserSchema = userSchema.omit({
  settings: true,
});
```

## Custom Error Messages

### Global Error Map

```typescript
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === 'string') {
      return { message: 'This field is required' };
    }
    if (issue.expected === 'number') {
      return { message: 'Please enter a valid number' };
    }
  }

  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === 'string') {
      return { message: `Must be at least ${issue.minimum} characters` };
    }
  }

  return { message: ctx.defaultError };
};

// Apply globally
z.setErrorMap(customErrorMap);
```

### Field-Level Error Messages

```typescript
const formSchema = z.object({
  email: z.string({
    required_error: 'Email address is required',
    invalid_type_error: 'Email must be text',
  }).email({
    message: 'Please enter a valid email address',
  }),

  password: z.string({
    required_error: 'Password is required',
  })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .regex(/[A-Z]/, { message: 'Password must include an uppercase letter' })
    .regex(/[0-9]/, { message: 'Password must include a number' }),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  })
    .int({ message: 'Age must be a whole number' })
    .min(18, { message: 'You must be at least 18 years old' })
    .max(120, { message: 'Please enter a valid age' }),
});
```
