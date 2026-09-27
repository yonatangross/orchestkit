---
type: llm
focus: last_message
weight: 1
---
Judge the answer itself. Notes about which skills or tools were available are not the subject of this criterion.

Claim: The most likely root cause it names is that carts created before the v2.3.0 change still have the old shape (no `pricing` object, or no currency where formatPrice now reads it), so the new code reads a property of undefined for those old carts.
