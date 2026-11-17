# Blast Radius of the Fix: Prove the Safety Fact (before you ship it)

RCA (Phase 4) tells you the *cause*. Before Fix Design (Phase 5) closes, find what the fix could
break somewhere else, and prove the one fact it is safe because of by running real code. Listing the
callers is not the job: a grep does that in a second. The job is the breakage a grep does not show.

This serves the two Critical Constraints: **fix root causes, not symptoms** and **minimal, focused
changes**. It asks the user nothing. Everything it needs is in the code, the library source, the
issue and the run you make.

## When to run

- Between Phase 4 (RCA confirmed) and Phase 5 (Fix Design), once. The result goes into the PR body.
- **Skip** for **Hotfix** / `low` effort, or when the fix is obviously one line and local.
- **Grep first**: never spend a step on what the code or the issue already answers.

## Check 1: root cause or symptom

Does the fix address the confirmed root cause, or a symptom of it? If symptom, widen the scope or
re-open RCA. The `# type: ignore` / image-retag / package-downgrade class of patch is a symptom fix:
flag it and prefer the real fix.

## Check 2: the safety fact

A blast-radius writeup that sounds right is worthless: it reads as convincing whether or not it is
true. So do not hand back the writeup. Find the one or two facts the whole fix depends on and prove
them by running code.

### How sure are you (the proof ladder)

For each fact the fix's safety depends on, get it as far down this list as is cheap, and say where
it stopped.

| Step | What you have | Counts as |
|------|---------------|-----------|
| 1 | You said so | Worthless on its own |
| 2 | You pointed at the line: a real `file:line`, or the library's own source | A claim with a citation |
| 3 | You showed the bad case cannot happen: you walked the failure step by step and it does not reach | Reasoning, not a run |
| 4 | You ran it: a script or test that calls the real code and fails loudly if you are wrong | **The minimum for a pass** |
| 5 | You reproduced it in the running app | Strongest |

Step 4 is usually one small script that imports the same library the app ships and calls the exact
function you are worried about. A pass needs step 4. A fact left at step 1 to 3 is written down as
**unproven**, never as safe.

### Steps

1. **Read the change.** The diff, the symbols it adds, changes and deletes, and what it now does
   differently, including the part the diff does not spell out.
2. **Find the one fact it is safe because of.** Most fixes that look risky are safe because of a
   single fact, such as "this call only drops already-dead cache entries and does nothing else". If
   it holds, most risky cases clear at once. Spend your time here, not on a long list of maybes.
3. **Look where grep stops.** Read the source of the library you call, its pinned version and any
   local patch. Work out when things run: microtasks, teardown, framework differences. Follow what a
   symbol search misses: the JSON an API returns, a database column, a wire format, another language
   reading the same bytes, a feature flag, code three hops downstream. A schema or data migration,
   an auth or trust-boundary change, an altered response shape a consumer depends on, a backfill or
   a hot-path cost change all live here.
4. **Be honest about each risk.** Give it a real chance of happening and a real cost if it does.
   Keep the risks you confirmed. List the ones you checked and cleared separately. Cite a real
   `file:line`. A search that finds nothing is still an answer. Never make up a caller or an API.
5. **Prove the one fact.** Write a script or test that runs the real code, run it, and paste what
   happened. If it cannot be run, say so and mark the fact unproven.
6. **For a big or wide change**, ask more than one model the same question and merge the answers.
   Different models catch different real bugs.

## Output

Append to `.claude/chain/decisions.json` and the **PR body**:

```markdown
## Fix decisions (blast radius)
- **What it does:** what changed, including the part that is not obvious.
- **Safety fact:** <the one fact the fix is safe because of>
- **Ladder step:** 4 (script `path/to/check.ts` ran against the real code; output pasted below)
- **Risks:** each with how it breaks, `file:line`, how likely, how bad, how to check.
- **Cleared:** what was checked and why it is fine.
- **Before you merge:** the cheapest test or repro that catches the real bug (the script above).
```

If the fact could not be proven to step 4, write `Ladder step: <n>, unproven` and say what stopped
the run. The safety fact and the risks feed Phase 5 Fix Design and the regression test (Critical
Constraint: write the failing test BEFORE the fix).

## Why (failure classes this closes)

- **Symptom-patching**: shipping a `# type: ignore` / retag / downgrade when a root fix exists.
- **Silent scope creep**: a "small fix" that quietly needed a migration or broke a consumer,
  discovered after merge.
- **Writeup theatre**: a convincing blast-radius paragraph that no run ever checked.

## Anti-patterns

- Handing back a long list of callers instead of the one fact.
- Marking a fact safe at ladder step 1 to 3 because the reasoning felt solid.
- Inventing a caller, an API or a `file:line` to fill a risk row.
- Running the proof before RCA confirms the cause: you would be proving the wrong fix.

## Credit and license

The method (the one safety fact, the five-step proof ladder, the hand-back shape) is adapted from
the `blast-radius` skill of pstack by Lauren Tan, https://github.com/cursor/plugins (MIT License).
Local additions, not in the upstream skill: the rule that a pass needs ladder step 4, the
root-cause-or-symptom check, and the PR-body output shape.

```
MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
