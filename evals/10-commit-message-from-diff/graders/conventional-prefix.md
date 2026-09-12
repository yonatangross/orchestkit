---
type: regex
target: last_message
match: contains
flags: m
---
^\s*(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9./-]+\))?!?: \S
