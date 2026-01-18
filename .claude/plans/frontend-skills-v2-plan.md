# Frontend Skills Implementation Plan v2.0

**Issues**: #112 (render-optimization), #113 (shadcn-patterns), #114 (radix-primitives), #115 (vite-advanced), #116 (biome-linting)
**Parent Epic**: #81 (Frontend Skills Expansion)
**Research Date**: 2026-01-17
**Sources**: Context7, React.dev, Vite.dev, Biome.dev, TanStack Virtual, shadcn/ui

---

## Executive Summary

This plan incorporates 2026 best practices including:
- **React Compiler** (stable in React 19) - automatic memoization replacing manual useMemo/useCallback
- **Vite 7 Environment API** - multi-environment builds (client, SSR, edge)
- **Biome 2.0** - type inference, noFloatingPromises, 421 lint rules
- **shadcn/ui OKLCH** - modern color space for theming
- **TanStack Virtual** - industry standard for virtualization

---

## Skill 1: render-optimization

**Issue**: #112 | **Priority**: HIGH | **Token Budget**: ~1200

### SKILL.md Frontmatter
```yaml
name: render-optimization
description: React render performance patterns including React Compiler integration, memoization strategies, TanStack Virtual, and DevTools profiling. Use when debugging slow renders, optimizing large lists, or reducing unnecessary re-renders.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [react, performance, optimization, react-compiler, virtualization, memo, profiler]
```

### Directory Structure
```
skills/render-optimization/
├── SKILL.md                              # Overview + decision tree (~400 tokens)
├── references/
│   ├── react-compiler-migration.md       # React 19 Compiler adoption guide (~250 tokens)
│   ├── memoization-escape-hatches.md     # When useMemo/useCallback still needed (~200 tokens)
│   ├── tanstack-virtual-patterns.md      # Virtualization with variable heights (~250 tokens)
│   ├── state-colocation.md               # Moving state closer to consumers (~150 tokens)
│   └── devtools-profiler-workflow.md     # Finding bottlenecks with React DevTools (~150 tokens)
├── templates/
│   ├── virtualized-list.tsx              # TanStack Virtual list template (~150 tokens)
│   └── optimized-context.tsx             # Context splitting pattern (~100 tokens)
└── checklists/
    └── performance-audit.md              # Pre-deployment performance checklist (~100 tokens)
```

### Key Content Areas

#### SKILL.md Core Sections
1. **React Compiler Decision Tree** (2026 PRIMARY approach)
   - For new projects: Enable React Compiler (auto-memoization)
   - For existing: Profile first, migrate incrementally
   - DevTools shows "Memo ✨" badge when compiler is active

2. **When Manual Memoization Still Needed**
   - Effect dependencies that shouldn't change
   - Values passed to third-party libraries without compiler support
   - Precise control over memoization boundaries

3. **Virtualization Thresholds**
   - 100+ items: Consider virtualization
   - 1000+ items: Required virtualization
   - Variable heights: Use `measureElement` ref pattern

4. **State Colocation Principles**
   - State should live as close to where it's used as possible
   - Lift state only when truly needed for sibling communication
   - Context for cross-cutting concerns, not local state

#### references/react-compiler-migration.md
```markdown
# React Compiler Migration Guide (2026)

## Prerequisites
- React 19+
- Next.js 16+ (stable support) or Expo SDK 54+

## Quick Setup
// next.config.js
const nextConfig = {
  reactCompiler: true,
}

## Verification
Open React DevTools → Components tab
Look for "Memo ✨" badge on components

## What Gets Optimized
- Component re-renders
- Intermediate values (like useMemo)
- Callback references (like useCallback)
- JSX elements

## Migration Checklist
□ Ensure code follows Rules of React
□ Components are idempotent (same input = same output)
□ Props/state treated as immutable
□ Side effects outside render
□ Enable compiler, test thoroughly
□ Remove redundant useMemo/useCallback gradually
```

#### references/tanstack-virtual-patterns.md
```markdown
# TanStack Virtual Patterns (v3)

## Basic Setup
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  overscan: 5, // Render 5 extra items for smooth scrolling
})

## Variable Height Pattern
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: (i) => rows[i].estimatedHeight,
  overscan: 5,
})

// Use measureElement for dynamic heights
{rowVirtualizer.getVirtualItems().map((virtualRow) => (
  <div
    key={virtualRow.key}
    ref={rowVirtualizer.measureElement}
    data-index={virtualRow.index}
    style={{
      position: 'absolute',
      transform: `translateY(${virtualRow.start}px)`,
    }}
  >
    {children}
  </div>
))}

## Grid Virtualization
Use two virtualizers: rowVirtualizer + columnVirtualizer
```

---

## Skill 2: shadcn-patterns

**Issue**: #113 | **Priority**: HIGH | **Token Budget**: ~1400

### SKILL.md Frontmatter
```yaml
name: shadcn-patterns
description: shadcn/ui component patterns including CVA variants, OKLCH theming, cn() utility, and composition. Use when adding shadcn components, building variant systems, or customizing themes.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [shadcn, ui, cva, variants, tailwind, theming, oklch, components]
```

### Directory Structure
```
skills/shadcn-patterns/
├── SKILL.md                              # Overview + CVA quick reference (~450 tokens)
├── references/
│   ├── cva-variant-system.md             # CVA patterns + compound variants (~300 tokens)
│   ├── oklch-theming.md                  # Modern color space theming (~250 tokens)
│   ├── cn-utility-patterns.md            # tailwind-merge + clsx patterns (~150 tokens)
│   ├── component-extension.md            # Extending shadcn components (~200 tokens)
│   └── dark-mode-toggle.md               # next-themes integration (~150 tokens)
├── templates/
│   ├── cva-component.tsx                 # CVA-based component template (~150 tokens)
│   ├── custom-theme.css                  # OKLCH theme variables (~200 tokens)
│   └── extended-button.tsx               # Extended Button example (~100 tokens)
└── checklists/
    └── shadcn-setup.md                   # Installation + configuration checklist (~100 tokens)
```

### Key Content Areas

#### SKILL.md Core Sections
1. **CVA (Class Variance Authority) Pattern**
   - Declarative variant definitions
   - Type-safe variant props
   - compoundVariants for combinations
   - defaultVariants for sensible defaults

2. **OKLCH Color Space (2026 Standard)**
   - Perceptually uniform colors
   - Better dark mode contrast
   - Easier color manipulation
   - Format: `oklch(lightness chroma hue)`

3. **cn() Utility Pattern**
   - Combines clsx + tailwind-merge
   - Resolves Tailwind class conflicts
   - Enables conditional classes

4. **Component Extension Strategy**
   - Wrap, don't modify source
   - Use forwardRef properly
   - Maintain CVA variant system

#### references/cva-variant-system.md
```markdown
# CVA Variant System

## Basic Pattern
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    // Compound variants for combinations
    compoundVariants: [
      {
        variant: 'outline',
        size: 'lg',
        className: 'border-2', // Thicker border for large outline
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

## Type-Safe Props
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

## Usage
<Button variant="destructive" size="lg">Delete</Button>
```

#### references/oklch-theming.md
```markdown
# OKLCH Theming (2026 Standard)

## Why OKLCH?
- Perceptually uniform (equal steps look equal)
- Wide gamut support
- Better accessibility contrast
- Easier programmatic manipulation

## CSS Variables Structure
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --border: oklch(0.269 0 0);
}

## Tailwind Integration
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
}

## Chart Colors (Data Visualization)
--chart-1: oklch(0.646 0.222 41.116);  /* Orange */
--chart-2: oklch(0.6 0.118 184.704);    /* Teal */
--chart-3: oklch(0.398 0.07 227.392);   /* Blue */
```

#### templates/custom-theme.css
```css
/* Custom OKLCH Theme Template */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Semantic Colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.13 0.028 261.692);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.13 0.028 261.692);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.13 0.028 261.692);

  /* Brand Colors */
  --primary: oklch(0.546 0.245 262.881);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.967 0.003 264.542);
  --secondary-foreground: oklch(0.21 0.034 264.665);

  /* State Colors */
  --muted: oklch(0.967 0.003 264.542);
  --muted-foreground: oklch(0.551 0.027 264.364);
  --accent: oklch(0.967 0.003 264.542);
  --accent-foreground: oklch(0.21 0.034 264.665);
  --destructive: oklch(0.577 0.245 27.325);

  /* Borders & Focus */
  --border: oklch(0.928 0.006 264.531);
  --input: oklch(0.928 0.006 264.531);
  --ring: oklch(0.707 0.022 261.325);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.13 0.028 261.692);
  --foreground: oklch(0.985 0.002 247.839);
  --primary: oklch(0.707 0.165 254.624);
  --border: oklch(1 0 0 / 10%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Skill 3: radix-primitives

**Issue**: #114 | **Priority**: HIGH | **Token Budget**: ~1200

### SKILL.md Frontmatter
```yaml
name: radix-primitives
description: Radix UI unstyled accessible primitives for dialogs, popovers, dropdowns, and more. Use when building custom accessible components, understanding shadcn internals, or needing polymorphic composition.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [radix, ui, primitives, accessibility, dialog, popover, dropdown, aschild, a11y]
```

### Directory Structure
```
skills/radix-primitives/
├── SKILL.md                              # Overview + primitives catalog (~400 tokens)
├── references/
│   ├── aschild-composition.md            # Polymorphic rendering pattern (~250 tokens)
│   ├── dialog-modal-patterns.md          # Dialog, AlertDialog, Sheet (~250 tokens)
│   ├── dropdown-menu-patterns.md         # Menu, ContextMenu, Select (~200 tokens)
│   ├── popover-tooltip-patterns.md       # Popover, Tooltip, HoverCard (~200 tokens)
│   └── focus-management.md               # Focus trap, return, keyboard nav (~150 tokens)
├── templates/
│   ├── custom-dialog.tsx                 # Abstracted Dialog with overlay (~150 tokens)
│   ├── custom-dropdown.tsx               # Dropdown with indicators (~150 tokens)
│   └── composed-trigger.tsx              # Tooltip + Dialog composition (~100 tokens)
└── checklists/
    └── accessibility-audit.md            # WCAG compliance for Radix (~100 tokens)
```

### Key Content Areas

#### SKILL.md Core Sections
1. **Primitives Catalog**
   - **Overlay**: Dialog, AlertDialog, Sheet
   - **Popover**: Popover, Tooltip, HoverCard, ContextMenu
   - **Menu**: DropdownMenu, Menubar, NavigationMenu
   - **Form**: Select, RadioGroup, Checkbox, Switch, Slider
   - **Disclosure**: Accordion, Collapsible, Tabs

2. **asChild Pattern** (Core Concept)
   - Polymorphic component rendering
   - No wrapper div pollution
   - Merge props and refs with child
   - Foundation of shadcn Button, Link patterns

3. **Built-in Accessibility**
   - Keyboard navigation (arrow keys, escape, enter)
   - Focus management (trap, return, visible focus)
   - ARIA attributes (role, aria-expanded, aria-controls)
   - Screen reader announcements

4. **Styling Strategy**
   - Unstyled by default (BYO styles)
   - Data attributes for state ([data-state="open"])
   - CSS selectors or Tailwind arbitrary variants

#### references/aschild-composition.md
```markdown
# asChild Composition Pattern

## What is asChild?
Renders children as the component itself, merging props and ref.
Avoids extra wrapper divs while preserving functionality.

## Basic Usage
// Instead of wrapping
<Button>
  <Link href="/about">About</Link>
</Button>

// Compose with asChild
<Button asChild>
  <Link href="/about">About</Link>
</Button>

## Under the Hood
- Uses Radix's Slot component
- Merges event handlers (both onClick fire)
- Forwards refs to child
- Combines classNames

## Nested Composition
import { Dialog, Tooltip } from 'radix-ui'

const MyButton = React.forwardRef((props, ref) => (
  <button {...props} ref={ref} />
))

// Combine Tooltip + Dialog triggers
<Dialog.Root>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <Dialog.Trigger asChild>
        <MyButton>Open dialog</MyButton>
      </Dialog.Trigger>
    </Tooltip.Trigger>
    <Tooltip.Portal>...</Tooltip.Portal>
  </Tooltip.Root>
  <Dialog.Portal>...</Dialog.Portal>
</Dialog.Root>

## When to Use asChild
✓ Rendering a link as a button
✓ Combining multiple triggers
✓ Using custom elements with Radix behavior
✓ Avoiding DOM nesting issues

## When NOT to Use
✗ When you need the default element
✗ When composition adds complexity without benefit
```

#### templates/custom-dialog.tsx
```tsx
// Abstracted Dialog with built-in Overlay and Close
import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Cross1Icon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 bg-black/50 data-[state=open]:animate-in',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out'
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-background rounded-lg shadow-lg p-6',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        <Cross1Icon className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
```

---

## Skill 4: vite-advanced

**Issue**: #115 | **Priority**: HIGH | **Token Budget**: ~1400

### SKILL.md Frontmatter
```yaml
name: vite-advanced
description: Advanced Vite 7+ patterns including Environment API, plugin development, SSR configuration, library mode, and build optimization. Use when customizing build pipelines, creating plugins, or configuring multi-environment builds.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [vite, build, bundler, plugins, ssr, library-mode, environment-api, optimization]
```

### Directory Structure
```
skills/vite-advanced/
├── SKILL.md                              # Overview + Environment API intro (~450 tokens)
├── references/
│   ├── environment-api.md                # Vite 7 multi-environment builds (~300 tokens)
│   ├── plugin-development.md             # Plugin hooks, transform, virtual modules (~300 tokens)
│   ├── ssr-configuration.md              # SSR middleware + production setup (~250 tokens)
│   ├── library-mode.md                   # Building publishable packages (~200 tokens)
│   └── chunk-optimization.md             # Manual chunks, analyze, tree-shaking (~200 tokens)
├── templates/
│   ├── multi-environment-config.ts       # Client + SSR + Edge config (~150 tokens)
│   ├── custom-plugin.ts                  # Plugin template with hooks (~150 tokens)
│   └── library-config.ts                 # Library build config (~100 tokens)
└── checklists/
    └── production-build.md               # Build optimization checklist (~100 tokens)
```

### Key Content Areas

#### SKILL.md Core Sections
1. **Vite 7 Environment API** (Major 2026 Feature)
   - Multi-environment builds: client, SSR, edge, workers
   - Each environment has own module graph, config, plugins
   - `createBuilder` API for coordinated builds
   - Framework agnostic SSR support

2. **Plugin Development**
   - Hook lifecycle: configResolved → buildStart → transform → buildEnd
   - `perEnvironmentPlugin` helper for env-specific plugins
   - Virtual modules for generated code
   - Hot module replacement integration

3. **SSR Configuration**
   - Development: Vite dev server in middleware mode
   - Production: Separate client + server builds
   - `transformIndexHtml` for HMR injection
   - ModuleRunner for server-side module execution

4. **Build Optimization**
   - Manual chunks for vendor splitting
   - `build.target: 'baseline-widely-available'` (Vite 7 default)
   - Tree-shaking with sideEffects hints
   - Bundle analysis with rollup-plugin-visualizer

#### references/environment-api.md
```markdown
# Vite 7 Environment API

## Concept
Until Vite 5, there were two implicit environments (client, ssr).
Vite 6+ formalizes environments as a first-class concept.
Vite 7 adds `buildApp` hook for coordinated multi-environment builds.

## Configuration
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: false, // Inherited by all environments
  },
  environments: {
    // Client (browser)
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
      },
    },
    // SSR (Node.js)
    ssr: {
      build: {
        outDir: 'dist/server',
        target: 'node20',
        rollupOptions: {
          output: { format: 'esm' },
        },
      },
    },
    // Edge (Cloudflare Workers, etc.)
    edge: {
      resolve: {
        noExternal: true,
        conditions: ['edge', 'worker'],
      },
      build: {
        outDir: 'dist/edge',
        rollupOptions: {
          external: ['cloudflare:workers'],
        },
      },
    },
  },
})

## Accessing Environments in Plugins
export function myPlugin() {
  return {
    name: 'my-plugin',
    transform(code, id) {
      // this.environment available in all hooks
      if (this.environment.name === 'ssr') {
        // SSR-specific transform
      }
    },
  }
}

## Builder API (Coordinated Builds)
import { createBuilder } from 'vite'

const builder = await createBuilder(config)
await builder.build() // Build all environments in parallel
await builder.close()

## Real-World: Cloudflare Workers
The Cloudflare Vite plugin uses Environment API to integrate
Workers runtime directly with Vite dev server.
```

#### templates/multi-environment-config.ts
```typescript
// vite.config.ts - Multi-Environment Configuration
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'baseline-widely-available', // Vite 7 default
  },

  environments: {
    // Browser client
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              router: ['react-router-dom'],
            },
          },
        },
      },
    },

    // Node.js SSR
    ssr: {
      build: {
        outDir: 'dist/server',
        ssr: 'src/entry-server.tsx',
        target: 'node20',
      },
    },

    // Edge runtime (optional)
    edge: {
      resolve: {
        noExternal: true,
        conditions: ['edge', 'worker', 'browser'],
      },
      build: {
        outDir: 'dist/edge',
        rollupOptions: {
          external: ['node:*'],
        },
      },
    },
  },
})
```

---

## Skill 5: biome-linting

**Issue**: #116 | **Priority**: MEDIUM | **Token Budget**: ~1000

### SKILL.md Frontmatter
```yaml
name: biome-linting
description: Biome 2.0+ linting and formatting for fast, unified code quality. Includes type inference, ESLint migration, CI integration, and 421 lint rules. Use when migrating from ESLint/Prettier or setting up new projects.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [biome, linting, formatting, eslint-migration, ci, code-quality, typescript]
```

### Directory Structure
```
skills/biome-linting/
├── SKILL.md                              # Overview + quick config (~350 tokens)
├── references/
│   ├── eslint-migration.md               # Step-by-step migration guide (~250 tokens)
│   ├── biome-json-config.md              # Full configuration options (~250 tokens)
│   ├── type-aware-rules.md               # Biome 2.0 type inference rules (~200 tokens)
│   └── ci-integration.md                 # GitHub Actions, pre-commit (~150 tokens)
├── templates/
│   ├── biome.json                        # Production-ready config (~150 tokens)
│   ├── biome-strict.json                 # Strict config for new projects (~100 tokens)
│   └── github-action.yml                 # CI workflow template (~100 tokens)
└── checklists/
    └── migration-checklist.md            # ESLint → Biome migration steps (~100 tokens)
```

### Key Content Areas

#### SKILL.md Core Sections
1. **Why Biome in 2026**
   - 10-25x faster than ESLint + Prettier
   - Single binary (vs 127+ npm packages)
   - One config file (vs 4+ files)
   - 421 lint rules from ESLint, typescript-eslint, unicorn, jsx-a11y

2. **Biome 2.0 Features**
   - Type inference (reads .d.ts from node_modules)
   - `noFloatingPromises` rule (85% coverage vs typescript-eslint)
   - Multi-file analysis
   - Linter plugins (GritQL-based, limited scope)

3. **Migration Strategy**
   - `biome migrate eslint` reads existing config
   - Handles both legacy and flat ESLint configs
   - Map custom rules to Biome equivalents
   - Gradual adoption with `overrides`

4. **CI Integration**
   - GitHub Actions: `biomejs/setup-biome@v2`
   - Pre-commit with lefthook or husky
   - IDE setup: VSCode, Neovim LSP

#### references/eslint-migration.md
```markdown
# ESLint to Biome Migration (2026)

## Quick Migration
npx @biomejs/biome migrate eslint --write

This reads your .eslintrc or eslint.config.js and creates biome.json.

## Manual Steps

### 1. Install Biome
npm install --save-dev --save-exact @biomejs/biome

### 2. Initialize Config
npx @biomejs/biome init

### 3. Map Common Rules
ESLint                    → Biome
no-unused-vars            → correctness/noUnusedVariables
no-console                → suspicious/noConsole (nursery)
@typescript-eslint/...    → Most rules supported
eslint-plugin-react       → Most rules supported
eslint-plugin-jsx-a11y    → Most rules supported

### 4. Run Both in Parallel (Transition Period)
{
  "scripts": {
    "lint": "biome check .",
    "lint:legacy": "eslint .",
    "lint:compare": "npm run lint && npm run lint:legacy"
  }
}

### 5. Remove ESLint When Ready
npm uninstall eslint @typescript-eslint/eslint-plugin ...
rm .eslintrc* eslint.config.* .eslintignore

## Handling Unsupported Rules
Use `overrides` to disable Biome for specific files:
{
  "overrides": [
    {
      "include": ["legacy/**"],
      "linter": { "enabled": false }
    }
  ]
}
```

#### templates/biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noVar": "error",
        "useConst": "warn",
        "useTemplate": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsole": "warn"
      },
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "build",
      ".next",
      "coverage"
    ]
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

#### templates/github-action.yml
```yaml
name: Code Quality

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Biome
        uses: biomejs/setup-biome@v2
        with:
          version: latest

      - name: Run Biome
        run: biome ci .
```

---

## Implementation Order

Based on dependencies and value:

| Order | Skill | Rationale |
|-------|-------|-----------|
| 1 | **radix-primitives** | Foundation for shadcn understanding |
| 2 | **shadcn-patterns** | High-value, uses Radix concepts |
| 3 | **render-optimization** | Independent, high impact |
| 4 | **vite-advanced** | Independent, Vite 7 features |
| 5 | **biome-linting** | Lower priority, standalone |

---

## Token Budget Summary

| Skill | SKILL.md | References | Templates | Checklists | Total |
|-------|----------|------------|-----------|------------|-------|
| render-optimization | ~400 | ~1000 | ~250 | ~100 | ~1750 |
| shadcn-patterns | ~450 | ~1050 | ~450 | ~100 | ~2050 |
| radix-primitives | ~400 | ~1050 | ~400 | ~100 | ~1950 |
| vite-advanced | ~450 | ~1250 | ~400 | ~100 | ~2200 |
| biome-linting | ~350 | ~850 | ~350 | ~100 | ~1650 |
| **TOTAL** | | | | | **~9600** |

---

## Cross-References

```
render-optimization
├── uses: TanStack Virtual (virtualization)
├── relates: react-server-components-framework
└── relates: focus-management (a11y with virtualized lists)

shadcn-patterns
├── builds-on: radix-primitives (asChild, accessibility)
├── integrates: design-system-starter (tokens → OKLCH)
├── integrates: motion-animation-patterns (tw-animate-css)
└── uses: biome-linting (code quality)

radix-primitives
├── foundation-for: shadcn-patterns
├── integrates: focus-management (keyboard nav)
├── relates: a11y-testing (axe-core validation)
└── relates: motion-animation-patterns (data-state animations)

vite-advanced
├── relates: biome-linting (build tooling)
├── relates: e2e-testing (Playwright + Vite)
├── relates: react-server-components-framework (SSR)
└── relates: edge-computing-patterns (Edge environment)

biome-linting
├── relates: vite-advanced (dev tooling)
├── relates: code-review-playbook (quality gates)
├── relates: ci-cd-engineer (pipeline integration)
└── replaces: ESLint + Prettier (legacy)
```

---

## Sources

- [React Compiler Introduction](https://react.dev/learn/react-compiler/introduction)
- [React 19 Memoization](https://dev.to/joodi/react-19-memoization-is-usememo-usecallback-no-longer-necessary-3ifn)
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7)
- [Vite Environment API](https://vite.dev/guide/api-environment)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [CVA Documentation](https://cva.style/docs)
- [Radix Primitives Documentation](https://www.radix-ui.com/primitives/docs)
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest/docs)
- [Biome 2.0 Announcement](https://biomejs.dev/blog/biome-v2/)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Biome vs ESLint 2025](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/)
