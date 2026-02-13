# Animation Presets Reference

Complete API reference for `frontend/src/lib/animations.ts`.

## Import

```typescript
import { 
  // Transitions
  transitions,
  
  // Basic animations
  fadeIn, fadeScale, scaleIn,
  
  // Slides
  slideInRight, slideInLeft, slideUp, slideDown,
  
  // Stagger
  staggerContainer, staggerContainerFast, staggerItem, staggerItemRight,
  
  // Modals
  modalBackdrop, modalContent, sheetContent,
  
  // Dropdowns
  dropdownDown, dropdownUp,
  
  // Pages
  pageFade, pageSlide,
  
  // Micro-interactions
  tapScale, hoverLift, buttonPress, cardHover,
  
  // Loading
  pulse, shimmer,
  
  // Toasts
  toastSlideIn,
  
  // Collapse
  collapse
} from '@/lib/animations';
```

---

## Transition Timings

### `transitions.fast`
- **Duration**: 150ms
- **Ease**: easeOut
- **Use for**: Button clicks, toggles, micro-interactions

### `transitions.normal`
- **Duration**: 200ms
- **Ease**: easeOut
- **Use for**: Default animations, fades, slides

### `transitions.slow`
- **Duration**: 300ms
- **Ease**: easeInOut
- **Use for**: Emphasis effects, page transitions

### `transitions.spring`
- **Type**: Spring
- **Stiffness**: 300
- **Damping**: 25
- **Use for**: Playful elements, bouncy effects

### `transitions.gentleSpring`
- **Type**: Spring
- **Stiffness**: 200
- **Damping**: 20
- **Use for**: Modals, overlays, subtle spring

---

## Basic Animations

### `fadeIn`
Simple opacity transition.

```tsx
<motion.div {...fadeIn}>Content</motion.div>
```

| State | Opacity | Duration |
|-------|---------|----------|
| initial | 0 | - |
| animate | 1 | 200ms |
| exit | 0 | 150ms |

### `fadeScale`
Opacity with subtle scale effect.

```tsx
<motion.div {...fadeScale}>Content</motion.div>
```

| State | Opacity | Scale |
|-------|---------|-------|
| initial | 0 | 0.95 |
| animate | 1 | 1 |
| exit | 0 | 0.95 |

### `scaleIn`
Prominent scale-in with spring animation.

```tsx
<motion.div {...scaleIn}>Badge</motion.div>
```

| State | Opacity | Scale | Transition |
|-------|---------|-------|------------|
| initial | 0 | 0.8 | - |
| animate | 1 | 1 | spring |
| exit | 0 | 0.8 | fast |

---

## Slide Animations

### `slideInRight` (RTL-Friendly)
Content slides in from right. Natural for Hebrew/RTL layouts.

```tsx
<motion.div {...slideInRight}>Hebrew Content</motion.div>
```

### `slideInLeft`
Content slides in from left. For LTR content in RTL context.

### `slideUp`
Content rises from bottom.

```tsx
<motion.div {...slideUp}>Card</motion.div>
```

### `slideDown`
Content drops from top.

```tsx
<motion.div {...slideDown}>Dropdown</motion.div>
```

---

## Stagger Animations

### `staggerContainer` + `staggerItem`
Parent-child pattern for animating lists.

```tsx
<motion.ul variants={staggerContainer} initial="initial" animate="animate">
  {items.map(item => (
    <motion.li key={item.id} variants={staggerItem}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

**staggerContainer**:
- `staggerChildren`: 50ms delay between items
- `delayChildren`: 100ms initial delay

**staggerItem**:
- Fade + slide up (y: 10 → 0)

### `staggerContainerFast`
Quick stagger for rapid lists.
- `staggerChildren`: 30ms
- `delayChildren`: 50ms

### `staggerItemRight`
RTL stagger variant. Slides from right.

---

## Modal Animations

### `modalBackdrop`
Dark overlay fade.

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div {...modalBackdrop} className="fixed inset-0 bg-black/50" />
  )}
</AnimatePresence>
```

### `modalContent`
Modal body animation with gentle spring.

```tsx
<motion.div {...modalContent} className="bg-white rounded-2xl p-6">
  Modal content
</motion.div>
```

| State | Opacity | Scale | Y |
|-------|---------|-------|---|
| initial | 0 | 0.95 | 10 |
| animate | 1 | 1 | 0 |
| exit | 0 | 0.95 | 10 |

### `sheetContent`
Mobile bottom sheet animation.

```tsx
<motion.div {...sheetContent} className="fixed bottom-0 bg-white">
  Sheet content
</motion.div>
```

---

## Dropdown Animations

### `dropdownDown`
Menu appearing below trigger.

```tsx
<motion.div {...dropdownDown} className="absolute top-full">
  Options...
</motion.div>
```

### `dropdownUp`
Menu appearing above trigger.

---

## Page Transitions

### `pageFade`
Simple page fade for route changes.

```tsx
<AnimatePresence mode="wait">
  <motion.div key={location.pathname} {...pageFade}>
    <Routes />
  </motion.div>
</AnimatePresence>
```

### `pageSlide`
RTL page slide (new pages enter from left).

---

## Micro-Interactions

### `tapScale`
Press feedback for buttons.

```tsx
<motion.button {...tapScale}>Click me</motion.button>
```

Effect: Scale to 0.97 on tap

### `hoverLift`
Subtle lift on hover for cards/list items.

```tsx
<motion.div {...hoverLift}>Hoverable</motion.div>
```

Effect: Y -2px + shadow

### `buttonPress`
Combined hover/tap for buttons.

```tsx
<motion.button {...buttonPress}>Action</motion.button>
```

Effect: Scale 1.02 on hover, 0.98 on tap

### `cardHover`
Card hover enhancement.

```tsx
<motion.div {...cardHover}>Card content</motion.div>
```

Effect: Y -4px + enhanced shadow

---

## Loading States

### `pulse`
Opacity pulse for skeleton loaders.

```tsx
<motion.div variants={pulse} initial="initial" animate="animate" className="bg-gray-200 rounded h-4" />
```

Effect: Opacity cycles 0.6 → 1 → 0.6 (1.5s, infinite)

### `shimmer`
Sliding highlight effect.

```tsx
<div className="relative overflow-hidden">
  <motion.div variants={shimmer} initial="initial" animate="animate" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
</div>
```

Effect: X slides -100% → 100% (1.5s, infinite)

---

## Toast/Notification

### `toastSlideIn`
Slide-in for toast notifications.

```tsx
<motion.div {...toastSlideIn}>Success!</motion.div>
```

Effect: Slides from right with spring + scale

---

## Collapse/Expand

### `collapse`
For accordions and expandable sections.

```tsx
<AnimatePresence>
  {isExpanded && (
    <motion.div {...collapse} className="overflow-hidden">
      Expandable content
    </motion.div>
  )}
</AnimatePresence>
```

**IMPORTANT**: Always use `overflow-hidden` on the animated element.

| State | Height | Opacity | Duration |
|-------|--------|---------|----------|
| initial | 0 | 0 | - |
| animate | auto | 1 | 200ms |
| exit | 0 | 0 | 150ms |

---

## Combining Presets

You can spread multiple presets:

```tsx
<motion.div {...cardHover} {...tapScale}>
  Interactive card
</motion.div>
```

---

## Custom Variants Extension

Extend presets for custom needs:

```typescript
const customFade = {
  ...fadeIn,
  animate: { 
    ...fadeIn.animate, 
    y: 0,
    transition: { duration: 0.5 } // Override
  },
};
```
