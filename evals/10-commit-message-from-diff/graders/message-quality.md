---
type: llm
focus: last_message
weight: 1
---
The response gives a commit message for the described change. Score it against
ALL of these concrete claims:

1. The subject line names the change type as a fix (not a feature, not a chore).
   A cookie hardening change that closes a cross-site request hole is a fix.
2. The subject line is a single line no longer than about 72 characters and is
   written in the imperative mood ("add", "harden", "set"), not past tense
   ("added", "hardened").
3. The message body explains WHY the change was made, that is, it refers to the
   cross-site or CSRF risk of a session cookie without SameSite. A body that only
   restates which files changed does NOT satisfy this claim.
4. The message does not invent changes that are not in the described diff.

Fail the response if it answers with a narrative explanation instead of an
actual commit message.
