---
title: Advanced INP optimization with scheduler.yield and third-party script management
impact: CRITICAL
impactDescription: "43% of sites fail INP — the most commonly failed Core Web Vital"
tags: inp, scheduler-yield, long-tasks, third-party-scripts, layout-thrashing, requestAnimationFrame
---

# Advanced INP Optimization

Advanced patterns for Interaction to Next Paint — 43% of sites fail INP in 2026, making it the most commonly failed Core Web Vital.

## Common INP Culprits

Form submissions, dropdown opens, accordion expansions, and filter applications are the top offenders. Each involves synchronous DOM reads/writes that block the main thread.

## scheduler.yield() for Breaking Long Tasks

**Incorrect — long synchronous event handler blocks paint:**
```typescript
async function handleFilterApply(filters: Filter[]) {
  const results = applyAllFilters(data, filters); // 200ms+ blocking
  updateDOM(results);
  trackAnalytics('filter_applied', filters);
}
```

**Correct — yield between chunks to let browser paint:**
```typescript
async function handleFilterApply(filters: Filter[]) {
  // Yield after each filter category to keep INP < 150ms
  let results = data;
  for (const filter of filters) {
    results = applySingleFilter(results, filter);
    await scheduler.yield();
  }
  updateDOM(results);
  // Defer non-visual work
  await scheduler.yield();
  trackAnalytics('filter_applied', filters);
}
```

## Avoid Synchronous Layout Thrashing

**Incorrect — forced reflow in a loop:**
```typescript
function resizeCards(cards: HTMLElement[]) {
  cards.forEach(card => {
    const height = card.offsetHeight; // Read (forces layout)
    card.style.height = `${height + 20}px`; // Write (invalidates layout)
  });
}
```

**Correct — batch reads then batch writes:**
```typescript
function resizeCards(cards: HTMLElement[]) {
  // Batch all reads first
  const heights = cards.map(card => card.offsetHeight);
  // Then batch all writes
  requestAnimationFrame(() => {
    cards.forEach((card, i) => {
      card.style.height = `${heights[i] + 20}px`;
    });
  });
}
```

## Audit and Defer Third-Party Scripts

**Incorrect — blocking third-party scripts in critical path:**
```html
<head>
  <script src="https://analytics.example.com/tracker.js"></script>
  <script src="https://ads.example.com/loader.js"></script>
  <script src="/app.js"></script>
</head>
```

**Correct — defer third-party scripts after interaction readiness:**
```html
<head>
  <script src="/app.js"></script>
</head>
<body>
  <!-- Load third-party after first interaction or idle -->
  <script>
    const loadThirdParty = () => {
      const scripts = [
        'https://analytics.example.com/tracker.js',
        'https://ads.example.com/loader.js',
      ];
      scripts.forEach(src => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        document.body.appendChild(s);
      });
    };
    // Load on first interaction or after 3s, whichever comes first
    ['click', 'scroll', 'keydown'].forEach(evt =>
      addEventListener(evt, loadThirdParty, { once: true })
    );
    setTimeout(loadThirdParty, 3000);
  </script>
</body>
```

## requestAnimationFrame for Visual Updates

**Incorrect — updating DOM outside rAF causes jank:**
```typescript
function handleAccordionToggle(panel: HTMLElement) {
  panel.style.height = panel.scrollHeight + 'px'; // May miss frame
  panel.classList.toggle('open');
}
```

**Correct — schedule visual updates in rAF:**
```typescript
function handleAccordionToggle(panel: HTMLElement) {
  requestAnimationFrame(() => {
    panel.style.height = panel.scrollHeight + 'px';
    panel.classList.toggle('open');
  });
}
```

## Key Rules

1. **Use** `scheduler.yield()` between chunks — target < 50ms per task (supported in Chrome 129+, Firefox 135+; use `'scheduler' in globalThis && 'yield' in scheduler` feature detection with `setTimeout(resolve, 0)` fallback)
2. **Audit** third-party scripts — defer or lazy-load non-critical ones
3. **Batch** DOM reads before writes to avoid layout thrashing
4. **Wrap** visual DOM updates in `requestAnimationFrame`
5. **Profile** real user interactions (form submit, dropdown, accordion, filter) — not just page load
6. Target **<= 150ms** INP for 2026 thresholds
