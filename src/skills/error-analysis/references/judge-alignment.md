# Judge Alignment

An LLM judge is a binary classifier: given a trace (or the slice of it that matters),
it answers "did failure mode X occur, pass or fail". It is untrusted until measured
against human labels. This file is the validation protocol; the failure taxonomy and
human notes are its inputs.

## Labels come from open coding

Phase 2 produces the raw material: human-reviewed traces with failure notes. To align
a judge for one mode you need labeled positives AND negatives. Target at least 50
failing and 50 passing examples per judge. The taxonomy counts tell you whether a mode
has enough examples; a mode with 4 occurrences cannot support judge alignment yet.

## Three splits, used in order

Split the labeled examples before touching the judge prompt:

- **Train**: examples allowed inside the judge prompt itself (as few-shot cases or
  quoted failure definitions).
- **Dev**: run the judge here, compare its pass/fail to the human label, inspect every
  disagreement, iterate the prompt or add missing context.
- **Test**: locked until iteration stops. The final agreement numbers come only from
  this split, on examples that never influenced the judge.

Iterating on dev bleeds information into the judge; a judge that scores well on dev
and poorly on test is overfit. If that happens, revisit the prompt and failure
definition, then reserve a fresh test set.

## Metrics

With "positive" meaning the failure is present:

- **TPR (recall)**: of the traces humans marked as failures, how many the judge
  catches. Prioritize when a missed failure is costly.
- **TNR**: of the good traces, how many the judge correctly passes. False alarms burn
  reviewer time; on rare failure modes even a small false-positive rate generates a
  large review queue.

Track both per iteration and pick acceptable floors based on the cost of a miss vs a
false alarm for this application.

## Debugging a disagreeing judge

Inspect disagreements by hand before any automated tuning. Common causes, in rough
frequency order:

1. Missing context: the judge was not shown the field or tool output the human used.
2. Vague failure definition: tighten the taxonomy definition; if a human cannot decide
   pass or fail on a borderline trace, the definition is the problem, not the judge.
3. Over-broad scope: the judge is grading several failure kinds at once. Split into
   one judge per mode. "Did the assistant escalate when required" aligns; "is this
   conversation good" does not.
4. Bad labels: re-review the human notes for the disagreeing traces.

Only after manual fixes plateau is automated prompt tuning (e.g. GEPA) worth its
hundreds of dev-set runs.

## Cheaper than a judge

If code can check the condition directly (a record exists, a schema validates, a
string matches), write the assertion and skip alignment entirely. Reserve judges for
modes where correctness is a judgment call. See `method.md` for the cost hierarchy.

## Handoff

The `ork:eval-runner` agent executes judge candidates against datasets and reports
scores to Langfuse. Give it: the failure definition, the judge prompt, the labeled
split files, and the TPR/TNR floors to hit. It reports; it does not set the taxonomy.
