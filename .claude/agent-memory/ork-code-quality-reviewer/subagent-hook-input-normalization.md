---
name: subagent-hook-input-normalization
description: run-hook.mjs shims agent_type/agent_id/parent_agent_id into tool_input — subagent-start hooks reading tool_input.subagent_type are NOT broken
metadata:
  type: project
---

`src/hooks/bin/run-hook.mjs:140-150` normalizes SubagentStart/SubagentStop payloads BEFORE any hook runs: top-level `agent_type` → `tool_input.subagent_type`, `agent_id` → `tool_input.agent_id`, `parent_agent_id` → `tool_input.parent_agent_id`.

**Why:** CC sends `agent_type` at top level at SubagentStart (no tool_input). During PR #2374 review I nearly flagged subagent-validator.ts:363 (`toolInput.subagent_type`) as a live bug — the live spawn log (`.claude/logs/subagent-spawns.jsonl`) disproved it; the shim is the reason.

**How to apply:** When reviewing any subagent-start/* or subagent-stop/* hook, check run-hook.mjs normalization before claiming a payload field is unreachable. Unit tests bypass run-hook.mjs, so test inputs with `tool_input.subagent_type` are realistic post-shim shapes.

Also #2371 ground truth (live-captured CC 2.1.173): SubagentStart payload = {session_id, transcript_path, cwd, agent_id, agent_type, hook_event_name}. No description, no prompt, no parent_agent_id — descriptions must be logged at PreToolUse[Task] (spawn-intent-logger, source:pretool vs source:start, no correlation field).
