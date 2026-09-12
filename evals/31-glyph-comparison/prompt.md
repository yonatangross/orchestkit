---
tags: [glyph, fire]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Give me a visual comparison of these two options so I can pick one.

Option A, polling: every client asks the API for new messages every 5 seconds.
Simple to build, works through any proxy, costs about 17k wasted requests a day,
and new messages show up up to 5 seconds late.

Option B, server-sent events: the server pushes. Near-instant delivery, far fewer
requests, but it needs a long-lived connection that some corporate proxies cut,
and reconnection logic we have not written yet.
