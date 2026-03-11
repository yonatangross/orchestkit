---
title: Warn if chosen preset conflicts with existing .claude/ configuration
impact: HIGH
impactDescription: "Silently overwriting .claude/settings.json or .mcp.json can break existing tool permissions, MCP servers, and team-shared configuration"
tags: presets, conflict-detection, safety, phase-3
---

## Preset Conflict Detection

Before applying any preset (complete, standard, lite, hooks-only, monorepo), check for existing `.claude/` configuration and warn the user about conflicts.

## Problem

A team has carefully configured `.claude/settings.json` with custom tool permissions and deny patterns. Running `/ork:setup --preset complete` overwrites these settings without warning, breaking their security posture and removing deny-listed commands.

**Incorrect -- apply preset without conflict check:**
```python
# Apply preset directly
preset = load_preset("complete")

# Overwrites any existing config
Write(file_path=".claude/settings.json", content=preset["settings"])
Write(file_path=".mcp.json", content=preset["mcp_config"])
# User's custom deny patterns and MCP servers are gone
```

**Correct -- detect conflicts and merge with user confirmation:**
```python
# Check for existing configuration first
existing_settings = Read(".claude/settings.json")  # may not exist
existing_mcp = Read(".mcp.json")                   # may not exist

preset = load_preset("complete")
conflicts = []

if existing_settings:
    if existing_settings.get("deny"):
        conflicts.append("Existing deny patterns in .claude/settings.json will be preserved")
    if existing_settings.get("permissions"):
        conflicts.append(f"{len(existing_settings['permissions'])} custom permissions detected")

if existing_mcp:
    existing_servers = set(existing_mcp.get("mcpServers", {}).keys())
    preset_servers = set(preset["mcp_config"].get("mcpServers", {}).keys())
    overlap = existing_servers & preset_servers
    if overlap:
        conflicts.append(f"MCP servers will be updated: {', '.join(overlap)}")

if conflicts:
    AskUserQuestion(questions=[{
        "question": "Existing configuration detected. How should we proceed?",
        "options": [
            {"label": "Merge (Recommended)", "description": "Keep existing settings, add preset additions"},
            {"label": "Replace", "description": "Overwrite with preset defaults"},
            {"label": "Cancel", "description": "Abort preset application"}
        ]
    }])
```

**Key rules:**
- Always read existing `.claude/settings.json`, `.mcp.json`, and `CLAUDE.md` before applying a preset
- Never overwrite `deny` patterns -- these are security-critical and must be preserved
- Present a diff-style summary of what will change before writing any files
- Default to merge strategy: keep user customizations, add preset additions
- Log which files were modified and what was preserved for the improvement plan
