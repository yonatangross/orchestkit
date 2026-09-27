---
type: regex
target: last_message
match: contains
flags: mi
weight: 0.5
---
(feat|fix|perf|refactor|chore)(\([a-z0-9./-]+\))?!?: \S
