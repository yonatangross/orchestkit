# OKLCH Theming (2026 Standard)

Modern perceptually uniform color space for shadcn/ui themes.

## Why OKLCH?

| Feature | OKLCH | HSL |
|---------|-------|-----|
| Perceptual uniformity | Yes | No |
| Wide gamut support | Yes | Limited |
| Predictable lightness | Yes | No |
| Dark mode conversion | Easier | Manual |

**Format**: `oklch(lightness chroma hue)`
- **Lightness**: 0 (black) to 1 (white)
- **Chroma**: 0 (gray) to ~0.4 (most saturated)
- **Hue**: 0-360 degrees

## Complete Theme Structure

```css
:root {
  /* Core semantic colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  /* Card/Popover */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  /* Primary brand color */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);

  /* Secondary */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  /* Muted/subdued */
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  /* Accent/highlight */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  /* Destructive/danger */
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  /* Borders and inputs */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Radius scale */
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);

  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}
```

## Tailwind Integration

```css
@theme inline {
  /* Map CSS variables to Tailwind utilities */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Radius scale */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

## Chart Colors

Data visualization with distinct OKLCH hues:

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);   /* Orange */
  --chart-2: oklch(0.6 0.118 184.704);     /* Teal */
  --chart-3: oklch(0.398 0.07 227.392);    /* Blue */
  --chart-4: oklch(0.828 0.189 84.429);    /* Yellow */
  --chart-5: oklch(0.769 0.188 70.08);     /* Amber */
}

.dark {
  --chart-1: oklch(0.488 0.243 264.376);   /* Indigo */
  --chart-2: oklch(0.696 0.17 162.48);      /* Cyan */
  --chart-3: oklch(0.769 0.188 70.08);      /* Amber */
  --chart-4: oklch(0.627 0.265 303.9);      /* Purple */
  --chart-5: oklch(0.645 0.246 16.439);     /* Red */
}
```

## Creating Custom Brand Colors

```css
/* Blue brand example */
:root {
  /* Primary blue - adjust lightness for variants */
  --primary: oklch(0.546 0.245 262.881);        /* Base blue */
  --primary-foreground: oklch(0.97 0.014 254.604);  /* Light text on blue */

  /* Derived variants */
  --primary-hover: oklch(0.496 0.245 262.881);  /* Darker for hover */
  --primary-muted: oklch(0.85 0.08 262.881);    /* Muted background */
}

.dark {
  --primary: oklch(0.707 0.165 254.624);        /* Lighter in dark mode */
  --primary-foreground: oklch(0.145 0 0);       /* Dark text */
}
```

## Sidebar-Specific Colors

```css
:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

## Converting from HSL

```
HSL: hsl(220, 70%, 50%)
    ↓
OKLCH: oklch(0.55 0.2 260)

Rough mapping:
- Lightness: HSL L% ÷ 100 ≈ OKLCH L
- Chroma: HSL S% × 0.003 ≈ OKLCH C (very rough)
- Hue: Similar but can shift
```

Use tools like [oklch.com](https://oklch.com) for accurate conversion.

## Accessibility Considerations

- Minimum contrast ratio: 4.5:1 for normal text
- Large text (18px+): 3:1 minimum
- OKLCH makes it easier to maintain contrast by adjusting lightness predictably
