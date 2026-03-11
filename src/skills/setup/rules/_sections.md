---
title: Setup Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Safety & Conflict Prevention (safety) — HIGH — 2 rules

Guards against silent overwrites of existing configuration files and preset conflicts that would destroy user customizations.

- `preset-conflict-detection.md` — Detect conflicts between chosen preset and existing `.claude/` config before applying
- `existing-config-preservation.md` — Never overwrite CLAUDE.md or `.claude/rules/*.md` without explicit user confirmation

## 2. Stack & Validation (validation) — HIGH — 1 rule

Ensures detected frameworks have corroborating evidence before recommendations or presets are applied.

- `stack-detection-validation.md` — Require corroborating file evidence for each detected framework before applying presets

## 3. MCP Configuration (mcp) — MEDIUM — 1 rule

Validates MCP server reachability before writing entries to `.mcp.json` to prevent silent connectivity failures.

- `mcp-server-verification.md` — Test MCP server reachability before adding to configuration

## 4. Privacy & Consent (privacy) — HIGH — 1 rule

Enforces explicit opt-in before enabling any telemetry or webhook data collection.

- `telemetry-consent-gate.md` — Require informed opt-in before configuring any telemetry; never default to enabled
