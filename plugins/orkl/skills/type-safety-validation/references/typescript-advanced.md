# Advanced TypeScript Patterns

Exhaustive type checking, branded types, and type guards for production-grade type safety.

## Exhaustive Type Checking

TypeScript's type system can guarantee compile-time exhaustiveness for union types. This prevents runtime bugs when union members are added or changed.

### The assertNever Pattern

```typescript
// ALWAYS use this helper function
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
    default: return assertNever(status) // Compile-time exhaustiveness check
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

// Exhaustive size mapping
const sizeMap = {
  sm: 'text-sm py-1 px-2',
  md: 'text-base py-2 px-4',
  lg: 'text-lg py-3 px-6',
  xl: 'text-xl py-4 px-8',
} as const satisfies Record<Size, string>

// Compile-time error if Size is expanded without updating sizeMap
```

## Branded Types

Prevent mixing similar primitive types at compile time.

### TypeScript Pattern (with Zod Runtime Validation)

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

deleteAnalysis(analysisId) // OK
deleteAnalysis(userId)     // Error: UserId not assignable to AnalysisId
```

### Python Pattern (NewType Compile-Time Safety)

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

delete_analysis(analysis_id)  # OK
delete_analysis(artifact_id)  # Error: ArtifactID not assignable to AnalysisID
```

**Why NewType for Python?**
- **Zero runtime overhead** - compiled away, no wrapper object
- **Mypy/Ty enforcement** - catches ID mixing at type-check time
- **Explicit factories** - centralized validation logic
- **Better than Pydantic** for this use case - no serialization needed

### Pure TypeScript Branded Types (No Runtime Library)

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

getUser(userId) // OK
getUser(postId) // Error: PostId not assignable to UserId
```

## Type Guards

Custom type narrowing functions for complex runtime checks.

### Basic Type Guards

```typescript
// Type guard with type predicate
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    typeof (obj as User).id === 'string' &&
    typeof (obj as User).email === 'string'
  )
}

// Usage
const data: unknown = await fetchData()

if (isUser(data)) {
  console.log(data.email) // TypeScript knows data is User
}
```

### Assertion Functions

```typescript
// Assertion function throws on failure
function assertIsUser(obj: unknown): asserts obj is User {
  if (!isUser(obj)) {
    throw new Error('Expected User object')
  }
}

// Usage - narrows type after call
const data: unknown = await fetchData()
assertIsUser(data)
console.log(data.email) // TypeScript knows data is User
```

### Discriminated Union Guards

```typescript
type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E }

function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true
}

function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false
}

// Usage
const result = await doSomething()

if (isSuccess(result)) {
  console.log(result.value) // T
} else {
  console.log(result.error) // E
}
```

## Common Anti-Patterns

```typescript
// NEVER use non-exhaustive switch
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  // Missing cases! Runtime bugs waiting to happen
}

// NEVER use default without assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  default: return 'unknown' // Silent bug if new status added
}

// NEVER use if-else chains for union types
if (status === 'pending') return 'gray'
else if (status === 'running') return 'blue'
// No compile-time check for missing cases!

// ALWAYS use switch with assertNever
switch (status) {
  case 'pending': return 'gray'
  case 'running': return 'blue'
  case 'completed': return 'green'
  case 'failed': return 'red'
  default: return assertNever(status)
}
```

## Best Practices

1. **Exhaustive switches** - Always use `assertNever` in default case
2. **Exhaustive records** - Use `satisfies Record<UnionType, Value>`
3. **Branded types (TypeScript)** - Use Zod `.brand<>()` for distinct ID types
4. **Branded types (Python)** - Use `NewType` for zero-overhead compile-time safety
5. **Type guards** - Create reusable predicates for complex type narrowing
6. **Assertion functions** - Use `asserts` for imperative type narrowing