---
title: "Project Structure: Import Direction & Component Location"
category: project-structure
impact: HIGH
---

# Import Direction & Component Location

Unidirectional import architecture, cross-feature prevention, and component/hook placement rules.

## Unidirectional Import Architecture

Code must flow in ONE direction. Lower layers never import from higher layers.

```
shared/lib  ->  components  ->  features  ->  app
(lowest)                                    (highest)
```

### Allowed Imports

| Layer | Can Import From |
|-------|-----------------|
| `shared/`, `lib/` | Nothing (base layer) |
| `utils/` | `shared/`, `lib/` |
| `components/` | `shared/`, `lib/`, `utils/` |
| `features/` | `shared/`, `lib/`, `components/`, `utils/` |
| `app/` | Everything above |

### Blocked Import Directions

```typescript
// BLOCKED: shared/ importing from features/
// File: src/shared/utils.ts
import { authConfig } from '@/features/auth/config';  // VIOLATION!

// BLOCKED: features/ importing from app/
// File: src/features/auth/useAuth.ts
import { RootLayout } from '@/app/layout';  // VIOLATION!

// BLOCKED: components/ importing from features/
// File: src/components/ui/UserAvatar.tsx
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser'; // VIOLATION!
```

### Cross-Feature Import Prevention

Features must not import from each other. Extract shared code to `shared/` or `lib/`.

```typescript
// BLOCKED: Cross-feature import
// File: src/features/auth/useAuth.ts
import { DashboardContext } from '@/features/dashboard/context';  // VIOLATION!
import { useCart } from '@/features/cart/hooks/useCart';          // VIOLATION!

// FIX: Extract to shared
// Move to: src/shared/types/user.ts
// Both features import from shared/
```

### Type-Only Import Exception

Type-only imports across features are allowed since they are erased at compile time:

```typescript
// ALLOWED: Type-only import from another feature
import type { User } from '@/features/users/types';
```

## Component Location Rules

### React Components (PascalCase .tsx)

```
ALLOWED:
  src/components/Button.tsx
  src/components/ui/Card.tsx
  src/features/auth/components/LoginForm.tsx
  src/app/dashboard/page.tsx

BLOCKED:
  src/utils/Button.tsx       # Components not in utils/
  src/services/Modal.tsx     # Components not in services/
  src/hooks/Dropdown.tsx     # Components not in hooks/
  src/lib/Avatar.tsx         # Components not in lib/
```

### Custom Hooks (useX pattern)

```
ALLOWED:
  src/hooks/useAuth.ts
  src/hooks/useLocalStorage.ts
  src/features/auth/hooks/useLogin.ts

BLOCKED:
  src/components/useAuth.ts   # Hooks not in components/
  src/utils/useDebounce.ts    # Hooks not in utils/
  src/services/useFetch.ts    # Hooks not in services/
```

## Import Direction Quick Reference

```
ALLOWED DIRECTIONS:
  shared/ -> (nothing)
  lib/    -> shared/
  utils/  -> shared/, lib/
  components/ -> shared/, lib/, utils/
  features/   -> shared/, lib/, utils/, components/
  app/        -> shared/, lib/, utils/, components/, features/

BLOCKED DIRECTIONS:
  shared/ -> components/, features/, app/
  lib/    -> components/, features/, app/
  components/ -> features/, app/
  features/ -> app/, other features/
```

## Fixing Import Direction Violations

### shared/ importing from features/

Extract the needed code to `shared/` where it belongs:

```typescript
// Before: shared/utils.ts imports features/auth/config
// After: Move config to shared/config/auth.ts
```

### features/ importing from app/

App layer should not export utilities. Move shared logic to appropriate lower layer:

```typescript
// Before: features/auth imports from app/layout
// After: Extract shared layout types to shared/types/layout.ts
```

### Cross-feature imports

Extract shared types and utilities:

```typescript
// Before: features/auth imports from features/users
// After:
//   1. Create src/shared/types/user.ts
//   2. Both features import from shared/
```

### components/ importing from features/

Component should receive data as props, not fetch it directly:

```typescript
// Before: components/UserAvatar imports useCurrentUser from features/auth
// After: UserAvatar receives user as prop, feature component provides it
```

## Why This Matters

- **Circular dependencies**: Bi-directional imports create runtime errors
- **Build failures**: Bundlers cannot resolve circular module graphs
- **Code splitting**: Circular deps prevent effective code splitting
- **Maintainability**: Tangled dependencies make refactoring impossible
- **Testing**: Cannot test components in isolation with circular deps
