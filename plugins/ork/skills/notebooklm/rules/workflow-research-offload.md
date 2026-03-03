---
title: "Research Offload Pattern"
impact: HIGH
impactDescription: "Reading large docs in-context wastes tokens and hits context limits"
tags: [research, synthesis, token-savings]
---

## Research Offload Pattern

Add large documents, codebases, and references as notebook sources instead of pasting them into chat. Use `notebook_query` for targeted synthesis without consuming context window.

**Incorrect -- pasting large content directly into chat:**
```
User: "Here's our entire codebase (100K chars)... now explain the auth flow"
# Wastes context, may hit token limits, loses nuance in truncation
```

**Correct -- add as source, query for synthesis:**
```
# 1. Add large docs as sources (use RepoMix for codebases)
source_add(notebook_id="...", url="https://docs.example.com/api-reference")
source_add(notebook_id="...", content=repomix_output)

# 2. Query for specific synthesis
notebook_query(notebook_id="...", query="How does the authentication middleware chain work?")

# 3. Follow up with targeted questions
notebook_query(notebook_id="...", query="What error codes does the auth endpoint return?")
```

**Key rules:**
- Add large documents as sources rather than pasting into chat context
- Use RepoMix to bundle codebases into a single source for onboarding
- Query the notebook for synthesis -- NotebookLM reads the full source each time
- Multiple targeted queries are cheaper than one massive context load
- Combine with second-brain pattern to build persistent project knowledge
