---
tags: [glyph, fire]
max_turns: 14
timeout_seconds: 420
runs: 3
allowed_tools: [Skill]
---

Show me this visually.

Four background workers, last hour:
- ingest: healthy, 0 retries
- thumbnailer: healthy, 3 retries
- webhook-fanout: failing, 41 retries, dead-letter queue is filling
- reindex: not scheduled to run until tonight
