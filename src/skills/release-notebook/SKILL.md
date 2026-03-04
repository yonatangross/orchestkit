---
name: release-notebook
license: MIT
compatibility: "Claude Code 2.1.59+. Requires notebooklm-mcp-cli (`nlm login` active session)."
description: "Creates a versioned NotebookLM notebook for the current OrchestKit release. Reads version from package.json, extracts the matching CHANGELOG section, uploads CHANGELOG + CLAUDE.md + manifests/ork.json as sources, generates an audio overview, and shares the notebook. Use when cutting a release to create the Release KB."
version: 1.0.0
author: OrchestKit
tags: [notebooklm, release, documentation, knowledge-base]
user-invocable: false
complexity: medium
allowed-tools:
  - Read
  - Bash
  - Grep
  - mcp__notebooklm-mcp__notebook_create
  - mcp__notebooklm-mcp__source_add
  - mcp__notebooklm-mcp__studio_create
  - mcp__notebooklm-mcp__studio_status
  - mcp__notebooklm-mcp__notebook_share_status
  - mcp__notebooklm-mcp__notebook_share_invite
  - mcp__notebooklm-mcp__note
metadata:
  category: document-asset-creation
  mcp-server: notebooklm-mcp
---

# Release Notebook

Creates a dedicated NotebookLM notebook for the current OrchestKit release, preserving changelog details, project instructions, and the plugin manifest as a queryable knowledge base.

See `rules/workflow-versioned-notebooks.md` in the `notebooklm` skill for the canonical versioned-notebook pattern this skill implements.

## Preconditions

Before running:

1. `nlm login --check` — confirm an active session (~20 min TTL)
2. If session expired: `nlm login` (re-authenticates via browser)
3. If notebooklm-mcp-cli is not installed: `uv tool install notebooklm-mcp-cli`

## Workflow

Execute all steps in order. Stop and report if any MCP call fails.

### Step 1 — Read Release Metadata

```bash
# Read version (e.g. "7.0.1")
Read: package.json  →  extract .version
```

Derive notebook title and major.minor label:

```
FULL_VERSION  = package.json .version          # e.g. "7.0.1"
MINOR_LABEL   = MAJOR.MINOR of FULL_VERSION    # e.g. "7.0"
NOTEBOOK_TITLE = "OrchestKit v{MINOR_LABEL} — Release KB"
```

Patch releases (x.y.Z where Z > 0) append to the existing minor notebook when it already exists. If this is the first patch of a minor series, create a new notebook.

### Step 2 — Extract CHANGELOG Section

```bash
Read: CHANGELOG.md
```

Extract the section that starts with `## [7.0.1]` (or whichever `FULL_VERSION` is current) up to — but not including — the next `## [` heading. Store as `CHANGELOG_SECTION`.

If the version section is not found, halt and report: "CHANGELOG.md has no entry for v{FULL_VERSION}. Add one before creating the Release KB."

### Step 3 — Read Project Sources

```bash
Read: CLAUDE.md          →  CLAUDE_CONTENT
Read: manifests/ork.json →  MANIFEST_CONTENT
```

### Step 4 — Create Notebook

```python
notebook = mcp__notebooklm-mcp__notebook_create(
    title="OrchestKit v{MINOR_LABEL} — Release KB"
)
# Save: notebook_id = notebook.id
```

### Step 5 — Add Sources

Add each source separately for better retrieval chunking:

```python
# Source 1: changelog section
mcp__notebooklm-mcp__source_add(
    notebook_id=notebook_id,
    type="text",
    title="CHANGELOG v{FULL_VERSION}",
    content=CHANGELOG_SECTION
)

# Source 2: project instructions
mcp__notebooklm-mcp__source_add(
    notebook_id=notebook_id,
    type="text",
    title="CLAUDE.md — Project Instructions",
    content=CLAUDE_CONTENT
)

# Source 3: plugin manifest
mcp__notebooklm-mcp__source_add(
    notebook_id=notebook_id,
    type="text",
    title="manifests/ork.json — Plugin Manifest",
    content=MANIFEST_CONTENT
)
```

### Step 6 — Add Release Summary Note

```python
mcp__notebooklm-mcp__note(
    notebook_id=notebook_id,
    action="create",
    content="Release KB for OrchestKit v{FULL_VERSION}. Sources: CHANGELOG section, CLAUDE.md, manifests/ork.json."
)
```

### Step 7 — Generate Audio Overview

Audio generation is async. Create, then poll until complete or failed.

```python
# Trigger generation
artifact = mcp__notebooklm-mcp__studio_create(
    notebook_id=notebook_id,
    type="audio_overview"
)

# Poll (check every ~30s; generation takes 2-5 min)
status = mcp__notebooklm-mcp__studio_status(artifact_id=artifact.id)
# Repeat until status in ("completed", "failed")
# Inform user: "Generating audio overview... (status: {status})"
```

If generation fails, log the failure but do not halt — the notebook is still useful without audio.

### Step 8 — Share Notebook

```python
# Check current sharing status first
share_status = mcp__notebooklm-mcp__notebook_share_status(notebook_id=notebook_id)

# Invite project owner as writer
mcp__notebooklm-mcp__notebook_share_invite(
    notebook_id=notebook_id,
    email="yonatan2gross@gmail.com",
    role="writer"
)
```

Do not enable public link unless the user explicitly requests it — release notebooks may contain pre-release details.

### Step 9 — Output Summary

Print a structured summary:

```
Release KB created for OrchestKit v{FULL_VERSION}

  Notebook : OrchestKit v{MINOR_LABEL} — Release KB
  ID       : {notebook_id}
  Sources  : CHANGELOG v{FULL_VERSION} | CLAUDE.md | manifests/ork.json
  Audio    : {completed | failed | pending}
  Shared   : yonatan2gross@gmail.com (writer)

Query this notebook with:
  notebook_query(notebook_id="{notebook_id}", query="What changed in v{FULL_VERSION}?")
```

## Error Handling

| Error | Action |
|-------|--------|
| `nlm login` session expired | Halt. Print: "Run `nlm login` to re-authenticate, then retry." |
| notebook_create fails | Halt. Print MCP error. Check `nlm login --check`. |
| source_add fails on one source | Log warning, continue with remaining sources. |
| CHANGELOG section missing | Halt before notebook_create. Report missing entry. |
| studio_create fails | Log warning, continue — notebook is still valid. |
| studio_status = "failed" | Log warning with artifact ID, continue. |

## Related Skills

- `ork:notebooklm` — Full NotebookLM MCP tool reference and workflow patterns
- `ork:release-checklist` — Pre-release gates (run before this skill)
- `ork:release-management` — GitHub release creation with gh CLI
