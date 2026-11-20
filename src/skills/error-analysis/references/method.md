# The Error Analysis Method

Condensed from Hamel Husain and Shreya Shankar's evals teaching. This file carries the
method detail the SKILL.md index compresses, plus the source list.

## Why error analysis comes first

Error analysis is the most important activity in evals because it decides what to
measure. Teams that skip it write generic evals (platform-default metrics, Likert
scored "quality") that never correspond to a real failure, then distrust the scores.
The taxonomy produced here is the spec that later evals are built against.

## The four steps

### 1. Create a dataset

Gather representative traces of real user interactions. Synthetic data works only as a
bootstrap when no production data exists; it is not a substitute for real traces. A
working pool of roughly 100 diverse traces is a useful guardrail for the human-agent
loop. Sample toward failures: user feedback, low scores, errors, retries.

### 2. Open coding

A human annotator reviews traces and writes open-ended notes about anything wrong,
journaling style, adapted from qualitative research. Rules that matter:

- One annotator owns the labels (the benevolent dictator). Splitting labeling across
  people without reconciliation produces a taxonomy nobody can reproduce.
- The annotator should be a domain expert or paired with one; many failures are only
  visible to someone who knows what correct looks like.
- Note the FIRST failure observed in a trace. Upstream errors cause downstream issues,
  so a downstream symptom tagged as its own mode double-counts the same root cause.
  Tagging additional independent failures is fine when feasible.
- Annotate at least ~30 traces before leaning on agent suggestions. After that, let the
  agent search remaining traces for likely instances of the patterns seen so far, and
  accept or reject each suggestion.
- Record problems that are not the model's fault. Some failures turn out to be
  engineering or design issues (a broken tool, missing data, an impossible request).
  They belong in the taxonomy because they route the fix to the right owner.

### 3. Axial coding

Group the open-ended notes into a failure taxonomy: named categories with definitions.
This is the most important step. An LLM can propose the clustering; the human confirms
it. Count the failures in each category at the end. The counts, not vibes, decide where
eval effort goes.

### 4. Iterative refinement to saturation

Keep reviewing until theoretical saturation: new reviews stop revealing new failure
modes or changing existing ones. Efficient sampling (cluster traces, sort by user
feedback, sort by likely-failure signals) focuses human attention on the most
informative traces instead of reading all 100 sequentially. Re-run the whole process
periodically on production traffic; taxonomies go stale as usage shifts.

## Prompt or code?

Before routing a fix, replay the suspected step: re-execute the tool call or DB query
with the inputs recorded in the trace. Replay live only for read-only calls; a
payment, message send, or DB write replays against a sandbox or a recorded
fixture, never a live service.

Compare the replayed output with the observation recorded in the trace, not with
what looks correct today. Three verdicts:

- Replayed output matches a wrong recorded observation: code or data failure. The
  tool itself returned bad data. Fix the retriever, the tool implementation, or
  the underlying data.
- Replayed output matches a correct recorded observation, final answer wrong:
  prompt or context failure. The model had good inputs. Fix the prompt, the
  context assembly, or the tool-output presentation.
- Replayed output differs from the recorded observation: inconclusive until the
  difference is explained (stale data, drift, flaky tool). The recorded output is
  what the model actually saw.

This check is cheap and it prevents the most common misdiagnosis: rewriting a prompt
for a failure whose root cause is a broken retrieval call.

## What earns an eval

Not every failure mode deserves an automated evaluator. The cost hierarchy:

1. Fix obvious prompt gaps first (missing instructions for format, length, tone).
   Many "failures" are preferences nobody specified.
2. Code assertions next (regex, schema validation, DB state checks). Cheap, exact, no
   human labels needed.
3. LLM-as-judge last, only for subjective, recurring modes that survived the first
   two. A judge costs 100+ labeled examples plus ongoing maintenance.

A judge is a binary classifier returning pass or fail for ONE failure mode. Never
build one judge that grades overall quality; it cannot be aligned and its failures are
unactionable. Judge validation is in `judge-alignment.md`.

## Sources

- Hamel Husain and Shreya Shankar, "AI Evals: Everything You Need to Know" (the error
  analysis, binary evals, and judge-alignment FAQs):
  https://hamel.dev/blog/posts/evals-faq/
- Hamel Husain, "LLM-as-Judge" (judge design and alignment):
  https://hamel.dev/blog/posts/llm-judge/
- Anthropic, "Develop tests" / evaluation guidance:
  https://docs.claude.com/en/docs/test-and-evaluate/develop-tests
- Langfuse public API (trace fetch): https://api.reference.langfuse.com/
- Method originates in qualitative research: open coding and axial coding are grounded
  theory terms (Strauss and Corbin); "theoretical saturation" is the stopping rule.
