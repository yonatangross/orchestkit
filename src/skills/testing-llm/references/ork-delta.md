# OrchestKit delta for LLM testing

House rules that are NOT in the vendor docs. Everything else about DeepEval, RAGAS,
VCR.py and the Playwright test agents is upstream: see the "Upstream coverage" table
in `SKILL.md`.

Provenance lines below name retired files. Those files were deleted in this change and
are recorded only to say where a rule came from; they are not live pointers.

> Three entries were removed from this file on 2026-07-31 after verification. They
> described DeepEval and RAGAS API defects as if the retired
> `references/deepeval-ragas-api.md` still contained them. It did not: those findings
> came from `docs/playgrounds/lib-currency-audit-2026-05-31.html` and were remediated
> the same day. `git show` of the retired file confirms it imported `GEval`, documented
> "Pass EITHER criteria OR evaluation_steps", used `EvaluationDataset.from_list` with
> class metrics, and carried the correct `gpt-5-mini` id. Stripped of the false
> incident, all three were plain restatement of vendor docs already routed in SKILL.md.

## Read HallucinationMetric's threshold as a ceiling, not a floor

Why: DeepEval scores hallucination in the inverted direction, a score near 1 means
hallucination was detected, so `threshold=` on this one metric is a maximum where every
other metric's is a minimum. The retired reference set it to 0.5 while the house table
one file over sets it to 0.3, and nothing flagged the disagreement because both look
like ordinary thresholds. The house number itself is not routed away: it stays in
`SKILL.md`, `rules/llm-evaluation.md` and `checklists/llm-test-checklist.md`.
Distilled from the retired references/deepeval-ragas-api.md; no traced incident.
Upstream: https://deepeval.com/docs/metrics-hallucination

## Grade with gpt-5-mini unless a test states otherwise

Why: house default. The retired `references/deepeval-ragas-api.md` used
`model="gpt-5-mini"` in all four graders it configured, and that consistency is the
point: a suite that mixes grader models cannot compare scores across metrics or across
runs, because the grader is part of the measurement. Pin one id per suite, and resolve
it against the provider catalog before writing it into a skill, since a wrong grader id
costs nothing at lint or import time and fails only inside a live eval run.
Distilled from the retired references/deepeval-ragas-api.md; no traced incident.
Upstream: https://platform.openai.com/docs/models

## Give SummarizationMetric explicit assessment_questions

Why: house pattern from the retired reference: construct the metric with a short list of
closed questions covering main points, conciseness, and factual accuracy, rather than
letting the metric infer what "good summary" means per run. Without the list the score
drifts between runs on the same input, because the judge re-derives the rubric each time.
Distilled from the retired references/deepeval-ragas-api.md; no traced incident.
Upstream: https://deepeval.com/docs/metrics-summarization

## Report metric scores with a 95 percent confidence interval, not a bare mean

Why: house reporting rule and its working recipe, which the retired reference carried and
no vendor page states: `stderr = stats.sem(scores)`, then
`h = stderr * stats.t.ppf((1 + confidence) / 2, n - 1)` at a default `confidence=0.95`,
reported as `(mean, mean - h, mean + h)`. A bare mean over a handful of eval runs invites
reading a 0.02 move as a regression when the interval is 0.1 wide. Use the t
distribution, not the normal, because eval sample counts here are small.
Distilled from the retired references/deepeval-ragas-api.md; no traced incident.
Upstream: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html

## Keep LLM cassettes in tests/cassettes/llm

Why: `cassette_library_dir: "tests/cassettes/llm"` is the house path, and it is what
makes the same cassette resolve from both the unit and the integration run instead of
each suite recording its own copy under pytest's default sibling directory. Only the
directory convention is rescued here: the record-mode gate (`"none"` under CI) and the
`filter_headers` list are NOT routed away and stay in full in `rules/llm-mocking.md`.
Distilled from the retired examples/llm-test-patterns.md; no traced incident.
Upstream: https://vcrpy.readthedocs.io/en/latest/configuration.html

## Golden-dataset regression floor: 50 cases minimum, semantic similarity >= 0.85

Why: house numbers. Under 50 cases a single flipped output swings the pass rate by more
than two points, so the suite reports sampling noise as a regression and gets muted;
0.85 is the house similarity floor for calling two answers equivalent, below which
paraphrase and contradiction stop being distinguishable. The 50-case line survives in
`checklists/llm-test-checklist.md`; the 0.85 floor lived only in the retired example.
Distilled from the retired examples/llm-test-patterns.md; no traced incident.
Upstream: the in-repo `golden-dataset` skill (`src/skills/golden-dataset/SKILL.md`)

## Assert an LLM latency budget of p50 < 2s and p95 < 5s across 10 samples

Why: house budget. A single-sample latency assertion against a hosted model is pure
flake, and a mean hides the tail that actually times out user requests. Ten samples with
a median plus a p95 quantile is the smallest shape that separates "the service is slow"
from "one call was slow", and the two numbers are the house ceilings a test may assert
before the call needs a cache or a smaller model. Compute p95 from those 10 samples with
`statistics.quantiles(latencies, n=20)[18]`, which is the non-obvious half: at n=20 the
19th cut point is the 95th percentile, and `quantiles` needs at least 2 data points.
Distilled from the retired examples/llm-test-patterns.md; no traced incident.
Upstream: the in-repo `testing-perf` skill (`src/skills/testing-perf/SKILL.md`)

## Gate an agent step at quality_score 0.85 pass, 0.5 retry with a reason

Why: house quality-gate numbers from the retired example: a state carrying
`quality_score=0.85` passes the gate, `quality_score=0.5` fails it, and a failing gate
must set `retry_reason` rather than returning a bare False, so the retry loop can log why
it fired instead of spinning silently. SKILL.md still lists quality gates as a use case
and the checklist still has a "Test quality gates" line, so without these numbers the
gate is named but unspecified.
Distilled from the retired examples/llm-test-patterns.md; no traced incident.
Upstream: the in-repo `quality-gates` skill (`src/skills/quality-gates/SKILL.md`)

## Test the truncation boundary at 100,000 characters

Why: house edge-case number. The retired example asserted that an input of `"x" * 100_000`
comes back with `result["truncated"] is True`. SKILL.md's "Edge Cases to Always Test"
section survives but carries no size, and an edge-case suite with no boundary value is
untestable prose. Keep the number with the case.
Distilled from the retired examples/llm-test-patterns.md; no traced incident.
Upstream: https://deepeval.com/docs/evaluation-test-cases
