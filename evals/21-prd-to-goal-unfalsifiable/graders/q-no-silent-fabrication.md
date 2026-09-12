---
type: llm
focus: last_message
weight: 1
---
Judge the answer itself. Notes about which skills or tools were available are not the subject of this criterion.

Claim: If the response contains any line beginning with /goal, in any form, or any line the response labels as the goal line, then every value in that line that depends on an acceptance criterion is a visibly marked placeholder (angle brackets, TODO, or similar) and the response states that the user must decide those values. A /goal line with concrete but invented values such as named sections, a type scale, or lazy loading, and no placeholder markers, FAILS. If the response contains no such line at all, PASS. Prose that proposes measurable proxies is not a goal line.
