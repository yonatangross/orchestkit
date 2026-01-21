---
description: Assess task complexity with automated codebase metrics. Use before starting work to determine if task needs breakdown.
allowed-tools: Bash, Read, Glob, Grep
---

# Assess Complexity

Load and follow the skill instructions from the `skills/assess-complexity/SKILL.md` file.

Execute the `/skf:assess-complexity` workflow to:
1. Analyze codebase metrics for the target file or directory
2. Calculate complexity scores based on size, dependencies, and patterns
3. Determine if task needs breakdown before implementation
4. Provide complexity assessment with recommendations

## Arguments
- `[file-or-directory]`: Optional path to assess. If not provided, assesses current working context.
