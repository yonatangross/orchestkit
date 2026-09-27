---
type: regex
target: last_message
match: contains
flags: mi
weight: 0.5
---
pnpm (install|i)\b(?! --(no-)?frozen)
