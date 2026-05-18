"""Hook event JSON Schemas (draft-07) — codegen output (M141-3, #1804).

DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.
Regenerate via ``python packages/hook-contract-py/scripts/codegen-py.py``.

Mirrors ``packages/hook-contract/src/schemas.generated.ts``.
"""
from __future__ import annotations

from typing import Any

from .events import HOOK_EVENT_NAMES, HookEventName

SCHEMA_DRAFT = "https://json-schema.org/draft-07/schema#"

PAYLOAD_SCHEMAS: dict[str, dict[str, Any]] = { 'SessionStart': { 'type': 'object',
                    'properties': { 'plugin_root': { 'type': 'string',
                                                     'description': 'Absolute path to the plugin '
                                                                    'root (injected by '
                                                                    'run-hook.mjs)'},
                                    'permissionMode': { 'type': 'string',
                                                        'description': 'Permission mode (default | '
                                                                       'acceptEdits | dontAsk | '
                                                                       'auto)'}},
                    'additionalProperties': True},
  'UserPromptSubmit': { 'type': 'object',
                        'properties': { 'prompt': { 'type': 'string',
                                                    'description': 'The user prompt text being '
                                                                   'submitted'}},
                        'additionalProperties': True,
                        'required': ['prompt']},
  'PreToolUse': { 'type': 'object',
                  'properties': { 'tool_name': { 'type': 'string',
                                                 'description': 'The tool being invoked (e.g. '
                                                                'Bash, Write, Read)'},
                                  'tool_input': { 'type': 'object',
                                                  'additionalProperties': True,
                                                  'description': 'Tool-specific input parameters'},
                                  'tool_use_id': { 'type': 'string',
                                                   'description': 'CC 2.1.69 correlation ID for '
                                                                  'matching with PostToolUse'}},
                  'additionalProperties': True,
                  'required': ['tool_name', 'tool_input']},
  'PostToolUse': { 'type': 'object',
                   'properties': { 'tool_name': { 'type': 'string',
                                                  'description': 'The tool that was invoked'},
                                   'tool_input': { 'type': 'object',
                                                   'additionalProperties': True,
                                                   'description': 'Tool input passed to the '
                                                                  'invocation'},
                                   'tool_output': { 'description': 'Tool output (type varies by '
                                                                   'tool)'},
                                   'tool_error': { 'type': 'string',
                                                   'description': 'Tool error message if one was '
                                                                  'produced'},
                                   'exit_code': { 'type': 'number',
                                                  'description': 'Tool exit code where applicable'},
                                   'tool_use_id': { 'type': 'string',
                                                    'description': 'CC 2.1.69 correlation ID'},
                                   'duration_ms': { 'type': 'number',
                                                    'description': 'Tool execution duration in '
                                                                   'milliseconds'}},
                   'additionalProperties': True,
                   'required': ['tool_name', 'tool_input']},
  'PostToolUseFailure': { 'type': 'object',
                          'properties': { 'tool_name': { 'type': 'string',
                                                         'description': 'The tool that failed'},
                                          'tool_input': { 'type': 'object',
                                                          'additionalProperties': True,
                                                          'description': 'Tool input passed to the '
                                                                         'failed invocation'},
                                          'tool_error': { 'type': 'string',
                                                          'description': 'Error message from the '
                                                                         'tool'},
                                          'exit_code': { 'type': 'number',
                                                         'description': 'Tool exit code'},
                                          'tool_use_id': { 'type': 'string',
                                                           'description': 'CC 2.1.69 correlation '
                                                                          'ID'}},
                          'additionalProperties': True,
                          'required': ['tool_name', 'tool_input', 'tool_error']},
  'PermissionRequest': { 'type': 'object',
                         'properties': { 'tool_name': { 'type': 'string',
                                                        'description': 'The tool requesting '
                                                                       'permission'},
                                         'tool_input': { 'type': 'object',
                                                         'additionalProperties': True,
                                                         'description': 'Tool input that triggered '
                                                                        'the permission request'},
                                         'permission_suggestions': { 'type': 'object',
                                                                     'additionalProperties': True,
                                                                     'description': 'CC 2.1.69 '
                                                                                    'suggested '
                                                                                    '"always '
                                                                                    'allow" '
                                                                                    'options'}},
                         'additionalProperties': True,
                         'required': ['tool_name', 'tool_input']},
  'SubagentStart': { 'type': 'object',
                     'properties': { 'subagent_type': { 'type': 'string',
                                                        'description': 'Subagent type (CC 2.1.0+ '
                                                                       'field name)'},
                                     'agent_type': { 'type': 'string',
                                                     'description': 'Alternative agent type field '
                                                                    'name'},
                                     'agent_id': {'type': 'string', 'description': 'Agent ID'},
                                     'parent_agent_id': { 'type': 'string',
                                                          'description': 'Parent agent ID for '
                                                                         'trace stitching (CC '
                                                                         '2.1.139)'}},
                     'additionalProperties': True},
  'SubagentStop': { 'type': 'object',
                    'properties': { 'agent_type': {'type': 'string', 'description': 'Agent type'},
                                    'agent_id': {'type': 'string', 'description': 'Agent ID'},
                                    'agent_output': { 'type': 'string',
                                                      'description': 'Final agent output text'},
                                    'output': { 'type': 'string',
                                                'description': 'Alternative output field name'},
                                    'error': { 'type': 'string',
                                               'description': 'Error from subagent if it failed'},
                                    'duration_ms': { 'type': 'number',
                                                     'description': 'Total subagent execution '
                                                                    'duration'},
                                    'agent_transcript_path': { 'type': 'string',
                                                               'description': 'Path to subagent '
                                                                              'transcript (CC '
                                                                              '2.1.69)'},
                                    'last_assistant_message': { 'type': 'string',
                                                                'description': 'Final assistant '
                                                                               'message text (CC '
                                                                               '2.1.47+)'}},
                    'additionalProperties': True},
  'Stop': { 'type': 'object',
            'properties': { 'last_assistant_message': { 'type': 'string',
                                                        'description': 'Final assistant message '
                                                                       'text (CC 2.1.47+)'},
                            'stop_hook_active': { 'type': 'boolean',
                                                  'description': 'Whether a stop hook is currently '
                                                                 'active (prevents re-entry)'}},
            'additionalProperties': True},
  'Notification': { 'type': 'object',
                    'properties': { 'message': { 'type': 'string',
                                                 'description': 'Notification message text'},
                                    'notification_type': { 'type': 'string',
                                                           'description': 'Notification type '
                                                                          'discriminator'}},
                    'additionalProperties': True,
                    'required': ['message']},
  'PreCompact': { 'type': 'object',
                  'properties': { 'compaction_count': { 'type': 'number',
                                                        'description': 'Number of compactions in '
                                                                       'this session so far'},
                                  'context_size_after': { 'type': 'number',
                                                          'description': 'Estimated context size '
                                                                         'after compaction '
                                                                         '(tokens)'}},
                  'additionalProperties': True},
  'TeammateIdle': { 'type': 'object',
                    'properties': { 'teammate_id': { 'type': 'string',
                                                     'description': 'Teammate agent ID'},
                                    'teammate_type': { 'type': 'string',
                                                       'description': 'Teammate agent type'},
                                    'idle_duration_ms': { 'type': 'number',
                                                          'description': 'How long the teammate '
                                                                         'has been idle'}},
                    'additionalProperties': True,
                    'required': ['teammate_id', 'teammate_type', 'idle_duration_ms']},
  'TaskCompleted': { 'type': 'object',
                     'properties': { 'task_id': { 'type': 'string',
                                                  'description': 'Completed task ID'},
                                     'task_subject': { 'type': 'string',
                                                       'description': 'Task subject'},
                                     'task_status': { 'type': 'string',
                                                      'description': 'Task result status'},
                                     'token_count': { 'type': 'number',
                                                      'description': 'Tokens consumed by the task '
                                                                     '(CC 2.1.30)'},
                                     'tool_uses': { 'type': 'number',
                                                    'description': 'Tool invocations in the task '
                                                                   '(CC 2.1.30)'}},
                     'additionalProperties': True,
                     'required': ['task_id']}}


def envelope_schema(event: HookEventName) -> dict[str, Any]:
    payload_schema = PAYLOAD_SCHEMAS.get(event, {"type": "object", "additionalProperties": True})
    return {
        "$schema": SCHEMA_DRAFT,
        "$id": f"https://orchestkit.dev/schemas/hook-contract/{event}.json",
        "title": f"{event} hook event",
        "type": "object",
        "properties": {
            "event": {"type": "string", "const": event},
            "timestamp": {"type": "string", "description": "ISO-8601 UTC timestamp"},
            "session_id": {"type": "string"},
            "cwd": {"type": "string"},
            "payload": payload_schema,
        },
        "required": ["event"],
        "additionalProperties": True,
    }


HOOK_EVENT_SCHEMAS: dict[str, dict[str, Any]] = {
    name: envelope_schema(name) for name in HOOK_EVENT_NAMES  # type: ignore[arg-type]
}

HOOK_EVENT_SCHEMA: dict[str, Any] = {
    "$schema": SCHEMA_DRAFT,
    "$id": "https://orchestkit.dev/schemas/hook-contract/HookEvent.json",
    "title": "HookEvent",
    "oneOf": [HOOK_EVENT_SCHEMAS[name] for name in HOOK_EVENT_NAMES],
}
