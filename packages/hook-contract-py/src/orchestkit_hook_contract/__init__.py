"""orchestkit-hook-contract — Pydantic + JSON Schema contract for Claude Code hook events.

Mirrors the npm package ``@orchestkit/hook-contract``. Both sides regenerate
from ``spec/hook-events.spec.yml`` in the OrchestKit repo. M141-6 (#1807)
ships a CI parity gate that fails if the two language sides drift.

Public surface:

    from orchestkit_hook_contract import (
        HOOK_EVENT_NAMES,
        HookEvent,
        HookEventName,
        is_hook_event_name,
        HOOK_EVENT_SCHEMAS,
    )

Typed per-event payloads (M141-3 step 1 covers 13 of 19 events):

    from orchestkit_hook_contract import PreToolUsePayload, NotificationPayload
"""

from __future__ import annotations

# Re-export per-event payload classes for events that have them.
from .events import (
    HOOK_EVENT_NAME_SET,
    HOOK_EVENT_NAMES,
    PAYLOAD_MAP,
    HookEvent,
    HookEventName,
    NotificationPayload,
    PermissionRequestPayload,
    PostToolUseFailurePayload,
    PostToolUsePayload,
    PreCompactPayload,
    PreToolUsePayload,
    SessionStartPayload,
    StopPayload,
    SubagentStartPayload,
    SubagentStopPayload,
    TaskCompletedPayload,
    TeammateIdlePayload,
    UserPromptSubmitPayload,
    is_hook_event_name,
)
from .schemas import (
    HOOK_EVENT_SCHEMA,
    HOOK_EVENT_SCHEMAS,
    PAYLOAD_SCHEMAS,
)
from .signing import (
    HOOK_SIGNATURE_HEADER,
    MIN_SECRET_BYTES,
    Reason,
    VerifyResult,
    sign,
    verify,
)
from .validate import (
    ValidationResult,
    is_hook_event,
    validate_hook_event,
)

__version__ = "0.1.1"

__all__ = [  # noqa: RUF022 — grouped by category for readability
    # Constants
    "HOOK_EVENT_NAMES",
    "HOOK_EVENT_NAME_SET",
    "HOOK_EVENT_SCHEMA",
    "HOOK_EVENT_SCHEMAS",
    "PAYLOAD_MAP",
    "PAYLOAD_SCHEMAS",
    # Types
    "HookEvent",
    "HookEventName",
    # Helpers
    "is_hook_event_name",
    "is_hook_event",
    "validate_hook_event",
    "ValidationResult",
    # HMAC signing (M141-4)
    "HOOK_SIGNATURE_HEADER",
    "MIN_SECRET_BYTES",
    "Reason",
    "VerifyResult",
    "sign",
    "verify",
    # Per-event payload classes
    "NotificationPayload",
    "PermissionRequestPayload",
    "PostToolUseFailurePayload",
    "PostToolUsePayload",
    "PreCompactPayload",
    "PreToolUsePayload",
    "SessionStartPayload",
    "StopPayload",
    "SubagentStartPayload",
    "SubagentStopPayload",
    "TaskCompletedPayload",
    "TeammateIdlePayload",
    "UserPromptSubmitPayload",
    # Version
    "__version__",
]
