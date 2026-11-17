---
type: regex
target: last_message
match: not_contains
flags: mi
---
^\s*(?:[-*>]\s+|\d+[.)]\s+)?`?(?:feat|fix)(\([a-z0-9./-]+\))?!?: \S
