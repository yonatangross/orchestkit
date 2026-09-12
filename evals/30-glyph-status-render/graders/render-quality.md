---
type: llm
focus: last_message
weight: 1
---
The user asked to see four worker statuses visually. Score the response against
ALL of these claims:

1. The answer is rendered as a terminal-friendly visual: a box, a table, a flow,
   or a bar meter drawn with light box-drawing or block characters. A plain
   bulleted list of four sentences with no drawn structure fails this claim.
2. All four workers appear, and the visual distinguishes the failing worker
   (webhook-fanout) from the healthy ones and from the one that is merely not
   scheduled yet. Collapsing "failing" and "not scheduled" into the same state
   fails this claim.
3. Any emoji used is semantic and carries a meaning such as pass, fail, warning,
   or waiting. Decorative emoji, or long chains of emoji, fail this claim.
4. The visual is compact, roughly twelve lines or fewer, and the point is stated
   in a sentence or two of prose before or alongside it rather than being buried.
