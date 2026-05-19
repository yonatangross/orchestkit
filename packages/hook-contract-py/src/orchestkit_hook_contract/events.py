"""Hook event registry — codegen output (M141-3, #1804).

DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.
Regenerate via ``python packages/hook-contract-py/scripts/codegen-py.py``.

Mirrors ``packages/hook-contract/src/events.generated.ts`` on the npm side.
CI parity gate (M141-6, #1807) will fail if the two emits drift.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

HOOK_EVENT_NAMES: tuple[str, ...] = (
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PermissionRequest",
    "SubagentStart",
    "SubagentStop",
    "Stop",
    "SessionEnd",
    "Setup",
    "Notification",
    "PreCompact",
    "TeammateIdle",
    "TaskCompleted",
    "InstructionsLoaded",
    "WorktreeCreate",
    "WorktreeRemove",
    "ConfigChange",
)

HookEventName = Literal["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest", "SubagentStart", "SubagentStop", "Stop", "SessionEnd", "Setup", "Notification", "PreCompact", "TeammateIdle", "TaskCompleted", "InstructionsLoaded", "WorktreeCreate", "WorktreeRemove", "ConfigChange"]


def is_hook_event_name(value: object) -> bool:
    return isinstance(value, str) and value in HOOK_EVENT_NAMES


HOOK_EVENT_NAME_SET: frozenset[str] = frozenset(HOOK_EVENT_NAMES)


class SessionStartPayload(BaseModel):
    """Payload for the SessionStart event.
    Fired when a CC session starts. Async hooks observe project state before the first prompt.
    """
    model_config = ConfigDict(extra="allow")
    plugin_root: str | None = Field(default=None, description="Absolute path to the plugin root (injected by run-hook.mjs)")
    permissionMode: str | None = Field(default=None, description="Permission mode (default | acceptEdits | dontAsk | auto)")

class UserPromptSubmitPayload(BaseModel):
    """Payload for the UserPromptSubmit event.
    Fires when the user submits a prompt — used to inject additionalContext.
    """
    model_config = ConfigDict(extra="allow")
    prompt: str = Field(..., description="The user prompt text being submitted")

class PreToolUsePayload(BaseModel):
    """Payload for the PreToolUse event.
    Before any tool invocation — gate or transform tool input.
    """
    model_config = ConfigDict(extra="allow")
    tool_name: str = Field(..., description="The tool being invoked (e.g. Bash, Write, Read)")
    tool_input: dict[str, Any] = Field(..., description="Tool-specific input parameters")
    tool_use_id: str | None = Field(default=None, description="CC 2.1.69 correlation ID for matching with PostToolUse")

class PostToolUsePayload(BaseModel):
    """Payload for the PostToolUse event.
    After a successful tool invocation — observe result.
    """
    model_config = ConfigDict(extra="allow")
    tool_name: str = Field(..., description="The tool that was invoked")
    tool_input: dict[str, Any] = Field(..., description="Tool input passed to the invocation")
    tool_output: Any | None = Field(default=None, description="Tool output (type varies by tool)")
    tool_error: str | None = Field(default=None, description="Tool error message if one was produced")
    exit_code: float | int | None = Field(default=None, description="Tool exit code where applicable")
    tool_use_id: str | None = Field(default=None, description="CC 2.1.69 correlation ID")
    duration_ms: float | int | None = Field(default=None, description="Tool execution duration in milliseconds")

class PostToolUseFailurePayload(BaseModel):
    """Payload for the PostToolUseFailure event.
    After a failed tool invocation — observe error.
    """
    model_config = ConfigDict(extra="allow")
    tool_name: str = Field(..., description="The tool that failed")
    tool_input: dict[str, Any] = Field(..., description="Tool input passed to the failed invocation")
    tool_error: str = Field(..., description="Error message from the tool")
    exit_code: float | int | None = Field(default=None, description="Tool exit code")
    tool_use_id: str | None = Field(default=None, description="CC 2.1.69 correlation ID")

class PermissionRequestPayload(BaseModel):
    """Payload for the PermissionRequest event.
    Fires when a tool needs permission approval.
    """
    model_config = ConfigDict(extra="allow")
    tool_name: str = Field(..., description="The tool requesting permission")
    tool_input: dict[str, Any] = Field(..., description="Tool input that triggered the permission request")
    permission_suggestions: dict[str, Any] | None = Field(default=None, description="CC 2.1.69 suggested \"always allow\" options")

class SubagentStartPayload(BaseModel):
    """Payload for the SubagentStart event.
    Fires when a subagent begins execution.
    """
    model_config = ConfigDict(extra="allow")
    subagent_type: str | None = Field(default=None, description="Subagent type (CC 2.1.0+ field name)")
    agent_type: str | None = Field(default=None, description="Alternative agent type field name")
    agent_id: str | None = Field(default=None, description="Agent ID")
    parent_agent_id: str | None = Field(default=None, description="Parent agent ID for trace stitching (CC 2.1.139)")

class SubagentStopPayload(BaseModel):
    """Payload for the SubagentStop event.
    Fires when a subagent finishes (success or error).
    """
    model_config = ConfigDict(extra="allow")
    agent_type: str | None = Field(default=None, description="Agent type")
    agent_id: str | None = Field(default=None, description="Agent ID")
    agent_output: str | None = Field(default=None, description="Final agent output text")
    output: str | None = Field(default=None, description="Alternative output field name")
    error: str | None = Field(default=None, description="Error from subagent if it failed")
    duration_ms: float | int | None = Field(default=None, description="Total subagent execution duration")
    agent_transcript_path: str | None = Field(default=None, description="Path to subagent transcript (CC 2.1.69)")
    last_assistant_message: str | None = Field(default=None, description="Final assistant message text (CC 2.1.47+)")

class StopPayload(BaseModel):
    """Payload for the Stop event.
    Fires when the assistant finishes a turn.
    """
    model_config = ConfigDict(extra="allow")
    last_assistant_message: str | None = Field(default=None, description="Final assistant message text (CC 2.1.47+)")
    stop_hook_active: bool | None = Field(default=None, description="Whether a stop hook is currently active (prevents re-entry)")

class NotificationPayload(BaseModel):
    """Payload for the Notification event.
    Fires on user-facing notifications.
    """
    model_config = ConfigDict(extra="allow")
    message: str = Field(..., description="Notification message text")
    notification_type: str | None = Field(default=None, description="Notification type discriminator")

class PreCompactPayload(BaseModel):
    """Payload for the PreCompact event.
    Fires before automatic context compaction.
    """
    model_config = ConfigDict(extra="allow")
    compaction_count: float | int | None = Field(default=None, description="Number of compactions in this session so far")
    context_size_after: float | int | None = Field(default=None, description="Estimated context size after compaction (tokens)")

class TeammateIdlePayload(BaseModel):
    """Payload for the TeammateIdle event.
    Fires when a teammate agent has been idle past a threshold.
    """
    model_config = ConfigDict(extra="allow")
    teammate_id: str = Field(..., description="Teammate agent ID")
    teammate_type: str = Field(..., description="Teammate agent type")
    idle_duration_ms: float | int = Field(..., description="How long the teammate has been idle")

class TaskCompletedPayload(BaseModel):
    """Payload for the TaskCompleted event.
    Fires when a TaskCreate task is marked completed.
    """
    model_config = ConfigDict(extra="allow")
    task_id: str = Field(..., description="Completed task ID")
    task_subject: str | None = Field(default=None, description="Task subject")
    task_status: str | None = Field(default=None, description="Task result status")
    token_count: float | int | None = Field(default=None, description="Tokens consumed by the task (CC 2.1.30)")
    tool_uses: float | int | None = Field(default=None, description="Tool invocations in the task (CC 2.1.30)")


PAYLOAD_MAP: dict[str, type] = {
    "SessionStart": SessionStartPayload,
    "UserPromptSubmit": UserPromptSubmitPayload,
    "PreToolUse": PreToolUsePayload,
    "PostToolUse": PostToolUsePayload,
    "PostToolUseFailure": PostToolUseFailurePayload,
    "PermissionRequest": PermissionRequestPayload,
    "SubagentStart": SubagentStartPayload,
    "SubagentStop": SubagentStopPayload,
    "Stop": StopPayload,
    "SessionEnd": Any,
    "Setup": Any,
    "Notification": NotificationPayload,
    "PreCompact": PreCompactPayload,
    "TeammateIdle": TeammateIdlePayload,
    "TaskCompleted": TaskCompletedPayload,
    "InstructionsLoaded": Any,
    "WorktreeCreate": Any,
    "WorktreeRemove": Any,
    "ConfigChange": Any,
}


class HookEvent(BaseModel):
    """Common envelope for all hook events."""
    model_config = ConfigDict(extra="allow")

    event: HookEventName
    timestamp: str | None = None
    session_id: str | None = None
    cwd: str | None = None
    payload: Any = None
