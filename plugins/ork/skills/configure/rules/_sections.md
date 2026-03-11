---
title: Configure Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Safety & Rollback (safety) — HIGH — 1 rule

Requires a timestamped backup of every configuration file before modifications to enable safe rollback of any failed write.

- `backup-before-modify.md` — Create a timestamped backup of existing config before any modification; report backup location to user

## 2. Write Integrity (integrity) — HIGH — 1 rule

Validates written configuration files for JSON syntax, required fields, and enum values to catch silent plugin-loading failures.

- `validation-after-write.md` — Parse and validate every config file after writing; report success or failure immediately
