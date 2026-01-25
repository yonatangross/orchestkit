# Project Structure Violations

Reference guide for common folder structure and import direction violations.

---

## 1. Excessive Nesting Depth

### Proper Pattern

```
src/
├── features/
│   └── dashboard/
│       └── charts/
│           └── LineChart.tsx    # 4 levels from src/ - ALLOWED
```

```typescript
// src/features/dashboard/charts/LineChart.tsx
// Flat structure with co-located components

import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import { useChartData } from './useChartData';

export function LineChart({ data }: LineChartProps) {
  const { processedData } = useChartData(data);
  return (
    <div className="chart-container">
      <svg>{/* chart rendering */}</svg>
      <ChartTooltip />
      <ChartLegend />
    </div>
  );
}
```

### Anti-Pattern (VIOLATION)

```
src/
├── features/
│   └── dashboard/
│       └── widgets/
│           └── charts/
│               └── line/
│                   └── LineChart.tsx    # 6 levels - VIOLATION!
│                   └── components/
│                       └── Tooltip.tsx  # 7 levels - VIOLATION!
```

```typescript
// src/features/dashboard/widgets/charts/line/components/Tooltip.tsx
// VIOLATION: 7 levels deep from src/

// Long import paths become unwieldy
import { formatNumber } from '../../../../../../utils/format';
import { theme } from '../../../../../../styles/theme';
```

### Why It Matters

- **Navigation Difficulty**: Deep nesting makes finding files tedious
- **Import Complexity**: Long relative paths like `../../../../../` are error-prone
- **Mental Overhead**: Developers struggle to track deep hierarchies
- **IDE Performance**: Some IDEs slow down with deeply nested structures

### Auto-Fix Suggestion

1. Flatten the structure by combining related levels:
   ```
   # Before (6 levels)
   src/features/dashboard/widgets/charts/line/LineChart.tsx

   # After (4 levels)
   src/features/dashboard/charts/LineChart.tsx
   ```

2. Co-locate related files instead of creating sub-directories:
   ```
   src/features/dashboard/charts/
   ├── LineChart.tsx
   ├── LineChartTooltip.tsx
   ├── LineChartLegend.tsx
   └── useLineChartData.ts
   ```

---

## 2. Barrel Files (index.ts Re-exports)

### Proper Pattern

```typescript
// Direct imports - each file imported explicitly
// src/app/page.tsx

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useLocalStorage } from '@/hooks/useLocalStorage';
```

### Anti-Pattern (VIOLATION)

```typescript
// VIOLATION: src/components/index.ts (barrel file)
export { Button } from './ui/Button';
export { Card } from './ui/Card';
export { Modal } from './ui/Modal';
export { Input } from './forms/Input';
export { Select } from './forms/Select';
export { Checkbox } from './forms/Checkbox';
// ... 50 more exports

// VIOLATION: src/hooks/index.ts (barrel file)
export { useAuth } from './useAuth';
export { useLocalStorage } from './useLocalStorage';
export { useDebounce } from './useDebounce';
// ... more exports

// Consumer code using barrel imports
// src/app/page.tsx
import { Button, Card } from '@/components';  // Imports ENTIRE barrel
import { useAuth } from '@/hooks';            // Imports ENTIRE barrel
```

### Why It Matters

- **Tree-Shaking Failure**: Bundlers import the entire barrel, not just used exports
- **Bundle Size**: Unused components still end up in production bundle
- **Build Performance**: Barrel files slow down build times significantly
- **Circular Dependencies**: Barrels create hidden circular import chains
- **HMR Slowdown**: Hot Module Replacement must process entire barrel on changes

### Auto-Fix Suggestion

1. Delete all `index.ts` files that only re-export
2. Update imports to use direct paths:
   ```typescript
   // Before (barrel import)
   import { Button, Card } from '@/components';

   // After (direct imports)
   import { Button } from '@/components/ui/Button';
   import { Card } from '@/components/ui/Card';
   ```
3. Configure ESLint to prevent barrel file creation:
   ```javascript
   // .eslintrc.js
   rules: {
     'no-restricted-imports': ['error', {
       patterns: ['**/index']
     }]
   }
   ```

---

## 3. Invalid Import Direction (Circular Architecture)

### Proper Pattern

```
Import direction flows ONE WAY:

shared/lib  -->  components  -->  features  -->  app
(lowest)                                       (highest)
```

```typescript
// CORRECT: src/features/auth/LoginForm.tsx
// Feature imports from lower layers only

import { Button } from '@/components/ui/Button';     // components -> features OK
import { Input } from '@/components/forms/Input';    // components -> features OK
import { validateEmail } from '@/lib/validation';    // lib -> features OK
import { useAuth } from './hooks/useAuth';           // same feature OK
```

```typescript
// CORRECT: src/components/ui/Button.tsx
// Component imports only from shared/lib layer

import { cn } from '@/lib/utils';                    // lib -> components OK
import type { ButtonVariant } from '@/types/ui';     // types -> components OK
```

### Anti-Pattern (VIOLATION)

```typescript
// VIOLATION: src/shared/utils.ts
// Shared layer importing from features layer

import { AUTH_CONFIG } from '@/features/auth/config';  // VIOLATION!
import { formatUserName } from '@/features/users/utils'; // VIOLATION!
```

```typescript
// VIOLATION: src/features/auth/useAuth.ts
// Feature importing from app layer

import { RootLayout } from '@/app/layout';           // VIOLATION!
import { metadata } from '@/app/page';               // VIOLATION!
```

```typescript
// VIOLATION: src/features/auth/useAuth.ts
// Cross-feature import (features should not import from each other)

import { DashboardContext } from '@/features/dashboard/context';  // VIOLATION!
import { useCart } from '@/features/cart/hooks/useCart';          // VIOLATION!
```

```typescript
// VIOLATION: src/components/ui/UserAvatar.tsx
// Component importing from features layer

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser'; // VIOLATION!
import { UserProfile } from '@/features/users/types';                   // VIOLATION!
```

### Why It Matters

- **Circular Dependencies**: Bi-directional imports create runtime errors
- **Build Failures**: Webpack/Vite cannot resolve circular module graphs
- **Code Splitting**: Circular deps prevent effective code splitting
- **Maintainability**: Tangled dependencies make refactoring impossible
- **Testing**: Cannot test components in isolation

### Auto-Fix Suggestion

1. **For shared/ importing from features/**:
   - Extract the needed code to `shared/` where it belongs
   ```typescript
   // Move features/auth/config.ts content to shared/config/auth.ts
   ```

2. **For features/ importing from app/**:
   - App layer should not export utilities; move to appropriate layer
   - If needed in feature, it belongs in `shared/` or `lib/`

3. **For cross-feature imports**:
   - Extract shared types/utilities to `shared/`:
   ```typescript
   // Before: features/auth imports from features/users
   // After: Extract to shared/types/user.ts
   // Both features import from shared/
   ```

4. **For components/ importing from features/**:
   - Component should receive data as props, not fetch it
   - Move hook usage to feature component that uses the UI component

---

## 4. Components in Wrong Directory

### Proper Pattern

```
src/
├── components/           # Reusable UI components
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   └── forms/
│       ├── Input.tsx
│       └── Select.tsx
├── features/             # Feature-specific components
│   └── auth/
│       └── components/
│           ├── LoginForm.tsx
│           └── RegisterForm.tsx
├── hooks/                # Global custom hooks
│   ├── useAuth.ts
│   └── useLocalStorage.ts
└── app/                  # Page components (Next.js)
    └── dashboard/
        └── page.tsx
```

### Anti-Pattern (VIOLATION)

```
src/
├── utils/
│   ├── Button.tsx       # VIOLATION: Component in utils/
│   └── formatDate.ts
├── services/
│   ├── Modal.tsx        # VIOLATION: Component in services/
│   └── api.ts
├── lib/
│   └── Dropdown.tsx     # VIOLATION: Component in lib/
├── hooks/
│   └── UserAvatar.tsx   # VIOLATION: Component in hooks/
└── components/
    ├── useAuth.ts       # VIOLATION: Hook in components/
    └── useFetch.ts      # VIOLATION: Hook in components/
```

### Why It Matters

- **Discoverability**: Developers expect components in `components/` or `features/`
- **Consistency**: Mixed purposes in directories creates confusion
- **Code Reviews**: Harder to enforce patterns with inconsistent structure
- **Tooling**: File generators and linters rely on predictable locations

### Auto-Fix Suggestion

| Current Location | Correct Location |
|------------------|------------------|
| `src/utils/Button.tsx` | `src/components/ui/Button.tsx` |
| `src/services/Modal.tsx` | `src/components/ui/Modal.tsx` |
| `src/lib/Dropdown.tsx` | `src/components/ui/Dropdown.tsx` |
| `src/hooks/UserAvatar.tsx` | `src/components/UserAvatar.tsx` |
| `src/components/useAuth.ts` | `src/hooks/useAuth.ts` |
| `src/components/useFetch.ts` | `src/hooks/useFetch.ts` |

**Detection Rules**:
- Files matching `*.tsx` with PascalCase names are React components
- Files matching `use*.ts` are custom hooks
- Components should be in `components/`, `features/*/components/`, or `app/`
- Hooks should be in `hooks/` or `features/*/hooks/`

---

## 5. Python Files in Wrong Layer Directories

### Proper Pattern

```
app/
├── routers/              # HTTP handlers only
│   ├── router_users.py
│   ├── router_auth.py
│   └── deps.py
├── services/             # Business logic only
│   ├── user_service.py
│   └── auth_service.py
├── repositories/         # Data access only
│   ├── user_repository.py
│   └── base_repository.py
├── schemas/              # Pydantic schemas only
│   ├── user_schema.py
│   └── auth_schema.py
└── models/               # SQLAlchemy models only
    ├── user_model.py
    └── base.py
```

### Anti-Pattern (VIOLATION)

```
app/
├── router_users.py       # VIOLATION: Router not in routers/
├── user_service.py       # VIOLATION: Service not in services/
├── routers/
│   ├── user_service.py   # VIOLATION: Service in routers/
│   └── user_repository.py # VIOLATION: Repository in routers/
├── services/
│   ├── router_auth.py    # VIOLATION: Router in services/
│   └── user_model.py     # VIOLATION: Model in services/
└── models/
    └── user_schema.py    # VIOLATION: Schema in models/
```

### Why It Matters

- **Architecture Clarity**: Each directory represents a distinct layer
- **Import Organization**: Clear layer boundaries prevent circular imports
- **Onboarding**: New developers understand the codebase faster
- **Refactoring**: Layer changes are isolated to specific directories

### Auto-Fix Suggestion

| Current Location | Correct Location |
|------------------|------------------|
| `app/router_users.py` | `app/routers/router_users.py` |
| `app/user_service.py` | `app/services/user_service.py` |
| `app/routers/user_service.py` | `app/services/user_service.py` |
| `app/routers/user_repository.py` | `app/repositories/user_repository.py` |
| `app/services/router_auth.py` | `app/routers/router_auth.py` |
| `app/services/user_model.py` | `app/models/user_model.py` |
| `app/models/user_schema.py` | `app/schemas/user_schema.py` |

---

## Quick Reference: Structure Rules

| Rule | Frontend (React/Next.js) | Backend (FastAPI) |
|------|--------------------------|-------------------|
| Max Nesting | 4 levels from `src/` | 4 levels from `app/` |
| Components | `components/`, `features/*/components/` | N/A |
| Hooks | `hooks/`, `features/*/hooks/` | N/A |
| Routers | N/A | `routers/router_*.py` |
| Services | `services/` (API clients) | `services/*_service.py` |
| Repositories | N/A | `repositories/*_repository.py` |
| Barrel Files | BLOCKED (index.ts) | N/A |

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