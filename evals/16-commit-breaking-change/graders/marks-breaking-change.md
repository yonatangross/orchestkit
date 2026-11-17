---
type: regex
target: last_message
match: contains
flags: mi
weight: 1
---
(^\s*(?:[-*>]\s+|\d+[.)]\s+)?`?[a-z]+(\([a-z0-9./-]+\))?!: \S)|(^\s*(?:[-*>]\s+)?BREAKING[ -]CHANGE: )
