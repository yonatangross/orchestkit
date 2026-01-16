---
description: Curate and add documents to the golden dataset with multi-agent validation
allowed-tools: Bash, Read, Write, Glob, Grep, Task, WebFetch, AskUserQuestion
---

# Add to Golden Dataset

Load and follow the skill instructions from the `skills/add-golden/SKILL.md` file.

Execute the `/skf:add-golden` workflow to:
1. Collect input URL and detect content type
2. Fetch and extract document structure
3. Launch 4 parallel analysis agents (quality, difficulty, domain, queries)
4. Run validation checks (URL, schema, duplicates, quality gates)
5. Apply decision thresholds (INCLUDE/REVIEW/EXCLUDE)
6. Present for user approval
7. Write to dataset files

## Arguments
- URL: Document URL to add (e.g., "https://example.com/article")
