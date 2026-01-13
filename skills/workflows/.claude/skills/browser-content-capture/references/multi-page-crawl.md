# Multi-Page Crawl Patterns

Strategies for capturing content from documentation sites with multiple pages.

## Table of Contents

1. [Crawl Strategies](#crawl-strategies)
2. [Link Discovery](#link-discovery)
3. [Crawl Implementation](#crawl-implementation)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)

---

## Crawl Strategies

### Strategy Comparison

| Strategy | Best For | Pros | Cons |
|----------|----------|------|------|
| Sidebar navigation | Doc sites | Complete, ordered | May miss pages |
| Sitemap.xml | Any site | Comprehensive | May be outdated |
| Recursive crawl | Unknown structure | Finds everything | Slow, may loop |
| Pagination | List pages | Efficient | Only works for lists |

### Decision Tree

```
Multi-page content needed
         │
         ▼
    Check for sitemap.xml
         │
    ├─ Exists ──► Parse sitemap, crawl listed URLs
    │
    └─ No sitemap
              │
         Check for sidebar/nav
              │
         ├─ Has nav ──► Extract nav links, crawl in order
         │
         └─ No nav ──► Recursive link following
```

---

## Link Discovery

### From Sidebar Navigation

Most documentation sites have a sidebar with all pages:

```python
# Get all navigation links
links = mcp__playwright__browser_evaluate(script="""
    const navLinks = document.querySelectorAll('nav a, .sidebar a, .toc a');
    return Array.from(navLinks)
        .map(a => ({
            href: a.href,
            text: a.innerText.trim(),
            depth: a.closest('ul')?.querySelectorAll('ul').length || 0
        }))
        .filter(link => link.href && !link.href.includes('#'));
""")
```

### From Sitemap.xml

```python
# Fetch and parse sitemap
mcp__playwright__browser_navigate(url="https://docs.example.com/sitemap.xml")
urls = mcp__playwright__browser_evaluate(script="""
    const locs = document.querySelectorAll('loc');
    return Array.from(locs).map(loc => loc.textContent);
""")
```

### Recursive Link Discovery

```python
def discover_links(visited_urls: set) -> list:
    """Find all internal links not yet visited."""
    links = mcp__playwright__browser_evaluate(script="""
        const baseUrl = new URL(window.location.href);
        return Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => {
                try {
                    const url = new URL(href);
                    return url.origin === baseUrl.origin;
                } catch {
                    return false;
                }
            });
    """)
    return [url for url in links if url not in visited_urls]
```

### Pagination Links

```python
# Handle paginated content
def get_pagination_links():
    return mcp__playwright__browser_evaluate(script="""
        const pagination = document.querySelector('.pagination, [aria-label="pagination"]');
        if (!pagination) return [];

        return Array.from(pagination.querySelectorAll('a'))
            .map(a => ({
                href: a.href,
                label: a.innerText.trim(),
                isNext: a.innerText.includes('Next') || a.getAttribute('rel') === 'next'
            }));
    """)
```

---

## Crawl Implementation

### Basic Sequential Crawl

```python
async def crawl_documentation(start_url: str) -> list:
    """Crawl all pages from a documentation site."""

    # Navigate to start page
    mcp__playwright__browser_navigate(url=start_url)
    mcp__playwright__browser_wait_for(selector="nav")

    # Discover all page links
    links = mcp__playwright__browser_evaluate(script="""
        return Array.from(document.querySelectorAll('nav a'))
            .map(a => ({ href: a.href, title: a.innerText }))
            .filter(l => l.href.includes('/docs/'));
    """)

    results = []

    for link in links:
        # Navigate to page
        mcp__playwright__browser_navigate(url=link['href'])
        mcp__playwright__browser_wait_for(selector=".content")

        # Extract content
        content = mcp__playwright__browser_evaluate(script="""
            return {
                title: document.querySelector('h1').innerText,
                content: document.querySelector('.content').innerText,
                url: window.location.href
            };
        """)

        results.append(content)

        # Rate limiting
        await asyncio.sleep(1)

    return results
```

### Breadth-First Crawl

```python
from collections import deque

async def bfs_crawl(start_url: str, max_pages: int = 100) -> list:
    """Breadth-first crawl up to max_pages."""

    visited = set()
    queue = deque([start_url])
    results = []

    while queue and len(visited) < max_pages:
        url = queue.popleft()

        if url in visited:
            continue
        visited.add(url)

        # Navigate and extract
        mcp__playwright__browser_navigate(url=url)
        mcp__playwright__browser_wait_for(selector="body")

        # Get content
        page_data = mcp__playwright__browser_evaluate(script="""
            return {
                url: window.location.href,
                title: document.title,
                content: document.querySelector('main, article, .content')?.innerText || ''
            };
        """)
        results.append(page_data)

        # Discover new links
        new_links = mcp__playwright__browser_evaluate(script="""
            const base = new URL(window.location.href);
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.href)
                .filter(href => {
                    try {
                        const url = new URL(href);
                        return url.origin === base.origin &&
                               !href.includes('#') &&
                               url.pathname.startsWith('/docs/');
                    } catch { return false; }
                });
        """)

        for link in new_links:
            if link not in visited:
                queue.append(link)

        await asyncio.sleep(0.5)

    return results
```

### Structured Documentation Crawl

For sites with clear hierarchy (intro → guide → api → examples):

```python
async def crawl_structured_docs(base_url: str) -> dict:
    """Crawl documentation maintaining structure."""

    mcp__playwright__browser_navigate(url=base_url)
    mcp__playwright__browser_wait_for(selector="nav")

    # Get navigation structure
    nav_structure = mcp__playwright__browser_evaluate(script="""
        const nav = document.querySelector('nav');

        function extractSection(element) {
            const links = [];
            const items = element.querySelectorAll(':scope > li, :scope > a');

            for (const item of items) {
                const link = item.querySelector('a') || item;
                const sublist = item.querySelector('ul');

                links.push({
                    title: link.innerText.trim(),
                    href: link.href || null,
                    children: sublist ? extractSection(sublist) : []
                });
            }
            return links;
        }

        return extractSection(nav.querySelector('ul'));
    """)

    # Crawl following structure
    async def crawl_section(section, depth=0):
        results = []

        for item in section:
            if item['href']:
                mcp__playwright__browser_navigate(url=item['href'])
                mcp__playwright__browser_wait_for(selector=".content")

                content = mcp__playwright__browser_evaluate(
                    script="document.querySelector('.content').innerText"
                )

                results.append({
                    'title': item['title'],
                    'url': item['href'],
                    'content': content,
                    'depth': depth,
                    'children': await crawl_section(item['children'], depth + 1)
                })

                await asyncio.sleep(0.5)

        return results

    return await crawl_section(nav_structure)
```

---

## Rate Limiting

### Polite Crawling

```python
import time
import random

class RateLimiter:
    def __init__(self, min_delay: float = 1.0, max_delay: float = 3.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.last_request = 0

    async def wait(self):
        """Wait appropriate time between requests."""
        elapsed = time.time() - self.last_request
        delay = random.uniform(self.min_delay, self.max_delay)

        if elapsed < delay:
            await asyncio.sleep(delay - elapsed)

        self.last_request = time.time()

# Usage
limiter = RateLimiter(min_delay=1.0, max_delay=2.0)

for url in urls:
    await limiter.wait()
    mcp__playwright__browser_navigate(url=url)
    # ... extract content
```

### Respect robots.txt

```python
def check_robots_allowed(url: str, user_agent: str = "*") -> bool:
    """Check if URL is allowed by robots.txt."""
    from urllib.parse import urlparse
    from urllib.robotparser import RobotFileParser

    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    rp = RobotFileParser()
    rp.set_url(robots_url)
    rp.read()

    return rp.can_fetch(user_agent, url)
```

---

## Error Handling

### Retry Failed Pages

```python
async def crawl_with_retry(url: str, max_retries: int = 3) -> dict:
    """Crawl a page with retries on failure."""

    for attempt in range(max_retries):
        try:
            mcp__playwright__browser_navigate(url=url)
            mcp__playwright__browser_wait_for(
                selector=".content",
                timeout=10000
            )

            content = mcp__playwright__browser_evaluate(
                script="document.querySelector('.content').innerText"
            )

            return {'url': url, 'content': content, 'status': 'success'}

        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
            else:
                return {'url': url, 'error': str(e), 'status': 'failed'}
```

### Handle Missing Content

```python
def extract_content_safely():
    """Extract content with fallbacks."""
    return mcp__playwright__browser_evaluate(script="""
        // Try multiple content selectors
        const selectors = [
            'main article',
            '.content',
            '#content',
            'article',
            '.markdown-body',
            '.prose'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim().length > 100) {
                return el.innerText;
            }
        }

        // Fallback to body with cleanup
        const body = document.body.cloneNode(true);
        body.querySelectorAll('nav, header, footer, .sidebar').forEach(el => el.remove());
        return body.innerText;
    """)
```

### Track Failed URLs

```python
async def crawl_with_tracking(urls: list) -> dict:
    """Crawl URLs and track successes/failures."""

    results = {
        'successful': [],
        'failed': [],
        'skipped': []
    }

    for url in urls:
        try:
            mcp__playwright__browser_navigate(url=url)
            mcp__playwright__browser_wait_for(selector="body", timeout=10000)

            # Check for error pages
            is_error = mcp__playwright__browser_evaluate(script="""
                const title = document.title.toLowerCase();
                const h1 = document.querySelector('h1')?.innerText.toLowerCase() || '';
                return title.includes('404') || title.includes('not found') ||
                       h1.includes('404') || h1.includes('not found');
            """)

            if is_error:
                results['skipped'].append({'url': url, 'reason': '404'})
                continue

            content = extract_content_safely()
            results['successful'].append({'url': url, 'content': content})

        except Exception as e:
            results['failed'].append({'url': url, 'error': str(e)})

        await asyncio.sleep(1)

    return results
```
