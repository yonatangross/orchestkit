# TypeScript 5.x Features for Type Safety

Modern TypeScript features (5.0-5.7) for maximum type safety in 2026 applications.

## TypeScript 5.7 Features (Latest)

### Path Rewriting for Relative Imports
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true
  }
}

// Write this:
import { User } from './user.ts'

// Compiles to:
import { User } from './user.js'
```

### Checked Imports
```typescript
// Prevent imports from test files in production
// tsconfig.json
{
  "compilerOptions": {
    "allowImportsFromTest": false // New in 5.7
  }
}
```

### Nullish and Truthy Checks
```typescript
// Better error messages for nullish checks
function process(value: string | null | undefined) {
  if (value) { // TS 5.7 warns about implicit coercion
    return value.toUpperCase()
  }
}

// Better:
function process(value: string | null | undefined) {
  if (value != null) { // Explicit nullish check
    return value.toUpperCase()
  }
}
```

## TypeScript 5.5 Features

### Inferred Type Predicates
```typescript
// TS 5.5+ can infer type predicates automatically!
function isString(value: unknown) {
  return typeof value === 'string'
}
// isString is inferred as: (value: unknown) => value is string

const values: unknown[] = ['hello', 42, 'world']
const strings = values.filter(isString)
//    ^? string[] (automatically narrowed!)

// Before TS 5.5, you had to write:
function isString(value: unknown): value is string {
  return typeof value === 'string'
}
```

### Const Type Parameters
```typescript
// Preserve literal types in generic functions
function identity<const T>(value: T): T {
  return value
}

const result = identity({ x: 10, y: 20 })
//    ^? { readonly x: 10, readonly y: 20 }
// Not: { x: number, y: number }

// Useful for config objects
function createConfig<const T extends Record<string, any>>(config: T): T {
  return config
}

const config = createConfig({
  apiUrl: 'https://api.example.com',
  timeout: 5000
} as const)
// config.apiUrl is 'https://api.example.com' (literal type!)
```

## TypeScript 5.4 Features

### NoInfer Utility Type
```typescript
// Prevent type inference from specific positions
function createStore<T>(
  initial: T,
  merge: (a: T, b: NoInfer<T>) => T
): T {
  return merge(initial, initial)
}

const store = createStore(
  { count: 0 },
  (a, b) => ({ count: a.count + b.count })
)
// b is inferred from first parameter, not from this lambda!

// Real-world example: React setState
type SetState<T> = (value: T | ((prev: T) => NoInfer<T>)) => void
```

### Import Attributes
```typescript
// Import JSON with type assertions
import config from './config.json' with { type: 'json' }

// Works with dynamic imports too
const data = await import('./data.json', {
  with: { type: 'json' }
})
```

## TypeScript 5.3 Features

### Import Types Syntax
```typescript
// Import only types (guaranteed to be erased)
import type { User } from './user'

// Import type and value separately
import { type User, createUser } from './user'

// Resolution mode for .cts/.mts files
import type { RequestHandler } from 'express' with { 'resolution-mode': 'require' }
```

## TypeScript 5.0 Features

### Decorators (Stage 3)
```typescript
// Enable in tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": false, // Use standard decorators
  }
}

// Class decorator
function logged<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    constructor(...args: any[]) {
      console.log(`Creating ${constructor.name}`)
      super(...args)
    }
  }
}

@logged
class User {
  constructor(public name: string) {}
}

// Method decorator
function measure(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const start = performance.now()
    const result = await original.apply(this, args)
    const duration = performance.now() - start
    console.log(`${propertyKey} took ${duration}ms`)
    return result
  }

  return descriptor
}

class API {
  @measure
  async fetchData() {
    await new Promise(resolve => setTimeout(resolve, 100))
    return { data: 'result' }
  }
}
```

### Const Type Parameters (5.0+)
```typescript
// Make generic type parameters const
type Const<T> = T extends readonly any[] ? readonly [...T] : T

function tuple<const T extends readonly any[]>(...args: T): T {
  return args
}

const numbers = tuple(1, 2, 3)
//    ^? readonly [1, 2, 3]
// Not: (number | number | number)[]
```

## TypeScript 4.9 Features

### Satisfies Operator
```typescript
// Ensure type without widening
type Config = {
  url: string
  timeout: number
  retries?: number
}

// ✅ GOOD: Keeps literal types
const config = {
  url: 'https://api.example.com',
  timeout: 5000,
  retries: 3
} satisfies Config

config.url // 'https://api.example.com' (literal type!)

// ❌ BAD: Widens to string
const config2: Config = {
  url: 'https://api.example.com',
  timeout: 5000
}

config2.url // string (widened)

// Real-world example: API routes
type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  handler: (req: any) => any
}

const routes = {
  getUser: {
    method: 'GET',
    path: '/users/:id',
    handler: (req) => ({ user: 'data' })
  },
  createUser: {
    method: 'POST',
    path: '/users',
    handler: (req) => ({ created: true })
  }
} satisfies Record<string, Route>

routes.getUser.method // 'GET' (literal!)
```

### Auto-Accessors in Classes
```typescript
class User {
  accessor name: string = ''

  // Equivalent to:
  // #__name: string = ''
  // get name() { return this.#__name }
  // set name(value: string) { this.#__name = value }
}

// With decorators
function logged(target: any, context: ClassAccessorDecoratorContext) {
  return {
    get(this: any) {
      const value = target.get.call(this)
      console.log(`Getting ${String(context.name)}: ${value}`)
      return value
    },
    set(this: any, value: any) {
      console.log(`Setting ${String(context.name)}: ${value}`)
      target.set.call(this, value)
    }
  }
}

class User {
  @logged
  accessor name: string = ''
}
```

## Advanced Type Patterns

### Branded Types
```typescript
// Prevent mixing similar primitive types
type UserId = string & { readonly __brand: 'UserId' }
type PostId = string & { readonly __brand: 'PostId' }

function UserId(id: string): UserId {
  return id as UserId
}

function PostId(id: string): PostId {
  return id as PostId
}

function getUser(id: UserId): User { /* ... */ }
function getPost(id: PostId): Post { /* ... */ }

const userId = UserId('user-123')
const postId = PostId('post-456')

getUser(userId) // ✅ OK
getUser(postId) // ❌ Error: PostId not assignable to UserId
```

### Template Literal Types
```typescript
// Type-safe event system
type EventName = `on${Capitalize<string>}`

type Handler<T extends EventName> =
  T extends `on${infer Event}`
    ? (event: Lowercase<Event>) => void
    : never

const handlers: Record<EventName, Handler<EventName>> = {
  onClick: (event) => console.log(event), // event: 'click'
  onMouseMove: (event) => {}, // event: 'mousemove'
}

// Type-safe API paths
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type ApiPath = `/api/${string}`
type Endpoint = `${HttpMethod} ${ApiPath}`

function registerEndpoint(endpoint: Endpoint, handler: Function) {}

registerEndpoint('GET /api/users', () => {}) // ✅ OK
registerEndpoint('GET api/users', () => {}) // ❌ Error: missing /
registerEndpoint('PATCH /api/users', () => {}) // ❌ Error: invalid method
```

### Recursive Conditional Types
```typescript
// Deep readonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K]
}

interface Config {
  db: {
    host: string
    port: number
    credentials: {
      username: string
      password: string
    }
  }
}

const config: DeepReadonly<Config> = {
  db: {
    host: 'localhost',
    port: 5432,
    credentials: {
      username: 'admin',
      password: 'secret'
    }
  }
}

config.db.credentials.password = 'new' // ❌ Error: readonly

// Deep partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? DeepPartial<T[K]>
    : T[K]
}

type ConfigUpdate = DeepPartial<Config>
const update: ConfigUpdate = {
  db: {
    port: 5433 // Can update just port
  }
}
```

### Variadic Tuple Types
```typescript
// Type-safe function composition
type Func<Args extends any[], Return> = (...args: Args) => Return

function compose<A extends any[], B, C>(
  f: Func<[B], C>,
  g: Func<A, B>
): Func<A, C> {
  return (...args: A) => f(g(...args))
}

const add = (a: number, b: number) => a + b
const double = (n: number) => n * 2

const addThenDouble = compose(double, add)
const result = addThenDouble(2, 3) // 10
//    ^? number

// Type-safe tuple concatenation
type Concat<T extends any[], U extends any[]> = [...T, ...U]

type Result = Concat<[1, 2], [3, 4]>
//   ^? [1, 2, 3, 4]
```

## Strict Mode Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    // Strict mode (enables all below)
    "strict": true,

    // Individual strict flags
    "strictNullChecks": true,           // null/undefined checking
    "strictFunctionTypes": true,        // Function parameter checking
    "strictBindCallApply": true,        // Accurate bind/call/apply
    "strictPropertyInitialization": true, // Class property init
    "noImplicitAny": true,              // No implicit any types
    "noImplicitThis": true,             // No implicit this
    "alwaysStrict": true,               // Emit 'use strict'

    // Additional safety
    "noUncheckedIndexedAccess": true,   // obj[key] includes undefined
    "noImplicitReturns": true,          // All code paths must return
    "noFallthroughCasesInSwitch": true, // Switch case fallthrough
    "noUnusedLocals": true,             // Catch unused variables
    "noUnusedParameters": true,         // Catch unused params
    "noPropertyAccessFromIndexSignature": true, // Force bracket notation
    "exactOptionalPropertyTypes": true, // undefined !== missing property

    // Module resolution
    "moduleResolution": "bundler",      // Modern bundler resolution
    "allowImportingTsExtensions": true, // Import .ts files
    "resolveJsonModule": true,          // Import JSON
    "isolatedModules": true,            // Each file is a module

    // Emit
    "declaration": true,                // Generate .d.ts files
    "declarationMap": true,             // Source maps for .d.ts
    "sourceMap": true,                  // Generate source maps
    "removeComments": false,            // Keep comments in output

    // Advanced
    "skipLibCheck": true,               // Skip type checking .d.ts files
    "forceConsistentCasingInFileNames": true, // Case-sensitive imports
    "useDefineForClassFields": true     // ECMAScript-compliant class fields
  }
}
```

## Best Practices

1. **Enable strict mode** - Catch bugs at compile time
2. **Use `const` type parameters** - Preserve literal types
3. **Use `satisfies`** - Type-check without widening
4. **Use branded types** - Prevent primitive type confusion
5. **Use template literals** - Type-safe string patterns
6. **Use `NoInfer`** - Control type inference direction
7. **Prefer `unknown` over `any`** - Force type checking
8. **Use type predicates** - Better type narrowing
9. **Enable `noUncheckedIndexedAccess`** - Safer array/object access
10. **Use decorators** - Clean metadata and cross-cutting concerns
