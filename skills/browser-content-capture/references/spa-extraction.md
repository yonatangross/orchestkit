# SPA Content Extraction

Patterns for extracting content from JavaScript-rendered Single Page Applications.

## Table of Contents

1. [Why SPAs Are Different](#why-spas-are-different)
2. [Detection Patterns](#detection-patterns)
3. [React Extraction](#react-extraction)
4. [Vue Extraction](#vue-extraction)
5. [Angular Extraction](#angular-extraction)
6. [Generic SPA Patterns](#generic-spa-patterns)

---

## Why SPAs Are Different

Traditional scrapers fail on SPAs because:

1. **Initial HTML is empty** - Content loads via JavaScript
2. **Hydration timing** - React/Vue must "hydrate" before content is interactive
3. **Client-side routing** - URLs change without page reloads
4. **Lazy loading** - Content loads as user scrolls
5. **API-driven** - Data fetched from backend after page load

**Solution:** Use browser automation to wait for JavaScript execution.

---

## Detection Patterns

### Identify SPA Framework

```javascript
// Check for React
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined
document.querySelector('[data-reactroot]') !== null

// Check for Vue
window.__VUE__ !== undefined
document.querySelector('[data-v-]') !== null

// Check for Angular
window.ng !== undefined
document.querySelector('[ng-version]') !== null

// Check for Next.js
document.querySelector('#__next') !== null

// Check for Nuxt
document.querySelector('#__nuxt') !== null
```

### Detect Loading State

```javascript
// Common loading indicators
document.querySelector('.loading') !== null
document.querySelector('.spinner') !== null
document.querySelector('[aria-busy="true"]') !== null

// Skeleton screens
document.querySelector('.skeleton') !== null
document.querySelector('[data-loading]') !== null
```

---

## React Extraction

### Wait for React Hydration

```python
# Method 1: Wait for specific hydration marker
mcp__playwright__browser_wait_for(
    selector="[data-hydrated='true']",
    timeout=10000
)

# Method 2: Wait for content container
mcp__playwright__browser_wait_for(
    selector="#root > *",  # React renders into #root
    timeout=10000
)

# Method 3: Custom hydration check
mcp__playwright__browser_evaluate(script="""
    // Wait for React to finish rendering
    await new Promise(resolve => {
        const check = () => {
            const root = document.getElementById('root');
            if (root && root.children.length > 0) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
    return true;
""")
```

### Next.js Specific

```python
# Wait for Next.js hydration
mcp__playwright__browser_wait_for(
    selector="#__next",
    timeout=10000
)

# Check for completed navigation
mcp__playwright__browser_evaluate(script="""
    // Wait for Next.js router to be ready
    await new Promise(r => setTimeout(r, 1000));
    return document.querySelector('main').innerText;
""")
```

### React Documentation Sites

Common patterns for React-based doc sites (Docusaurus, Nextra):

```python
# Docusaurus
mcp__playwright__browser_wait_for(selector=".theme-doc-markdown")
content = mcp__playwright__browser_evaluate(script="""
    return document.querySelector('.theme-doc-markdown').innerText;
""")

# Nextra
mcp__playwright__browser_wait_for(selector="article")
content = mcp__playwright__browser_evaluate(script="""
    return document.querySelector('article').innerText;
""")
```

---

## Vue Extraction

### Wait for Vue Mount

```python
# Wait for Vue app mount
mcp__playwright__browser_wait_for(
    selector="#app > *",  # Vue typically mounts to #app
    timeout=10000
)

# Or check for Vue data attributes
mcp__playwright__browser_wait_for(
    selector="[data-v-]",  # Vue scoped CSS attributes
    timeout=10000
)
```

### Nuxt Specific

```python
# Wait for Nuxt hydration
mcp__playwright__browser_wait_for(
    selector="#__nuxt",
    timeout=10000
)

# Handle Nuxt loading states
mcp__playwright__browser_evaluate(script="""
    // Wait for Nuxt loading to complete
    await new Promise(resolve => {
        const check = () => {
            const loading = document.querySelector('.nuxt-loading');
            if (!loading || loading.style.display === 'none') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
    return document.querySelector('main').innerText;
""")
```

### VuePress/VitePress

```python
# VuePress
mcp__playwright__browser_wait_for(selector=".theme-default-content")
content = mcp__playwright__browser_evaluate(script="""
    return document.querySelector('.theme-default-content').innerText;
""")

# VitePress
mcp__playwright__browser_wait_for(selector=".vp-doc")
content = mcp__playwright__browser_evaluate(script="""
    return document.querySelector('.vp-doc').innerText;
""")
```

---

## Angular Extraction

### Wait for Angular Bootstrap

```python
# Wait for Angular to initialize
mcp__playwright__browser_wait_for(
    selector="app-root > *",
    timeout=10000
)

# Or check ng-version attribute
mcp__playwright__browser_wait_for(
    selector="[ng-version]",
    timeout=10000
)
```

### Handle Angular Change Detection

```python
mcp__playwright__browser_evaluate(script="""
    // Trigger change detection and wait
    if (window.ng) {
        const appRef = window.ng.getComponent(document.querySelector('app-root'));
        if (appRef) {
            appRef.detectChanges && appRef.detectChanges();
        }
    }
    await new Promise(r => setTimeout(r, 500));
    return document.querySelector('main').innerText;
""")
```

---

## Generic SPA Patterns

### Wait for Content, Not Framework

When framework is unknown, wait for visible content:

```python
mcp__playwright__browser_evaluate(script="""
    // Wait for meaningful content
    await new Promise(resolve => {
        const check = () => {
            const body = document.body;
            const text = body.innerText.trim();
            // Wait until page has substantial content
            if (text.length > 500) {
                resolve();
            } else {
                setTimeout(check, 200);
            }
        };
        check();
    });
    return true;
""")
```

### Handle Infinite Scroll

```python
mcp__playwright__browser_evaluate(script="""
    // Scroll to load all content
    const scrollToBottom = async () => {
        let lastHeight = document.body.scrollHeight;
        while (true) {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(r => setTimeout(r, 1000));
            const newHeight = document.body.scrollHeight;
            if (newHeight === lastHeight) break;
            lastHeight = newHeight;
        }
    };
    await scrollToBottom();
    return document.body.innerText;
""")
```

### Handle Lazy Images

```python
mcp__playwright__browser_evaluate(script="""
    // Trigger lazy image loading
    document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
    });
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.loading = 'eager';
    });
    await new Promise(r => setTimeout(r, 2000));
    return true;
""")
```

### Extract Clean Content

```python
mcp__playwright__browser_evaluate(script="""
    // Remove noise elements
    const removeSelectors = [
        'nav', 'header', 'footer',
        '.sidebar', '.ads', '.cookie-banner',
        '[role="navigation"]', '[aria-hidden="true"]'
    ];
    removeSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Get main content
    const main = document.querySelector('main, article, .content, #content');
    return main ? main.innerText : document.body.innerText;
""")
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Empty content | JS not executed | Add longer wait or explicit delay |
| Partial content | Hydration incomplete | Wait for specific hydration marker |
| Stale content | Client-side cache | Add cache-busting param to URL |
| Loading spinner | Slow API | Increase timeout, wait for content selector |
| 404 after nav | Client routing issue | Use full page reload |
