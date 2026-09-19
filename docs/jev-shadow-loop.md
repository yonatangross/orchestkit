# Offline Jev improvement loop

Step 1 is a local report command. It neither calls TypeSafe nor installs a job,
changes a flag, trains a model, or promotes a seam. Its cost is 0 TypeSafe credits.

```sh
node scripts/jev-loop-report.mjs sources.json > report.json
```

The manifest explicitly attributes each input to its harness and host or tenant
namespace. Paths are files relative to the manifest, not directories or globs.
Use immutable snapshots, excluding benchmark and fixture outputs from traffic.
Never list the same file as traffic from multiple harnesses.

```json
{
  "version": 1,
  "sources": [
    {"harness":"claude-code","namespace":"host-a","producer":"hq-ext","seam":"route","files":["hq-route.jsonl"]},
    {"harness":"claude-code","namespace":"host-a","producer":"ork","seam":"route","files":["ork-route.jsonl"]},
    {"harness":"codex","namespace":"host-a","producer":"ork-codex","seam":"route","files":[]}
  ]
}
```

Supported harness names are `claude-code`, `codex`, `cursor`, `devin`, `pi`, and
`platform`. Producer is provenance, not an inferred router. Use `seam: "*"` for
mixed files. Sources without files are visible inventory gaps, not proof of absent
wiring. Each file must be at most 64 MiB; rotate or snapshot larger logs first.
Missing, unreadable, conflicting-provenance, and wrong-seam inputs fail the command.
Malformed lines or invalid canonical pairing contracts produce an incomplete
report and exit 2. Null incumbents require a reason; structured incumbent outcomes
require null agreement. Do not promote from an incomplete report.

The JSON contains file byte hashes, inventory, minimal decision projections,
joined decisions, per-harness/seam counts, and `confident_wrong` as the export.
The export predicate is shadow mode AND `agree === false` AND
`jev_confidence >= floor`, with valid probabilities required. The bucket name is
historical: these are disagreements awaiting adjudication, not proven mistakes.
Legacy route and category rows remain readable. Auxiliary Noul answers retain
their seam and provenance but do not become Choice picks or probabilities.
Platform inputs must be flattened decision projections with the canonical fields;
the command does not query production databases or unpack arbitrary event blobs.

Route joins require namespace, harness, session_id and prompt_id. HQ and Ork use
the same identity within a Claude prompt. An explicit handoff selects the terminal
router, pending records cannot win, and conflicting terminal records stay unknown.
Cross-harness coincidental IDs never merge. Historical rows without identity stay
separate. Category and expect rows are separate questions, not route decisions.
Every input row survives in `rows`; selected decisions retain source lineage.
Canonical recursively sorted JSON SHA-256 matches the reply-audit fingerprint
contract. The labeler's sidecar can bind `source` and `decision_sha256` to these
rows. Step 1 deliberately does not generate, infer, or apply weak outcome labels.

## Proposed cycle after step 1

1. Freeze snapshots from each wired harness and host, hash inputs, run this report.
2. Feed exact identities and fingerprints to jev-reply-audit's separate labeler.
   Keep weak correct/wrong/unknown apart from human adjudicated correctness.
3. Review per-seam disagreements. Use development rows to propose prompt shape,
   candidate framing or a floor change. Formbench owns checkbox negation and
   candidate omissions; do not duplicate its work or train on its held-out forms.
4. Before any proposal, freeze a grouped split by task/session/form family across
   all harnesses: 60% development, 20% calibration, 20% sealed evaluation. A prompt,
   its router rows, duplicates and related form variants must stay in one split.
   Tune floors only on calibration. Keep eval labels hidden from proposal authors.
5. Evaluate the frozen candidate and incumbent on the same sealed rows with fresh
   isolated state. Neither weak labels nor agreement alone establish accuracy.
6. Operator may approve installing a successful candidate in shadow. Collect a
   new prospective cohort; reuse of the offline evaluation cohort is forbidden.
7. Operator alone may authorize promotion, separately for each seam and harness.

Proposed promotion policy, not current authorization: route, category, expect,
inbox, outbound, agent routing, spam and fanout each require at least 300
independently adjudicated above-floor held-out decisions AND 300 fresh shadow
decisions; at least 99% complete pairing/identity coverage; a one-sided 95% Wilson
upper bound on above-floor error at most 1%; no more errors than the incumbent on
the matched cohort; and zero observed critical safety regressions. Apply the same
checks independently to both cohorts and each harness/seam. Correlated repetitions
do not count as independent samples. Fewer eligible rows means keep shadowing.
Noul auxiliary seams need separate typed outcomes and a calibrated rubric before
they are eligible for these gates. Never invent a probability or reuse a route floor.

Automatic work, once separately scheduled, may freeze, collect, validate, label
weak outcomes, and prepare review queues. Human adjudication, changing prompts or
floors, any paid evaluation, installing candidates, and every promotion require
the operator. Nothing is scheduled by this change.

Budget proposal: automatic collection/reporting remains 0 TypeSafe credits. A paid
cycle would have a hard ceiling of 100 native TypeSafe credits, shared across all
harnesses and retries, plus at most 500 requests and 1 million tokens. This is an
engineering proposal, not an approved spend or dollar conversion. The verified
credit meter and pre-request reservation must exist before enabling it; unknown
cost, exhaustion or unavailable balance stops the cycle. No paid cycle runs now.

Evidence principles: outcomes and graders need calibration, unknown must remain
available, and shared state contaminates evaluation (Demystifying Evals for AI
Agents, p. 1). End-to-end identity and idempotent ingestion are necessary to avoid
missing or duplicated effects (Distributed Task Reliability for AI Agents:
Idempotency, Retries & Queues, p. 9). Numeric gates above are proposed policy,
not thresholds supplied by those books.
