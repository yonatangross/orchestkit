# SkillForge Design System

## Overview

SkillForge uses a modern design system built on **Tailwind CSS v4** with **OKLCH color space** for perceptual uniformity and **CSS custom properties** for theme switching.

**Key Features:**
- OKLCH colors (perceptually uniform, wider gamut)
- Light/dark mode with automatic OS detection
- Teal accent color for brand identity
- Consistent typography using Outfit font
- Responsive spacing and component tokens

---

## Design Tokens

### Color Palette

All colors use **OKLCH** (Oklab Lightness, Chroma, Hue) for better perceptual uniformity than HSL.

```css
/* frontend/src/index.css */

/* Light Mode Colors */
:root {
  /* Base colors */
  --background: oklch(0.9911 0 0);           /* Near-white background */
  --foreground: oklch(0.2046 0 0);           /* Dark text */

  /* Primary (Teal accent) */
  --primary: oklch(0.8348 0.1302 160.9080);  /* Vibrant teal */
  --primary-foreground: oklch(0.2626 0.0147 166.4589); /* Dark teal for text */

  /* Muted backgrounds */
  --muted: oklch(0.9461 0 0);                /* Light gray */
  --muted-foreground: oklch(0.2435 0 0);     /* Medium dark text */

  /* Borders & inputs */
  --border: oklch(0.9037 0 0);               /* Light border */
  --input: oklch(0.9731 0 0);                /* Input background */

  /* Destructive (errors) */
  --destructive: oklch(0.5523 0.1927 32.7272); /* Red */
  --destructive-foreground: oklch(0.9934 0.0032 17.2118);
}

/* Dark Mode Colors */
.dark, [data-theme='dark'] {
  --background: oklch(0.1822 0 0);           /* Very dark gray */
  --foreground: oklch(0.9288 0.0126 255.5078); /* Light text */

  --primary: oklch(0.4365 0.1044 156.7556);  /* Darker teal */
  --primary-foreground: oklch(0.9213 0.0135 167.1556);

  --muted: oklch(0.2393 0 0);
  --muted-foreground: oklch(0.7122 0 0);

  --border: oklch(0.2809 0 0);
  --input: oklch(0.2603 0 0);
}
```

**Why OKLCH?**
- Perceptually uniform (same perceived brightness across hues)
- Wider color gamut than sRGB (future-proof for P3 displays)
- Predictable lightness adjustments (0.9 = very light, 0.2 = very dark)
- Easier to create accessible color pairs

### Typography

```css
/* Primary font family */
body {
  font-family: Outfit, sans-serif;
  letter-spacing: 0.025em;
}

/* Tailwind Typography Scale (configured in tailwind.config.js) */
text-xs    /* 0.75rem (12px) */
text-sm    /* 0.875rem (14px) */
text-base  /* 1rem (16px) - default */
text-lg    /* 1.125rem (18px) */
text-xl    /* 1.25rem (20px) */
text-2xl   /* 1.5rem (24px) */
text-3xl   /* 1.875rem (30px) */
text-4xl   /* 2.25rem (36px) */
```

**Usage:**
```tsx
<h1 className="text-4xl font-bold text-foreground">Heading</h1>
<p className="text-base text-muted-foreground">Body text</p>
```

### Spacing Scale

Tailwind's default spacing scale (0.25rem increments):

```css
0   /* 0px */
1   /* 0.25rem (4px) */
2   /* 0.5rem (8px) */
3   /* 0.75rem (12px) */
4   /* 1rem (16px) */
6   /* 1.5rem (24px) */
8   /* 2rem (32px) */
12  /* 3rem (48px) */
16  /* 4rem (64px) */
```

**Common patterns:**
- Small gaps: `gap-2` (8px)
- Medium padding: `p-4` (16px)
- Large margins: `mb-8` (32px)
- Section spacing: `py-12` (48px vertical)

### Border Radius

```css
/* Defined in Tailwind config */
--radius: 0.5rem;  /* Base radius (8px) */

/* Computed variants */
--radius-sm: calc(var(--radius) - 4px);  /* 4px */
--radius-md: calc(var(--radius) - 2px);  /* 6px */
--radius-lg: var(--radius);              /* 8px */
--radius-xl: calc(var(--radius) + 4px);  /* 12px */

/* Tailwind utilities */
rounded-sm   /* 4px */
rounded-md   /* 6px */
rounded-lg   /* 8px */
rounded-xl   /* 12px */
```

---

## Component Architecture

### Base Components (shadcn/ui)

SkillForge uses **shadcn/ui** components as primitives:

```
frontend/src/components/ui/
├── button.tsx          # Button variants
├── card.tsx            # Card container
├── badge.tsx           # Status badges
├── input.tsx           # Form inputs
├── textarea.tsx        # Multi-line input
├── dialog.tsx          # Modal dialogs
├── progress.tsx        # Progress bars
├── tabs.tsx            # Tab navigation
└── tooltip.tsx         # Hover tooltips
```

**Example: Button Component**

```tsx
// frontend/src/components/ui/button.tsx (simplified)
import { cn } from "@/lib/utils"

const buttonVariants = {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  },
}

export function Button({ variant = "default", size = "default", className, ...props }) {
  return (
    <button
      className={cn(buttonVariants.variant[variant], buttonVariants.size[size], className)}
      {...props}
    />
  )
}
```

**Usage:**
```tsx
<Button variant="default">Analyze URL</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon"><XIcon /></Button>
```

### Feature Components

Domain-specific components for SkillForge features:

```
frontend/src/features/
├── analysis/
│   └── components/
│       ├── AnalysisProgressCard.tsx   # Workflow status display
│       ├── AgentProgress.tsx          # Individual agent progress
│       └── ArtifactPreview.tsx        # Markdown preview
├── library/
│   └── components/
│       ├── LibraryGrid.tsx            # Grid of analyzed content
│       ├── AnalysisCard.tsx           # Card for single analysis
│       └── SearchBar.tsx              # Hybrid search input
└── tutor/
    └── components/
        ├── TutorInterface.tsx         # Socratic chat UI
        ├── MessageBubble.tsx          # Chat message
        └── QuestionSuggestions.tsx    # Suggested questions
```

**Example: Status Badge**

```tsx
// frontend/src/features/analysis/components/AnalysisProgressCard.tsx
import { Badge } from "@/components/ui/badge"

function StatusBadge({ status }: { status: string }) {
  const variants = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "default", label: "In Progress" },
    completed: { variant: "success", label: "Complete" },
    failed: { variant: "destructive", label: "Failed" },
  }

  const { variant, label } = variants[status] || variants.pending

  return <Badge variant={variant}>{label}</Badge>
}
```

---

## Theme Switching

### Implementation

```tsx
// frontend/src/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  setTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const root = document.documentElement

    // Remove previous theme classes
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

**Usage:**
```tsx
import { useTheme } from '@/contexts/ThemeContext'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
```

---

## Accessibility

### Color Contrast

All color pairs meet **WCAG 2.1 AA** standards:

| Combination | Contrast Ratio | Grade |
|-------------|----------------|-------|
| foreground / background | 16.5:1 | AAA |
| primary / primary-foreground | 8.2:1 | AAA |
| muted-foreground / background | 7.1:1 | AAA |
| destructive / destructive-foreground | 4.9:1 | AA |

**Testing:**
```bash
# Install contrast checker
npm install -D axe-core @axe-core/react

# Run automated tests
npm run test:a11y
```

### Focus States

All interactive elements have visible focus indicators:

```css
/* Automatically applied via Tailwind */
@layer base {
  * {
    @apply outline-ring/50;  /* Teal outline on focus */
  }
}
```

**Example:**
```tsx
<button className="focus:outline-2 focus:outline-offset-2 focus:outline-ring">
  Click me
</button>
```

### Screen Reader Support

Use semantic HTML and ARIA labels:

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label="Toggle theme"
  onClick={toggleTheme}
>
  <MoonIcon aria-hidden="true" />
</Button>
```

---

## Code Block Styling

SkillForge uses **dark code blocks** in both light and dark modes:

```css
/* frontend/src/index.css */

:root {
  /* Code blocks use dark theme in both modes */
  --code-bg: oklch(0.1822 0 0);           /* Dark background */
  --code-border: oklch(0.2809 0 0);       /* Subtle border */
  --code-header-bg: oklch(0.2393 0 0);    /* Header background */
  --code-text: oklch(0.8551 0 0);         /* Light text */
  --inline-code-bg: var(--muted);         /* Light inline code */
  --inline-code-text: oklch(0.5523 0.1302 32.7272); /* Red inline code */
}
```

**Usage in Markdown:**
````tsx
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

<ReactMarkdown
  components={{
    code({ inline, className, children }) {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{
            backgroundColor: 'var(--code-bg)',
            border: '1px solid var(--code-border)',
          }}
        >
          {String(children)}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-inline-code-bg text-inline-code-text px-1.5 py-0.5 rounded">
          {children}
        </code>
      )
    },
  }}
>
  {markdownContent}
</ReactMarkdown>
````

---

## Design Patterns

### Consistent Card Layout

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

function FeatureCard({ title, description, children }) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

### Loading States

```tsx
import { Skeleton } from "@/components/ui/skeleton"

function LoadingAnalysisCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />  {/* Title */}
        <Skeleton className="h-4 w-full mt-2" />  {/* Description */}
      </CardHeader>
      <CardContent>
        <Skeleton className="h-32 w-full" />  {/* Content */}
      </CardContent>
    </Card>
  )
}
```

### Empty States

```tsx
function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <BookOpenIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No analyses yet</h3>
      <p className="text-muted-foreground mb-6">
        Start by analyzing your first URL
      </p>
      <Button variant="default" asChild>
        <Link to="/analyze">Analyze URL</Link>
      </Button>
    </div>
  )
}
```

---

## Performance Considerations

### CSS-in-JS vs. Tailwind

SkillForge uses **Tailwind utility classes** for:
- Zero runtime cost (pre-compiled CSS)
- Automatic tree-shaking (only used utilities)
- Predictable bundle size (~10-20KB gzipped)

### Component Optimization

```tsx
import { memo } from 'react'

// Memoize expensive components
const AnalysisCard = memo(({ analysis }) => {
  return (
    <Card>
      {/* Card content */}
    </Card>
  )
}, (prev, next) => prev.analysis.id === next.analysis.id)
```

### Lazy Loading

```tsx
import { lazy, Suspense } from 'react'

const ArtifactPreview = lazy(() => import('./components/ArtifactPreview'))

function AnalysisDetail() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ArtifactPreview analysisId={id} />
    </Suspense>
  )
}
```

---

## References

- **Tailwind CSS v4 Docs**: https://tailwindcss.com/docs
- **OKLCH Color Picker**: https://oklch.com/
- **shadcn/ui Components**: https://ui.shadcn.com/
- **SkillForge Styles**: `frontend/src/index.css`
- **Component Library**: `frontend/src/components/ui/`
