---
tags: [lane-0927, triage, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

Users say CSV export dropped the last row of every file. It worked in release v3.1.0 and is broken
in v3.2.0. There are 14 commits between the two tags and nobody knows which one did it. I have a
one-line reproduction: `npm run export -- --fixture small.csv | wc -l` prints 9 on v3.1.0 and 8 on v3.2.0.

How should I find the culprit commit? Give me the exact commands.
