---
type: llm
focus: last_message
weight: 1
---
Judge the goal line itself: a line beginning with /goal until. If the response contains no such line, FAIL; prose that describes the criteria is not a goal line. Text around the line, including commentary on what an assertion can or cannot prove, is not the subject of this criterion.

Claim: Every assertion in the goal line is something a shell can check without human judgement: a file test, a grep, a test command exiting zero, a lint command exiting zero. An assertion like the header works correctly or the code is clean fails this claim.
