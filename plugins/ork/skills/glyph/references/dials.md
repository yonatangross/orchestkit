# Glyph dials: surface and audience

Glyph picks two things before it draws. Both have a default, both can be inferred
from the request, and a flag always beats inference.

|              | **chat** (inline)        | **ask** (one question)          | **page** (served file)        |
|--------------|--------------------------|---------------------------------|-------------------------------|
| **operator** | dense render, internal names allowed | options side by side, a pick unblocks the next step | KPI strip, charts, raw evidence below a fold |
| **novice**   | plain words, analogy first | same fork, plain words         | explainer: one idea per beat, consequence cards |

## The announce line

Print exactly one line, then a blank line, then the answer:

```
→ chat · operator
```

The surface comes first, then the audience. Nothing else on that line: no "I will
now", no restated request. For the ask surface, the audience in the announce line is
the person who answers the question (the operator), even when the artifact that
follows is written for a novice.

## Flags

| Flag | Effect |
|---|---|
| `--chat` | Surface chat. One render, up to about 50 lines, 76 cells wide. |
| `--ask` | Surface ask. One `AskUserQuestion`, 2 to 4 options, then render the picked branch. |
| `--page` | Surface page. Write the HTML and hand it over with `/ork:page-serve PATH`. |
| `--eli5` | Audience novice, and page unless a surface flag is given. The bare word "eli5" in the request acts the same. |
| `--decide` | The answer is a decision. Chat: a DECIDE block. Page: a decision beat with real controls. |
| `--signoff` | After the render, run the done sign-off gate from `../../shared/rules/done-signoff.md`. |

Flags combine: `/ork:glyph --chat --eli5` is a plain-word chat render;
`/ork:glyph --ask --eli5 --signoff` asks the fork, renders the pick for a novice,
then asks for sign-off.

## Inference when no flag is given

**Audience** defaults to operator. Pick novice when the request:

- says "eli5" or "explain like",
- names a reader who is not the operator ("for the client", "explain to Nir",
  "for onboarding"),
- asks what a thing is or how it works in general ("how does OAuth work" is novice;
  "is our OAuth broken" is operator).

**The eli5 rule, settled.** eli5 (the flag or the word) sets novice, and eli5 also picks page
unless a surface flag (`--chat`, `--ask`, `--page`) is given: `--chat --eli5` stays inline. The
other novice triggers (a named reader, a "how does X work" question) set the audience only; the
surface is then chosen by the table below, so a short plain-word answer stays in chat.

Novice means: a one-clause gloss for every term, no internal file or host names
unless defined on the spot, an analogy before the mechanism. It does not mean less
accurate.

**Surface** defaults to chat. Escalate only on a real trigger:

| Pick | When |
|---|---|
| chat | The honest render fits one render of about 50 lines. The common case. |
| ask | There is a real 2 to 4 way fork that must be settled before the next step. |
| page | Over about 50 lines, or it must persist (a client deliverable, a doc to link), or a file was asked for. |

## The ask guardrail

`AskUserQuestion` blocks until someone answers. Use it only when the pick changes
what happens next, never as a nicer way to print a list.

- Each option may carry a `preview` (monospace, shown beside the list). On Claude
  Code 2.1.291 the arrow keys moved the highlight with previews on (tested
  2026-10-06, one tester). Earlier builds lost arrow keys in preview mode
  (`brainstorm/SKILL.md`, "Picker fallback"), so keep each preview short and
  never put the only copy of a fact in it.
- With `ORK_ASK_FALLBACK=text` set, ask the same options as a numbered text list.
- After the answer, render the picked branch. Do not ask again.

## --decide

Chat form, plain text so it can be copied:

```
DECIDE: <one-line question>
( ) option A, <one-line consequence>
( ) option B, <one-line consequence>   <- recommended, because <one clause>
after you pick:
[ ] <step that follows>
```

Page form: one decision beat per fork with real radio controls, a consequence beside
each option, and one answer bar whose copy button stays disabled until every fork has
a pick. If a dedicated decision-page skill is listed in the session (for example
`hq-ext:decision`), hand the page to it; if none is listed, use the decision beat in
`templates/explainer.html` and say so in one clause.

## Personal skills named glyph

A user may also have a personal skill named `glyph` (invoked as `/glyph`). Claude Code
keeps personal skills and plugin skills in separate namespaces, so `/glyph` and
`/ork:glyph` do not collide. A personal front door may call `ork:glyph` for its chat
route; that call lands here, and the flags above apply. This skill never calls a
skill named glyph in return.
