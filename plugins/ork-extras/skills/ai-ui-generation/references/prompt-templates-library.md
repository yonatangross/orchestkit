---
title: "AI UI Prompt Templates Library"
version: 1.0.0
---

# AI UI Prompt Templates Library

Copy-paste prompt templates for common component types. Each template includes framework, tokens, a11y, and state requirements. Customize the token names and specific requirements for your project.

## 1. Form Component

```
Generate a [form purpose] form component:

Framework: React 19 + TypeScript strict mode
Styling: Tailwind CSS v4 + shadcn/ui (Form, Input, Label, Button, Select)
Validation: zod schema + react-hook-form v7
Design tokens:
  - bg-card for form container, border-border for field borders
  - text-destructive for error messages, text-muted-foreground for hints
  - ring-ring for focus states
Accessibility:
  - <Label> linked to each input via htmlFor
  - aria-describedby pointing to error/hint text
  - aria-invalid="true" on fields with errors
  - aria-live="polite" region for form-level success/error
States: default, field-error (inline), form-error (banner), loading (disabled + spinner), success (toast)
Responsive: single column, max-w-lg centered
Submit: async handler returning { success: boolean; error?: string }
```

## 2. Data Table

```
Generate a data table component:

Framework: React 19 + TypeScript
Library: @tanstack/react-table v8
Styling: Tailwind CSS v4 + shadcn/ui (Table, Button, Input, DropdownMenu)
Features: sorting (multi-column), column filtering, global search, pagination (10/25/50 per page)
Design tokens:
  - bg-card for table container, border-border for cell borders
  - bg-muted/50 for header row, hover:bg-muted for row hover
  - text-muted-foreground for empty state text
Accessibility:
  - role="grid" with proper aria-sort on sortable columns
  - aria-label on action buttons, sr-only text for icon-only controls
  - Keyboard: arrow keys for cell navigation, Enter for sort
States: loading (skeleton rows), empty (illustration + message), error (retry banner)
Props: data: T[], columns: ColumnDef<T>[], onRowClick?: (row: T) => void
```

## 3. Dashboard Card

```
Generate a dashboard metric card component:

Framework: React 19 + TypeScript
Styling: Tailwind CSS v4 + shadcn/ui (Card, CardHeader, CardContent)
Design tokens:
  - bg-card, border-border for card container
  - text-muted-foreground for label, text-foreground for value
  - text-emerald-600 dark:text-emerald-400 for positive trend
  - text-destructive for negative trend
Content: icon (Lucide), label, value (formatted number), trend (% with arrow)
Accessibility: aria-label describing the full metric context
Animation: value count-up on mount using Motion
States: loading (skeleton), error (dash value), stale (muted opacity + "Updated 5m ago")
Responsive: full width on mobile, fixed 280px on desktop grid
```

## 4. Navigation Component

```
Generate a responsive navigation component:

Framework: React 19 + TypeScript + Next.js App Router
Styling: Tailwind CSS v4 + shadcn/ui (Sheet, Button, NavigationMenu)
Design tokens:
  - bg-background/95 backdrop-blur for sticky header
  - border-border for bottom border
  - text-foreground for links, text-primary for active link
Accessibility:
  - <nav aria-label="Main navigation">
  - aria-current="page" on active link
  - Mobile: Sheet with focus trap, Escape to close
  - Skip-to-content link as first focusable element
Responsive:
  - Desktop (>=1024px): horizontal nav with dropdown menus
  - Mobile (<1024px): hamburger icon → Sheet slide-in panel
States: default, mobile-open, dropdown-open
Links: [{label, href, children?: [{label, href}]}]
```

## 5. Modal / Dialog

```
Generate a confirmation dialog component:

Framework: React 19 + TypeScript
Styling: Tailwind CSS v4 + shadcn/ui (Dialog, Button)
Design tokens:
  - bg-background for dialog surface
  - bg-background/80 for overlay backdrop
  - text-destructive for destructive action variant
Accessibility:
  - Focus trap within dialog (shadcn/ui Dialog handles this)
  - aria-labelledby pointing to title, aria-describedby pointing to description
  - Escape key closes, click outside closes (configurable)
  - Return focus to trigger element on close
Props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant: "default" | "destructive"
States: default, loading (confirm button disabled + spinner), success (auto-close)
Animation: Motion scale + opacity entrance/exit
```

## 6. Empty State

```
Generate an empty state component:

Framework: React 19 + TypeScript
Styling: Tailwind CSS v4 + shadcn/ui (Button)
Design tokens:
  - text-muted-foreground for description
  - bg-muted for illustration container circle
Content: icon (Lucide, 48px), title, description, primary CTA button, optional secondary link
Accessibility: role="status" with aria-label summarizing the empty state
Props: icon: LucideIcon, title: string, description: string,
       action?: { label: string; onClick: () => void },
       secondaryAction?: { label: string; href: string }
Responsive: centered, max-w-md, 64px vertical padding
```

## Usage Notes

- Replace token names with your project's actual tokens
- Add project-specific imports (your `cn()` utility path, component library path)
- After generation, run through the review checklist (`rules/ai-review-checklist.md`)
- Refactor for design system conformance (`rules/ai-refactoring-conformance.md`)
