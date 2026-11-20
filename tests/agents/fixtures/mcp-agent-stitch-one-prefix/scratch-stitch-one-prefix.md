---
name: scratch-stitch-one-prefix
description: Fixture agent that grants only mcp__stitch__list_projects (no hq-ext twin).
model: haiku
context: fork
tools:
  - Read
  - Bash
  - mcp__stitch__list_projects
---

# Scratch Stitch One Prefix

Fail-first for dual-prefix: tools lists mcp__stitch__list_projects only.
