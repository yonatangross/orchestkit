---
title: Each idea must have a feasibility score (1-5) before synthesis; flag unfeasible ideas explicitly
impact: HIGH
impactDescription: "Without feasibility scoring, the synthesis phase wastes tokens evaluating ideas that are clearly impractical, and users receive recommendations they cannot act on"
tags: feasibility, scoring, filtering, ideation, synthesis
---

# Feasibility Filter

Every idea generated in Phase 2 (Divergent Exploration) must receive a feasibility score (1-5) during Phase 3 (Feasibility Fast-Check) before advancing to synthesis. Ideas scoring 1-2 must be explicitly flagged as low-feasibility rather than silently dropped or presented alongside viable options.

## Problem

When brainstorm agents generate 10+ ideas but skip feasibility scoring, the evaluation phase (Phase 4) wastes context rating ideas that were never buildable. Worse, unfeasible ideas can survive to the final presentation, undermining trust in the brainstorm output.

## Feasibility Scale

| Score | Label | Meaning |
|-------|-------|---------|
| 5 | Ready | Can implement with current stack and team |
| 4 | Likely | Minor unknowns, resolvable with a spike |
| 3 | Possible | Requires new dependency or skill acquisition |
| 2 | Stretch | Significant unknowns, timeline risk > 50% |
| 1 | Impractical | Blocked by hard constraints (budget, infra, time) |

## Rules

- Every idea in `03-feasibility.json` must include a `feasibility_score` field (1-5)
- Ideas scoring 1-2 are kept in the output but marked `"flagged": true` with a `reason` field
- Flagged ideas must NOT appear in the top recommendations unless the user explicitly asks for moonshots
- The feasibility check must consider the detected project tier from Step 0

**Incorrect -- presenting ideas without feasibility scores:**
```python
# Phase 3 output: no scoring, all ideas pass through
Write(".claude/chain/03-feasibility.json", {
    "ideas": [
        {"title": "Build custom ML pipeline", "description": "..."},
        {"title": "Add caching layer", "description": "..."},
        {"title": "Rewrite in Rust", "description": "..."}
    ]
})
# Phase 5 wastes tokens evaluating "Rewrite in Rust" for a Tier 2 hackathon
```

**Correct -- every idea scored, unfeasible ones flagged:**
```python
# Phase 3 output: each idea scored, low-feasibility flagged with reason
Write(".claude/chain/03-feasibility.json", {
    "tier": 2,
    "ideas": [
        {"title": "Add caching layer", "feasibility_score": 5,
         "flagged": False},
        {"title": "Build custom ML pipeline", "feasibility_score": 2,
         "flagged": True, "reason": "Requires GPU infra not available at Tier 2"},
        {"title": "Rewrite in Rust", "feasibility_score": 1,
         "flagged": True, "reason": "Complete rewrite exceeds project scope and timeline"}
    ],
    "viable_count": 1,
    "flagged_count": 2
})
# Phase 4 focuses evaluation on viable ideas; flagged ideas shown separately
```

## Integration with Phase Workflow

- Phase 2 generates ideas freely (no filtering)
- Phase 3 applies this feasibility filter -- every idea gets a score
- Phase 4 evaluates only ideas with `feasibility_score >= 3` in detail
- Phase 5 synthesis references flagged ideas in a "Considered but excluded" section
