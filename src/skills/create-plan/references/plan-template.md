# Plan body template

Adapted from humanlayer's riptide `plan_template.md` (Apache-2.0). This is the BODY only: the
front matter and comment block are written by `scripts/artifact.mjs`.

````markdown
# <Task name>: implementation plan

## Overview
What is being built and why, in two or three sentences.

## Current state
What exists now, with `file:line` references. What is missing. Constraints found while reading.

## Desired end state
What is true when the plan is done, and the one check that proves it.

## Out of scope
What this plan will not do, so the review can hold it to that.

## Approach
The strategy in a paragraph, and why it beats the obvious alternative.

---

## Phase 1: <name>

### Changes
**File**: `path/to/file.ext` (around line N)
What changes, then the code:

```diff
+ export function newThing() {
+   ...
+ }
```

### Success criteria
Automated:
- [ ] `<command that must pass>`

Manual (only if a person really must look):
- [ ] <specific step>

Stop here for the reviewer before phase 2 when a manual check is listed.

---

## Phase 2: <name>
...
````

Use four backticks for the outer fence when the plan quotes markdown that contains three-backtick
blocks.
