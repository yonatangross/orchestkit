---
title: Long-Run Protocol
impact: HIGH
impactDescription: Long multi-agent runs finish at a named line, stop only where a human is needed, and never pass an unchecked claim as fact
tags: [long-run, subagents, evidence, finish-line, cross-cutting]
---

## Long-Run Protocol

Source: Anthropic, "Getting the most out of Opus 5.5" (claude.dev/blog/getting-the-most-out-of-opus-5-5),
read 2026-09-22. Quoted lines below are verbatim.

### 1. Name the finish line before starting

"Name the finish line, like 'the tests pass' or 'every endpoint is migrated.'" Each skill that loads this
rule states its own line as `Done means: ...`. Work until that line is met, not until the phases are
ticked.

### 2. Keep going, and stop only where a human is needed

"When a step doesn't need my input, keep going. Put status notes in the same message as your next
action. Stop and ask only when you can't continue without me, or before anything destructive: deleting
data, force-pushing, or changing anything outside this repository."

**Incorrect:** ending a phase with "Want me to continue with phase 4?" when phase 4 needs no decision.
**Correct:** a one-line status note, then the first action of phase 4, in the same message.

A skill's own AskUserQuestion gates (intent, scope, blast radius) still apply: they are decisions only
the user can make, which is the case the rule stops for.

### 3. Keep a TASKS.md for runs that can outlive the session

"Keep a checklist in TASKS.md. Tick each item when it's done, and add anything new you find."
TaskCreate tracks the live session; a rate-limit kill or a relaunch loses it. When a run spans many
phases or several sessions, mirror the task list into `TASKS.md` at the worktree root and read it first
on resume. Never stage or commit it.

### 4. Check each subagent's evidence before accepting it

"When a subagent reports back, check its evidence before you accept it." A subagent's DONE is a claim.
Accept it only when the evidence it cites is present: re-run the command, read the file and line, or
open the artifact.

**Incorrect:** `agent says tests pass -> mark phase complete`.
**Correct:** `agent says tests pass (npm test, exit 0) -> re-run npm test -> exit 0 -> mark complete`.

### 5. Mark what you could not confirm

"Mark anything you couldn't confirm, and say where you looked." Every claim in a final report is either
confirmed (with the command, file:line or URL) or marked unconfirmed with the places searched.

**Incorrect:** "The config is only read at startup."
**Correct:** "Unconfirmed: the config is only read at startup. Looked in src/config/*.ts and the boot
path; found no reload call, but did not check plugins/."

### 6. Do not ask for reproduced reasoning

Opus 5.5 "always thinks before it replies, and it decides how much. You don't need to ask it to think."
Do not add "think step by step" or "show your reasoning" to agent or subagent prompts: "A request to
reproduce its internal reasoning in the reply can be declined." To change depth, change effort. To get a
rationale, ask for one: "Explain why you chose this approach in three sentences."
