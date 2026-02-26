---
title: Visualization Tiers
description: Progressive disclosure tiers for plan visualization output.
---

# Visualization Tiers

Plan-viz uses three tiers of progressive disclosure. Tier 1 is always shown; Tier 2 sections are shown on request; Tier 3 deep dives are on-demand.

## Tier 1: Header (Always Rendered)

Use `assets/tier1-header.md` template. Fill from gathered data:

```
PLAN: {plan_name} ({issue_ref})  |  {phase_count} phases  |  {file_count} files  |  +{added} -{removed} lines
Risk: {risk_level}  |  Confidence: {confidence}  |  Reversible until {last_safe_phase}
Branch: {branch} -> {base_branch}

[1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

### Computing Header Fields

- **Risk level** = highest risk across all phases (LOW/MEDIUM/HIGH/CRITICAL)
- **Confidence** = LOW if >50% of changes are in untested code, MEDIUM if mixed, HIGH if well-tested paths
- **Reversible until** = last phase before an irreversible operation (DROP, DELETE data, breaking API change)

## Tier 2: Core Sections (On Request)

Five numbered sections, each answering a specific reviewer question:

| Section | Question Answered | Pattern Reference |
|---------|------------------|-------------------|
| [1] Change Manifest | What files change and how? | `change-manifest-patterns.md` |
| [2] Execution Swimlane | What runs in parallel? What blocks what? | `execution-swimlane-patterns.md` |
| [3] Risk Dashboard | What can go wrong? When is it irreversible? | `risk-dashboard-patterns.md` |
| [4] Decision Log | What non-obvious choices were made? | `decision-log-patterns.md` |
| [5] Impact Summary | What are the raw numbers? | `assets/impact-dashboard.md` |

## Tier 3: Deep Dives (On Demand)

| Section | Question Answered | Reference |
|---------|------------------|-----------|
| [6] Blast Radius | How far do changes ripple? | `blast-radius-patterns.md` |
| [7] Cross-Layer Consistency | Are frontend/backend aligned? | `deep-dives.md` |
| [8] Migration Checklist | What's the ordered runbook? | `deep-dives.md` |
