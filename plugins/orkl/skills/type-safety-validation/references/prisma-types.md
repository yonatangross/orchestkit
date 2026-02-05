# Prisma Types and Type-Safe Queries

Complete guide to leveraging Prisma's generated TypeScript types for type-safe database access.

## Prisma Schema Basics

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Post {
  id        String    @id @default(cuid())
  title     String
  content   String?
  published Boolean   @default(false)
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  String
  tags      Tag[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([authorId])
  @@index([published])
}

model Profile {
  id     String  @id @default(cuid())
  bio    String?
  avatar String?
  user   User    @relation(fields: [userId], references: [id])
  userId String  @unique
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}
```

## Generated Types

After running `npx prisma generate`, Prisma creates TypeScript types:

```typescript
import { PrismaClient, User, Post, Prisma } from '@prisma/client'

// Model types (from database schema)
const user: User = {
  id: 'abc123',
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: new Date(),
  updatedAt: new Date()
}

// Type-safe client
const prisma = new PrismaClient()

// All queries are fully typed!
const posts = await prisma.post.findMany()
//    ^? Post[]

const post = await prisma.post.findUnique({ where: { id: '123' } })
//    ^? Post | null
```

## Type-Safe Queries

### Basic CRUD Operations
```typescript
// Create
const newUser = await prisma.user.create({
  data: {
    email: 'new@example.com',
    name: 'New User',
    posts: {
      create: [
        { title: 'First Post', content: 'Hello world' }
      ]
    }
  }
})
// newUser: User

// Read
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' }
})
// user: User | null

const users = await prisma.user.findMany({
  where: {
    posts: {
      some: {
        published: true
      }
    }
  }
})
// users: User[]

// Update
const updated = await prisma.user.update({
  where: { id: 'abc123' },
  data: { name: 'Updated Name' }
})
// updated: User

// Delete
const deleted = await prisma.user.delete({
  where: { id: 'abc123' }
})
// deleted: User
```

### Includes and Selects
```typescript
// Include relations
const userWithPosts = await prisma.user.findUnique({
  where: { id: 'abc123' },
  include: {
    posts: true,
    profile: true
  }
})
// userWithPosts: User & { posts: Post[], profile: Profile | null } | null

// Nested includes
const userWithPublishedPosts = await prisma.user.findUnique({
  where: { id: 'abc123' },
  include: {
    posts: {
      where: { published: true },
      include: {
        tags: true
      }
    }
  }
})
// userWithPublishedPosts: User & { posts: (Post & { tags: Tag[] })[] } | null

// Select specific fields
const userEmail = await prisma.user.findUnique({
  where: { id: 'abc123' },
  select: {
    email: true,
    name: true
  }
})
// userEmail: { email: string, name: string | null } | null

// Mix select and include (not allowed, pick one!)
// ❌ This is a compile-time error:
// const bad = await prisma.user.findUnique({
//   where: { id: 'abc123' },
//   select: { email: true },
//   include: { posts: true }  // ERROR: Cannot use both!
// })
```

## Prisma Types Namespace

```typescript
import { Prisma } from '@prisma/client'

// Input types for create/update
type UserCreateInput = Prisma.UserCreateInput
const newUser: UserCreateInput = {
  email: 'user@example.com',
  name: 'John',
  posts: {
    create: [{ title: 'Post', content: 'Content' }]
  }
}

// Where input for filtering
type UserWhereInput = Prisma.UserWhereInput
const filter: UserWhereInput = {
  email: { contains: '@example.com' },
  posts: {
    some: { published: true }
  }
}

// Order by input
type UserOrderByInput = Prisma.UserOrderByWithRelationInput
const orderBy: UserOrderByInput = {
  createdAt: 'desc',
  posts: {
    _count: 'desc' // Order by number of posts
  }
}

// Select input
type UserSelectInput = Prisma.UserSelect
const select: UserSelectInput = {
  id: true,
  email: true,
  posts: {
    select: {
      title: true
    }
  }
}
```

## Custom Type Helpers

### Get Return Types
```typescript
import { Prisma } from '@prisma/client'

// Type of findUnique result with includes
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true }
}>
// = User & { posts: Post[] }

// Type of findMany result with select
type UserEmailOnly = Prisma.UserGetPayload<{
  select: { email: true, name: true }
}>
// = { email: string, name: string | null }

// Use in functions
async function getUserWithPosts(id: string): Promise<UserWithPosts | null> {
  return await prisma.user.findUnique({
    where: { id },
    include: { posts: true }
  })
}
```

### Validator Pattern
```typescript
import { Prisma } from '@prisma/client'

// Define reusable query options
const userWithPostsArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: { posts: true }
})

// Get type from validator
type UserWithPosts = Prisma.UserGetPayload<typeof userWithPostsArgs>

// Use in multiple places
async function getUser(id: string): Promise<UserWithPosts | null> {
  return await prisma.user.findUnique({
    where: { id },
    ...userWithPostsArgs
  })
}
```

## Extending Prisma Types

### Add Custom Fields
```typescript
import { User, Post } from '@prisma/client'

// Extend with computed fields
interface UserWithPostCount extends User {
  postCount: number
}

async function getUserWithPostCount(id: string): Promise<UserWithPostCount | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: { posts: true }
      }
    }
  })

  if (!user) return null

  return {
    ...user,
    postCount: user._count.posts
  }
}

// Extend with virtual fields
interface PostWithSlug extends Post {
  slug: string
}

function addSlug(post: Post): PostWithSlug {
  return {
    ...post,
    slug: post.title.toLowerCase().replace(/\s+/g, '-')
  }
}
```

### Partial Models
```typescript
import { Prisma } from '@prisma/client'

// Pick specific fields
type UserPublicInfo = Pick<User, 'id' | 'name' | 'email'>

// Omit sensitive fields
type UserSafe = Omit<User, 'password' | 'resetToken'>

// Make fields optional
type UserUpdate = Partial<Pick<User, 'name' | 'email'>>

// Combine with Prisma types
type UserCreateDTO = Omit<Prisma.UserCreateInput, 'id' | 'createdAt' | 'updatedAt'>
```

## Type-Safe Transactions

```typescript
// Simple transaction
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'user@example.com' } }),
  prisma.post.create({ data: { title: 'Post', authorId: 'userId' } })
])
// user: User, post: Post

// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: 'user@example.com' }
  })

  const post = await tx.post.create({
    data: {
      title: 'First Post',
      authorId: user.id
    }
  })

  return { user, post }
})
// result: { user: User, post: Post }

// With isolation level
await prisma.$transaction(async (tx) => {
  // Your queries here
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 10000
})
```

## Raw Queries with Types

```typescript
import { Prisma } from '@prisma/client'

// Type-safe raw query
const users = await prisma.$queryRaw<User[]>`
  SELECT * FROM "User" WHERE email LIKE ${`%@example.com`}
`
// users: User[]

// With custom type
interface UserWithCount {
  id: string
  email: string
  postCount: bigint
}

const usersWithCounts = await prisma.$queryRaw<UserWithCount[]>`
  SELECT u.id, u.email, COUNT(p.id) as "postCount"
  FROM "User" u
  LEFT JOIN "Post" p ON p."authorId" = u.id
  GROUP BY u.id
`

// Execute raw (no return value)
await prisma.$executeRaw`
  UPDATE "User" SET name = 'Updated' WHERE id = ${userId}
`

// Use Prisma.sql for safer raw queries
const email = 'user@example.com'
const users = await prisma.$queryRaw<User[]>(
  Prisma.sql`SELECT * FROM "User" WHERE email = ${email}`
)
```

## Prisma with Zod

Combine Prisma types with Zod validation:

```typescript
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// Create Zod schema matching Prisma model
const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  posts: z.array(z.object({
    title: z.string().min(1),
    content: z.string().optional()
  })).optional()
}) satisfies z.ZodType<Prisma.UserCreateInput>

// Use in API
export async function createUser(input: unknown) {
  const validated = UserCreateSchema.parse(input)

  return await prisma.user.create({
    data: validated
  })
}

// Generate Zod from Prisma schema automatically
// npm install zod-prisma-types
// Then add to schema.prisma:
// generator zod {
//   provider = "zod-prisma-types"
// }
```

## Repository Pattern

```typescript
// repositories/user.repository.ts
import { PrismaClient, User, Prisma } from '@prisma/client'

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { email } })
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return await this.prisma.user.create({ data })
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return await this.prisma.user.update({ where: { id }, data })
  }

  async delete(id: string): Promise<User> {
    return await this.prisma.user.delete({ where: { id } })
  }

  // Custom queries with proper types
  async findUsersWithPublishedPosts(): Promise<Array<User & { posts: Post[] }>> {
    return await this.prisma.user.findMany({
      where: {
        posts: {
          some: { published: true }
        }
      },
      include: {
        posts: {
          where: { published: true }
        }
      }
    })
  }
}

// Usage
const userRepo = new UserRepository(prisma)
const user = await userRepo.findById('123')
// user: User | null
```

## Best Practices

1. **Always run `prisma generate`** after schema changes
2. **Use strict mode** in tsconfig.json
3. **Leverage `Prisma.validator`** for reusable query options
4. **Use `Prisma.UserGetPayload`** to extract types from queries
5. **Combine with Zod** for input validation
6. **Use repositories** to encapsulate database logic
7. **Enable preview features** carefully in production
8. **Type transactions** properly for complex operations
9. **Avoid `any` types** - Prisma provides full type coverage
10. **Use raw queries sparingly** - lose some type safety
