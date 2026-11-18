# Ship mode: design export to a reviewable PR

One command: Claude Design export in, reviewable GitHub PR out. Formerly the `design-ship` skill.

```bash
design-to-code ship ~/Downloads/pricing-page.zip     # "Download as .zip"
design-to-code ship ~/Downloads/pricing-page.html    # "Export as standalone HTML"
design-to-code ship ./design-export/                 # an unpacked export
```

Use it when you have a design export and want a PR opened against the current branch. No intermediate steps, no manual test generation, no manual PR drafting.

For just-the-import (no tests, no PR), use `import` mode instead (`Read("references/import-mode.md")`). Export formats and the handoff URL of the standalone site that still works until 2026-12-14: `Read("references/export-formats.md")`.

## Pipeline

```
Design export (zip, standalone HTML, or folder)
  │
  ▼
┌──────────────────────────────┐
│ 1. import mode               │  Scaffold components, write provenance
│    (delegates to orchestrator │  Tokens reconciled
│     for parse + dedup)        │  Components written or reused
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 2. cover                     │  Storybook stories per new component
│    (Storybook + Playwright)   │  Playwright E2E for new routes/views
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 3. expect                    │  Diff-aware browser verification
│    (CDP + ARIA-tree-first)    │  Screenshots saved for PR body
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 4. create-pr                 │  PR opened with:
│                               │   - Export source
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
        {"label": "Commit them first", "description": "Run commit, then proceed with ship"},
        {"label": "Stash and restore", "description": "Stash now, restore after PR opens"},
        {"label": "Include in this PR", "description": "Risky: only if changes are related"},
        {"label": "Cancel", "description": "Abort ship"}
      ],
      "multiSelect": False
    }])

current_branch = Bash("git branch --show-current")
if current_branch in ("main", "master", "dev"):
    AskUserQuestion(questions=[{
      "question": f"You're on {current_branch}. Create a feature branch?",
      "header": "Branch",
      "options": [
        {"label": "Yes: feat/design-ship-<bundle-id>", "description": "Recommended"},
        {"label": "Cancel", "description": "Switch branch yourself first"}
      ],
      "multiSelect": False
    }])
```

## Phase 1: Import

Set `bundle_source` from the argument first, so Phase 4 can name it for either input:

- Local file or folder input: `bundle_source` is the file name of the export (never the full local path: a PR body is public).
- URL input: `bundle_source` is the URL as given.

Run import mode with the same argument (`Read("references/import-mode.md")`). Capture its output (the import manifest): it includes the bundle_id, list of components written, and the provenance file path.

If import fails, **stop**. Do NOT proceed to test generation against partially-imported components.

## Phase 2: Cover

Run `cover` scoped to the components written by phase 1:

```python
component_paths = [c["path"] for c in import_result["components"] if c["decision"] != "reuse"]

Agent(
  subagent_type="ork:test-generator",
  description="Cover the freshly-imported components",
  prompt=f"""Use the cover skill to generate tests for these components (scoped: do not regenerate suites for unrelated files):
  {component_paths}

  Tiers needed:
  - Storybook stories per component (mandatory)
  - Playwright E2E if any new route was registered (check src/app or src/pages)
  - Unit tests if the components include non-trivial logic (skip for pure-presentation)
  """
)
```

## Phase 3: Expect

Run `expect` to do diff-aware browser verification. This produces the screenshots that go into the PR body:

```python
Agent(
  subagent_type="ork:expect-agent",
  description="Diff-aware verification of imported components",
  prompt=f"""Use the expect skill on the current diff.

  Extra: capture before/after screenshots for each new component
  and save them to .claude/design-handoffs/{bundle_id}/screenshots/.
  These will be uploaded to the PR body.

  If verification fails, do not block: report findings and continue.
  Failures will surface in the PR review.
  """
)
```

## Phase 4: Create PR

Use `create-pr` with a body templated from the export and verification results:

```python
pr_body = f"""## Summary
Generated from a Claude Design export: {bundle_source}

Bundle ID: `{bundle_id}` · Provenance: `.claude/design-handoffs/{bundle_id}.json`

## Components
| Decision | Component | Path |
|---|---|---|
{table_from(import_result['components'])}

## Tokens
- Added: {len(token_diff['added'])}
- Modified: {len(token_diff['modified'])}
- Conflicts (resolved): {len(token_diff['conflicts'])}

## Verification (`expect`)
{expect_summary}

## Coverage delta (`cover`)
{coverage_delta}

## Screenshots
{screenshot_table}

---
🤖 Opened by `design-to-code ship` · Closes: (none, link issues manually)
"""

body_path = f".claude/design-handoffs/{bundle_id}.pr-body.md"
Write(body_path, pr_body)  # the body goes to a file, never into the shell line

# ship-mode:pr-create
import shlex

def pr_create_cmd(pr_title, body_path):
    # The title can hold a quote, a $( ) or a backtick (it comes from the export's
    # name), so it is quoted as ONE shell word. The body is read from the file.
    return ("gh pr create --title " + shlex.quote(pr_title)
            + " --body-file " + shlex.quote(body_path) + " --label claude-design")

Bash(pr_create_cmd(pr_title, body_path))
```

Never write `pr_title` or `pr_body` between quotes inside the command text: a name such as `O'Brien's card` or one holding `$(...)` ends the quote early and the rest runs as shell. The body file is the only way the body reaches `gh`; `--body-file -` (stdin) is the other safe form.

## Phase 5: Update provenance

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
| 1. Import | Export refused, token conflict | Import mode already prompts; if user cancels, abort |
| 2. Cover | Test generation fails | Continue to expect: tests are recoverable in PR review |
| 3. Expect | Browser verification fails | Continue to PR: failures noted in PR body |
| 4. Create PR | `gh` not authenticated | Stop, surface auth error |
| 5. Provenance | File not writable | Warn but do not fail (PR is already open) |

## Composition

| Skill | Role |
|---|---|
| import mode | Phase 1: scaffold components |
| `cover` | Phase 2: Storybook + Playwright |
| `expect` | Phase 3: diff-aware browser verification |
| `create-pr` | Phase 4: open PR with templated body |
| `remember` / `memory` | Provenance updates |

## NOT ship mode's job

| Concern | Owned by |
|---|---|
| Opening and reading the export | `inspect-export.mjs` and the `claude-design-orchestrator` agent (called by import mode) |
| Component dedup | Orchestrator agent (called by import mode) |
| Test execution (CI) | GitHub Actions: ship mode only generates tests |
| Merging the PR | Human reviewer. Never auto-merge |

## Limitations

- **No auto-merge**: ship mode opens the PR; humans review and merge.
- **No iteration loop**: if the PR review surfaces design changes, you currently change the design in Claude, export again and re-run ship mode. The reverse path (live UI drift → refinement prompt) is tracked in M124, Claude Design Drift Sync (Bet B): #1391 (PR hook), #1393 (`design-iterate`), #1395 (design-drift-detector agent).
- **Single-export scope**: one invocation, one export, one PR. Multi-export batches are not supported.
