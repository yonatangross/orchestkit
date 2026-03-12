---
title: Audit Full Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Scope Planning (scope) — HIGH — 1 rule

Requires upfront scope declaration before loading files, preventing context window exhaustion on irrelevant content.

- `scope-declaration.md` — Declare audit mode, inclusion list, exclusion patterns, and token budget before loading any files

## 2. Finding Classification (severity) — HIGH — 1 rule

Enforces evidence-backed severity levels for every finding to prevent alert fatigue and hidden critical vulnerabilities.

- `finding-severity-classification.md` — Every finding must include severity level, file path with line number, code snippet, and exploitation scenario
