---
title: Scroll-Driven Animations
impact: MEDIUM
impactDescription: "JavaScript-based scroll animations cause jank and battery drain — CSS Scroll-Driven Animations run on the compositor thread at guaranteed 60fps"
tags: scroll-driven, scroll-timeline, parallax, css-animations, progressive-enhancement
---

## Scroll-Driven Animations

Use CSS Scroll-Driven Animations API for performant, declarative scroll-linked effects without JavaScript.

**Incorrect — JavaScript scroll listener (jank-prone):**
```javascript
// WRONG: Scroll listeners run on main thread, cause jank
window.addEventListener('scroll', () => {
  const progress = window.scrollY / document.body.scrollHeight;
  progressBar.style.width = `${progress * 100}%`; // Layout thrashing!
  parallaxElement.style.transform = `translateY(${window.scrollY * 0.5}px)`;
});
```

**Correct — CSS Scroll-Driven Animations (compositor thread):**
```css
/* Reading progress bar — zero JavaScript */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: var(--color-primary);
  transform-origin: left;
  animation: grow-progress linear;
  animation-timeline: scroll(root block);
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* Reveal on scroll — element enters viewport */
.reveal-on-scroll {
  animation: fade-in-up linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Parallax section */
.parallax-bg {
  animation: parallax-shift linear;
  animation-timeline: scroll(root block);
}

@keyframes parallax-shift {
  from { transform: translateY(-20%); }
  to { transform: translateY(20%); }
}
```

**Progressive enhancement (required for browser support):**
```css
/* Feature detection — fallback for unsupported browsers */
@supports (animation-timeline: view()) {
  .reveal-on-scroll {
    animation: fade-in-up linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }
}

/* Fallback: IntersectionObserver in JavaScript */
@supports not (animation-timeline: view()) {
  .reveal-on-scroll {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.5s, transform 0.5s;
  }
  .reveal-on-scroll.visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Browser support:**
| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Scroll-Driven CSS | 115+ | 18.4+ | In dev | 115+ |
| `scroll()` function | 115+ | 18.4+ | In dev | 115+ |
| `view()` function | 115+ | 18.4+ | In dev | 115+ |

**Key rules:**
- CSS Scroll-Driven Animations run on compositor thread = guaranteed 60fps
- Always use `@supports (animation-timeline: view())` for progressive enhancement
- Use `scroll(root block)` for page-level progress, `view()` for element visibility
- `animation-range` controls when animation starts/ends relative to viewport
- Never use JavaScript scroll listeners for visual effects (use CSS or IntersectionObserver)
- Respect `prefers-reduced-motion` — disable parallax and motion effects
