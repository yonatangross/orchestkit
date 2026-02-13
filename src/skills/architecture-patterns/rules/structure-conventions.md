---
title: "Structure: Import Direction & Conventions"
category: structure
impact: HIGH
impactDescription: Unidirectional imports prevent circular dependencies and maintain clean architecture
tags: [import-direction, unidirectional, circular-dependency, component-location, conventions]
---

# Import Direction & Conventions

## Unidirectional Architecture

```
shared/lib  ->  components  ->  features  ->  app
(lowest)                                    (highest)
```

| Layer | Can Import From |
|-------|-----------------|
| shared/, lib/ | Nothing (base layer) |
| components/ | shared/, lib/, utils/ |
| features/ | shared/, lib/, components/, utils/ |
| app/ | Everything above |

## Blocked Imports

```typescript
// BLOCKED: shared/ importing from features/
import { authConfig } from '@/features/auth/config';

// BLOCKED: features/ importing from app/
import { RootLayout } from '@/app/layout';

// BLOCKED: Cross-feature imports
import { DashboardContext } from '@/features/dashboard/context';
// Fix: Extract to shared/ if needed by multiple features
```

## Type-Only Exception

```typescript
// ALLOWED: Type-only import from another feature
import type { User } from '@/features/users/types';
```

## Component Location Rules

```
ALLOWED: src/components/Button.tsx, src/features/auth/components/LoginForm.tsx
BLOCKED: src/utils/Button.tsx, src/services/Modal.tsx

ALLOWED: src/hooks/useAuth.ts, src/features/auth/hooks/useLogin.ts
BLOCKED: src/components/useAuth.ts, src/utils/useDebounce.ts
```

## Python File Locations

```
ALLOWED: app/routers/router_users.py, app/services/user_service.py
BLOCKED: app/user_service.py (not in services/), app/services/router_users.py (router in services/)
```
