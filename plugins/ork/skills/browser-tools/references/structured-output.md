# Structured Output

Patterns for converting scraped web content into clean, structured formats for downstream processing.

## Output Formats

| Format | Use Case | Tool |
|--------|----------|------|
| Markdown | Documentation, notes, LLM context | Text extraction + formatting |
| JSON | APIs, data pipelines, structured data | JavaScript eval + JSON.stringify |
| CSV | Tabular data, spreadsheets | Table extraction + conversion |
| Plain text | Search indexing, simple storage | get text @e# |

---

## Markdown Conversion

### Page to Clean Markdown

```bash
# Extract content as clean markdown
agent-browser eval "
function toMarkdown(el) {
    let md = '';
    el.childNodes.forEach(node => {
        if (node.nodeType === 3) {
            md += node.textContent;
        } else if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();
            switch(tag) {
                case 'h1': md += '# ' + node.innerText + '\\n\\n'; break;
                case 'h2': md += '## ' + node.innerText + '\\n\\n'; break;
                case 'h3': md += '### ' + node.innerText + '\\n\\n'; break;
                case 'p': md += node.innerText + '\\n\\n'; break;
                case 'li': md += '- ' + node.innerText + '\\n'; break;
                case 'code': md += '\`' + node.innerText + '\`'; break;
                case 'pre': md += '\\n\`\`\`\\n' + node.innerText + '\\n\`\`\`\\n\\n'; break;
                case 'a': md += '[' + node.innerText + '](' + node.href + ')'; break;
                case 'strong': case 'b': md += '**' + node.innerText + '**'; break;
                case 'em': case 'i': md += '*' + node.innerText + '*'; break;
                default: md += toMarkdown(node);
            }
        }
    });
    return md;
}
const main = document.querySelector('article, main, .content');
toMarkdown(main || document.body);
"
```

### With Frontmatter Metadata

```bash
# Save page with YAML frontmatter
URL=$(agent-browser eval "window.location.href")
TITLE=$(agent-browser eval "document.title")
CONTENT=$(agent-browser eval "document.querySelector('article')?.innerText || document.body.innerText")

{
    echo "---"
    echo "title: $TITLE"
    echo "url: $URL"
    echo "crawled_at: $(date -Iseconds)"
    echo "---"
    echo ""
    echo "$CONTENT"
} > "/tmp/page-output.md"
```

---

## JSON Extraction

### Structured Data from Page

```bash
# Extract structured data
agent-browser eval "
const article = document.querySelector('article');
JSON.stringify({
    title: document.title,
    url: window.location.href,
    author: document.querySelector('[rel=\"author\"], .author')?.innerText || '',
    publishDate: document.querySelector('time')?.getAttribute('datetime') || '',
    content: article?.innerText || '',
    wordCount: (article?.innerText || '').split(/\s+/).length,
    links: Array.from(article?.querySelectorAll('a') || []).map(a => ({
        text: a.innerText.trim(),
        href: a.href
    })),
    images: Array.from(article?.querySelectorAll('img') || []).map(img => ({
        alt: img.alt,
        src: img.src
    }))
}, null, 2);
"
```

### JSON-LD / Schema.org Data

```bash
# Extract structured data from JSON-LD
agent-browser eval "
const scripts = document.querySelectorAll('script[type=\"application/ld+json\"]');
const data = Array.from(scripts).map(s => JSON.parse(s.textContent));
JSON.stringify(data, null, 2);
"
```

### Product Data Extraction

```bash
# Extract product information
agent-browser eval "
const products = Array.from(document.querySelectorAll('.product-card, [data-product]'));
JSON.stringify(products.map(p => ({
    name: p.querySelector('.product-name, h3, h2')?.innerText.trim(),
    price: p.querySelector('.price, [data-price]')?.innerText.trim(),
    rating: p.querySelector('.rating, [data-rating]')?.innerText.trim(),
    image: p.querySelector('img')?.src,
    url: p.querySelector('a')?.href
})), null, 2);
"
```

---

## Table Extraction

### HTML Table to JSON

```bash
# Convert table to structured JSON
agent-browser eval "
const rows = document.querySelectorAll('table tr');
if (rows.length === 0) { '[]'; }
else {
    const headers = Array.from(rows[0].querySelectorAll('th, td')).map(th => th.innerText.trim());
    const data = Array.from(rows).slice(1).map(row =>
        Object.fromEntries(
            Array.from(row.querySelectorAll('td')).map((td, i) => [headers[i] || 'col_' + i, td.innerText.trim()])
        )
    );
    JSON.stringify(data, null, 2);
}
"
```

### Table to CSV

```bash
# Convert table to CSV
agent-browser eval "
const rows = document.querySelectorAll('table tr');
Array.from(rows).map(row =>
    Array.from(row.querySelectorAll('th, td'))
        .map(cell => '\"' + cell.innerText.trim().replace(/\"/g, '\"\"') + '\"')
        .join(',')
).join('\\n');
" > /tmp/table-output.csv
```

---

## Content Cleaning

### Remove Noise Elements

```bash
# Clean page before extraction
agent-browser eval "
// Remove non-content elements
const selectors = [
    'nav', 'header', 'footer',
    '.sidebar', '.toc', '.breadcrumbs',
    '.ads', '.advertisement', '.sponsored',
    '.cookie-banner', '.popup', '.modal',
    '.comments', '.related-posts',
    'script', 'style', 'noscript'
];
selectors.forEach(sel =>
    document.querySelectorAll(sel).forEach(el => el.remove())
);

// Return cleaned content
const main = document.querySelector('main, article, .content, #content, .post-body');
main ? main.innerText : document.body.innerText;
"
```

### Normalize Whitespace

```bash
# Clean up extracted text
agent-browser eval "
const content = document.querySelector('article')?.innerText || '';
content
    .replace(/\\t/g, ' ')           // Replace tabs with spaces
    .replace(/ {2,}/g, ' ')         // Collapse multiple spaces
    .replace(/\\n{3,}/g, '\\n\\n')  // Max two newlines
    .trim();
"
```

---

## Batch Output

### Multi-Page to Single File

```bash
#!/bin/bash
# Combine crawled pages into single document

OUTPUT="/tmp/combined-docs.md"
echo "# Combined Documentation" > "$OUTPUT"
echo "" >> "$OUTPUT"
echo "Crawled: $(date -Iseconds)" >> "$OUTPUT"
echo "" >> "$OUTPUT"

for file in /tmp/docs-crawl/*.md; do
    echo "---" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
done

echo "Combined output: $(wc -l < "$OUTPUT") lines"
```

### Index File Generation

```bash
#!/bin/bash
# Generate index of crawled pages

OUTPUT="/tmp/crawl-index.json"

agent-browser eval "
JSON.stringify(
    Array.from(document.querySelectorAll('nav a')).map(a => ({
        title: a.innerText.trim(),
        url: a.href,
        section: a.closest('section')?.querySelector('h2')?.innerText || 'uncategorized'
    })),
    null, 2
);
" > "$OUTPUT"
```

---

## Validation

### Verify Extraction Quality

```bash
# Check that extraction returned meaningful content
CONTENT=$(agent-browser get text @e5)
WORD_COUNT=$(echo "$CONTENT" | wc -w)

if [[ $WORD_COUNT -lt 50 ]]; then
    echo "Warning: Extraction returned only $WORD_COUNT words"
    echo "Consider: wait --load networkidle, or different selector"
fi
```

### Validate JSON Output

```bash
# Ensure valid JSON
OUTPUT=$(agent-browser eval "JSON.stringify({data: 'test'})")

if echo "$OUTPUT" | jq . > /dev/null 2>&1; then
    echo "Valid JSON"
    echo "$OUTPUT" | jq . > /tmp/validated-output.json
else
    echo "Invalid JSON output, raw: $OUTPUT"
fi
```

---

## Best Practices

1. **Preserve metadata** -- Always include title, URL, timestamp in output
2. **Clean before extracting** -- Remove noise elements for better signal-to-noise
3. **Validate output** -- Check word count, JSON validity before saving
4. **Use targeted selectors** -- Extract specific content areas, not full page
5. **Normalize whitespace** -- Clean up tabs, multiple spaces, excessive newlines
6. **Check for JSON-LD** -- Structured data may already exist on the page
