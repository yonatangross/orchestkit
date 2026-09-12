---
type: llm
focus: last_message
weight: 1
---
The user gave four acceptance criteria and asked for a pasteable goal line.

Score ONLY the goal line itself. Prose before or after it is allowed and is not
scored: the author may explain the ordering, or flag what an assertion cannot
prove. Naming a limitation honestly is not a defect and must not fail any claim
below.

Score the response against ALL of these claims:

1. It emits exactly ONE goal line. Two or more separate goal lines fail this
   claim, because a second line replaces the first rather than adding to it.
2. The assertions are AND-joined inside that single line.
3. Every assertion is something a shell can check without human judgement, for
   example a file test, a grep, a test command exiting zero, or a lint command
   exiting zero. An assertion like "the header works correctly" or "the code is
   clean" fails this claim.
4. Each of the four criteria the user gave is represented by at least one
   assertion in the line. Judge representation, not proof strength: an
   assertion that is a reasonable observable proxy for a criterion satisfies
   this claim even if it cannot prove the criterion exhaustively.
5. A turn budget is folded into the same line, not issued as a separate command.
