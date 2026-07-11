# Parallel Primitives in Claude Code — Slidedeck

> Paste this into a NotebookLM notebook source. NotebookLM will treat each
> `# Slide N` as a deck section when generating the audio/slide artifact.
> Companion to `docs/parallel-primitives.md` and the interactive playground.

---

# Slide 1 — The question that prompted this deck

OrchestKit shipped `/ork:agents-view` as a thin wrapper around `claude agents`
(CC's native CLI for parallel-agent observability).

That skill is being removed.

The real question it tried to answer — *"how do I orchestrate multiple
simultaneous CC sessions?"* — turns out to be a category error. Claude Code
gives you **three** different parallel primitives, and they're not
interchangeable. The skill conflated them.

This deck makes the distinction crisp.

---

# Slide 2 — The three primitives

**Task tool** (star pattern)
- Parent spawns N independent subagents in one Claude session.
- Each subagent works in isolation; parent collects results.
- ~150K tokens for 3-5 subagents.
- Dies with the parent session.

**Agent Teams** (mesh pattern)
- Teammates can `SendMessage` to each other in real time.
- One Claude session hosts all teammates.
- ~400K tokens — roughly 3× the Task tool cost.
- Dies with the parent session.

**`claude agents` CLI** (process-isolated)
- N separate CC OS processes, each with its own context budget.
- No inter-process comms except shared filesystem.
- N × full-session cost.
- Survives `/clear`, terminal close, even reboot.

---

# Slide 3 — Picking by workload shape

| Workload | Right primitive |
|---|---|
| Do these N independent things, give me results | **Task tool** |
| Brainstorm a design — multiple POVs need to riff | **Agent Teams** |
| Run 4 wave-implementations overnight | **`claude agents` CLI** |
| Poll N PRs in a CI conveyor | **None — use a plain loop** |

The fourth row is the key insight. Iteration over N items is **not** the same
as parallel work on N agents. Reach for parallelism when you have real
concurrent work to spend, not when you have a list.

---

# Slide 4 — Anti-patterns

**Spawning Task subagents that need shared state.**
- Use Agent Teams. Task subagents can't see each other's outputs.

**Using Agent Teams for independent work.**
- "More agents = better" is wrong. Pay the 3× cost only for back-and-forth.

**Dispatching `claude agents` CLI for a 5-minute polling loop.**
- Process isolation is the point. Don't pay for it when you don't need it.

**Wrapping the CC native CLI in an OrchestKit skill.**
- This is what `/ork:agents-view` did. The wrapper added almost nothing
  over the native tool. Document the native primitive; don't shadow it.

---

# Slide 5 — Today's worked example

Real session log, 2026-05-19: 5 pull requests in a merge queue. Each PR
needed rebase, watch checks, rebase again as main moved.

We tried framing this as a "swarm" problem — spawn N CC sessions, one per
PR. Wrong. The actual workload was:

```
while open_PRs > 0:
    for pr in BEHIND_PRs:
        rebase(pr)
    sleep_until(next_merge_event)
```

That's a single loop. One process. One token budget. One `gh pr list` call
every few seconds. It doesn't want agents — it wants iteration.

Lesson: ask "what's the shape of the work?" before reaching for parallelism.

---

# Slide 6 — When primitives compose

These are not mutually exclusive. Common compositions:

- **Task → `claude agents`**: parent uses Task tool to plan worktrees in
  parallel, then dispatches `claude agents` sessions per worktree.
- **Agent Teams → `claude agents`**: design team brainstorms architecture
  in one session, then long-running implementation runs detached.
- **`claude agents` → Task**: each detached session uses Task tool internally
  for its own parallelism.

The choice isn't "which primitive replaces the others." It's "which primitive
at which layer of the orchestration."

---

# Slide 7 — Why `/ork:agents-view` had to go

The skill description claimed it provided:

1. "Live observability of parallel agent sessions" — `claude agents` already
   does this; the wrapper added `--watch` and `--json` (both native flags).
2. "Per-session token cost" — `claude agents` shows this natively since
   CC 2.1.142.
3. "Plugin runtime footprint" — `claude plugin details ork` is the CLI for
   this; no skill needed.

The skill survived for ~7 days. Removing it:

- −1 skill from manifest (110 → 109)
- −1 docs page
- 0 functionality lost — `claude agents` and `claude plugin details ork`
  remain directly invocable.
- +1 docs page (`docs/parallel-primitives.md`) that teaches when to use
  each primitive, which is the actual durable knowledge.

---

# Slide 8 — Takeaways

1. **Three primitives, three workloads.** Task / Teams / CLI are tuned for
   different problem shapes; pick by workload, not by habit.

2. **Not every N-item problem is parallel.** Loops are fine. Sometimes the
   best "orchestration" is one smart process with `gh` / `curl` / `kubectl`.

3. **Don't wrap native CLIs as skills.** If the CC team ships a CLI, teach
   it in docs and use it directly. Wrapper skills add maintenance and
   confusion without value.

4. **Document the decision, not the syntax.** The hard part of parallel
   orchestration isn't "how do I invoke Task" — it's "which primitive
   fits this workload."

5. **Compose when needed.** The three primitives layer cleanly. The question
   is which goes where, not which replaces which.

---

# Slide 9 — References

- `docs/parallel-primitives.md` — the full markdown guide
- `docs/chore--kill-agents-view-document-parallel-primitives/parallel-primitives-playground.html`
  — interactive decision tool
- `claude agents --help` — native CLI (CC 2.1.139+)
- `claude plugin details ork` — runtime footprint
- `src/skills/brainstorm/SKILL.md` — Agent Teams worked example
- `src/skills/cover/SKILL.md` — Task tool worked example
- `shared/rules/manual-worktree-pattern.md` — pre-create worktrees before
  spawning agents/sessions
