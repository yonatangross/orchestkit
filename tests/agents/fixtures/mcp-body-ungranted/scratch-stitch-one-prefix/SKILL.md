---
name: scratch-stitch-one-prefix
description: Fixture skill that grants only mcp__stitch__list_projects (no hq-ext twin).
context: fork
allowed-tools:
  - Read
  - Bash
  - mcp__stitch__list_projects
---

# Scratch Stitch One Prefix

Call list_projects() once. Dual-prefix check must fail for the missing plugin twin.
