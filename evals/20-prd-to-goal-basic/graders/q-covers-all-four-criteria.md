---
type: llm
focus: last_message
weight: 1
---
Judge the goal line itself: a line beginning with /goal until. If the response contains no such line, FAIL; prose that describes the criteria is not a goal line. Text around the line, including commentary on what an assertion can or cannot prove, is not the subject of this criterion.

Claim: Each of the four criteria the user gave is represented by at least one assertion in the line: the Retry-After header change, the new rate-limit test, pytest tests/middleware staying green, and ruff check src exiting zero. Judge representation, not proof strength; a reasonable observable proxy counts.
