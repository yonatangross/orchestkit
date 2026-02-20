---
title: Review TypeScript code for any types, missing validation, and weak type usage
impact: HIGH
impactDescription: "Weak TypeScript usage (any types, missing validation) causes runtime crashes that static analysis should prevent"
tags: typescript, zod, react-19, exhaustive, type-safety
---

## TypeScript Quality Review Rules

Review rules for TypeScript and React code. Flag violations, suggest fixes.

### No `any` Types

```typescript
// VIOLATION: any defeats the type system
function processData(data: any) { ... }
const result: any = await fetch(url);

// CORRECT: Use proper types or unknown
function processData(data: UserInput) { ... }
const result: unknown = await fetch(url);
```

### Zod Runtime Validation

All API responses MUST be validated with Zod at the boundary:

```typescript
// VIOLATION: Trust the network
const data = await response.json();
const data = await response.json() as User;  // Type assertion, not validation

// CORRECT: Validate at boundary
import { z } from 'zod';
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});
const data = UserSchema.parse(await response.json());
```

### Exhaustive Switch Statements

All switch statements MUST have `assertNever` default:

```typescript
// VIOLATION: Non-exhaustive — adding a new status silently falls through
switch (status) {
  case 'active': return 'Active';
  case 'inactive': return 'Inactive';
}

// CORRECT: Compiler catches missing cases
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

switch (status) {
  case 'active': return 'Active';
  case 'inactive': return 'Inactive';
  default: return assertNever(status);
}
```

### React 19 APIs

```typescript
// REQUIRE: useOptimistic for mutations
const [optimistic, addOptimistic] = useOptimistic(state, reducer);

// REQUIRE: useFormStatus in form submit buttons
const { pending } = useFormStatus();

// REQUIRE: use() for Suspense-aware data fetching
const data = use(promise);

// REQUIRE: Skeleton loading, not spinners
function CardSkeleton() {
  return <div className="animate-pulse">...</div>;
}
```

**Incorrect — any types, no validation, non-exhaustive switch:**
```typescript
// Defeats type system
function processData(data: any) { return data.email; }

// Trust the network - no validation!
const data = await response.json();

// Non-exhaustive switch
switch (status) {
  case 'active': return 'Active';
  case 'inactive': return 'Inactive';
}  // Adding 'pending' silently breaks
```

**Correct — proper types, Zod validation, exhaustive switch:**
```typescript
import { z } from 'zod';

// Proper types
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
function processData(data: z.infer<typeof UserSchema>) { return data.email; }

// Validate at boundary
const data = UserSchema.parse(await response.json());

// Exhaustive switch with assertNever
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${x}`);
}
switch (status) {
  case 'active': return 'Active';
  case 'inactive': return 'Inactive';
  default: return assertNever(status);  // Compiler catches missing cases
}
```

### Review Checklist

| Check | Severity | What to Look For |
|-------|----------|-----------------|
| No `any` types | HIGH | `any` in params, returns, variables |
| Zod validation | CRITICAL | Raw `.json()` without `.parse()` |
| Exhaustive switches | HIGH | Missing `assertNever` default |
| React 19 APIs | MEDIUM | Missing `useOptimistic`, `useFormStatus` |
| Skeleton loading | MEDIUM | Spinners instead of skeletons |
| Prefetching | MEDIUM | Links without `preload="intent"` |
| MSW for tests | HIGH | `jest.mock(fetch)` instead of MSW |
