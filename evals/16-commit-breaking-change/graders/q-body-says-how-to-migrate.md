---
type: llm
focus: last_message
weight: 1
---
Judge the commit message itself. Text around it is not the subject of this criterion.

Claim: The message body or footer tells callers what to change: pass the input as `opts.input` instead of the first argument, and replace `parseSync`, which is gone. A footer that only says "breaking change" with no migration detail does not meet the claim.
