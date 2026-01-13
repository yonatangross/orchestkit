# Example: Capturing React Documentation

Real-world example of capturing content from React.dev using browser automation.

## The Challenge

React.dev is a Next.js-based SPA that:
- Renders content client-side
- Uses client-side routing
- Has lazy-loaded code examples
- Includes interactive sandboxes

**WebFetch returns incomplete content** because JavaScript hasn't executed.

## Solution: Playwright MCP

### Step 1: Navigate and Wait for Hydration

```python
# Navigate to React docs
mcp__playwright__browser_navigate(url="https://react.dev/learn")

# Wait for Next.js to hydrate
mcp__playwright__browser_wait_for(
    selector="#__next",
    timeout=10000
)

# Additional wait for content rendering
mcp__playwright__browser_evaluate(script="""
    await new Promise(r => setTimeout(r, 2000));
""")
```

### Step 2: Extract Article Content

```python
content = mcp__playwright__browser_evaluate(script="""
    // Find the main article
    const article = document.querySelector('article');

    // Extract structured content
    const result = {
        title: document.querySelector('h1').innerText,
        sections: [],
        codeExamples: []
    };

    // Get all sections
    article.querySelectorAll('h2, h3').forEach(heading => {
        const section = {
            title: heading.innerText,
            level: heading.tagName,
            content: ''
        };

        // Get content until next heading
        let sibling = heading.nextElementSibling;
        while (sibling && !['H2', 'H3'].includes(sibling.tagName)) {
            section.content += sibling.innerText + '\\n';
            sibling = sibling.nextElementSibling;
        }

        result.sections.push(section);
    });

    // Extract code examples
    article.querySelectorAll('pre code').forEach((code, i) => {
        result.codeExamples.push({
            index: i,
            language: code.className.match(/language-(\\w+)/)?.[1] || 'jsx',
            code: code.innerText
        });
    });

    return result;
""")
```

### Step 3: Discover All Documentation Pages

```python
# Get sidebar navigation links
links = mcp__playwright__browser_evaluate(script="""
    const nav = document.querySelector('nav[aria-label="Main"]');
    return Array.from(nav.querySelectorAll('a'))
        .filter(a => a.href.includes('/learn/'))
        .map(a => ({
            href: a.href,
            title: a.innerText.trim(),
            isSection: a.querySelector('svg') !== null
        }));
""")

# Result: list of all Learn section pages
# [
#   { href: "https://react.dev/learn", title: "Quick Start", isSection: false },
#   { href: "https://react.dev/learn/thinking-in-react", title: "Thinking in React", isSection: false },
#   ...
# ]
```

### Step 4: Crawl All Pages

```python
results = []

for link in links:
    if link['isSection']:
        continue  # Skip section headers

    # Navigate to page
    mcp__playwright__browser_navigate(url=link['href'])

    # Wait for content
    mcp__playwright__browser_wait_for(selector="article h1")
    mcp__playwright__browser_evaluate(script="await new Promise(r => setTimeout(r, 1000))")

    # Extract content
    page_content = mcp__playwright__browser_evaluate(script="""
        const article = document.querySelector('article');
        return {
            url: window.location.href,
            title: document.querySelector('h1').innerText,
            content: article.innerText,
            wordCount: article.innerText.split(/\\s+/).length
        };
    """)

    results.append(page_content)

    # Rate limiting
    import time
    time.sleep(1.5)

print(f"Captured {len(results)} pages")
```

### Step 5: Queue to SkillForge

```python
from templates.queue_to_skillforge import SkillForgeClient

client = SkillForgeClient()

for page in results:
    response = await client.queue_for_analysis(
        url=page['url'],
        content=page['content'],
        title=page['title']
    )
    print(f"Queued: {page['title']} -> {response.analysis_id}")
```

## Complete Workflow Output

```
Captured 45 pages from React Learn section

Queued: Quick Start -> analysis-a1b2c3
Queued: Thinking in React -> analysis-d4e5f6
Queued: Describing the UI -> analysis-g7h8i9
...

All pages queued for SkillForge analysis!
```

## Handling Edge Cases

### Interactive Sandboxes

React docs include CodeSandbox embeds. Extract the code separately:

```python
sandboxes = mcp__playwright__browser_evaluate(script="""
    return Array.from(document.querySelectorAll('[data-sandpack]'))
        .map(sandbox => ({
            files: sandbox.querySelector('.sp-file-explorer')?.innerText,
            code: sandbox.querySelector('.sp-code-editor')?.innerText
        }));
""")
```

### Expandable Sections

Some content is hidden in collapsed sections:

```python
# Expand all collapsed sections first
mcp__playwright__browser_evaluate(script="""
    document.querySelectorAll('[aria-expanded="false"]')
        .forEach(btn => btn.click());
    await new Promise(r => setTimeout(r, 500));
""")
```

### Deep Links with Hash

React docs uses hash-based deep links. Handle them:

```python
# Navigate to section
mcp__playwright__browser_navigate(url="https://react.dev/learn/state-a-components-memory#state-is-isolated-and-private")

# Wait for scroll to complete
mcp__playwright__browser_evaluate(script="""
    await new Promise(r => setTimeout(r, 500));
    const target = document.querySelector(window.location.hash);
    if (target) target.scrollIntoView();
""")
```

## Results

After running this workflow on React.dev:

- **45 pages** captured from Learn section
- **~150,000 words** of documentation
- **200+ code examples** extracted
- **All content** queued to SkillForge for analysis

Each page becomes a searchable, AI-analyzed artifact in SkillForge's knowledge base.
