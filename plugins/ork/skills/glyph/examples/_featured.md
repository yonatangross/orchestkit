---
title: Glyph, at a glance
description: The page an agent sends a human to when they ask how to use /ork:glyph. Curated, not a dump; regenerated from this file on every docs build (#3901).
---

Glyph draws the answer instead of describing it: an inventory with sections and totals, a
status board, a comparison, a flow, in plain box-drawing characters that survive any
terminal, with a small fixed set of emojis that each mean one thing. It does this inline,
right now, with no setup questions. One render per reply, up to about 50 lines, 76 cells
wide, verdict first. If the honest drawing needs more than that, it is not a chat answer
any more and glyph hands off to a page instead.

### The two picks it makes for you

| Pick | Options | Default | It escalates when |
|---|---|---|---|
| **audience** | operator (dense, internal names allowed) or novice (plain words, an analogy first) | operator | you name a reader who is not you ("for Nir", "explain to the client", "eli5") |
| **surface** | chat (inline, one render up to ~50 lines) or page (a served HTML explainer) | chat | the drawing needs more than ~50 lines, or it has to persist, or you asked for a file |

Both picks are announced in one line before the render, so you can override with a word.

### The reference render: an inventory

`/ork:glyph what is using my disk` on a 460 G Mac. One prose line with the verdict, then
the render, then what the numbers told me. This is the shape every inventory-like answer
takes (disk, spend, backlog, dependencies, hooks): header meter, traffic-light sections,
rows of icon / label / bar / value / action, a total per section, one arithmetic summary
line, caveat lines for the numbers that lie.

87 G comes back without asking anyone; 39 G more is real work and needs a yes.

```
🖥️  MACINTOSH HD  ·  /System/Volumes/Data
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░]
 used 355 G    free 73 G    83 % full · 460 G total

────────────────────────────────────────────────
🟢 SAFE, pure caches; nothing lost, tools refill them
────────────────────────────────────────────────
🐳 Docker dangling images+build cache  ▓▓▓▓░░░  14.5 G  docker prune
🌐 Chrome caches (Google + Island)     ▓▓░░░░░   8.9 G  browsers refill
🐍 uv cache  ~/.cache/uv  (unused)     ▓▓░░░░░   6.9 G  uv cache prune
📦 npm cache  ~/.npm                   ▓▓░░░░░   6.2 G  npm cache clean
🌐 Playwright + Puppeteer browsers     ▓░░░░░░   2.5 G  re-fetched
🗂️ JetBrains caches, 3 old PyCharms    ▓░░░░░░   2.2 G  3 old versions
🐳 Docker installer cache              ▓░░░░░░   2.1 G  old installers
🗂️ VSCode ShipIt logs + payloads       ▓░░░░░░   1.4 G  update leftovers
🗑️ Trash + Homebrew cleanup            ▓░░░░░░   0.6 G  brew: 148 MB
                                       ── 45.3 G

────────────────────────────────────────────────
🟡 REGENERABLE, safe, but the next run rebuilds or re-downloads
────────────────────────────────────────────────
📦 node_modules ×58 repos/worktrees    ▓▓▓░░░░   9.7 G  install again
🗂️ ~/projects/wellness/.build          ▓▓▓░░░░   8.6 G  one repo's build
🧠 Chrome on-device model ×2 copies    ▓▓▓░░░░   8.0 G  Chrome profiles
🐳 ~/.docker/sandboxes VM              ▓▓░░░░░   7.2 G  feature removed
🧠 Whisper models large-v3 + medium    ▓▓░░░░░   4.3 G  re-download
🐍 .venv ×13 repos                     ▓░░░░░░   3.6 G  uv sync rebuilds
                                       ── 41.4 G

────────────────────────────────────────────────
🔴 ASK FIRST, in use, or yours to judge
────────────────────────────────────────────────
📱 iOS simulators, 7 devices iOS 26.1  ▓▓▓▓▓▓▓  21.8 G  booted YESTERDAY
🧠 Claude Desktop VM rootfs.img        ▓▓▓░░░░   9.5 G  the Claude app
💾 Docker volumes (2, active)          ▓▓░░░░░   5.1 G  live data
📥 ~/Downloads                         ▓░░░░░░   3.0 G  many small files
                                       ── 39.4 G

🟢 safe 45 G + 🟡 regenerable 41 G ≈ 87 G  →  free 73 G → ~159 G
🔴 39 G more, only with your say-so

ℹ️  Docker.raw shows 432 G but is sparse: 37 G real. Prune shrinks it.
ℹ️  9 wellness worktrees share one 0.4 G .git; the cost is node_modules.
```

Three things the numbers told me that are not obvious from the chart:

- **Docker is the biggest single lever**: 93 images, 78 dangling, 227 build-cache entries;
  Docker's own accounting says 14.5 G reclaimable, and Docker.raw shrinks to match.
- **The iOS simulators are real work, not cruft**: Xcode is installed and a device booted
  yesterday. Only worth trimming if you name devices you do not use.
- **Two things look like caches but are payloads**: the Claude Desktop VM image (9.5 G,
  part of the app) and the Whisper models (4.3 G, re-downloadable but slow). Both kept
  out of "safe".

### Two more real renders

**A status board** (`/ork:glyph` with no argument draws where the conversation is):

```
✅ 1 probe      measured, transcript on #3877 (CLOSED)
✅ 2 lane 5     #3949 merged c326ca5fe (my #3948 closed as its duplicate)
🔥 3 beta.1     #3950 alpha.86 is open; beta.1 needs a Release-As footer
✅ 4 worktrees  done
✅ 5 stashes    done
```

**A comparison** (`/ork:glyph compare monolith vs services`):

```
BEFORE                          AFTER
┌────────────┐                  ┌────────────┐
│  Monolith  │                  │  Service A │──┐
│  (all-in-1)│                  └────────────┘  │  ┌──────────┐
└────────────┘                  ┌────────────┐  ├─>│  Shared  │
                                │  Service B │──┘  │  Queue   │
                                └────────────┘     └──────────┘
```

The status board and the flow came from one working night (2026-09-06, milestone 164's
close-out); the inventory is the 2026-09-17 reference render that set the v3 shape. None
is a mock-up.

### The exact invocation

```bash
/ork:glyph                  # draw where the conversation is right now
/ork:glyph <topic>          # one thing: an inventory, a comparison, a state
/ork:glyph --eli5 <topic>   # novice audience, and a page if it needs one
/glyph                      # the front door: same dials, may route to page
```

What it will never do: ask you a setup question, use a status emoji that is not in its
closed set (done, failed, warning, in progress, waiting, idea, hard block, goal, top
priority, doc, agent, hook, caveat, and the three risk colours), put a domain icon
anywhere but the leading column of a row, or stack two renders in one reply. Over about
50 lines means a different deliverable, and it says so.

### When it is the wrong tool

A multi-section interactive playground or a persisted plan artifact is `visualize-plan`.
A real chart with numbers on axes goes through `dataviz` first. Anything that must be
handed to a human as a URL is served with `/ork:page-serve`.
