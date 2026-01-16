---
description: Comprehensive feature verification with parallel analysis agents
allowed-tools: Bash, Read, Glob, Grep, Task
---

# Verify Feature

Load and follow the skill instructions from the `skills/verify/SKILL.md` file.

Execute the `/skf:verify` workflow to:
1. Gather context (git diff, recent changes)
2. Auto-load relevant skills (code-review-playbook, security-scanning)
3. Launch 5 parallel verification agents (code-quality, security, tests, backend, frontend)
4. Run tests (unit, integration, E2E)
5. Compile verification evidence and report
6. Optional E2E verification with Playwright MCP

## Arguments
- Feature name: Feature or flow to verify (e.g., "authentication flow", "user profile feature")
