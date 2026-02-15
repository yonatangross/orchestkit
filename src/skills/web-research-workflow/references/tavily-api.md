# Tavily API Reference

## Search (Semantic Web Search)

Returns relevance-scored results with raw markdown content:

```bash
curl -s -X POST 'https://api.tavily.com/search' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "query": "your search query",
    "search_depth": "advanced",
    "max_results": 5,
    "include_raw_content": "markdown"
  }' | python3 -m json.tool
```

Options:
- `search_depth`: `"basic"` (fast) or `"advanced"` (thorough, 2x cost)
- `topic`: `"general"` (default) or `"news"` or `"finance"`
- `include_domains`: `["example.com"]` — restrict to specific sites
- `exclude_domains`: `["reddit.com"]` — filter out sites
- `days`: `3` — limit to recent results (news/finance)
- `include_raw_content`: `"markdown"` — get full page content

## Extract (Batch URL Content)

Extract raw content from up to 20 URLs at once:

```bash
curl -s -X POST 'https://api.tavily.com/extract' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "urls": [
      "https://docs.example.com/guide",
      "https://competitor.com/pricing"
    ]
  }' | python3 -m json.tool
```

Returns markdown content for each URL. Use when you have specific URLs and need full content.

## Map (Site Discovery)

Discover all URLs on a site before extracting:

```bash
curl -s -X POST 'https://api.tavily.com/map' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 2,
    "limit": 50
  }' | python3 -m json.tool
```

Useful for documentation sites and competitor sitemaps. Combine with extract for full crawl.

## Crawl (Multi-Page Content Extraction)

Crawl an entire site and extract content from all discovered pages in one call. Replaces the manual map+extract two-step workflow:

```bash
curl -s -X POST 'https://api.tavily.com/crawl' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 2,
    "limit": 50,
    "include_raw_content": "markdown"
  }' | python3 -m json.tool
```

Options:
- `max_depth`: `2` — how many link-hops from the seed URL
- `limit`: `50` — max pages to crawl
- `include_raw_content`: `"markdown"` — get full page content (not just snippets)
- `exclude_paths`: `["/blog/*"]` — skip certain URL patterns
- `include_paths`: `["/docs/*"]` — restrict to certain URL patterns

**When to use Crawl vs Map+Extract:**
- Use **Crawl** when you want content from an entire site section (docs, changelog, pricing)
- Use **Map** when you only need URL discovery without content
- Use **Extract** when you already have specific URLs

## Research (Deep Research — Beta)

Multi-step research agent that searches, reads, and synthesizes across multiple sources. Returns a comprehensive report with citations:

```bash
curl -s -X POST 'https://api.tavily.com/research' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "query": "comparison of vector databases for RAG in 2026",
    "max_results": 10,
    "report_type": "research_report"
  }' | python3 -m json.tool
```

Options:
- `report_type`: `"research_report"` (default) | `"outline_report"` | `"detailed_report"`
- `max_results`: number of sources to analyze (more = deeper but slower)

**Note:** The `/research` endpoint is in beta. Falls back gracefully to `/search` + `/extract` if unavailable. Best for deep competitive analysis, market research, and technical comparisons.
