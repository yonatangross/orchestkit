---
name: OrchestKit Eval Framework Structure
description: Sprint 2 Wave A eval framework - 17 skill eval YAMLs (5 existing + 12 new), quality runner, trigger runner, dry-run CI mode
type: project
---

OrchestKit has a skill evaluation framework at `tests/evals/` with two runners:
- `run-trigger-eval.sh` — tests skill trigger accuracy (precision/recall) with N reps
- `run-quality-eval.sh` — A/B comparison: skill-assisted vs baseline output, graded by LLM

**Why:** Validate that skills trigger on correct prompts and add measurable quality over baseline Claude.

**How to apply:**
- 5 original pilot evals: api-design, assess, commit, explore, implement (no confusion pairs, 4 negatives each)
- 12 new Wave A evals: brainstorm, create-pr, doctor, fix-issue, help, memory, remember, review-pr, setup, verify, visualize-plan, write-prd
- New evals have confusion pairs, 5 negatives, and more structured quality coverage
- Dry-run mode validates YAML structure only (no Claude CLI needed) — used in CI
- Results written to `tests/evals/results/skills/*.json` (gitignored)
- Exit code: 0 = pass, 1 = regression (quality) or low recall (trigger)
