---
name: error-analysis
license: MIT
compatibility: "Claude Code 2.1.277+. Needs Langfuse credentials in env or an exported traces JSONL."
description: "Evals-first error analysis for LLM apps: clusters real Langfuse or JSONL traces into a human-confirmed failure taxonomy with counts, then recommends binary pass/fail evals for recurring named modes. Use to learn what to measure before writing evals. Not for CI failures."
context: fork
# user-typed commands stay interactive; CC >= 2.1.218 backgrounds forks by default (#3093)
background: false
version: 1.0.0
author: OrchestKit
tags: [error-analysis, evaluation, llm-testing, testing, langfuse, traces, failure-taxonomy, evals, debugging]
user-invocable: false
disable-model-invocation: false
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, TaskGet, TaskStop, WebFetch, WebSearch]
skills: [testing-llm, memory]
complexity: high
persuasion-type: discipline
effort: high
model: sonnet
metadata:
  category: workflow-automation
triggers:
  keywords: ["error analysis", "failure modes", "failure taxonomy", "open coding", "axial coding", "analyze traces", "langfuse traces", "evals first", "what to measure", "why does my agent fail"]
  examples:
    - "run error analysis on my Langfuse traces"
    - "my agent keeps failing and I do not know which evals to write"
    - "pull 100 production traces and build me a failure taxonomy"
  anti-triggers: [ci-debug, errors, "write evals", verify, cover, "fix this bug"]
---

# Error Analysis

Evals-first failure analysis for LLM applications. The method (Hamel Husain, Shreya Shankar) is qualitative research applied to traces: a human open-codes real failures, Claude axial-codes the notes into a named taxonomy, and only the recurring named modes earn an automated eval. Error analysis decides what to measure; it never writes an eval for a mode that has no name and no count.

## When to Use

- An LLM feature (chatbot, RAG, agent, extractor) misbehaves and the team is guessing which evals to write
- You have production traces in Langfuse (or a JSONL export) and need the top failure modes with counts
- Eval scores exist but nobody trusts them because they were never grounded in real failures
- A judge or metric exists and its agreement with human labels is unknown

Do NOT use for Claude Code session errors (`errors` skill), failing CI runs (`ci-debug`), or writing the evaluators themselves once modes are named (`testing-llm`, `ork:eval-runner`).

## Task Management (CC 2.1.16)

Multi-phase workflow: create tasks before Phase 1 and keep status current.

```python
t_run  = TaskCreate(subject="Error analysis: {target}", activeForm="Running error analysis on {target}")
t_pull = TaskCreate(subject="Pull traces", activeForm="Pulling traces")
t_open = TaskCreate(subject="Open-code failure notes", activeForm="Open-coding traces")
t_axial = TaskCreate(subject="Axial-code failure taxonomy", activeForm="Axial-coding notes")
t_tax  = TaskCreate(subject="Write failure-taxonomy.md", activeForm="Writing taxonomy")
t_eval = TaskCreate(subject="Recommend evals + judge alignment", activeForm="Recommending evals")
TaskUpdate(taskId=t_open,  addBlockedBy=[t_pull])
TaskUpdate(taskId=t_axial, addBlockedBy=[t_open])
TaskUpdate(taskId=t_tax,   addBlockedBy=[t_axial])
TaskUpdate(taskId=t_eval,  addBlockedBy=[t_tax])
```

## Effort Scaling (CC 2.1.76)

| Effort | Trace pool | Notes | Outcome |
|--------|-----------|-------|---------|
| low | 30 | human notes only, no Claude drafts | draft taxonomy |
| medium | 50 | drafts after 10 human notes | taxonomy + counts |
| high (default) | 100 | drafts after 30 human notes, saturation check | full deliverable |

## Phase 1: Pull Traces

Goal: a working pool of ~100 diverse traces (default N=100), skewed toward failures.

**Source A, Langfuse public API.** Requires `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` in env. Never echo or print the secret value; reference the variable names only.

```bash
mkdir -p error-analysis/traces
# Credentials ride in the Authorization header, so let curl enforce the scheme:
# --proto '=https' fails closed on every non-HTTPS URL. Do not pattern-match the
# host yourself; uppercase schemes, scheme-less names, decimal IPs, and userinfo
# tricks all bypass a regex. Relax to '=http,https' ONLY for an exact local
# endpoint (http://localhost, http://127.0.0.1, http://[::1], optional port and
# path, no userinfo). For a self-hosted internal instance, use HTTPS or an SSH
# tunnel to localhost.
proto="=https"
host_lc=$(printf '%s' "$LANGFUSE_HOST" | tr 'A-Z' 'a-z')
case "$host_lc" in
  http://*)
    authority=${host_lc#http://}
    authority=${authority%%/*}
    case "$authority" in
      *@*) printf '%s\n' 'Refusing HTTP with userinfo in the URL; use HTTPS.' >&2; exit 1 ;;
    esac
    case "$authority" in
      localhost|localhost:*|127.0.0.1|127.0.0.1:*|\[::1\]|\[::1\]:*) proto="=http,https" ;;
      *) printf '%s\n' 'Refusing plain HTTP to a non-local host; use HTTPS or an SSH tunnel to localhost.' >&2; exit 1 ;;
    esac
    ;;
esac
# Langfuse v4 removed GET /api/public/traces (404); the v2 Observations API is the
# supported read. It returns observation rows, so group by traceId client-side.
# io is required in fields or the rows come back without input/output.
curl -sS --fail-with-body --proto "${proto:-=https}" -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  "$LANGFUSE_HOST/api/public/v2/observations?fromStartTime=$FROM&toStartTime=$TO&limit=100&fields=core,basic,trace_context,io" \
  -o error-analysis/traces/page1.json
```

Paginate with the `cursor` from each response until ~100 distinct `traceId` values are collected (or the cursor is exhausted), aborting on any non-2xx status so an error body is not read as the end of the cursor. Then finish the selected traces: the last trace in the pool may be missing rows, so keep paging until every selected `traceId` has its root observation (the `isRootObservation: true` row, or exactly one `parentObservationId == null` row as fallback; zero or several null-parent rows means `root-unknown`, so exclude that trace and say so in the notes), or fetch the missing rows per trace with `?traceId=<id>`. Group rows by `traceId` and normalize each trace to one JSONL line in `error-analysis/traces.jsonl`: `{id, timestamp, input, output, scores, observations[]}`. Observation rows do not carry `scores`; fetch them per trace id from the Scores API v3 (`GET /api/public/v3/scores?traceId=<id>`) and join them in, since low scores and negative feedback are the failure signals Phase 1 prioritizes. Keep the raw tool and DB observations; Phase 5 needs them for replay. On a v3 host the legacy `GET /api/public/traces` list still works; the v2/v1 shapes, deprecation detail, and the JSONL fallback live in `references/langfuse-traces.md`.

**Source B, exported JSONL.** If the user hands you a file, inspect the first line with `head -1` and map its fields to the same normalized shape. Do not assume field names; Langfuse, Braintrust, and home-grown loggers all differ.

Prioritize traces that carry failure signals: thumbs-down feedback, low scores, exceptions, retries, escalations. If fewer than ~30 traces show any failure signal, say so and ask whether to analyze a random sample anyway.

## Phase 2: Open Coding (human writes, Claude drafts)

Open coding is a human activity. The reviewer is the benevolent dictator: one person owns the labels so the taxonomy stays coherent. Claude accelerates, it does not label unattended.

For each failing trace:

1. Render a compact view: input, final output, and each tool or DB observation with its output.
2. Draft ONE short free-form candidate note (a sentence, not a category). Aim at the FIRST failure in the trace; upstream failures cascade, so tagging a downstream symptom as its own mode double-counts.
3. The human accepts, edits, or replaces the note via AskUserQuestion (options: Accept, Edit, Skip; Other captures free text).
4. Append to `error-analysis/open-coding-notes.md`: `trace_id | note`.
5. Label passing traces too. Judge alignment needs true negatives, so the human also labels a slice of traces with no failure signal (roughly one pass for every two failures) with the same per-mode binary label. Without labeled passes, Phase 5 can report TPR but never an honest TNR.

Cadence per the method: the human writes the first ~30 notes largely unaided (Claude drafts may be shown but the human decides), then Claude may search remaining traces for likely instances of the failure patterns seen so far and the human accepts or rejects each suggestion. Continue until theoretical saturation: new traces stop revealing new failure modes. ~100 diverse traces is the usual working pool, not a quota.

**Prompt or code?** When a note implicates a tool or retrieval step, replay it: re-run that tool call or DB query with the inputs recorded in the trace. Replay live only when the call is read-only; a payment, message send, or DB write replays against a sandbox or a recorded fixture, never a live service, or it is not replayed at all. Compare the replayed output with the observation recorded in the trace before assigning a verdict. If the replayed output matches the recorded one and it was wrong, the failure is code or data (the tool itself). If the replayed output matches a correct recorded output yet the final answer was wrong, the failure is prompt or context (the model had good inputs and used them badly). If the replayed output differs from the recorded one, the verdict is inconclusive until the difference is explained (stale data, drift, flaky tool), because the recorded output is what the model actually saw. Record the verdict in the note, for example `prompt`, `code:retriever`, or `inconclusive:replay-diverged`. This one check splits the taxonomy into things a prompt edit can fix and things it cannot.

## Phase 3: Axial Coding (Claude proposes, human confirms)

When open coding slows or the pool is exhausted, cluster the notes:

1. Claude reads `open-coding-notes.md` and proposes 5 to 8 named failure modes. Each mode gets a name, a one-sentence definition, and the notes it absorbs.
2. Present the proposed modes with per-mode note counts via AskUserQuestion. The human confirms, merges, splits, renames, or rejects modes. This confirmation is mandatory; an unconfirmed taxonomy is a draft.
3. Fewer than 5 modes usually means over-merged categories that will produce vague judges. More than 8 usually means noise modes with count 1 or 2 that should fold into a sibling or a `misc` bucket rather than earn a name.

## Phase 4: Write failure-taxonomy.md

Write `error-analysis/failure-taxonomy.md` with two artifacts:

Table 1, the taxonomy:

| Failure mode | Definition | Example trace ids | Count | Eval? |
|---|---|---|---|---|

Table 2, counts:

| Mode | Count | % of failures | Fix surface (prompt/code/data) |
|---|---|---|---|

Rules for the Eval? column: `yes` only for modes that are named, recurring (count >= ~3 or a top share of failures), and expected to persist after an obvious prompt fix. One-off bugs, upstream data issues, and modes a code assertion can check deterministically get `no` with a reason in Phase 5. Sort both tables by count descending.

## Phase 5: Recommend Evals

For each `eval: yes` mode, write a recommendation in `error-analysis/eval-recommendations.md`:

- **Name** and the failure mode it detects
- **Check**: binary pass/fail only. Phrase it so a grader answers "did failure X occur, yes or no". No Likert scales; a 1-5 score hides disagreement inside the middle values and makes judge alignment unmeasurable.
- **Critique**: a written paragraph covering what the eval can and cannot catch, likely false-positive sources, and the cheapest viable implementation (code assertion before LLM judge; a judge is a classifier returning pass or fail, one judge per mode, never one judge grading overall quality).
- **Judge alignment**: if the check needs an LLM judge, it is untrusted until measured against the Phase 2 human labels, which must include both labeled failures and labeled passes for the mode. Split labeled examples into train/dev/test, iterate the judge prompt on dev disagreements, and report TPR (failures caught) and TNR (good outputs passed) on the untouched test set. The full protocol is `references/judge-alignment.md`.

Delegate execution to the eval-runner agent (`ork:eval-runner`) when the user wants the evals actually run against a dataset; this skill produces the taxonomy and the eval specs, the runner executes and scores them.

```python
Agent(subagent_type="ork:eval-runner",
      prompt="Run the recommended evals in error-analysis/eval-recommendations.md against <dataset>. Report TPR/TNR vs the human labels in error-analysis/open-coding-notes.md.")
```

## Output Artifacts

| File | Content |
|------|---------|
| `error-analysis/traces.jsonl` | Normalized trace pool |
| `error-analysis/open-coding-notes.md` | trace_id, note, prompt-or-code verdict |
| `error-analysis/failure-taxonomy.md` | Named modes, definitions, examples, counts, eval yes/no |
| `error-analysis/eval-recommendations.md` | Binary eval specs, critiques, judge-alignment status |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Who labels | One human (benevolent dictator); Claude drafts, human decides |
| Which failure to note | The first one in the trace; downstream symptoms cascade from it |
| How many modes | 5 to 8, human-confirmed |
| Eval granularity | Binary pass/fail, one judge per mode |
| Which modes get evals | Named and recurring only; fix trivial prompt gaps first |
| Judge trust | Unmeasured until TPR/TNR vs human labels on a held-out test set |

## References

- `references/method.md`: the open/axial coding method, saturation, and the source list (hamel.dev evals FAQ, hamel.dev LLM-as-judge, Anthropic eval docs)
- `references/langfuse-traces.md`: Langfuse public API trace pull, pagination, JSONL export shape
- `references/judge-alignment.md`: train/dev/test splits, TPR/TNR, disagreement-driven judge iteration

## Related Skills

- `testing-llm`: evaluation frameworks, Langfuse SDK v4, metric thresholds for the evals this skill recommends
- `errors`: Claude Code session errors, a different domain than LLM app traces
- `cover`: generates tests; run it after the taxonomy names what to test
- `verify`: grades the resulting eval suite once it exists
- `ork:eval-runner`: executes the recommended evals and reports scores to Langfuse
