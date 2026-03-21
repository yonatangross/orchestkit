---
title: "Research Discovery Pattern"
impact: HIGH
impactDescription: "Manual source curation misses relevant content; research API automates discovery"
tags: [research, discovery, web-search, drive]
---

## Research Discovery Pattern

Use the research API for automated web and Google Drive discovery. The flow is async: start a research task, poll for status, then import discovered sources into your notebook.

**Incorrect -- manually searching and adding URLs one by one:**
```
# Tedious and misses relevant content
source_add(notebook_id="...", url="https://example.com/article1")
source_add(notebook_id="...", url="https://example.com/article2")
source_add(notebook_id="...", url="https://example.com/article3")
# Missed 20 other relevant articles
```

**Correct -- automated research flow:**
```
# 1. Start research (searches web and/or Google Drive)
task = research_start(
    notebook_id="...",
    topic="Latest developments in WebAssembly component model",
    sources=["web", "drive"]
)

# 2. Poll for completion (uses Google API quota)
status = research_status(task_id=task.id)
# status: "searching" | "analyzing" | "completed"

# 3. Import discovered sources into notebook (v0.5.0+: timeout configurable)
research_import(task_id=task.id, notebook_id="...", timeout=300)
# Adds the most relevant discovered sources automatically
# Default timeout is 300s (was 120s pre-0.5.0). Use --timeout in CLI.
```

**Deep research mode** (v0.5.1+):
```
# Deep research for comprehensive multi-source synthesis
research_start(notebook_id="...", topic="...", mode="deep")
# Transient API errors now auto-retry with RPCError handling
```

**Key rules:**
- Use `research_start` for broad topic discovery instead of manual URL hunting
- Always poll with `research_status` -- research takes 1-3 minutes
- Research uses Google API quota -- avoid running many parallel research tasks
- Import results with `research_import` to add discovered sources to your notebook
- For notebooks with many sources, increase `timeout` on `research_import` (default 300s, was 120s)
- Use `mode="deep"` for comprehensive synthesis -- transient errors are now auto-retried (v0.5.1+)
- Combine web and Drive sources for comprehensive coverage
- Follow up with `notebook_query` to synthesize the newly imported sources
