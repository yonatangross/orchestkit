---
name: type-safety-validation
description: Use when adding runtime validation, type-safe APIs, or end-to-end TypeScript safety. Covers Zod schemas, tRPC, Prisma, and exhaustive type checking patterns.
context: fork
agent: frontend-ui-developer
version: 1.1.0
author: AI Agent Hub
tags: [typescript, zod, trpc, prisma, type-safety, validation, exhaustive-types, branded-types, 2025]
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/test-runner.sh"
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/test-runner.sh"
---

# Type Safety & Validation

## Overview

End-to-end type safety ensures bugs are caught at compile time, not runtime. This skill covers Zod for runtime validation, tRPC for type-safe APIs, Prisma for type-safe database access, and modern TypeScript features.

**When to use this skill:**
- Building type-safe APIs (REST, RPC, GraphQL)
- Validating user input and external data
- Ensuring database queries are type-safe
- Creating end-to-end typed full-stack applications
- Migrating from JavaScript to TypeScript
- Implementing strict validation rules

## Core Stack

### 1. Zod - Runtime Validation

```typescript
import { z } from 'zod'

// Define schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().positive().max(120),
  role: z.enum(['admin', 'user', 'guest']),
  metadata: z.record(z.string()).optional(),
  createdAt: z.date().default(() => new Date())
})

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>

// Validate data
const result = UserSchema.safeParse(data)
if (result.success) {
  const user: User = result.data
} else {
  console.error(result.error.issues)
}

// Transform data
const EmailSchema = z.string().email().transform(email => email.toLowerCase())
```

**Advanced Patterns**:
```typescript
// Refinements
const PasswordSchema = z.string()
  .min(8)
  .refine((pass) => /[A-Z]/.test(pass), 'Must contain uppercase')
  .refine((pass) => /[0-9]/.test(pass), 'Must contain number')

// Discriminated Unions
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), offset: z.number() })
])

// Recursive Types
const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(CategorySchema).optional()
  })
)
```

### 2. tRPC - Type-Safe APIs

```typescript
// Server: Define procedures
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await db.user.findUnique({ where: { id: input.id } })
    }),

  createUser: t.procedure
    .input(z.object({
      email: z.string().email(),
      name: z.string()
    }))
    .mutation(async ({ input }) => {
      return await db.user.create({ data: input })
    })
})

export type AppRouter = typeof appRouter

// Client: Fully typed!
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from './server'

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/api/trpc' })]
})

// TypeScript knows the exact shape!
const user = await client.getUser.query({ id: '123' })
//    ^? User | null
```

### 3. Prisma - Type-Safe ORM

```prisma
// schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fully typed queries
const user = await prisma.user.findUnique({
  where: { id: '123' },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' }
    }
  }
})
// user is typed as: User & { posts: Post[] }

// Type-safe creates
const newUser = await prisma.user.create({
  data: {
    email: 'user@example.com',
    posts: {
      create: [
        { title: 'First Post', content: 'Hello world' }
      ]
    }
  }
})
```

### 4. TypeScript 5.7+ Features

```typescript
// Const type parameters (TS 5.0+)
function firstElement<T extends readonly any[]>(arr: T) {
  return arr[0]
}

const result = firstElement(['a', 'b'] as const)
// result is typed as 'a'

// Satisfies operator (TS 4.9+)
const config = {
  url: 'https://api.example.com',
  timeout: 5000
} satisfies Config  // Ensures config matches Config, but keeps literal types

// Decorators (TS 5.0+)
function logged(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log("Calling " + propertyKey)
    return original.apply(this, args)
  }
}

class API {
  @logged
  async fetchData() {}
}
```

## Full-Stack Example

```typescript
// ===== BACKEND (Next.js API) =====
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'

export async function GET(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({})
  })
}

export const POST = GET

// server/routers/_app.ts
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { publicProcedure, router } from '../trpc'

export const appRouter = router({
  posts: {
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(10),
        cursor: z.string().optional()
      }))
      .query(async ({ input }) => {
        const posts = await prisma.post.findMany({
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: { createdAt: 'desc' },
          include: { author: true }
        })

        return {
          items: posts.slice(0, input.limit),
          nextCursor: posts[input.limit]?.id
        }
      }),

    create: publicProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        content: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        return await prisma.post.create({
          data: input
        })
      })
  }
})

// ===== FRONTEND (React) =====
// lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()

// components/PostList.tsx
'use client'

import { trpc } from '@/lib/trpc'

export function PostList() {
  const { data, isLoading } = trpc.posts.list.useQuery({ limit: 10 })
  const createPost = trpc.posts.create.useMutation()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.items.map(post => (
        <div key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
          <span>By {post.author.name}</span>
        </div>
      ))}

      <button onClick={() => createPost.mutate({ title: 'New Post' })}>
        Create Post
      </button>
    </div>
  )
}
```

## Python Type Safety with Ty

**SkillForge uses ty**, a Rust-based static type checker for Python that enforces stricter type safety than mypy.

### Pattern: Safe Dict Extraction (Ty-Compliant)

```python
from typing import cast

# Extract from untyped dict (e.g., agent results)
result = {"findings": {...}, "confidence_score": 0.85}
findings_raw = result.get("findings", {})
confidence_raw = result.get("confidence_score")

# Type-safe extraction with explicit annotations
findings_to_save: dict[str, object] | None = (
    cast("dict[str, object]", findings_raw) if isinstance(findings_raw, dict) else None
)
confidence_to_save: float | None = (
    float(confidence_raw) if isinstance(confidence_raw, (int, float)) else None
)
```

**Why needed**: Ty requires explicit type annotations + `isinstance()` checks to narrow types from `object | None`.

**Full patterns**: See `references/ty-type-checker-patterns.md` for:
- Mixed numeric type handling
- List type narrowing
- Nested dict extraction
- Agent result processing examples

## Exhaustive Type Checking (2025 Pattern)

TypeScript's type system can guarantee compile-time exhaustiveness for union types. This prevents runtime bugs when union members are added or changed.

### The assertNever Pattern

```typescript
// ✅ ALWAYS use this helper function
function assertNever(x: never): never {
  throw new Error("Unexpected value: " + x)
}

// Example: Status handling
type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

function getStatusColor(status: AnalysisStatus): string {
  switch (status) {
    case 'pending': return 'gray'
    case 'running': return 'blue'
    case 'completed': return 'green'
    case 'failed': return 'red'
    default: return assertNever(status) // ✅ Compile-time exhaustiveness check
  }
}

// If you add a new status 'cancelled', TypeScript will error at compile time:
// Error: Argument of type 'string' is not assignable to parameter of type 'never'.
```

### Exhaustive Record Mapping

```typescript
// For mapping union types to values, use satisfies with Record
type EventType = 'click' | 'scroll' | 'keypress' | 'hover'

const eventColors = {
  click: 'red',
  scroll: 'blue',
  keypress: 'green',
  hover: 'yellow',
} as const satisfies Record<EventType, string>

// TypeScript will error if any EventType is missing from the record
// Adding new EventType requires updating this record
```

### Exhaustive Handler Objects

```typescript
// For complex logic, use handler objects instead of switches
type ContentType = 'article' | 'video' | 'podcast' | 'repository'

interface ContentHandler<T> {
  article: (data: ArticleData) => T
  video: (data: VideoData) => T
  podcast: (data: PodcastData) => T
  repository: (data: RepoData) => T
}

function createContentHandlers<T>(handlers: ContentHandler<T>): ContentHandler<T> {
  return handlers
}

// Usage: TypeScript enforces all content types are handled
const renderContent = createContentHandlers({
  article: (data) => <ArticleCard {...data} />,
  video: (data) => <VideoPlayer {...data} />,
  podcast: (data) => <AudioPlayer {...data} />,
  repository: (data) => <RepoCard {...data} />,
})
```

### Exhaustive Union Checks with Type Guards

```typescript
// When you need runtime type narrowing with exhaustiveness
type APIResponse =
  | { type: 'success'; data: Data }
  | { type: 'error'; error: Error }
  | { type: 'loading' }

function handleResponse(response: APIResponse): string {
  switch (response.type) {
    case 'success':
      return "Data: " + response.data.id
    case 'error':
      return "Error: " + response.error.message
    case 'loading':
      return 'Loading...'
    default:
      return assertNever(response) // Ensures all cases handled
  }
}
```

### Template Literal Exhaustiveness

```typescript
// For string pattern unions
type Size = 'sm' | 'md' | 'lg' | 'xl'
type Variant = 'primary' | 'secondary' | 'danger'
// Template literal type (TypeScript feature)
type ButtonClass = "btn-${Size}-${Variant}" // Pseudo-syntax for documentation

// Exhaustive size mapping
const sizeMap = {
  sm: 'text-sm py-1 px-2',
  md: 'text-base py-2 px-4',
  lg: 'text-lg py-3 px-6',
  xl: 'text-xl py-4 px-8',
} as const satisfies Record<Size, string>

// Compile-time error if Size is expanded without updating sizeMap
```

### Branded Types for IDs

**TypeScript Pattern** (Zod runtime validation):

```typescript
import { z } from 'zod'

// Create branded types for different ID kinds
const UserId = z.string().uuid().brand<'UserId'>()
const AnalysisId = z.string().uuid().brand<'AnalysisId'>()
const ArtifactId = z.string().uuid().brand<'ArtifactId'>()

type UserId = z.infer<typeof UserId>
type AnalysisId = z.infer<typeof AnalysisId>
type ArtifactId = z.infer<typeof ArtifactId>

// Now TypeScript prevents mixing ID types
function deleteAnalysis(id: AnalysisId): void { ... }
function getUser(id: UserId): User { ... }

const userId: UserId = UserId.parse('...')
const analysisId: AnalysisId = AnalysisId.parse('...')

deleteAnalysis(analysisId) // ✅ OK
deleteAnalysis(userId)     // ❌ Error: UserId not assignable to AnalysisId
```

**Python Pattern** (NewType compile-time safety):

```python
from typing import NewType
from uuid import UUID

# Define branded types (zero runtime overhead)
AnalysisID = NewType("AnalysisID", UUID)
ArtifactID = NewType("ArtifactID", UUID)
SessionID = NewType("SessionID", UUID)
TraceID = NewType("TraceID", str)

# Factory functions for runtime validation
def create_analysis_id(value: UUID | str) -> AnalysisID:
    """Create typed AnalysisID with validation."""
    if isinstance(value, str):
        value = UUID(value)
    return AnalysisID(value)

def create_artifact_id(value: UUID | str) -> ArtifactID:
    """Create typed ArtifactID with validation."""
    if isinstance(value, str):
        value = UUID(value)
    return ArtifactID(value)

# Type checker (mypy/ty) prevents mixing
def delete_analysis(id: AnalysisID) -> None: ...
def get_artifact(id: ArtifactID) -> Artifact: ...

analysis_id = create_analysis_id("...")
artifact_id = create_artifact_id("...")

delete_analysis(analysis_id)  # ✅ OK
delete_analysis(artifact_id)  # ❌ Error: ArtifactID not assignable to AnalysisID
```

**Why NewType for Python?**
- **Zero runtime overhead** - compiled away, no wrapper object
- **Mypy/Ty enforcement** - catches ID mixing at type-check time
- **Explicit factories** - centralized validation logic
- **Better than Pydantic** for this use case - no serialization needed

### Common Anti-Patterns

```typescript
// ❌ NEVER use non-exhaustive switch
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  // Missing cases! Runtime bugs waiting to happen
}

// ❌ NEVER use default without assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  default: return 'unknown' // Silent bug if new status added
}

// ❌ NEVER use if-else chains for union types
if (status === 'pending') return 'gray'
else if (status === 'running') return 'blue'
// No compile-time check for missing cases!

// ✅ ALWAYS use switch with assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  case 'completed': return 'green'
  case 'failed': return 'red'
  default: return assertNever(status)
}
```

## Best Practices

### Validation
- ✅ Validate at boundaries (API inputs, form submissions, external data)
- ✅ Use `.safeParse()` to handle errors gracefully
- ✅ Provide clear error messages for users
- ✅ Validate environment variables at startup
- ✅ Use branded types for IDs (`z.string().brand<'UserId'>()`)

### Type Safety
- ✅ Enable `strict: true` in `tsconfig.json`
- ✅ Use `noUncheckedIndexedAccess` for safer array access
- ✅ Prefer `unknown` over `any`
- ✅ Use type guards for narrowing
- ✅ Leverage inference with `typeof` and `ReturnType`
- ✅ **Exhaustive switches**: Always use `assertNever` in default case
- ✅ **Exhaustive records**: Use `satisfies Record<UnionType, Value>`
- ✅ **Branded types (TypeScript)**: Use Zod `.brand<>()` for distinct ID types
- ✅ **Branded types (Python)**: Use `NewType` for zero-overhead compile-time safety
- ✅ **Python/Ty**: Use explicit annotations + `isinstance()` for dict extraction

### Performance
- ✅ Reuse schemas (don't create inline)
- ✅ Use `.parse()` for known-good data (faster than `.safeParse()`)
- ✅ Enable Prisma query optimization
- ✅ Use tRPC batching for multiple queries
- ✅ Cache validation results when appropriate

## Resources

- [Zod Documentation](https://zod.dev)
- [tRPC Documentation](https://trpc.io)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

**Skill Version**: 1.2.0
**Last Updated**: 2025-12-27
**Maintained by**: AI Agent Hub Team

## Changelog

### v1.2.0 (2025-12-27)
- Added Python `NewType` pattern for branded types (zero-overhead compile-time safety)
- Added factory function pattern for typed ID creation
- Updated branded types section with TypeScript vs Python comparison
- Updated best practices to include Python NewType usage

### v1.1.0 (2025-12-25)
- Added comprehensive exhaustive type checking section
- Added `assertNever` pattern for compile-time exhaustiveness
- Added exhaustive record mapping with `satisfies`
- Added exhaustive handler objects pattern
- Added template literal exhaustiveness examples
- Added branded types for IDs with Zod
- Added common anti-patterns for non-exhaustive code
- Updated best practices with exhaustive type checking guidelines

### v1.0.0 (2025-12-14)
- Initial skill with Zod, tRPC, Prisma, and TypeScript 5.7+ patterns

## Capability Details

### zod-schemas
**Keywords:** zod, schema, validation, parse, safeParse, infer, refine, transform
**Solves:**
- How do I validate input with Zod?
- Create runtime validation schema
- Infer TypeScript types from Zod
- Transform and refine data with Zod
- Handle Zod validation errors

### exhaustive-types
**Keywords:** exhaustive, assertNever, never assertion, switch exhaustive, compile-time exhaustiveness, exhaustive check, missing cases, union exhaustive
**Solves:**
- How do I make switch statements exhaustive?
- Compile-time check for missing union cases
- assertNever pattern for TypeScript
- Catch missing cases at compile time
- Exhaustive handler objects pattern
- Why does my switch have a default that never runs?

### branded-types
**Keywords:** branded type, type branding, nominal type, opaque type, NewType, brand, distinct types, id types
**Solves:**
- How do I prevent mixing different ID types?
- Branded types with Zod
- Python NewType for type safety
- Prevent UserId where AnalysisId expected
- Nominal typing in TypeScript
- Type-safe IDs across the codebase

### trpc
**Keywords:** trpc, type-safe api, procedure, router, mutation, query, context, middleware
**Solves:**
- How do I set up tRPC?
- Type-safe API calls
- tRPC with React Query
- tRPC authentication middleware
- tRPC error handling

### prisma-types
**Keywords:** prisma, orm, generated types, model, client, payload, validator
**Solves:**
- How do I use Prisma types?
- Type-safe database queries
- Prisma schema to TypeScript
- Extract types from Prisma queries
- Extend Prisma models with custom fields

### typescript-5-features
**Keywords:** typescript 5, const parameters, satisfies, decorators, template literals, inferred predicates
**Solves:**
- Use TypeScript 5.x features
- Const type parameters
- Satisfies operator
- Modern TypeScript patterns
- Branded types and template literals

### skillforge-integration
**Keywords:** skillforge, pydantic, fastapi, openapi, backend types, frontend types
**Solves:**
- How can SkillForge use Zod with FastAPI?
- Convert Pydantic to Zod schemas
- Share types between Python and TypeScript
- Validate API responses in frontend
- Generate types from OpenAPI spec

### implementation-checklist
**Keywords:** checklist, type safety, validation, testing, deployment
**Solves:**
- What steps to implement type safety?
- Type safety checklist
- Validation best practices
- Type safety testing strategy
- Production deployment checklist

### ty-type-checker
**Keywords:** ty, rust type checker, strict typing, isinstance, cast, type narrowing, dict extraction, optional types
**Solves:**
- How do I make ty type checker pass?
- Extract values from untyped dicts safely
- Type-safe agent result processing
- Handle optional numeric types with ty
- Type narrowing with isinstance checks
- Fix 'object | None' type errors in ty
