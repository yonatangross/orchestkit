# Frontend API Integration (2026 Patterns)

Type-safe API consumption with runtime validation.

## Runtime Validation with Zod

**CRITICAL**: TypeScript types are erased at runtime. API responses MUST be validated:

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'developer', 'viewer']),
  created_at: z.string().datetime(),
})

const UsersResponseSchema = z.object({
  data: z.array(UserSchema),
  pagination: z.object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
})

type User = z.infer<typeof UserSchema>

async function fetchUsers(cursor?: string): Promise<UsersResponse> {
  const response = await fetch(`/api/v1/users${cursor ? `?cursor=${cursor}` : ''}`)
  const data = await response.json()
  return UsersResponseSchema.parse(data) // Runtime validation!
}
```

## Request Interceptors (ky)

```typescript
import ky from 'ky'

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  timeout: 30000,
  retry: {
    limit: 2,
    methods: ['get', 'head', 'options'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await getAccessToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          const newToken = await refreshToken()
          if (newToken) {
            request.headers.set('Authorization', `Bearer ${newToken}`)
            return ky(request, options)
          }
        }
        return response
      },
    ],
  },
})
```

## Error Enrichment Pattern

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isValidationError(): boolean {
    return this.status === 422
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}
```

## TanStack Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useUsers(cursor?: string) {
  return useQuery({
    queryKey: ['users', { cursor }],
    queryFn: () => getUsers(cursor),
    staleTime: 30_000,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      api.post('users', { json: input }).json().then(UserSchema.parse),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

## Anti-Patterns

```typescript
// NEVER: Trust API response types blindly
const data = await response.json() as User  // Unsafe cast!

// NEVER: Skip validation
const user: User = await response.json()    // Runtime crash waiting

// ALWAYS: Validate at the boundary
const user = UserSchema.parse(await response.json())
```