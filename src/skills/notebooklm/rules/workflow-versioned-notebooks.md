---
title: "Versioned Notebooks Per Release"
impact: HIGH
impactDescription: "Without versioned notebooks, release knowledge is lost and users cannot query historical release context."
tags: [notebooklm, release, changelog, versioning]
---

## Versioned Notebooks Per Release

Create a dedicated NotebookLM notebook for each OrchestKit release to preserve release context, changelog details, and key skill diffs as a queryable knowledge base.

### When to Create

- On every minor or major release (e.g., v7.0.0, v7.1.0)
- Patch releases can be appended to the existing minor notebook

### Notebook Naming

```
OrchestKit v{MAJOR}.{MINOR} Release Notes
```

Examples: `OrchestKit v7.0 Release Notes`, `OrchestKit v7.1 Release Notes`

### Sources to Upload

For each release notebook, add these sources:

| Source | Type | Purpose |
|--------|------|---------|
| `CHANGELOG.md` (release section) | text | Full changelog for the release |
| Key skill diffs | text | Before/after for skills with significant changes |
| Migration guide (if breaking) | text | Breaking changes and migration steps |
| PR descriptions | text | Merged PR summaries for context |
| Updated CLAUDE.md | file | Current project instructions snapshot |

### Workflow

```python
# 1. Create release notebook
notebook_create(title="OrchestKit v7.0 Release Notes")

# 2. Add changelog section
source_add(notebook_id="...", type="text",
  title="CHANGELOG v7.0.0",
  content="<paste relevant CHANGELOG.md section>")

# 3. Add key skill diffs (significant changes only)
source_add(notebook_id="...", type="text",
  title="Skill Changes: implement",
  content="<diff summary of implement skill changes>")

# 4. Add migration guide for breaking changes
source_add(notebook_id="...", type="text",
  title="Migration Guide v6 to v7",
  content="<breaking changes and migration steps>")

# 5. Share with team
notebook_share_invite(notebook_id="...",
  email="your-email@example.com", role="writer")
```

**Incorrect:**
```python
# Dump everything into one shared notebook
source_add(notebook_id="shared", type="text", title="v7 + v6 + v5 notes",
  content="<all changelogs mixed together>")
```

**Correct:**
```python
# One notebook per minor version with focused sources
notebook_create(title="OrchestKit v7.0 Release Notes")
source_add(notebook_id="v7", type="text", title="CHANGELOG v7.0.0",
  content="<v7.0.0 changelog section only>")
```

### Key Rules

- One notebook per minor version — do not mix v7.0 and v7.1 content
- Upload CHANGELOG section as `type=text` (not file) for better chunking
- Include skill diffs only for skills with significant functional changes (not cosmetic edits)
- Add a note summarizing the release theme after uploading sources
- Generate an audio overview via `studio_create(type="deep_dive")` for each release

### Querying Release History

```python
# Query specific release context
notebook_query(notebook_id="...",
  query="What changed in the implement skill for v7.0?")

# Compare across releases (query the relevant notebook)
notebook_query(notebook_id="...",
  query="What breaking changes were introduced?")
```
