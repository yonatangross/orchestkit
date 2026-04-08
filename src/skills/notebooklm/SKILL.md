---
name: notebooklm
license: MIT
compatibility: "Claude Code 2.1.76+."
author: OrchestKit
description: "NotebookLM integration patterns for external RAG, research synthesis, studio content generation (audio, cinematic video, slides, infographics, mind maps), and knowledge management. Use when creating notebooks, adding sources, generating audio/video, or querying NotebookLM via MCP."
version: 1.2.0
tags: [notebooklm, mcp, rag, google, podcast, video, cinematic, research, knowledge-management]
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

NotebookLM = external RAG engine that offloads reading from your context window. Uses the `notebooklm-mcp-cli` MCP server (PyPI, v0.5.0+) to create notebooks, manage sources, generate content, and query with grounded AI responses. Supports batch operations across notebooks, pipelines, and multilingual content generation.

> **Disclaimer**: Uses internal undocumented Google APIs via browser authentication. Sessions last ~20 minutes. API may change without notice.

### What's New (March 2026)

- **Cinematic Video Overviews** (Mar 4) — fully animated narrated videos powered by Gemini 3 + Veo 3. Google AI Ultra only, 20/day limit, English only.
- **4 Audio Formats** — Brief, Critique, Debate, Deep Dive (was single podcast style)
- **8x Source Capacity** — 8x more source material per conversation, 6x extended memory
- **Per-Slide Editing** — `studio_revise` edits individual slides without regenerating the full deck
- **3-Panel UI** — Sources / Chat / Studio layout on notebooklm.google.com
- **Research timeout** (v0.5.0) — `research_import` now configurable via `--timeout` / `timeout` param (default 300s, was 120s)
- **Deep research errors** (v0.5.1) — `RPCError` class with error codes, auto-retry on transient API failures

## Prerequisites

1. **Install**: `uv tool install notebooklm-mcp-cli` (or `pip install notebooklm-mcp-cli`)
2. **Authenticate**: `nlm login` (opens browser, session ~20 min)
3. **Configure MCP**: `nlm setup add claude-code` (auto-configures `.mcp.json`) or `nlm setup add all` for multi-tool setup
4. **Verify**: `nlm login --check` to confirm active session
5. **Upgrade**: `uv tool upgrade notebooklm-mcp-cli` — restart MCP server after upgrade

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="NotebookLM: {operation}",
  description="Managing notebooks, sources, and content generation",
  activeForm="Managing NotebookLM resources"
)

# 2. Create subtasks for the notebook workflow
TaskCreate(subject="Notebook setup", activeForm="Creating/configuring notebook")
TaskCreate(subject="Source management", activeForm="Adding sources to notebook")
TaskCreate(subject="Content generation", activeForm="Generating studio content")

# 3. Set dependencies for sequential steps
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

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
│   ├── Rename a source ──────────► source_rename
│   └── Manage sources ──────────► rules/setup-quickstart.md
│
├── Query a notebook (AI chat)
│   ├── Ask questions ────────────► notebook_query
│   └── Configure chat style ────► chat_configure
│
├── Generate studio content
│   ├── 10 artifact types ───────► rules/workflow-studio-content.md
│   ├── Revise slides ───────────► studio_revise (creates new deck)
│   └── Export to Docs/Sheets ──► export_artifact
│
├── Research & discovery
│   └── Web/Drive research ──────► rules/workflow-research-discovery.md
│
├── Notes (capture insights)
│   └── Create/list/update/delete ► note (unified tool)
│
├── Sharing & collaboration
│   └── Public links / invites / batch ► rules/workflow-sharing-collaboration.md
│
├── Batch & cross-notebook
│   ├── Query across notebooks ────► cross_notebook_query
│   ├── Bulk operations ───────────► batch (query, add-source, create, studio)
│   └── Multi-step pipelines ──────► rules/workflow-batch-pipelines.md
│
├── Organization
│   └── Tag notebooks ─────────────► tags
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
| **Workflows** | `workflow-studio-content.md` | HIGH | 10 artifact types (audio, cinematic video, slides, infographics, mind maps...) |
| **Research** | `workflow-research-discovery.md` | HIGH | Web/Drive research async flow |
| **Collaboration** | `workflow-sharing-collaboration.md` | MEDIUM | Public links, collaborator invites, batch sharing |
| **Batch** | `workflow-batch-pipelines.md` | HIGH | Cross-notebook queries, batch ops, pipelines |
| **Release** | `workflow-versioned-notebooks.md` | HIGH | Per-release notebooks with changelog + diffs |

**Total: 9 rules across 5 categories**

## MCP Tools by API Group

| Group | Tools | Count |
|-------|-------|-------|
| Notebooks | notebook_list, notebook_create, notebook_get, notebook_describe, notebook_rename, notebook_delete | 6 |
| Sources | source_add, source_rename, source_list_drive, source_sync_drive, source_delete, source_describe, source_get_content | 7 |
| Querying | notebook_query, chat_configure | 2 |
| Studio | studio_create, studio_status, studio_list_types, studio_revise, studio_delete | 5 |
| Research | research_start, research_status, research_import | 3 |
| Sharing | notebook_share_status, notebook_share_public, notebook_share_invite, notebook_share_batch | 4 |
| Notes | note (unified: list/create/update/delete) | 1 (4 actions) |
| Downloads | download_artifact | 1 |
| Export | export_artifact (Google Docs/Sheets) | 1 |
| Batch | batch (multi-notebook ops), cross_notebook_query | 2 |
| Pipelines | pipelines (ingest-and-podcast, research-and-report, multi-format) | 1 |
| Tags | tags (organize and smart-select notebooks) | 1 |
| Auth | save_auth_tokens, refresh_auth, server_info | 3 |

**Total: 37 tools across 13 groups** (v0.5.0+)

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New notebook vs existing | One notebook per project/topic; add sources to existing |
| Source type | URL for web, text for inline, file for local docs, drive for Google Docs |
| Large sources | Split >50K chars into multiple sources for better retrieval |
| Auth expired? | `nlm login --check`; sessions last ~20 min, re-auth with `nlm login` |
| Studio content | Use studio_create, poll with studio_status (generation takes 2-5 min) |
| Cinematic video | `studio_create(artifact_type="cinematic_video")` — requires Ultra, English only, 20/day |
| Audio format | Choose brief/critique/debate/deep_dive via `audio_format` param |
| Research discovery | research_start for web/Drive discovery, then research_import (timeout=300s default) |
| Deep research | `research_start(mode="deep")` for multi-source synthesis (v0.5.1+, auto-retries) |
| Release notebooks | One notebook per minor version; upload CHANGELOG + key skill diffs as sources |
| Query vs search | notebook_query for AI-grounded answers; source_get_content for raw text |
| Notes vs sources | Notes for your insights/annotations; sources for external documents |
| Infographic style | 11 visual styles via `infographic_style` param on studio_create |
| Slide revision | Use `studio_revise` to edit individual slides (creates a new deck) |
| Export artifacts | `export_artifact` sends reports → Google Docs, data tables → Sheets |
| Language | `language` param on studio_create accepts BCP-47 codes (e.g., `he` for Hebrew, `en`, `es`, `ja`) |
| Batch operations | Use `batch` for multi-notebook ops; `cross_notebook_query` for aggregated answers |
| Pipelines | `ingest-and-podcast` / `research-and-report` / `multi-format` for multi-step workflows |

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

# 4. Generate a deep dive audio overview (supports language param)
studio_create(notebook_id="...", artifact_type="audio", audio_format="deep_dive", language="he", confirm=True)
studio_status(notebook_id="...")  # Poll until complete

# 5. Generate a cinematic video overview (Ultra only, English)
studio_create(notebook_id="...", artifact_type="cinematic_video", confirm=True)
studio_status(notebook_id="...")  # Poll — takes 3-8 minutes

# 6. Capture insights as notes
note(notebook_id="...", action="create", content="Key takeaway: PKCE is mandatory in 2.1")
```

## Common Mistakes

- **Forgetting auth expiry** — Sessions last ~20 min. Always check with `nlm login --check` before long workflows. Re-auth with `nlm login`.
- **One giant notebook** — Split by project/topic. One notebook with 50 sources degrades retrieval quality.
- **Huge single sources** — Split documents >50K characters into logical sections for better chunking and retrieval.
- **Not polling studio_status** — Studio content generation takes 2-5 minutes. Poll `studio_status` instead of assuming instant results.
- **Ignoring source types** — Use `type=url` for web pages (auto-extracts), `type=file` for local files. Using `type=text` for a URL gives you the URL string, not the page content.
- **Deleting notebooks without checking** — `notebook_delete` is irreversible. List contents with `source_list_drive` and `note(action=list)` first.
- **Skipping research_import** — `research_start` discovers content but does not add it. Use `research_import` to actually add findings as sources.
- **Raw queries on empty notebooks** — `notebook_query` returns poor results with no sources. Add sources before querying.
- **Ignoring language param** — `studio_create` supports BCP-47 `language` codes (e.g., `he`, `ar`, `ja`). Defaults to English if omitted.
- **Batch without purpose** — `batch` and `cross_notebook_query` are powerful but add latency. Use for multi-project synthesis, not single-notebook tasks.

## Related Skills

- `ork:mcp-patterns` — MCP server building, security, and composition patterns
- `ork:web-research-workflow` — Web research strategies and source evaluation
- `ork:memory` — Memory fabric for cross-session knowledge persistence
- `ork:security-patterns` — Input sanitization and layered security
