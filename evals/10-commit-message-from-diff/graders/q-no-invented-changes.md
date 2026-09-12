---
type: llm
focus: last_message
weight: 1
---
Judge the commit message itself. Text around it, including notes about which skills or tools were available, is not the subject of this criterion.

Claim: Every change the commit message says was made is one of these two: the session cookie gained SameSite=Lax and Secure, or tests were added for those attributes. A message that claims any other code change was made fails. Explaining the risk being fixed, or mentioning a possible follow-up outside the message, is not a claimed change.
