# Research body template

Adapted from humanlayer's riptide `research_template.md` (Apache-2.0). This is the BODY only: the
front matter and comment block are written by `scripts/artifact.mjs`.

````markdown
# Research: <question or topic>

## Questions
1. <question as asked>

## Method
This document describes the code as it exists at the commit in the front matter. It makes no
recommendations.

## Summary
Two to four paragraphs: the main structures, how data moves, how the parts relate.

## Findings

### 1. <a claim about the code, stated as a fact>
What it is and how it works, with citations inline (`src/app.ts:57-80`). Use a table, a call tree or
a short type signature where it is faster than prose.

#### Tests
Where the tests for this are and how they work. Say so if there are none.

### 2. <next claim>
...

## Code references
### <area>
- `path/to/file.ts:28-36`: what is there
- `path/to/dir/`: what the directory holds (complete list, or key files only)

## Open questions
Things not fully traced. "None" if none.
````
