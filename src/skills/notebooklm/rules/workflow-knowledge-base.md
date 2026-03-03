---
title: "Knowledge Base Pattern"
impact: HIGH
impactDescription: "Without curated KB, debugging repeats past mistakes and security reviews miss known patterns"
tags: [debugging, security, knowledge-base]
---

## Knowledge Base Pattern

Build dedicated notebooks as curated knowledge bases for debugging, security, and onboarding. Add incident reports, advisories, and runbooks as sources for grounded, verified answers.

**Incorrect -- re-investigating a known issue from scratch:**
```
User: "Production is throwing OOM errors again"
Claude: "Let me research possible causes..."
# Wastes time if this was already diagnosed and documented
```

**Correct -- query the debugging knowledge base:**
```
# 1. Create dedicated KB notebooks
notebook_create(name="Debugging KB")
notebook_create(name="Security Handbook")

# 2. Add incident reports and advisories as sources
source_add(notebook_id="debug_kb", content="INC-042: OOM caused by unbounded cache. Fix: add TTL...")
source_add(notebook_id="security_kb", content="SEC-007: SQL injection in search endpoint. Fix: parameterize...")

# 3. Query for grounded answers
notebook_query(notebook_id="debug_kb", query="What causes OOM errors and how were they fixed?")
notebook_query(notebook_id="security_kb", query="Known SQL injection patterns in our codebase")
```

**Key rules:**
- Create separate notebooks for debugging, security, and onboarding domains
- Add incident reports, post-mortems, and security advisories as sources
- Query KB notebooks before re-investigating known issues
- Keep sources current -- add new incidents as they are resolved
- Use for onboarding: new team members query the KB instead of asking around
