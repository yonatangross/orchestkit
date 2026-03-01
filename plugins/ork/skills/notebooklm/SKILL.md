---
name: notebooklm
license: MIT
compatibility: "Claude Code 2.1.59+."
author: OrchestKit
description: NotebookLM integration patterns for external RAG, research synthesis, studio content generation, and knowledge management via the notebooklm-mcp-cli MCP server.
version: 1.0.0
tags: [notebooklm, mcp, rag, google, podcast, research, knowledge-management]
user-invocable: false
disable-model-invocation: true
context: fork
complexity: medium
metadata:
  category: mcp-enhancement
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# NotebookLM

NotebookLM = external RAG engine that offloads reading from your context window. Uses the `notebooklm-mcp-cli` MCP server (PyPI) to create notebooks, manage sources, generate content, and query with grounded AI responses.

> **Disclaimer**: Uses internal undocumented Google APIs via browser authentication. Sessions last ~20 minutes. API may change without notice.

## Prerequisites

1. **Install**: `uv tool install notebooklm-mcp-cli` (or `pip install notebooklm-mcp-cli`)
2. **Authenticate**: `nlm login` (opens browser, session ~20 min)
3. **Configure MCP**: `nlm setup add claude-code` (auto-configures `.mcp.json`)
4. **Alternative**: `nlm skill install` for guided setup with verification
5. **Verify**: `nlm login --check` to confirm active session

## Decision Tree — Which Rule to Read

```
What are you trying to do?
│
├── Create / manage notebooks
│   ├── List / get / rename ──────► notebook_list, notebook_get, notebook_rename
│   ├── Create new notebook ──────► notebook_create
│   └── Delete notebook ──────────► notebook_delete (irreversible!)
│
├── Add sources to a notebook
│   ├── URL / YouTube ────────────► source_add(type=url)
│   ├── Plain text ───────────────► source_add(type=text)
│   ├── Local file ───────────────► source_add(type=file)
│   ├── Google Drive ─────────────► source_add(type=drive)
│   └── Manage sources ──────────► rules/setup-quickstart.md
│
├── Query a notebook (AI chat)
│   ├── Ask questions ────────────► notebook_query
│   └── Configure chat style ────► chat_configure
│
├── Generate studio content
│   └── 9 artifact types ────────► rules/workflow-studio-content.md
│
├── Research & discovery
│   └── Web/Drive research ──────► rules/workflow-research-discovery.md
│
├── Notes (capture insights)
│   └── Create/list/update/delete ► note (unified tool)
│
├── Sharing & collaboration
│   └── Public links / invites ──► rules/workflow-sharing-collaboration.md
│
└── Workflow patterns
    ├── Second brain ─────────────► rules/workflow-second-brain.md
    ├── Research offload ─────────► rules/workflow-research-offload.md
    └── Knowledge base ──────────► rules/workflow-knowledge-base.md
```

## Quick Reference

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| **Setup** | `setup-quickstart.md` | HIGH | Auth, MCP config, source management, session refresh |
| **Workflows** | `workflow-second-brain.md` | HIGH | Decision docs, project hub, agent interop |
| **Workflows** | `workflow-research-offload.md` | HIGH | Synthesis, onboarding, token savings |
| **Workflows** | `workflow-knowledge-base.md` | HIGH | Debugging KB, security handbook, team knowledge |
| **Workflows** | `workflow-studio-content.md` | MEDIUM | 9 artifact types (audio overview, deep dive, slides...) |
| **Research** | `workflow-research-discovery.md` | HIGH | Web/Drive research async flow |
| **Collaboration** | `workflow-sharing-collaboration.md` | MEDIUM | Public links, collaborator invites |
| **Release** | `workflow-versioned-notebooks.md` | HIGH | Per-release notebooks with changelog + diffs |

**Total: 8 rules across 4 categories**

## MCP Tools by API Group

| Group | Tools | Count |
|-------|-------|-------|
| Notebooks | notebook_list, notebook_create, notebook_get, notebook_describe, notebook_rename, notebook_delete | 6 |
| Sources | source_list, source_add, source_list_drive, source_sync_drive, source_delete, source_describe, source_get_content | 7 |
| Querying | notebook_query, chat_configure | 2 |
| Studio | studio_create, studio_status, studio_delete | 3 |
| Research | research_start, research_status, research_import | 3 |
| Sharing | notebook_share_status, notebook_share_public, notebook_share_invite | 3 |
| Notes | note (unified: list/create/update/delete) | 1 (4 actions) |
| Downloads | download_artifact | 1 |
| Auth | save_auth_tokens, refresh_auth | 2 |

**Total: 29 tools across 9 groups**

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New notebook vs existing | One notebook per project/topic; add sources to existing |
| Source type | URL for web, text for inline, file for local docs, drive for Google Docs |
| Large sources | Split >50K chars into multiple sources for better retrieval |
| Auth expired? | `nlm login --check`; sessions last ~20 min, re-auth with `nlm login` |
| Studio content | Use studio_create, poll with studio_status (generation takes 2-5 min) |
| Research discovery | research_start for web/Drive discovery, then research_import to add findings |
| Release notebooks | One notebook per minor version; upload CHANGELOG + key skill diffs as sources |
| Query vs search | notebook_query for AI-grounded answers; source_get_content for raw text |
| Notes vs sources | Notes for your insights/annotations; sources for external documents |

## Example

```bash
# 1. Create a notebook for your project
notebook_create(title="Auth Refactor Research")

# 2. Add sources (docs, articles, existing code analysis)
source_add(notebook_id="...", type="url", url="https://oauth.net/2.1/")
source_add(notebook_id="...", type="text", content="Our current auth uses...")
source_add(notebook_id="...", type="file", path="/docs/auth-design.md")

# 3. Query with grounded AI responses
notebook_query(notebook_id="...", query="What are the key differences between OAuth 2.0 and 2.1?")

# 4. Generate a deep dive audio overview
studio_create(notebook_id="...", type="deep_dive")
studio_status(notebook_id="...")  # Poll until complete

# 5. Capture insights as notes
note(notebook_id="...", action="create", content="Key takeaway: PKCE is mandatory in 2.1")
```

## Common Mistakes

- **Forgetting auth expiry** — Sessions last ~20 min. Always check with `nlm login --check` before long workflows. Re-auth with `nlm login`.
- **One giant notebook** — Split by project/topic. One notebook with 50 sources degrades retrieval quality.
- **Huge single sources** — Split documents >50K characters into logical sections for better chunking and retrieval.
- **Not polling studio_status** — Studio content generation takes 2-5 minutes. Poll `studio_status` instead of assuming instant results.
- **Ignoring source types** — Use `type=url` for web pages (auto-extracts), `type=file` for local files. Using `type=text` for a URL gives you the URL string, not the page content.
- **Deleting notebooks without checking** — `notebook_delete` is irreversible. List contents with `source_list` and `note(action=list)` first.
- **Skipping research_import** — `research_start` discovers content but does not add it. Use `research_import` to actually add findings as sources.
- **Raw queries on empty notebooks** — `notebook_query` returns poor results with no sources. Add sources before querying.

## Related Skills

- `ork:mcp-patterns` — MCP server building, security, and composition patterns
- `ork:web-research-workflow` — Web research strategies and source evaluation
- `ork:memory` — Memory fabric for cross-session knowledge persistence
- `ork:security-patterns` — Input sanitization and layered security
