# Parallel Primitives in Claude Code

When you have N parallel-friendly tasks, Claude Code gives you **three different
primitives**. They're not interchangeable — each fits a different workload
shape. This page is the OrchestKit decision guide.

> **Why this doc exists**: `/ork:agents-view` was a thin wrapper around
> `claude agents`. We removed it (2026-05-20) because it added little over
> the native CLI and obscured the real question: *which primitive should I
> use?* This doc answers that.

---

## The three primitives at a glance

```
┌─ Task tool ──────────┐  ┌─ Agent Teams ────────┐  ┌─ claude agents ─┐
│ STAR (subagents)     │  │ MESH (in-process)    │  │ PROCESS-ISOLATED│
│                      │  │                      │  │                 │
│     ┌────┐           │  │   ┌────┐    ┌────┐   │  │ ┌──┐ ┌──┐ ┌──┐  │
│     │YOU │           │  │   │ A  │◄──►│ B  │   │  │ │CC│ │CC│ │CC│  │
│     │ ▼  │           │  │   └──┬─┘    └─┬──┘   │  │ │1 │ │2 │ │3 │  │
│   ┌─┴┐┌─┴┐┌─┴┐       │  │      ▼        ▼      │  │ └──┘ └──┘ └──┘  │
│   │a1││a2││a3│       │  │     ┌──────────┐     │  │  N OS processes │
│   └──┘└──┘└──┘       │  │     │    C     │     │  │  No comms       │
│   isolated, no chat  │  │     └──────────┘     │  │  except files   │
│                      │  │     riff in realtime │  │                 │
├──────────────────────┤  ├──────────────────────┤  ├─────────────────┤
│ Cost: ~150K tokens   │  │ Cost: ~400K tokens   │  │ Cost: N×budget  │
│ Same session         │  │ Same session         │  │ Separate ctx    │
│ Survives /clear: NO  │  │ Survives /clear: NO  │  │ Survives: YES   │
│ Best for:            │  │ Best for:            │  │ Best for:       │
│   • cheap parallelism│  │   • debate, hand-off │  │   • overnight   │
│   • independent work │  │   • coordination     │  │   • cross-mach  │
│   • "do N things"    │  │   • design sessions  │  │   • async/batch │
└──────────────────────┘  └──────────────────────┘  └─────────────────┘
```

---

## Quick decision tree

```
Do I need parallelism?
│
├─ No  → just call tools sequentially, you're done
│
└─ Yes
   │
   ├─ Are the N tasks INDEPENDENT (no need to talk to each other)?
   │  │
   │  ├─ Yes → Task tool       (cheapest, simplest, star pattern)
   │  │
   │  └─ No  → do they need to DEBATE or HAND OFF in real time?
   │           │
   │           ├─ Yes → Agent Teams (TeamCreate + SendMessage)
   │           │
   │           └─ No  → still Task tool — they don't actually need to talk
   │
   └─ Do they need to RUN OVERNIGHT or SURVIVE /clear?
      │
      └─ Yes → claude agents CLI (process-isolated, durable)
```

---

## Detailed comparison

### Task tool — STAR pattern

**When to reach for it:**

- You have N **independent** things to do that share no state.
- The work fits in one Claude session's context budget.
- You want results back before the parent agent's next decision.

**Examples in this repo:**

- `/ork:cover` spawns one Task per test tier (unit / integration / e2e) — each
  generator runs without seeing the others' work. The parent collects results.
- `/ork:brainstorm` Phase 2 — N domain experts each draft 3-4 ideas
  independently, then the parent synthesizes.
- Multi-file research: 5 Reads in parallel via the Task tool, parent merges.

**Cost shape:** ~150K tokens for 3-5 subagents. Linear in N up to context
budget. Cache hits across forks (CC 2.1.89+) drop this further.

**Anti-pattern:** spawning Task subagents when they actually need to share
intermediate state. Use Agent Teams instead.

---

### Agent Teams — MESH pattern

**When to reach for it:**

- The agents genuinely need to **react to each other's outputs** in real time.
- Design debate. Code review where reviewer A's finding changes what
  reviewer B looks at. Hand-off chains.
- You're OK paying ~3× the Task tool cost for the back-and-forth.

**Examples in this repo:**

- `/ork:brainstorm` Agent Teams mode — `system-designer` proposes an arch,
  `backend-thinker` riffs on the APIs, `frontend-thinker` reacts with UX,
  `testability-assessor` challenges the lot.
- `/ork:implement` parallel workstreams that need to negotiate interface
  boundaries.

**Cost shape:** ~400K tokens for a 3-5 agent team across a brainstorm
session. The premium pays for `SendMessage` traffic between agents.

**Anti-pattern:** using Agent Teams for **independent** work just because
"more agents = better." If they don't actually need to talk, Task is cheaper
and simpler.

---

### `claude agents` CLI — PROCESS-ISOLATED

**When to reach for it:**

- Truly **long-running** work — overnight runs, multi-hour batches.
- Each session needs its **own context budget** because one parent can't hold
  all the state.
- Work that should **survive `/clear`**, terminal close, or even reboot.
- Cross-machine fan-out (one machine spawns sessions on others).

**Examples in this repo:**

- Wave runs like M170 / M164 overnight — 4 parallel `claude agents` sessions,
  one per worktree, each with its own context.
- Manual orchestration of multi-day work where the human reviews each
  session's output asynchronously.

**Cost shape:** N × (full session budget). Most expensive. Each session pays
its own startup cost (no shared cache between sessions).

**Anti-pattern:** spawning `claude agents` for a 5-minute poll loop. That's
ONE foreground loop's job, not N processes. Process isolation is overkill
when you don't need its specific guarantees.

---

## Today's example: a 5-PR merge queue

Real workload we ran (2026-05-19): 5 PRs in CI conveyor — rebase, watch
checks, rebase again as main moves.

| Primitive | Fit? | Why |
|---|---|---|
| Task tool | ❌ | Subagents return and die; can't "watch" persistently |
| Agent Teams | ❌ | No coordination needed — rebase is mechanical |
| `claude agents` CLI | ❌ | Heavy: N processes for a polling loop is wasteful |
| **A single foreground loop using `gh` CLI** | ✅ | Right tool. ONE process, ONE budget, watches N PRs |

This is the case where **none of the three primitives is the right answer**.
The right answer was a plain loop. Reach for parallelism only when you have
genuine parallelism to spend.

---

## When to use multiple primitives together

These compose:

- **Task → claude agents**: parent spawns Task subagents to plan worktrees,
  then dispatches `claude agents` CLI sessions per worktree.
- **Agent Teams → claude agents**: design team brainstorms architecture,
  then long-running implementation runs as detached CLI sessions.
- **claude agents → Task**: each detached session uses Task internally for
  its own parallelism.

---

## See also

- `claude agents --help` — the CLI itself (CC 2.1.139+).
- `claude plugin details ork` — runtime footprint of the OrchestKit plugin
  in the current session.
- `src/skills/brainstorm/SKILL.md` — Agent Teams worked example.
- `src/skills/cover/SKILL.md` — Task tool worked example.
- `shared/rules/manual-worktree-pattern.md` — pre-creating worktrees before
  spawning agents/sessions.
