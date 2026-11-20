---
tags: [lane-0927, promote, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

My branch `feat/api-rate-limit` is ready to go up for review against `main`. What it does:
- adds a token-bucket rate limiter middleware on `/api/*`, 100 requests per minute per API key
- returns 429 with a `Retry-After` header when the bucket is empty
- adds 6 unit tests for the limiter and one integration test for the 429 path
- closes issue #402

I cannot run gh from here. Write me the PR title and body I should paste.
