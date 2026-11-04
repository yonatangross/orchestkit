---
tags: [routing-1104, test-generator, fire]
max_turns: 4
timeout_seconds: 180
runs: 3
allowed_tools: [Agent]
---

Get a test specialist to write unit tests for this function, covering edge cases, with Vitest:

```ts
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
```
