---
type: llm
focus: last_message
weight: 1
---
The user gave four acceptance criteria and asked for a pasteable goal line.
Score the response against ALL of these claims:

1. It emits exactly ONE goal line. Two or more separate goal lines fail this
   claim, because a second line replaces the first rather than adding to it.
2. The assertions are AND-joined inside that single line.
3. Every assertion is something a shell can check without human judgement, for
   example a file test, a test command exiting zero, or a lint command exiting
   zero. An assertion like "the header works correctly" or "the code is clean"
   fails this claim.
4. The assertions cover the criteria the user actually gave, in particular both
   the new rate-limit test and the ruff lint check.
5. A turn budget is folded into the same line, not issued as a separate command.
