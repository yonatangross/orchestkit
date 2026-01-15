# Design Tokens Reference

Design tokens are the atomic design decisions that define your system's visual language.

## Token Categories

### 1. Color Tokens

**Primitive Colors** (Raw values):
```json
{
  "color": {
    "primitive": {
      "blue": {
        "50": "#eff6ff",
        "100": "#dbeafe",
        "200": "#bfdbfe",
        "300": "#93c5fd",
        "400": "#60a5fa",
        "500": "#3b82f6",
        "600": "#2563eb",
        "700": "#1d4ed8",
        "800": "#1e40af",
        "900": "#1e3a8a",
        "950": "#172554"
      }
    }
  }
}
```

**Semantic Colors** (Contextual meaning):
```json
{
  "color": {
    "semantic": {
      "brand": {
        "primary": "{color.primitive.blue.600}",
        "primary-hover": "{color.primitive.blue.700}",
        "primary-active": "{color.primitive.blue.800}"
      },
      "text": {
        "primary": "{color.primitive.gray.900}",
        "secondary": "{color.primitive.gray.600}",
        "tertiary": "{color.primitive.gray.500}",
        "disabled": "{color.primitive.gray.400}",
        "inverse": "{color.primitive.white}"
      },
      "background": {
        "primary": "{color.primitive.white}",
        "secondary": "{color.primitive.gray.50}",
        "tertiary": "{color.primitive.gray.100}"
      },
      "feedback": {
        "success": "{color.primitive.green.600}",
        "warning": "{color.primitive.yellow.600}",
        "error": "{color.primitive.red.600}",
        "info": "{color.primitive.blue.600}"
      }
    }
  }
}
```

**Accessibility Requirements**: Ensure color contrast ratios meet WCAG 2.1 Level AA:
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- UI components and graphics: 3:1 minimum

---

### 2. Typography Tokens

```json
{
  "typography": {
    "fontFamily": {
      "sans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "serif": "'Georgia', 'Times New Roman', serif",
      "mono": "'Fira Code', 'Courier New', monospace"
    },
    "fontSize": {
      "xs": "0.75rem",     // 12px
      "sm": "0.875rem",    // 14px
      "base": "1rem",      // 16px
      "lg": "1.125rem",    // 18px
      "xl": "1.25rem",     // 20px
      "2xl": "1.5rem",     // 24px
      "3xl": "1.875rem",   // 30px
      "4xl": "2.25rem",    // 36px
      "5xl": "3rem"        // 48px
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.25,
      "normal": 1.5,
      "relaxed": 1.75,
      "loose": 2
    },
    "letterSpacing": {
      "tight": "-0.025em",
      "normal": "0",
      "wide": "0.025em"
    }
  }
}
```

---

### 3. Spacing Tokens

**Scale**: Use a consistent spacing scale (commonly 4px or 8px base)

```json
{
  "spacing": {
    "0": "0",
    "1": "0.25rem",   // 4px
    "2": "0.5rem",    // 8px
    "3": "0.75rem",   // 12px
    "4": "1rem",      // 16px
    "5": "1.25rem",   // 20px
    "6": "1.5rem",    // 24px
    "8": "2rem",      // 32px
    "10": "2.5rem",   // 40px
    "12": "3rem",     // 48px
    "16": "4rem",     // 64px
    "20": "5rem",     // 80px
    "24": "6rem"      // 96px
  }
}
```

**Component-Specific Spacing**:
```json
{
  "component": {
    "button": {
      "padding-x": "{spacing.4}",
      "padding-y": "{spacing.2}",
      "gap": "{spacing.2}"
    },
    "card": {
      "padding": "{spacing.6}",
      "gap": "{spacing.4}"
    }
  }
}
```

---

### 4. Border Radius Tokens

```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.125rem",   // 2px
    "base": "0.25rem",  // 4px
    "md": "0.375rem",   // 6px
    "lg": "0.5rem",     // 8px
    "xl": "0.75rem",    // 12px
    "2xl": "1rem",      // 16px
    "full": "9999px"
  }
}
```

---

### 5. Shadow Tokens

```json
{
  "shadow": {
    "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "sm": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    "base": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    "md": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    "lg": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    "xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  }
}
```

---

## W3C Design Token Format

For interoperability, use W3C Design Tokens format. See `templates/design-tokens-template.json` for a complete example.

## Implementation with Tailwind

Use Tailwind's `@theme` directive to define tokens:

```css
@theme {
  --color-primary: #10b981;
  --color-primary-hover: #059669;
  --color-text-primary: #111827;
  --color-background: #f9fafb;
  --color-surface: #ffffff;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  /* ... */
}
```

Then use Tailwind utilities in components:
```tsx
<div className="bg-surface text-text-primary p-4">
  Content
</div>
```

**Important**: Components should use Tailwind utilities (`bg-primary`, `text-text-primary`) NOT CSS variables directly (`bg-[var(--color-primary)]`).