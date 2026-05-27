# Audit Scope Dialog

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify audit scope:

```python
AskUserQuestion(
  questions=[
    {
      "question": "What type of audit do you want to run?",
      "header": "Audit mode",
      # multiSelect questions do not render previews (single-select only) — text-only
      "options": [
        {"label": "Full audit (Recommended)", "description": "Security + architecture + dependencies in one pass (Opus 1M context, all files at once)"},
        {"label": "Security audit", "description": "Cross-file vulnerability analysis, data flow tracing, OWASP mapping, secret detection"},
        {"label": "Architecture review", "description": "Pattern consistency, coupling metrics, dependency violations, layer enforcement"},
        {"label": "Dependency audit", "description": "CVE scan, license compliance, version drift, unused/transitive-risk deps"}
      ],
      "multiSelect": true
    },
    {
      "question": "What should be audited?",
      "header": "Scope",
      "options": [
        {"label": "Entire codebase", "description": "Load all source files into context", "preview": "```\nEntire Codebase\n───────────────\n  Load ALL source files\n  into 1M context window\n\n  Best for: first audit,\n  full security review,\n  architecture assessment\n  ⚠ Requires Tier 4+ API\n```"},
        {"label": "Specific directory", "description": "Focus on a subdirectory (e.g., src/api/)", "preview": "```\nSpecific Directory\n──────────────────\n  Load one subtree:\n  src/api/ or src/auth/\n\n  Best for: targeted review,\n  post-change validation,\n  smaller context budget\n```"},
        {"label": "Changed files only", "description": "Audit only files changed vs main branch", "preview": "```\nChanged Files Only\n──────────────────\n  git diff main...HEAD\n  Load only modified files\n\n  Best for: pre-merge check,\n  PR-scoped audit,\n  incremental review\n```"}
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
