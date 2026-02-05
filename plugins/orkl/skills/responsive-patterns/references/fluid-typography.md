# Fluid Typography Reference

## The clamp() Formula

```css
/* Syntax: clamp(min, preferred, max) */
font-size: clamp(1rem, 0.5rem + 2vw, 2rem);

/* Breakdown:
   min: 1rem (16px at default)
   preferred: 0.5rem + 2vw (scales with viewport)
   max: 2rem (32px at default)
*/
```

## Accessible Fluid Scale

```css
:root {
  /* Always include rem to respect user preferences */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1rem + 1.25vw, 1.75rem);
  --text-2xl: clamp(1.5rem, 1rem + 2.5vw, 2.5rem);
  --text-3xl: clamp(1.875rem, 1rem + 4.375vw, 3.5rem);
  --text-4xl: clamp(2.25rem, 1rem + 6.25vw, 4.5rem);
}

h1 { font-size: var(--text-4xl); }
h2 { font-size: var(--text-3xl); }
h3 { font-size: var(--text-2xl); }
h4 { font-size: var(--text-xl); }
p { font-size: var(--text-base); }
small { font-size: var(--text-sm); }
```

## Container-Based Fluid Type

```css
/* For component-scoped scaling */
.card {
  container-type: inline-size;
}

.card-title {
  /* Scales with card width, not viewport */
  font-size: clamp(1rem, 0.5rem + 5cqi, 1.75rem);
}

.card-body {
  font-size: clamp(0.875rem, 0.5rem + 3cqi, 1rem);
}
```

## Calculating Fluid Values

```
Target: 16px at 320px viewport → 24px at 1200px viewport

Formula:
preferred = min + (max - min) × (viewport - min-viewport) / (max-viewport - min-viewport)

Step 1: Convert to vw
  (24 - 16) / (1200 - 320) = 8 / 880 = 0.909% per px
  0.909 × 100 = 0.909vw

Step 2: Calculate rem offset
  At 320px: 16px = 1rem
  16 - (320 × 0.00909) = 16 - 2.91 = 13.09px ≈ 0.818rem

Result:
font-size: clamp(1rem, 0.818rem + 0.909vw, 1.5rem);
```

## Accessibility Considerations

```css
/* ❌ WRONG: Ignores user font preferences */
font-size: 5vw;

/* ❌ WRONG: Completely overrides user settings */
font-size: 16px;

/* ✅ CORRECT: Respects user preferences while scaling */
font-size: clamp(1rem, 0.5rem + 2vw, 2rem);

/* The rem portion ensures user's font-size preference
   is always a factor in the final size */
```

## Line Height Scaling

```css
/* Tighter line-height for larger text */
h1 {
  font-size: clamp(2rem, 1rem + 5vw, 4rem);
  line-height: clamp(1.1, 1.4 - 0.2vw, 1.3);
}

p {
  font-size: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  line-height: 1.6; /* Static is fine for body */
}
```

## Tools

- [Utopia.fyi](https://utopia.fyi/type/calculator) - Fluid type scale generator
- [Fluid Type Scale](https://www.fluid-type-scale.com/) - Calculate clamp values
