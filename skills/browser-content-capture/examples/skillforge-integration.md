# Example: SkillForge Integration Workflow

End-to-end example showing how browser capture integrates with SkillForge's analysis pipeline.

## Use Case

A developer wants to analyze the LangGraph documentation, but:
- The docs are rendered with Docusaurus (React-based SPA)
- WebFetch returns incomplete HTML
- Need all 30+ pages in the knowledge base

## Complete Workflow

### Phase 1: Discovery

First, understand what we're capturing:

```python
# Navigate to LangGraph docs
mcp__playwright__browser_navigate(url="https://langchain-ai.github.io/langgraph/")
mcp__playwright__browser_wait_for(selector=".theme-doc-sidebar-container")

# Get site structure
structure = mcp__playwright__browser_evaluate(script="""
    const sidebar = document.querySelector('.theme-doc-sidebar-container');

    function extractNav(container) {
        const items = [];
        container.querySelectorAll(':scope > ul > li').forEach(li => {
            const link = li.querySelector(':scope > a');
            const nested = li.querySelector(':scope > ul');

            items.push({
                title: link?.innerText.trim(),
                href: link?.href,
                children: nested ? extractNav(nested) : []
            });
        });
        return items;
    }

    return {
        totalPages: sidebar.querySelectorAll('a[href]').length,
        structure: extractNav(sidebar)
    };
""")

print(f"Found {structure['totalPages']} pages to capture")
```

**Output:**
```
Found 32 pages to capture
```

### Phase 2: Capture Strategy

Choose capture approach based on structure:

```python
# Flatten the navigation tree
def flatten_nav(items, depth=0):
    result = []
    for item in items:
        if item.get('href'):
            result.append({
                'url': item['href'],
                'title': item['title'],
                'depth': depth
            })
        if item.get('children'):
            result.extend(flatten_nav(item['children'], depth + 1))
    return result

pages = flatten_nav(structure['structure'])

# Filter to only documentation pages (not external links)
doc_pages = [p for p in pages if 'langchain-ai.github.io/langgraph' in p['url']]
print(f"Capturing {len(doc_pages)} documentation pages")
```

### Phase 3: Capture Loop

Capture each page with proper waiting:

```python
import asyncio

captured_content = []

for i, page in enumerate(doc_pages):
    print(f"[{i+1}/{len(doc_pages)}] Capturing: {page['title']}")

    try:
        # Navigate
        mcp__playwright__browser_navigate(url=page['url'])

        # Wait for Docusaurus content
        mcp__playwright__browser_wait_for(
            selector=".theme-doc-markdown",
            timeout=10000
        )

        # Additional wait for code highlighting
        mcp__playwright__browser_evaluate(script="""
            await new Promise(r => setTimeout(r, 1000));
        """)

        # Extract content
        content = mcp__playwright__browser_evaluate(script="""
            const article = document.querySelector('.theme-doc-markdown');

            // Extract headings for structure
            const headings = Array.from(article.querySelectorAll('h1, h2, h3'))
                .map(h => ({
                    level: parseInt(h.tagName[1]),
                    text: h.innerText,
                    id: h.id
                }));

            // Extract code blocks
            const codeBlocks = Array.from(article.querySelectorAll('pre'))
                .map(pre => ({
                    language: pre.querySelector('code')?.className.match(/language-(\\w+)/)?.[1] || 'text',
                    code: pre.innerText
                }));

            return {
                url: window.location.href,
                title: document.querySelector('h1').innerText,
                content: article.innerText,
                headings,
                codeBlocks,
                lastUpdated: document.querySelector('.theme-last-updated')?.innerText
            };
        """)

        captured_content.append(content)

    except Exception as e:
        print(f"  Failed: {e}")
        captured_content.append({
            'url': page['url'],
            'title': page['title'],
            'error': str(e)
        })

    # Rate limiting
    await asyncio.sleep(1.5)

# Summary
successful = len([c for c in captured_content if 'error' not in c])
print(f"\\nCapture complete: {successful}/{len(doc_pages)} pages")
```

**Output:**
```
[1/32] Capturing: Introduction
[2/32] Capturing: Quick Start
[3/32] Capturing: Tutorials
...
[32/32] Capturing: API Reference

Capture complete: 31/32 pages
```

### Phase 4: Queue to SkillForge

Send captured content to analysis pipeline:

```python
from templates.queue_to_skillforge import SkillForgeClient

client = SkillForgeClient(base_url="http://localhost:8500")

analysis_ids = []

for content in captured_content:
    if 'error' in content:
        continue  # Skip failed pages

    result = await client.queue_for_analysis(
        url=content['url'],
        content=content['content'],
        title=content['title']
    )

    analysis_ids.append({
        'title': content['title'],
        'analysis_id': result.analysis_id
    })

    print(f"Queued: {content['title']} -> {result.analysis_id}")

print(f"\\nQueued {len(analysis_ids)} pages for analysis")
```

### Phase 5: Monitor Progress

Track analysis completion:

```python
completed = []
failed = []

for item in analysis_ids:
    print(f"Waiting for: {item['title']}...")

    async for event in client.stream_progress(item['analysis_id']):
        status = event.get('status')
        progress = event.get('progress', 0)

        if status == 'completed':
            completed.append(item)
            print(f"  ✓ Completed ({progress}%)")
            break
        elif status == 'failed':
            failed.append(item)
            print(f"  ✗ Failed: {event.get('error')}")
            break
        else:
            print(f"  ... {status} ({progress}%)", end='\\r')

print(f"\\nResults: {len(completed)} completed, {len(failed)} failed")
```

### Phase 6: Verify Results

Check that content is searchable:

```python
# Test search in SkillForge
async with httpx.AsyncClient() as http:
    response = await http.get(
        "http://localhost:8500/api/v1/search",
        params={"q": "LangGraph supervisor pattern", "limit": 5}
    )
    results = response.json()

print(f"Search found {len(results['results'])} relevant chunks")
for r in results['results'][:3]:
    print(f"  - {r['title']} (score: {r['score']:.2f})")
```

**Output:**
```
Search found 12 relevant chunks
  - Supervisor-Worker Pattern (score: 0.92)
  - Multi-Agent Architectures (score: 0.87)
  - State Management Guide (score: 0.81)
```

## Summary Statistics

After running this workflow:

| Metric | Value |
|--------|-------|
| Pages captured | 31/32 |
| Total content | ~85,000 words |
| Code examples | 150+ |
| Analysis time | ~15 minutes |
| Searchable chunks | 450+ |

## Automation Script

For repeated use, wrap in a reusable script:

```python
#!/usr/bin/env python3
"""
Capture and analyze documentation site.

Usage:
    python capture_docs.py https://docs.example.com
"""

import sys
import asyncio

async def main(base_url: str):
    # Discovery
    pages = await discover_pages(base_url)
    print(f"Found {len(pages)} pages")

    # Capture
    content = await capture_all(pages)
    print(f"Captured {len(content)} pages")

    # Queue
    ids = await queue_all(content)
    print(f"Queued {len(ids)} for analysis")

    # Wait
    await wait_for_completion(ids)
    print("All analyses complete!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: capture_docs.py <url>")
        sys.exit(1)

    asyncio.run(main(sys.argv[1]))
```

## Best Practices Learned

1. **Always wait for hydration** - Docusaurus/Next.js need 1-2 seconds after navigation
2. **Rate limit aggressively** - 1.5+ seconds between pages prevents blocks
3. **Extract structure first** - Navigation gives you the full page list
4. **Handle failures gracefully** - Some pages may fail, don't stop the whole crawl
5. **Verify with search** - Test that captured content is actually searchable
