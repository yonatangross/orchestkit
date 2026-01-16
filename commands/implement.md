---
description: Full-power feature implementation with parallel subagents, skills, and MCPs
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Task, WebSearch, WebFetch
---

# Implement Feature

Load and follow the skill instructions from the `skills/implement/SKILL.md` file.

Execute the `/skf:implement` workflow to:
1. Create task list and research best practices
2. Query Context7 for library documentation
3. Launch 5 parallel architecture agents (Plan, backend, frontend, LLM, UX)
4. Launch 8 parallel implementation agents
5. Launch 4 parallel integration/validation agents
6. Track progress with notifications
7. E2E verification with Playwright MCP
8. Save decisions to memory MCP

## Arguments
- Feature description: What to implement (e.g., "user authentication", "real-time notifications")
