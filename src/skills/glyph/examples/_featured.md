---
title: Glyph, at a glance
description: The page an agent sends a human to when they ask how to use /ork:glyph. Curated, not a dump; regenerated from this file on every docs build (#3901).
---

Glyph draws the answer instead of describing it: a status board, a comparison, a flow, a
risk meter, in plain box-drawing characters that survive any terminal, with a small fixed
set of emojis that each mean one thing. It does this inline, right now, with no setup
questions. If the honest drawing needs more than about twelve lines, it is not a chat
answer any more and glyph hands off to a page instead.

### The two picks it makes for you

| Pick | Options | Default | It escalates when |
|---|---|---|---|
| **audience** | operator (dense, internal names allowed) or novice (plain words, an analogy first) | operator | you name a reader who is not you ("for Nir", "explain to the client", "eli5") |
| **surface** | chat (inline, at most 12 lines) or page (a served HTML explainer) | chat | the drawing needs more than 12 lines, or it has to persist, or you asked for a file |

Both picks are announced in one line before the render, so you can override with a word.

### Three real renders

**1. A status board** (`/ork:glyph` with no argument draws where the conversation is):

```
✅ 1 probe      measured, transcript on #3877 (CLOSED)
✅ 2 lane 5     #3949 merged c326ca5fe (my #3948 closed as its duplicate)
🔥 3 beta.1     #3950 alpha.86 is open; beta.1 needs a Release-As footer instead
✅ 4 worktrees  done
✅ 5 stashes    done
```

**2. A comparison** (`/ork:glyph compare monolith vs services`):

```
BEFORE                          AFTER
┌────────────┐                  ┌────────────┐
│  Monolith  │                  │  Service A │──┐
│  (all-in-1)│                  └────────────┘  │  ┌──────────┐
└────────────┘                  ┌────────────┐  ├─>│  Shared  │
                                │  Service B │──┘  │  Queue   │
                                └────────────┘     └──────────┘
```

**3. A dependency flow with a verdict per node** (`/ork:glyph what blocks the release`):

```
🔥 1 probe (#3877)  ──→  2 lane 5  ──→  3 beta.1  ──→  milestone CLOSED
     you, 10 min          agent          1 PR

   4 worktrees: 4 real + 2 strays        independent, your call
   5 stashes:   7 proven + 2 unproven    independent, your call
```

All three came from one working night (2026-09-06, milestone 164's close-out); none is a
mock-up.

### The exact invocation

```bash
/ork:glyph                       # draw where the conversation is right now
/ork:glyph <topic>               # draw one thing: a plan, a comparison, a status
/ork:glyph --eli5 <topic>        # novice audience, and a page if it needs one
/glyph                           # the front door: same dials, may route to a page
```

What it will never do: ask you a setup question, use an emoji that is not in its fixed
semantic set (done, failed, warning, in progress, waiting, idea, hard block, goal, top
priority, doc, agent, hook, and the three risk colours), or exceed the twelve-line budget
in chat. Over budget means a different deliverable, and it says so.

### When it is the wrong tool

A multi-section interactive playground or a persisted plan artifact is `visualize-plan`.
A real chart with numbers on axes goes through `dataviz` first. Anything that must be
handed to a human as a URL is served with `/ork:page-serve`.
