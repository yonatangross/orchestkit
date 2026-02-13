---
title: "Transitions: Shared Element Morph"
category: transitions
impact: MEDIUM
---

# Shared Element Transitions

Shared element animations between pages using `view-transition-name` for list-to-detail morphing.

## useViewTransitionState Hook

```tsx
import { useViewTransitionState, Link } from 'react-router';

function ProductCard({ product }: { product: Product }) {
  const isTransitioning = useViewTransitionState(`/products/${product.id}`);

  return (
    <Link to={`/products/${product.id}`} viewTransition>
      <img
        src={product.image}
        alt={product.name}
        style={{
          viewTransitionName: isTransitioning ? 'product-image' : undefined,
        }}
      />
    </Link>
  );
}

// On detail page, match the transition name
function ProductDetail({ product }: { product: Product }) {
  return (
    <img
      src={product.image}
      alt={product.name}
      style={{ viewTransitionName: 'product-image' }}
    />
  );
}
```

## Image Gallery with Shared Elements

```tsx
// Source page (list)
function ImageGallery({ images }: { images: Image[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((image) => (
        <Link
          key={image.id}
          to={`/image/${image.id}`}
          viewTransition
        >
          <img
            src={image.thumbnail}
            alt={image.alt}
            style={{ viewTransitionName: `image-${image.id}` }}
          />
        </Link>
      ))}
    </div>
  );
}

// Target page (detail)
function ImageDetail({ image }: { image: Image }) {
  return (
    <img
      src={image.fullSize}
      alt={image.alt}
      style={{ viewTransitionName: `image-${image.id}` }}
      className="w-full h-auto"
    />
  );
}
```

## CSS Pseudo-Element Customization

```css
/* Structure of view transition pseudo-elements */
::view-transition
  ::view-transition-group(root)
    ::view-transition-image-pair(root)
      ::view-transition-old(root)
      ::view-transition-new(root)
  ::view-transition-group(product-image)
    ::view-transition-image-pair(product-image)
      ::view-transition-old(product-image)
      ::view-transition-new(product-image)
```

```css
/* Customize specific elements */
::view-transition-group(product-image) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(product-image),
::view-transition-new(product-image) {
  /* Prevent default crossfade, use only movement */
  animation: none;
  mix-blend-mode: normal;
}
```

## CSS Feature Detection

```css
@supports (view-transition-name: none) {
  .card-image {
    view-transition-name: var(--transition-name);
  }
}
```

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Shared elements | CSS static names | JS dynamic | **CSS** for static, **JS** for dynamic lists |
| Animation duration | < 200ms | 200-400ms | **200-300ms** balance of UX and speed |
| Fallback | No animation | CSS fallback | **CSS fallback** animations |
| Reduced motion | Shorter animation | Instant | **Instant** (skip entirely) |

## Anti-Patterns

```tsx
// NEVER: Duplicate view-transition-name (must be unique per page)
<img style={{ viewTransitionName: 'image' }} />
<img style={{ viewTransitionName: 'image' }} /> // Breaks transition!

// NEVER: viewTransitionName on hidden elements
<div style={{ display: 'none', viewTransitionName: 'card' }} />

// NEVER: Static name for list items (use dynamic names)
{items.map(item => (
  <img style={{ viewTransitionName: 'item' }} /> // All same name!
))}
// CORRECT: Dynamic names
{items.map(item => (
  <img style={{ viewTransitionName: `item-${item.id}` }} />
))}
```
