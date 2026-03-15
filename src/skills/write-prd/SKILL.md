---
name: write-prd
license: MIT
compatibility: "Claude Code 2.1.76+."
description: "Write PRD — Product Requirements Documents with structured 8-section templates, user stories, acceptance criteria, and value proposition validation. Use when writing PRDs, defining product requirements, creating user stories with INVEST criteria, or building go/no-go decision frameworks."
tags: [prd, requirements, user-story, acceptance-criteria, invest, value-proposition, go-no-go]
context: fork
agent: product-strategist
version: 2.0.0
author: OrchestKit
user-invocable: true
argument-hint: "product name or feature"
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - Agent
  - mcp__memory__search_nodes
  - mcp__memory__create_entities
  - mcp__memory__add_observations
  - mcp__memory__create_relations
---

# PRD — Product Requirements Document

Translate product vision and research into clear, actionable engineering specifications. Produces `PRD-[product-name].md` output files following an 8-section structure.

**Output file naming:** `PRD-[product-name].md` (e.g., `PRD-sso-invite-flow.md`)

## Argument Resolution

```python
PRODUCT = "$ARGUMENTS"  # Product name or feature, e.g., "SSO invite flow"
```

## STEP 0: Scope Clarification

```python
AskUserQuestion(
  questions=[{
    "question": "What type of PRD?",
    "header": "PRD Scope",
    "options": [
      {"label": "Full PRD (Recommended)", "description": "All 8 sections with research, stories, and release plan", "markdown": "```\nFull PRD (8 sections)\n─────────────────────\n1. Executive Summary\n2. Problem Statement\n3. Objectives & KPIs\n4. User Stories (INVEST)\n5. Functional Requirements\n6. Non-Functional Requirements\n7. Release Plan\n8. Appendices\n```"},
      {"label": "Lightweight spec", "description": "Summary, objectives, user stories only", "markdown": "```\nLightweight Spec\n────────────────\n1. Summary (1 paragraph)\n2. Objectives (3-5 bullets)\n3. User Stories\n\nBest for: internal tools,\nsmall features, quick specs\n```"},
      {"label": "User stories only", "description": "INVEST stories with acceptance criteria", "markdown": "```\nUser Stories Only\n─────────────────\nAs a [role], I want [goal]\nso that [benefit].\n\nAcceptance Criteria:\nGiven... When... Then...\n\nINVEST: Independent,\nNegotiable, Valuable,\nEstimable, Small, Testable\n```"},
      {"label": "Update existing PRD", "description": "I have a PRD file to iterate on", "markdown": "```\nUpdate Existing PRD\n───────────────────\n→ Read current PRD file\n→ Identify gaps/changes\n→ Preserve approved sections\n→ Track change history\n```"}
    ],
    "multiSelect": false
  }]
)
```

## Task Management

```python
TaskCreate(
  subject="Write PRD: {PRODUCT}",
  description="8-section PRD with user stories and acceptance criteria",
  activeForm="Writing PRD for {PRODUCT}"
)
```

## Memory Integration

```python
# Search for prior PRDs and product decisions
mcp__memory__search_nodes(query="{PRODUCT} PRD requirements")

# After PRD is written, store key decisions
mcp__memory__create_entities(entities=[{
  "name": "PRD-{product-slug}",
  "entityType": "document",
  "observations": ["PRD written for {PRODUCT}", "Key objectives: ..."]
}])
```

## The 8-Section PRD Template

Load `Read("${CLAUDE_SKILL_DIR}/references/prd-template.md")` for the full template with all 8 sections (Summary, Contacts, Background, Objective, Market Segments, Value Propositions, Solution, Release), priority levels, and NFR categories.

## User Stories & Acceptance Criteria

Load `Read("${CLAUDE_SKILL_DIR}/references/user-stories-guide.md")` for INVEST criteria, story format, Gherkin acceptance criteria, and Definition of Ready/Done.

## Value Proposition Canvas

Load `Read("${CLAUDE_SKILL_DIR}/references/value-prop-canvas-guide.md")` for the canvas template and fit check process. Every Value Map item must correspond to a Job, Pain, or Gain.

## Go/No-Go Gate Criteria

Load from rules: `Read("${CLAUDE_SKILL_DIR}/rules/strategy-go-no-go.md")` for stage gate criteria and scoring thresholds (Go >= 7.0 | Conditional 5.0-6.9 | No-Go < 5.0).

## Rules (Load On-Demand)

- [research-requirements-prd.md](rules/research-requirements-prd.md) — INVEST user stories, PRD template, priority levels, DoR/DoD
- [strategy-value-prop.md](rules/strategy-value-prop.md) — Value proposition canvas, JTBD framework, fit assessment
- [strategy-go-no-go.md](rules/strategy-go-no-go.md) — Stage gate criteria, scoring, build/buy/partner decision matrix

## References

- [output-templates.md](references/output-templates.md) — Structured JSON output schemas for PRD, business case, and strategy artifacts
- [value-prop-canvas-guide.md](references/value-prop-canvas-guide.md) — Detailed value proposition canvas facilitation guide

## Output

After generating the PRD, write it to disk:

```python
Write(f"PRD-{product_slug}.md", prd_content)
TaskUpdate(status="completed")
```

## Chain: Next Steps

After PRD is approved, chain into implementation:

```
/ork:implement PRD-{product-slug}.md
```

## Related Skills

- `ork:user-research` — Build user understanding (personas, journey maps, interviews) before writing the PRD
- `ork:implement` — Execute the implementation plan from the PRD
- `ork:brainstorm` — Explore solution alternatives before committing to PRD scope
- `ork:assess` — Rate PRD quality and completeness

---

**Version:** 2.0.0
