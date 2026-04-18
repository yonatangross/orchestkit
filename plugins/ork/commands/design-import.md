---
description: "Imports a Claude Design (claude.ai/design) handoff bundle and scaffolds the proposed components into the project. Accepts a bundle URL or local file, parses and validates the schema, deduplicates components against the existing codebase via component-search, then pipes the survivors through the design-to-code pipeline. Writes provenance metadata so future imports can detect drift between design versions. Use after exporting a handoff bundle from claude.ai/design — this is the entry point that turns a design into code."
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/design-import/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Design Import

Turn a Claude Design handoff bundle into scaffolded React components, with provenance and dedup against the existing codebase.

```bash
/ork:design-import https://claude.ai/design/abc123      # From handoff URL
/ork:design-import /tmp/handoff-bundle.json             # From local file
```

## When to use
After exporting a handoff bundle from claude.ai/design. This skill is the **entry point** — it does NOT open a PR, run tests, or deploy. For the end-to-end flow (import → tests → PR), use `/ork:design-ship` instead.

## Pipeline

```
Handoff bundle (URL or file)
  │
  ▼
┌──────────────────────────────┐
│ 1. PARSE + VALIDATE          │  via claude-design-orchestrator agent
│    - Fetch bundle             │  Schema validation
│    - Compute bundle_id (sha)  │  Surface deviations
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 2. RECONCILE TOKENS           │  Diff bundle tokens vs project tokens
│    - Read project tokens      │  Conflicts → AskUserQuestion
│    - Apply additions          │  Additions → write to design-tokens.json
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 3. DEDUP COMPONENTS           │  For each proposed component:
│    Storybook MCP first        │   • exact match → reuse (skip)
│    21st.dev next              │   • similar match → adapt
│    Filesystem grep last       │   • no match → scaffold
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 4. SCAFFOLD                   │  Delegate to design-to-code per component
│    (skipped components        │  Use bundle's tsx_scaffold as seed
│     logged but not touched)   │  Apply project tokens
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ 5. WRITE PROVENANCE           │  .claude/design-handoffs/<bundle_id>.json
│    Bundle → files → (PR)      │  PR field empty until /ork:design-ship
└──────────┬───────────────────┘
           │
           ▼
   Import manifest (stdout)
```

## Argument resolution

```python
ARG = "$1"  # First positional argument

if ARG.startswith("http://") or ARG.startswith("https://"):
    bundle_source = "url"
    bundle_input = ARG
elif Path(ARG).exists():
    bundle_source = "file"
    bundle_input = ARG
else:
    AskUserQuestion(questions=[{
      "question": "I couldn't resolve that as a URL or file. What is it?",
      "header": "Bundle source",
      "options": [
        {"label": "Paste handoff URL", "description": "claude.ai/design URL"},
        {"label": "Paste file path", "description": "Local handoff JSON"},
        {"label": "Cancel", "description": "Abort import"}
      ],
      "multiSelect": False
    }])
```

## Phase 1 — Parse + validate

Delegate to the orchestrator agent. The agent fetches, parses, and produces a normalized payload. Do NOT reimplement parsing here — the agent owns the schema.

```python
Agent(
  subagent_type="claude-design-orchestrator",
  description="Parse and normalize handoff bundle",
  prompt=f"""Parse the Claude Design handoff bundle at {bundle_input}.

  Tasks:
  1. Fetch the bundle (WebFetch if URL, Read if file)
  2. Validate against the expected schema (see your agent definition)
  3. Compute bundle_id = sha256(canonical bundle URL or absolute path)
  4. Produce the normalized output payload as specified
  5. Write provenance file at .claude/design-handoffs/{{bundle_id}}.json with:
     - bundle_url, bundle_id, fetched_at, components: [], pr: null
  6. Return the normalized payload as JSON

  Surface any schema deviations explicitly — do not silently coerce.
  """
)
```

## Phase 2 — Reconcile tokens

Read the normalized `token_diff` from the agent's payload.

| Diff field | Action |
|---|---|
| `added` | Append to project's design-tokens.json (or Tailwind config). No prompt — additions are safe. |
| `modified` | Show diff. AskUserQuestion: keep project value, accept bundle value, or open editor. |
| `conflicts` | Block scaffolding. AskUserQuestion to resolve before continuing. |

```python
if token_diff["conflicts"]:
    AskUserQuestion(questions=[{
      "question": f"Token conflict on {conflict.path}. Project says {conflict.project}, bundle says {conflict.bundle}. Resolve?",
      "header": "Token conflict",
      "options": [
        {"label": "Keep project value", "description": "Bundle adapts to project"},
        {"label": "Accept bundle value", "description": "Project adapts to bundle (writes new token)"},
        {"label": "Both — namespace bundle's", "description": f"Add as {conflict.path}.imported"}
      ],
      "multiSelect": False
    }])
```

## Phase 3 — Dedup components

The agent already ran component-search per component. Read decisions from the normalized payload:

| `decision` | Behavior |
|---|---|
| `reuse` | Log "skipped (existing: <path>)" — do nothing on disk |
| `adapt` | Pipe through `ork:design-to-code` with `--adapt-from <existing-path>` context |
| `scaffold` | Pipe through `ork:design-to-code` with the bundle's `tsx_scaffold` as seed |

## Phase 4 — Scaffold

For each component with decision `scaffold` or `adapt`, invoke design-to-code:

````python
for component in payload["components"]:
    if component["decision"] in ("scaffold", "adapt"):
        # Compose, don't reimplement — design-to-code owns the EXTRACT/MATCH/ADAPT/RENDER pipeline
        Agent(
          subagent_type="frontend-ui-developer",
          description=f"Scaffold {component['name']} from bundle",
          prompt=f"""Use the design-to-code skill to scaffold this component.

          Source: handoff bundle {payload['bundle_id']}
          Component: {component['name']}
          Target path: {component['target_path']}
          Bundle scaffold seed:
          ```tsx
          {component['tsx_scaffold']}
          ```
          Resolved tokens: {component['tokens_resolved']}
          Decision: {component['decision']}
          {f"Adapt from: {component['existing_match']}" if component['decision'] == 'adapt' else ''}

          Write the component, mirror existing project file structure, use project tokens.
          """
        )
````

## Phase 5 — Provenance

Update the provenance file with the actual file paths written:

```python
provenance = Read(payload["provenance_path"])
provenance["components"] = [
    {"name": c["name"], "decision": c["decision"], "path": c["target_path"]}
    for c in payload["components"]
]
provenance["imported_at"] = now()
Write(payload["provenance_path"], provenance)
```

## Output — import manifest

Print a concise summary (not a wall of JSON):

```
Imported bundle <bundle_id>
  Source: <bundle_url>
  Provenance: .claude/design-handoffs/<bundle_id>.json

Components:
  ✓ PricingCard          scaffold  src/components/pricing/PricingCard.tsx
  ↻ Button               reuse     existing: src/components/ui/Button.tsx
  ⤳ Hero                 adapt     adapted from: src/components/Hero.tsx

Tokens:
  + 3 new (added to design-tokens.json)
  ~ 1 modified (user accepted bundle value)
  ✗ 0 conflicts unresolved

Next: /ork:design-ship <bundle_id>   # to open PR
      /ork:dogfood                    # to verify
```

## Hooks

- After completion, the `post-design-import` hook auto-runs `/ork:dogfood` + `/ork:expect` (non-blocking, see hook for details).

## Composition

| Skill | Role |
|---|---|
| `design-to-code` | Owns the actual scaffold pipeline (EXTRACT/MATCH/ADAPT/RENDER). This skill delegates to it per component. |
| `component-search` | Used by the orchestrator agent for dedup |
| `design-context-extract` | Used if bundle is missing `design_tokens` block |
| `design-system-tokens` | Token reconciliation reference |
| `remember` / `memory` | Provenance + prior-import detection |

## NOT this skill's job

| Concern | Owned by |
|---|---|
| Open PR | `/ork:design-ship` |
| Run tests | `post-design-import` hook → `/ork:dogfood`, `/ork:expect` |
| Generate Storybook stories | `/ork:cover` (called by `/ork:design-ship`) |
| Re-prompt Claude Design | Not yet — no public API |

## Limitations

- **No public Claude Design API yet**: bundles are one-shot exports. To iterate, re-export from claude.ai/design and re-import. (See Bet B for the future drift-sync workflow.)
- **Schema is provisional**: Claude Design has not published a stable bundle schema. The orchestrator agent adapts to deviations but may need updates as the format stabilizes.
- **Asset URLs are referenced, not downloaded**: bundle `asset_urls` are kept as-is. If you need them in-repo, run a separate sync step.
