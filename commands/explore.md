---
description: Deep codebase exploration with parallel specialized agents
allowed-tools: Bash, Read, Glob, Grep, Task
---

# Codebase Exploration

Load and follow the skill instructions from the `skills/explore/SKILL.md` file.

Execute the `/skf:explore` workflow to:
1. Perform initial searches (grep patterns, glob files)
2. Check memory for existing knowledge
3. Launch 4 parallel explorers (structure, data flow, backend, frontend)
4. Add AI system exploration if applicable
5. Generate comprehensive exploration report

## Arguments
- Search query: Topic or feature to explore (e.g., "authentication", "API endpoints")
