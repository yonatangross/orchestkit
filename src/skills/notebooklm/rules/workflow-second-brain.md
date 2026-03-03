---
title: "Second Brain Pattern"
impact: HIGH
impactDescription: "Without centralized knowledge, decisions scatter across chat sessions and get lost"
tags: [knowledge, decisions, documentation]
---

## Second Brain Pattern

Create a dedicated notebook per project to capture decisions, design docs, and insights. Query the notebook for grounded answers instead of relying on ephemeral chat context.

**Incorrect -- relying on Claude's memory for past decisions:**
```
User: "What did we decide about the auth architecture last week?"
Claude: "I don't have context from previous sessions..."
```

**Correct -- add decisions as sources, query later:**
```
# 1. Create a project notebook
notebook_create(name="Project Alpha Decisions")

# 2. Add decision documents as sources
source_add(notebook_id="...", content="ADR-001: Use JWT for auth because...")
source_add(notebook_id="...", content="ADR-002: PostgreSQL over MongoDB for...")

# 3. Capture new insights with notes
note(notebook_id="...", content="Perf test showed 2x latency with Redis cache miss")

# 4. Query for grounded answers
notebook_query(notebook_id="...", query="What auth approach did we choose and why?")
```

**Key rules:**
- One notebook per project or domain -- avoid mixing unrelated topics
- Add decision records, design docs, and meeting notes as sources
- Use `note` tool to capture in-session insights for future retrieval
- Use `notebook_query` for grounded answers backed by actual sources
- Periodically prune outdated sources to keep answers relevant
