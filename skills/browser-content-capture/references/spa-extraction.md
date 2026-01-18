# SPA Content Extraction

Patterns for extracting content from JavaScript-rendered Single Page Applications using agent-browser.

## Why SPAs Are Different

Traditional scrapers fail on SPAs because:

1. **Initial HTML is empty** - Content loads via JavaScript
2. **Hydration timing** - React/Vue must "hydrate" before content is interactive
3. **Client-side routing** - URLs change without page reloads
4. **Lazy loading** - Content loads as user scrolls
5. **API-driven** - Data fetched from backend after page load

**Solution:** Use agent-browser to wait for JavaScript execution.

---

## Detection Patterns

### Identify SPA Framework

```bash
# Check for React
agent-browser eval "window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined"

# Check for Vue
agent-browser eval "window.__VUE__ !== undefined"

# Check for Angular
agent-browser eval "window.ng !== undefined"

# Check for Next.js
agent-browser eval "document.querySelector('#__next') !== null"

# Check for Nuxt
agent-browser eval "document.querySelector('#__nuxt') !== null"
```

---

## React Extraction

### Wait for React Hydration

```bash
# Navigate
agent-browser open https://react-docs.example.com

# Wait for React to render content
agent-browser wait --load networkidle

# Or wait for specific hydration marker
agent-browser wait --fn "document.querySelector('[data-hydrated]') !== null"

# Get snapshot to find content
agent-browser snapshot -i

# Extract content
agent-browser get text @e5
```

### Next.js Specific

```bash
# Wait for Next.js
agent-browser open https://nextjs-site.com
agent-browser wait --fn "document.querySelector('#__next').children.length > 0"
agent-browser snapshot -i
agent-browser get text @e3
```

### Docusaurus Sites

```bash
agent-browser open https://docusaurus-docs.com
agent-browser wait --load networkidle
agent-browser eval "document.querySelector('.theme-doc-markdown').innerText"
```

---

## Vue Extraction

### Wait for Vue Mount

```bash
# Navigate
agent-browser open https://vue-app.example.com

# Wait for Vue to mount
agent-browser wait --fn "document.querySelector('#app').children.length > 0"

# Or wait for Vue data attributes
agent-browser wait --fn "document.querySelector('[data-v-]') !== null"

# Extract
agent-browser snapshot -i
agent-browser get text @e4
```

### Nuxt Specific

```bash
agent-browser open https://nuxt-site.com
agent-browser wait --fn "document.querySelector('#__nuxt').children.length > 0"
agent-browser snapshot -i
agent-browser get text @e2
```

### VitePress/VuePress

```bash
# VitePress
agent-browser open https://vitepress-docs.com
agent-browser wait --fn "document.querySelector('.vp-doc') !== null"
agent-browser eval "document.querySelector('.vp-doc').innerText"
```

---

## Angular Extraction

### Wait for Angular Bootstrap

```bash
# Navigate
agent-browser open https://angular-app.example.com

# Wait for Angular
agent-browser wait --fn "document.querySelector('app-root').children.length > 0"

# Or check ng-version attribute
agent-browser wait --fn "document.querySelector('[ng-version]') !== null"

# Extract
agent-browser snapshot -i
agent-browser get text @e3
```

---

## Generic SPA Patterns

### Wait for Content, Not Framework

When framework is unknown, wait for visible content:

```bash
# Wait for meaningful content (page has substantial text)
agent-browser wait --fn "document.body.innerText.trim().length > 500"

# Or wait for specific text
agent-browser wait --text "Welcome"
```

### Handle Infinite Scroll

```bash
# Scroll to load all content
agent-browser eval "
async function scrollToBottom() {
    let lastHeight = document.body.scrollHeight;
    while (true) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        if (document.body.scrollHeight === lastHeight) break;
        lastHeight = document.body.scrollHeight;
    }
    return document.body.innerText;
}
scrollToBottom();
"
```

### Handle Lazy Images

```bash
# Trigger lazy image loading
agent-browser eval "
document.querySelectorAll('img[data-src]').forEach(img => img.src = img.dataset.src);
document.querySelectorAll('img[loading=\"lazy\"]').forEach(img => img.loading = 'eager');
"
agent-browser wait 2000
```

### Extract Clean Content

```bash
# Remove noise elements before extraction
agent-browser eval "
['nav', 'header', 'footer', '.sidebar', '.ads', '.cookie-banner']
    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
const main = document.querySelector('main, article, .content, #content');
main ? main.innerText : document.body.innerText;
"
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Empty content | JS not executed | Add `wait --load networkidle` |
| Partial content | Hydration incomplete | Use `wait --fn` with specific check |
| Stale content | Client-side cache | Add cache-busting param to URL |
| Loading spinner | Slow API | Increase timeout, use `wait --text` |
| 404 after nav | Client routing issue | Use full page reload |
