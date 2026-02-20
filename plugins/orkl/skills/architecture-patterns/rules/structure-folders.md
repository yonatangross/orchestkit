---
title: Organize folders consistently to reduce cognitive load and improve codebase navigability
category: structure
impact: HIGH
impactDescription: Consistent folder structure reduces cognitive load and improves codebase navigability
tags: [folder-structure, project-layout, nesting-depth, barrel-files, feature-based]
---

# Folder Organization

## React/Next.js (Frontend)

```
src/
├── app/              # Next.js App Router
│   ├── (auth)/       # Route groups
│   ├── api/          # API routes
│   └── layout.tsx
├── components/       # Reusable UI components
│   ├── ui/           # Primitive components
│   └── forms/        # Form components
├── features/         # Feature modules (self-contained)
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   └── dashboard/
├── hooks/            # Global custom hooks
├── lib/              # Third-party integrations
├── services/         # API clients
├── types/            # Global TypeScript types
└── utils/            # Pure utility functions
```

## FastAPI (Backend)

```
app/
├── routers/          # API route handlers
├── services/         # Business logic layer
├── repositories/     # Data access layer
├── schemas/          # Pydantic models
├── models/           # SQLAlchemy models
├── core/             # Config, security, deps
└── utils/            # Utility functions
```

## Nesting Depth (Max 4 levels)

```
ALLOWED (4 levels):
  src/features/auth/components/LoginForm.tsx

BLOCKED (5+ levels):
  src/features/dashboard/widgets/charts/line/LineChart.tsx
  -> Flatten to: src/features/dashboard/charts/LineChart.tsx
```

## No Barrel Files

```typescript
// BLOCKED: src/components/index.ts
export { Button } from './Button';

// GOOD: Import directly
import { Button } from '@/components/Button';
```

Barrel files break tree-shaking, cause circular dependencies, and slow builds.

**Incorrect — excessive nesting depth:**
```typescript
// 6 levels deep
src/features/dashboard/widgets/analytics/charts/line/LineChart.tsx
```

**Correct — flattened to maximum 4 levels:**
```typescript
// 4 levels, clear hierarchy
src/features/dashboard/charts/LineChart.tsx
```
