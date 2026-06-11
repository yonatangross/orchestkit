---
name: design-ship
license: MIT
compatibility: "Claude Code 2.1.170+. Requires: design-import skill, claude-design-orchestrator agent. Composes: cover, expect, create-pr."
description: "End-to-end Claude Design handoff to pull request: imports a handoff bundle from claude.ai/design, generates Storybook stories and Playwright tests, runs diff-aware browser verification, and opens a PR with the bundle URL, before/after screenshots, and coverage delta embedded in the body. The one-shot 'design URL in, reviewable PR out' workflow. Use when a designer or PM hands you a Claude Design URL and you want a PR back without intermediate steps."
argument-hint: "<handoff-url | path-to-bundle.json>"
tags: [claude-design, design-ship, end-to-end, pr, handoff, ship-it, frontend]
context: fork
version: 1.0.0
author: OrchestKit
user-invocable: true
complexity: complex
persuasion-type: collaborative
effort: high
model: sonnet
agent: claude-design-orchestrator
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - AskUserQuestion
  - Agent
  - TaskCreate
  - TaskUpdate
  - TaskList
skills:
  - design-import
  - cover
  - expect
  - create-pr
  - remember
  - memory
metadata:
  category: workflow-automation
triggers:
  keywords: ["design ship", "design to pr", "ship claude design", "handoff to pr", "design-ship"]
  examples:
    - "ship this Claude Design handoff: https://claude.ai/design/abc123"
    - "design URL in, PR out"
    - "design-ship /tmp/handoff.json"
  anti-triggers: [import only, scaffold only, brainstorm]
paths:
  - "src/components/**/*.{tsx,css}"
  - "**/*.stories.{ts,tsx}"
  - "tests/e2e/**"
  - ".claude/design-handoffs/**"
---

# Design Ship

One command: Claude Design handoff URL → reviewable GitHub PR.

```bash
/ork:design-ship https://claude.ai/design/abc123     # From handoff URL
/ork:design-ship /tmp/handoff-bundle.json            # From local file
```

## When to use
You have a Claude Design handoff URL (or file) and want a PR opened against the current branch. No intermediate steps, no manual test generation, no manual PR drafting.

For just-the-import (no tests, no PR), use `/ork:design-import` instead.

## Pipeline

```
Handoff bundle (URL or file)
  │
  ▼
┌──────────────────────────────┐
│ 1. /ork:design-import         │  Scaffold components, write provenance
│    (delegates to orchestrator │  Tokens reconciled
│     for parse + dedup)        │  Components written or reused
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 2. /ork:cover                 │  Storybook stories per new component
│    (Storybook + Playwright)   │  Playwright E2E for new routes/views
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 3. /ork:expect                │  Diff-aware browser verification
│    (CDP + ARIA-tree-first)    │  Screenshots saved for PR body
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 4. /ork:create-pr             │  PR opened with:
│                               │   - Claude Design URL link
│                               │   - Before/after screenshots
│                               │   - Component scaffold list
│                               │   - Coverage delta
│                               │   - Label: claude-design
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 5. UPDATE PROVENANCE          │  Patch .claude/design-handoffs/<id>.json
│                               │  with the opened PR number + URL
└──────────────────────────────┘
```

## Pre-flight

Before starting the pipeline, verify the working tree is clean enough to ship:

```python
status = Bash("git status --porcelain")
if status:
    AskUserQuestion(questions=[{
      "question": "Working tree has uncommitted changes. How to proceed?",
      "header": "Pre-flight",
      "options": [
        {"label": "Commit them first", "description": "Run /ork:commit, then proceed with ship"},
        {"label": "Stash and restore", "description": "Stash now, restore after PR opens"},
        {"label": "Include in this PR", "description": "Risky — only if changes are related"},
        {"label": "Cancel", "description": "Abort design-ship"}
      ],
      "multiSelect": False
    }])

current_branch = Bash("git branch --show-current")
if current_branch in ("main", "master", "dev"):
    AskUserQuestion(questions=[{
      "question": f"You're on {current_branch}. Create a feature branch?",
      "header": "Branch",
      "options": [
        {"label": "Yes — feat/design-ship-<bundle-id>", "description": "Recommended"},
        {"label": "Cancel", "description": "Switch branch yourself first"}
      ],
      "multiSelect": False
    }])
```

## Phase 1 — Import

Delegate to `/ork:design-import` with the bundle argument. Capture its output (the import manifest) — it includes the bundle_id, list of components written, and the provenance file path.

If import fails, **stop**. Do NOT proceed to test generation against partially-imported components.

## Phase 2 — Cover

Run `/ork:cover` scoped to the components written by phase 1:

```python
component_paths = [c["path"] for c in import_result["components"] if c["decision"] != "reuse"]

Agent(
  subagent_type="ork:test-generator",
  description="Cover the freshly-imported components",
  prompt=f"""Use the cover skill to generate tests for these components (scoped — do not regenerate suites for unrelated files):
  {component_paths}

  Tiers needed:
  - Storybook stories per component (mandatory)
  - Playwright E2E if any new route was registered (check src/app or src/pages)
  - Unit tests if the components include non-trivial logic (skip for pure-presentation)
  """
)
```

## Phase 3 — Expect

Run `/ork:expect` to do diff-aware browser verification. This produces the screenshots that go into the PR body:

```python
Agent(
  subagent_type="ork:expect-agent",
  description="Diff-aware verification of imported components",
  prompt=f"""Use the expect skill on the current diff.

  Extra: capture before/after screenshots for each new component
  and save them to .claude/design-handoffs/{bundle_id}/screenshots/.
  These will be uploaded to the PR body.

  If verification fails, do not block — report findings and continue.
  Failures will surface in the PR review.
  """
)
```

## Phase 4 — Create PR

Use `/ork:create-pr` with a body templated from the bundle and verification results:

```python
pr_body = f"""## Summary
Generated from Claude Design handoff: {bundle_url}

Bundle ID: `{bundle_id}` · Provenance: `.claude/design-handoffs/{bundle_id}.json`

## Components
| Decision | Component | Path |
|---|---|---|
{table_from(import_result['components'])}

## Tokens
- Added: {len(token_diff['added'])}
- Modified: {len(token_diff['modified'])}
- Conflicts (resolved): {len(token_diff['conflicts'])}

## Verification (`/ork:expect`)
{expect_summary}

## Coverage delta (`/ork:cover`)
{coverage_delta}

## Screenshots
{screenshot_table}

---
🤖 Opened by `/ork:design-ship` · Closes: (none — link issues manually)
"""

Bash(f"gh pr create --title '{pr_title}' --body @- <<< '{pr_body}' --label claude-design")
```

## Phase 5 — Update provenance

Patch the provenance file with the opened PR number and URL:

```python
provenance = Read(f".claude/design-handoffs/{bundle_id}.json")
provenance["pr"] = {"number": pr_number, "url": pr_url, "opened_at": now()}
Write(f".claude/design-handoffs/{bundle_id}.json", provenance)
```

## Failure modes

| Phase | Failure | Behavior |
|---|---|---|
| Pre-flight | Dirty tree, on main | AskUserQuestion, do not proceed silently |
| 1. Import | Schema deviation, token conflict | `design-import` already prompts; if user cancels, abort |
| 2. Cover | Test generation fails | Continue to expect — tests are recoverable in PR review |
| 3. Expect | Browser verification fails | Continue to PR — failures noted in PR body |
| 4. Create PR | `gh` not authenticated | Stop, surface auth error |
| 5. Provenance | File not writable | Warn but do not fail (PR is already open) |

## Composition

| Skill | Role |
|---|---|
| `design-import` | Phase 1 — scaffold components |
| `cover` | Phase 2 — Storybook + Playwright |
| `expect` | Phase 3 — diff-aware browser verification |
| `create-pr` | Phase 4 — open PR with templated body |
| `remember` / `memory` | Provenance updates |

## NOT this skill's job

| Concern | Owned by |
|---|---|
| Parsing bundles | `claude-design-orchestrator` agent (called by `design-import`) |
| Component dedup | Orchestrator agent (called by `design-import`) |
| Test execution (CI) | GitHub Actions — this skill only generates tests |
| Merging the PR | Human reviewer — never auto-merge |

## Limitations

- **No auto-merge**: this skill opens the PR; humans review and merge.
- **No iteration loop**: if the PR review surfaces design changes, you currently re-export from Claude Design and re-run `/ork:design-ship`. The reverse-path (live UI drift → refinement prompt for claude.ai/design) is tracked in M124 — Claude Design Drift Sync (Bet B): #1391 (PR hook), #1393 (`/ork:design-iterate`), #1395 (design-drift-detector agent).
- **Single-bundle scope**: one invocation, one bundle, one PR. Multi-bundle batches are not supported.
