---
type: regex
target: last_message
match: contains
flags: m
weight: 0.5
---
^\s*(?:[-*>]\s+|\d+[.)]\s+)?`?fix(\([a-z0-9./-]+\))?!?: \S
