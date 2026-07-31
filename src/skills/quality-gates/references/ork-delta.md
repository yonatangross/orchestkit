# OrchestKit delta: quality gates

What this skill knows that no vendor doc will tell you. The gate rubric itself
(complexity 1-5, blocking thresholds, the escalation template) lives in `SKILL.md`;
scoring lives in `references/unified-scoring-framework.md`. Everything below is a scar
or a house decision that survived the thinning of the restated tutorials.

Bare filenames in the `Why:` lines (for example `gate-patterns.md`) name files retired
by that thinning. They are provenance, not load pointers, and no longer exist on disk.

## Count files and lines with `awk 'END{print NR}'`, never `xargs wc -l | tail -1`

Why: PR #2973 (commit `740dd9c02`) found this skill's own `scripts/analyze-codebase.sh`
and `scripts/assess-complexity.md` shipping the `xargs wc -l | tail -1` recipe. xargs
batches long file lists and wc emits one total per batch, so `tail -1` silently keeps
only the last: a 6k-file tree undercounted by 83%, which drags every downstream
complexity score with it. `grep -c` is not a substitute, it exits 1 on empty input and
aborts `set -euo pipefail` scripts.
Upstream: `src/skills/shared/rules/shell-count-correctness.md`

## Fail open on a quality gate by default, fail closed only for security and money

Why: house threshold ladder, docs 0.6, code generation 0.7, test generation 0.7,
security analysis 0.8, payment and finance 0.9, with max retries 1 / 2 / 2 / 3 / 3.
A stalled workflow costs more than one mediocre paragraph, but a rubber-stamped
security review costs more than a stall, so the fail mode flips with the stake, not
with the score. Distilled from the retired llm-quality-validation.md; no traced
incident.
Upstream: `ork:testing-llm` for the DeepEval and RAGAS metric APIs behind these scores

## Treat a gate's own pass rate as the alarm, not just the work it blocks

Why: house rule, a pass rate under 70% or a bypass rate over 5% means the gate is
miscalibrated or is being routed around, and the first fix is the gate, not the work.
An average retry count above 2 means the gate is not returning actionable feedback.
Distilled from the retired gate-patterns.md and quality-gate-checklist.md; no traced
incident.
Upstream: https://sre.google/workbook/alerting-on-slos/

## Never bypass a gate for security, compliance, or data integrity

Why: house decision. The three sanctioned bypass lanes (explicit human override with a
written justification, emergency mode on a CRITICAL task, an explicitly experimental
feature) all stay narrower than these three categories, because a bypassed security
gate emits no signal that anything was skipped. Distilled from the retired
gate-patterns.md; no traced incident.
Upstream: `ork:security-patterns`

## Score with the unified framework, do not invent a second scale here

Why: `references/unified-scoring-framework.md` is loaded by `ork:assess` and
`ork:verify` through `CLAUDE_PLUGIN_ROOT`, so any local rubric in this skill forks the
grade those two report for the same change. The retired gate references each carried
their own 0.60 / 0.75 / 0.85 threshold table, none of them reconciled with the shared
0-10 dimension weights.
Upstream: `references/unified-scoring-framework.md` in this skill, canonical for
`ork:assess` and `ork:verify`

## Do not ship fill-in gate templates as standalone files

Why: the retired complexity-assessment.md closed by routing the agent to a
`breakdown-template.md` under `.claude/skills/scripts/`, a path that has never existed
anywhere in this repo, and it restated the same 7-criterion rubric already carried by
`scripts/assess-complexity.md` and `SKILL.md`. Standalone templates drift from the gate
flow they claim to implement and dead-end into siblings nobody wrote.
Upstream: `src/skills/CONTRIBUTING-SKILLS.md`

## Do not cite metrics from a codebase this repo does not contain

Why: the retired orchestkit-quality-gates.md presented "203 analyses, 84.7%
first-attempt pass rate, 3.4% escalation" as measured OrchestKit production data, sourced
from a `quality_gate_node.py` under `backend/app/workflows/nodes/`. Asking git for either
path across all refs returns nothing: neither has ever been tracked in this repository, so
the numbers were unfalsifiable and the threshold tuning they justified rested on nothing.
Upstream: `src/skills/shared/rules/verification-gate.md`
