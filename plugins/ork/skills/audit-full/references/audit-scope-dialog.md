# Audit Scope Dialog

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify audit scope:

```python
AskUserQuestion(
  questions=[
    {
      "question": "What type of audit do you want to run?",
      "header": "Audit mode",
      "options": [
        {"label": "Full audit (Recommended)", "description": "Security + architecture + dependencies in one pass", "markdown": "```\nFull Audit (1M context)\n───────────────────────\n  Load entire codebase ──▶\n  ┌────────────────────────┐\n  │ Security    OWASP Top10│\n  │ Architecture  patterns │\n  │ Dependencies  CVEs     │\n  │ Cross-file   data flow │\n  └────────────────────────┘\n  Single pass: Opus 4.6 sees\n  ALL files simultaneously\n  Output: Prioritized findings\n```"},
        {"label": "Security audit", "description": "Cross-file vulnerability analysis, data flow tracing, OWASP mapping", "markdown": "```\nSecurity Audit\n──────────────\n  ┌──────────────────────┐\n  │ OWASP mapping        │\n  │ Data flow tracing    │\n  │   input ──▶ DB ──▶ output\n  │ Cross-file vulns     │\n  │ Auth/AuthZ review    │\n  │ Secret detection     │\n  └──────────────────────┘\n  Finds vulns that chunked\n  analysis misses\n```"},
        {"label": "Architecture review", "description": "Pattern consistency, coupling analysis, dependency violations", "markdown": "```\nArchitecture Review\n───────────────────\n  ┌──────────────────────┐\n  │ Pattern consistency  │\n  │ Coupling metrics     │\n  │   A ←→ B  (tight)   │\n  │   C ──▶ D  (clean)  │\n  │ Dependency violations│\n  │ Layer enforcement    │\n  └──────────────────────┘\n  Cross-file analysis of\n  architectural integrity\n```"},
        {"label": "Dependency audit", "description": "License compliance, CVE checking, version currency", "markdown": "```\nDependency Audit\n────────────────\n  ┌──────────────────────┐\n  │ CVE scan       N vuls│\n  │ License check  ✓/✗   │\n  │ Version drift  N old │\n  │ Unused deps    N     │\n  │ Transitive risk      │\n  └──────────────────────┘\n  npm audit + pip-audit +\n  license compatibility\n```"}
      ],
      "multiSelect": true
    },
    {
      "question": "What should be audited?",
      "header": "Scope",
      "options": [
        {"label": "Entire codebase", "description": "Load all source files into context", "markdown": "```\nEntire Codebase\n───────────────\n  Load ALL source files\n  into 1M context window\n\n  Best for: first audit,\n  full security review,\n  architecture assessment\n  ⚠ Requires Tier 4+ API\n```"},
        {"label": "Specific directory", "description": "Focus on a subdirectory (e.g., src/api/)", "markdown": "```\nSpecific Directory\n──────────────────\n  Load one subtree:\n  src/api/ or src/auth/\n\n  Best for: targeted review,\n  post-change validation,\n  smaller context budget\n```"},
        {"label": "Changed files only", "description": "Audit only files changed vs main branch", "markdown": "```\nChanged Files Only\n──────────────────\n  git diff main...HEAD\n  Load only modified files\n\n  Best for: pre-merge check,\n  PR-scoped audit,\n  incremental review\n```"}
      ],
      "multiSelect": false
    }
  ]
)
```

**Based on answers, adjust workflow:**
- **Full audit**: All 3 domains, maximum context usage
- **Security only**: Focus token budget on source + config files
- **Architecture only**: Focus on module boundaries, imports, interfaces
- **Dependency only**: Focus on lock files, manifests, import maps
- **Changed files only**: Use `git diff --name-only main...HEAD` to scope
