---
title: "Project Structure: Folder Conventions & Nesting"
category: project-structure
impact: HIGH
---

# Folder Conventions & Nesting Depth

Feature-based organization, maximum nesting depth enforcement, and barrel file prevention.

## React/Next.js Folder Structure

```
src/
+-- app/              # Next.js App Router (pages)
|   +-- (auth)/       # Route groups
|   +-- api/          # API routes
|   +-- layout.tsx
+-- components/       # Reusable UI components
|   +-- ui/           # Primitive components
|   +-- forms/        # Form components
+-- features/         # Feature modules (self-contained)
|   +-- auth/
|   |   +-- components/
|   |   +-- hooks/
|   |   +-- services/
|   |   +-- types.ts
|   +-- dashboard/
+-- hooks/            # Global custom hooks
+-- lib/              # Third-party integrations
+-- services/         # API clients
+-- types/            # Global TypeScript types
+-- utils/            # Pure utility functions
```

## FastAPI Folder Structure

```
app/
+-- routers/          # API route handlers
|   +-- router_users.py
|   +-- router_auth.py
|   +-- deps.py       # Shared dependencies
+-- services/         # Business logic layer
|   +-- user_service.py
|   +-- auth_service.py
+-- repositories/     # Data access layer
|   +-- user_repository.py
|   +-- base_repository.py
+-- schemas/          # Pydantic models
|   +-- user_schema.py
|   +-- auth_schema.py
+-- models/           # SQLAlchemy models
|   +-- user_model.py
|   +-- base.py
+-- core/             # Config, security, deps
|   +-- config.py
|   +-- security.py
|   +-- database.py
+-- utils/            # Utility functions
```

## Nesting Depth Rules

Maximum 4 levels from `src/` or `app/`:

```
ALLOWED (4 levels):
  src/features/auth/components/LoginForm.tsx
  app/routers/v1/users/router_users.py

BLOCKED (5+ levels):
  src/features/dashboard/widgets/charts/line/LineChart.tsx
  Fix: src/features/dashboard/charts/LineChart.tsx
```

### Flattening Deep Nesting

```
# Before (6 levels - VIOLATION)
src/features/dashboard/widgets/charts/line/LineChart.tsx
src/features/dashboard/widgets/charts/line/LineChartTooltip.tsx

# After (4 levels) - Co-locate related files
src/features/dashboard/charts/LineChart.tsx
src/features/dashboard/charts/LineChartTooltip.tsx
src/features/dashboard/charts/useLineChartData.ts
```

## Barrel File Prevention

Barrel files (`index.ts` that only re-export) are BLOCKED.

```typescript
// BLOCKED: src/components/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';

// GOOD: Import directly
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/forms/Input';
```

### Why Barrel Files Are Harmful

- **Tree-shaking failure**: Bundlers import the entire barrel, not just used exports
- **Bundle size**: Unused components end up in production bundle
- **Build performance**: Barrel files slow down build times significantly
- **Circular dependencies**: Barrels create hidden circular import chains
- **HMR slowdown**: Hot Module Replacement processes entire barrel on changes

### Removing Barrel Files

```typescript
// Before (barrel import)
import { Button, Card } from '@/components';

// After (direct imports)
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
```

ESLint rule to prevent barrel creation:

```javascript
// .eslintrc.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: ['**/index']
  }]
}
```

## Python File Location Rules

### Routers

```
ALLOWED:
  app/routers/router_users.py
  app/routers/routes_auth.py
  app/routers/api_v1.py

BLOCKED:
  app/users_router.py          # Not in routers/
  app/services/router_users.py # Router in services/
```

### Services

```
ALLOWED:
  app/services/user_service.py
  app/services/auth_service.py

BLOCKED:
  app/user_service.py           # Not in services/
  app/routers/user_service.py   # Service in routers/
```

## Common Violations

| Violation | Detection | Fix |
|-----------|-----------|-----|
| Deep nesting (5+ levels) | Count path segments from src/ | Flatten by combining levels |
| Barrel file created | index.ts with re-exports only | Delete, use direct imports |
| Component in wrong dir | PascalCase .tsx in utils/ | Move to components/ |
| Router not in routers/ | router_*.py outside routers/ | Move to app/routers/ |
| Service in wrong dir | *_service.py outside services/ | Move to app/services/ |
