# ork delta: llm-integration

What this skill knows that the vendors' own docs do not. Everything else was
deleted; see the "Upstream coverage" table in `SKILL.md` for where each removed
topic now lives.

## Never hardcode vendor token prices or model ids in a skill example

Why: commit `f32cfd750` (PR #2145, "fix(skills): residual library-currency
sweep (16 skills)") rewrote the price-table key in the now-retired
synthetic-data reference from `gpt-5.2` to `gpt-5.5` but carried the old
`$2.50 / $10.00` per-million numbers across unchanged. A currency sweep is a
lexical rename, so it launders a stale price into a current-looking one and
nothing flags it. Model ids are cheap to bump and get bumped; prices are not,
so quote them by link or leave them out.

Upstream: https://platform.openai.com/docs/pricing

## Climb the ladder before fine-tuning: prompt, few-shot, RAG, then LoRA

Why: house decision, carried in the `SKILL.md` Key Decisions table
("Fine-tuning approach: LoRA/QLoRA, try prompting first") and enforced by the
1000+ quality-example floor. Fine-tuning is the last rung here, not the first,
because the three cheaper rungs cover the cases teams most often mistake for
fine-tuning needs (long prompts, missing facts, style drift).

Upstream: https://platform.openai.com/docs/guides/optimizing-llm-accuracy

## Cap tools at 5 to 15 per request and turn off parallel_tool_calls under strict mode

Why: house decision in the `SKILL.md` Key Decisions table, distilled from the
retired tool-schema reference and tool-checklist; no traced incident. The pairing matters: strict mode and parallel tool calls are
mutually exclusive in practice, and the tool ceiling is ours, not a vendor
limit.

Upstream: https://platform.openai.com/docs/guides/function-calling

## Judge with a different model than the one under test, on the cost tier

Why: house convention repeated across the retired dpo-alignment and
synthetic-data references and the surviving
`rules/evaluation-metrics.md`, which pins the judge to
`claude-haiku-4-5-20251001` and the quality gate to 0.7 production / 0.6
drafts. Self-judging inflates scores, and judging on the expensive tier makes
the eval loop cost more than the feature.

Upstream: https://docs.claude.com/en/docs/about-claude/models/overview

## Do not let references/ mirror rules/ on the same topic

Why: the retired tool-schema reference was a near-verbatim copy of
`rules/calling-tool-definition.md`, and the synthetic-data reference
duplicated `rules/tuning-dataset-prep.md`. PR #2145 had to patch the same stale
model id in both copies of each pair, and one copy always drifts. One topic,
one file: the rule is canonical, `references/` is for what does not fit the
rule format.

Upstream: `.claude/rules/skill-authoring.md` (in-repo authoring standard)

## Check tests/skills/scripts before deleting any src/skills/*/scripts/*.md

Why: `tests/skills/scripts/test-specific-skills.sh` and
`tests/skills/scripts/integration/test-script-invocation.sh` both hardcode
`llm-integration/scripts/create-lora-config.md` in an expected-scripts array,
and the first hard-fails on a missing path. Neither test references the skill
anywhere else, so a delete looks safe from inside the skill directory and
red-fails two suites. `scripts/create-lora-config.md` survived this pass for
exactly that reason.

Upstream: none (ork-only); enforced by `tests/skills/scripts/test-specific-skills.sh`
