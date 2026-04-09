---
name: release-sync
description: "Sync release content to NotebookLM and HQ Knowledge Base after tagging a new version. Reads CHANGELOG, CLAUDE.md, and hook README, then updates notebook sources and ingests to knowledge base."
version: 1.0.0
author: OrchestKit
tags: [release, notebooklm, knowledge-base, content-sync, automation]
user-invocable: true
argument-hint: "[version]"
complexity: low
persuasion-type: collaborative
triggers:
  keywords: [release-sync, sync release, update notebooklm, sync kb, push release content]
  examples:
    - "sync the latest release to notebooklm"
    - "update the knowledge base with v7.27.0 changes"
    - "push release notes to notebooklm and hq"
  anti-triggers:
    - "create a release"
    - "tag a version"
    - "bump version"
---

# Release Content Sync

Sync the latest OrchestKit release to external knowledge systems.

## What This Does

1. Reads the latest CHANGELOG entry, CLAUDE.md, and hook README
2. Updates the OrchestKit NotebookLM KB notebook with fresh sources
3. Ingests the release digest into HQ Knowledge Base (if available)
4. Optionally generates a new podcast from the updated notebook

## Prerequisites

- MCP servers: `notebooklm-mcp` and/or `hq-content`
- NotebookLM notebook ID stored in `.claude/release-sync-config.json`

## Step 1: Detect Version and Read Sources

```python
# Read current version from CLAUDE.md
version = Grep(pattern="Current.*\\d+\\.\\d+\\.\\d+", path="CLAUDE.md")

# Read CHANGELOG — extract latest release section
changelog = Read("CHANGELOG.md", limit=80)

# Read hook architecture summary
hook_readme = Read("src/hooks/README.md", limit=100)

# Read CLAUDE.md for project overview
claude_md = Read("CLAUDE.md")
```

## Step 2: Load Config

```python
config = Read(".claude/release-sync-config.json")
# Expected format:
# {
#   "notebooklm_notebook_id": "0a05e680-e33b-4d8c-94b2-5df26a1af329",
#   "hq_kb_project": "orchestkit"
# }
```

If config doesn't exist, prompt user:

```python
AskUserQuestion(questions=[{
  "question": "NotebookLM notebook ID for OrchestKit KB?",
  "header": "Configuration",
  "options": [
    {"label": "Use default", "description": "OrchestKit v7 — Complete KB (0a05e680...)"},
    {"label": "I'll provide", "description": "Enter a custom notebook ID"}
  ]
}])
```

## Step 3: Update NotebookLM Sources

```python
# Probe MCP availability
ToolSearch(query="select:mcp__notebooklm-mcp__source_add")

# Add release digest as new source
mcp__notebooklm-mcp__source_add(
  notebook_id=config.notebooklm_notebook_id,
  source_type="text",
  title=f"Release {version} — {date}",
  text=release_digest,
  wait=True
)
```

## Step 4: Ingest to HQ Knowledge Base (Optional)

```python
# Probe HQ content MCP
ToolSearch(query="select:mcp__hq-content__knowledge_ingest")

# If available, ingest
mcp__hq-content__knowledge_ingest(
  title=f"OrchestKit {version} Release Notes",
  content=release_digest,
  project="orchestkit",
  content_type="release-notes"
)
```

## Step 5: Generate Podcast (Optional)

```python
AskUserQuestion(questions=[{
  "question": "Generate a podcast from the updated notebook?",
  "header": "Podcast",
  "options": [
    {"label": "Yes — deep dive", "description": "~10 min podcast covering all changes"},
    {"label": "Yes — brief", "description": "~3 min summary"},
    {"label": "No", "description": "Skip podcast generation"}
  ]
}])

if podcast_requested:
  mcp__notebooklm-mcp__studio_create(
    notebook_id=config.notebooklm_notebook_id,
    artifact_type="audio",
    audio_format=selected_format,
    confirm=True
  )
```

## Output

Report what was synced:

```
Release Sync Complete — v{version}
  NotebookLM: source added to {notebook_title}
  HQ KB: ingested as release-notes/{version}
  Podcast: generating (poll with studio_status)
```
