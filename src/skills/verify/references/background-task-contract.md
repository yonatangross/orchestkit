---
title: "Background task contract: never wait unconditionally"
tags: [verify, background, monitor, silent-failure]
---

# Background task contract

`/ork:verify` hung for ~40 minutes producing **no verdict** (#3263, 2026-08-03).
Three backgrounded test suites each wrote **0 bytes** and no process was alive
afterwards. This file records the contract that prevents a repeat, and the
evidence behind it, so nobody re-derives the refuted hypotheses.

## The rule

1. **Capture the task id.** If `run_in_background` returned no id, the request
   was not honoured: the command ran synchronously and its output came back
   inline. There is nothing to wait for. Use the inline output.
2. **Bound every wait.** A wait that can only end on a notification will never
   end if the notification cannot fire.
3. **An empty run is a FAILURE, not a pending one.** If the output is still
   empty and no matching process is alive, the suite never ran. Report that.
   Never emit a grade, a score, or a "verified" claim from a run that produced
   no bytes.

Rule 3 is the important one. A verification skill that can silently no-op
undermines every claim ever made through it: the operator reads "no verdict
yet" as "still working" rather than "never started".

## Diagnosis: what npm's banner proves

npm writes `> pkg@version script` **before** executing any script body. So any
hypothesis in which npm started predicts a non-empty file. All three failing
tasks were 0 bytes, which refutes every "the suite failed / hung" explanation
at once. Useful primitive: **the absence of a tool's own startup banner locates
the failure before the tool, not inside it.**

## Hypotheses, settled

| # | hypothesis | verdict |
|---|---|---|
| H1 | dies under the #3235 concurrency bug | REFUTED, requires npm to start |
| H2 | cwd/PATH differ so `npm` is unresolvable | REFUTED with positive evidence: npm resolves, node v22, exits 0 |
| H3 | `Monitor` attaches to an already-exited task | reclassified: a consequence, not a cause |
| H4 | child reaped when the subagent exits | REFUTED, child ran a 20s sleep to completion |
| H5 | backgrounding from inside a fork is ignored | LEADING, not proven for the skill-fork path |

**H5 is not proven.** The probe that demonstrated inline execution was an
*Agent* fork and received no task id at all; `/ork:verify` is a *skill* fork and
did receive ids (`b6tvprwm6`, `bdycijacv`, `brvhtn4h3`) with empty files. The two
paths only share a mechanism if the same plumbing serves both, which is an
assumption. Do not write "fixed by H5" anywhere until that is measured.

The contract above deliberately does not depend on H5 being right. Whatever
empties the file, an unbounded wait on an unconfirmed task is a defect on its
own, and bounding it converts a silent hang into a reported failure.

## The executable form of this contract

`scripts/assert-evidence.sh <logfile> [--task-id <id|none>] [--pid <pid>] [--banner-re <re>] [--json]`
implements rules 1-3: EVIDENCE (0) / NO-BANNER (1) / usage (2) / COULD-NOT-OBSERVE (3) /
STILL-RUNNING (4). Phase 3 runs it before any grade; only EVIDENCE may be graded.
The banner regex defaults to npm's `> pkg@ver script` line; pass `--banner-re` for other
runners (pytest: `'^=+ test session'`).

## Settling H5: the one-off measurement

Redirection makes the harness task-output file empty by construction, so H5 cannot be
measured through the normal Phase 3 path. To settle it, run ONCE on a quiet tree the
UNredirected shape the original failure used:

```python
M = f"verification-output/{ts}/marker.txt"
task = Bash(command=f"echo START-$(date +%s) > {M}; npm test 2>&1", run_in_background=true)
```

Record exactly four fields: (1) was a task id returned; (2) bytes in the harness
task-output file (`wc -c` on the path Monitor/TaskOutput reports); (3) where npm's banner
appeared: in that file, inline in the tool result, or nowhere; (4) does `marker.txt`
exist (absent = the command never launched; present with an empty output file = launched
and the output was lost). Post the four fields as a comment on #3263 — the operator's
comment, not a memory entry. If (1) is null, the Agent-fork result generalises to the
skill fork; if an id arrives with 0 bytes and the marker exists, the skill-fork path is a
distinct defect and #3263 gets a new hypothesis rather than a close.

## Reproducing the original signature is still blocked

It needs a real `/ork:verify` run, which runs `npm test`.
`tests/unit/test-sync-versions.sh:76` sets `FAKE_VER="999.888.777"` and
propagates it through `scripts/stamp-counts.sh` into tracked files, restoring
them with a trap. That makes `npm test` unsafe while any other session is live.

`--quick` does **not** avoid it: `tests/run-all-tests.sh:63` clears only
`RUN_INTEGRATION`, `RUN_E2E` and `RUN_PERFORMANCE`, leaving `RUN_UNIT="true"`,
so the sentinel still runs. Verified at HEAD `b6e65248f` on 2026-08-06.

Settling H5 therefore requires either a quiet tree or making the sentinel test
operate on a copy instead of the live working tree. That is tracked separately
under #3235.
