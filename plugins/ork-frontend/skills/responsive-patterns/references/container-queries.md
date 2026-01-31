# Container Queries Reference

## Container Types

```css
/* Size queries (width/height) */
container-type: inline-size;  /* Query inline dimension */
container-type: size;         /* Query both dimensions */
container-type: normal;       /* No containment (default) */

/* Named container */
container-name: card;

/* Shorthand */
container: card / inline-size;
```

## Query Syntax

```css
/* Width queries */
@container (min-width: 400px) { }
@container (max-width: 399px) { }
@container (width > 400px) { }
@container (400px <= width <= 800px) { }

/* Named container queries */
@container card (min-width: 400px) { }

/* Logical properties */
@container (min-inline-size: 400px) { }
@container (min-block-size: 300px) { }
```

## Container Query Units

```css
/* Inline dimension (usually width) */
cqi  /* 1% of container inline size */

/* Block dimension (usually height) */
cqb  /* 1% of container block size */

/* Min/max of cqi and cqb */
cqmin
cqmax

/* Legacy (avoid - not logical) */
cqw  /* Container width */
cqh  /* Container height */
```

## Tailwind CSS Integration

```html
<!-- Enable container with @container -->
<div class="@container">
  <div class="flex flex-col @md:flex-row @lg:gap-8">
    <!-- Responsive to container, not viewport -->
  </div>
</div>

<!-- Named containers -->
<div class="@container/card">
  <div class="@lg/card:grid-cols-2">
    <!-- Queries the 'card' container -->
  </div>
</div>
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
```

## Best Practices

```css
/* ✅ Use logical units */
.card-title {
  font-size: clamp(1rem, 5cqi, 2rem);
  padding: 2cqi;
}

/* ✅ Nest containers carefully */
.outer {
  container: outer / inline-size;
}
.inner {
  container: inner / inline-size;
}
@container inner (min-width: 200px) { }

/* ❌ Don't query non-container */
.no-container {
  /* No container-type set */
}
@container (min-width: 400px) {
  /* This won't work! */
}
```

## Feature Detection

```css
@supports (container-type: inline-size) {
  .card-container {
    container-type: inline-size;
  }
}
```
