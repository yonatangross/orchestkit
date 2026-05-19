# orchestkit-hook-contract

Pydantic v2 + JSON Schema contract for Claude Code hook events. Python sibling of the npm package [`@orchestkit/hook-contract`](../hook-contract). Both packages regenerate from the single source of truth at `spec/hook-events.spec.yml` in the repo root.

## Status

- **M141-3**: scaffold — Pydantic models, JSON schemas, structural validator, hand-rolled codegen from spec.
- **M141-4 (this change)**: HMAC signing protocol + reference verifier. Spec at [`../hook-contract/docs/signing-rfc.md`](../hook-contract/docs/signing-rfc.md). Shared golden vectors at [`../hook-contract/test-vectors/signing/`](../hook-contract/test-vectors/signing/).
- **M141-6**: cross-language parity gate CI — diff this output against the npm side field-by-field.

## Install

```bash
pip install orchestkit-hook-contract
```

Requires Python 3.11+ and `pydantic>=2.5`.

## Usage

```python
from orchestkit_hook_contract import (
    HookEvent,
    HOOK_EVENT_NAMES,
    PreToolUsePayload,
    validate_hook_event,
)

# Structural validation
result = validate_hook_event({"event": "PreToolUse"})
if result.valid:
    print("known event:", result.event)

# Typed payload access
p = PreToolUsePayload(tool_name="Bash", tool_input={"cmd": "ls"})
assert p.tool_name == "Bash"

# Pydantic envelope
e = HookEvent(event="PreToolUse", payload={"tool_name": "Bash", "tool_input": {}})
```

### HMAC signing (M141-4)

Sign hook deliveries on the sender and verify on the receiver. Full spec: [`../hook-contract/docs/signing-rfc.md`](../hook-contract/docs/signing-rfc.md).

```python
from orchestkit_hook_contract import sign, verify, HOOK_SIGNATURE_HEADER

# Sender
import json, requests, os
body = json.dumps(event).encode("utf-8")
header = sign(body, os.environ["HOOK_SECRET"])
requests.post(url, headers={HOOK_SIGNATURE_HEADER: header, "Content-Type": "application/json"}, data=body)

# Receiver (Flask / FastAPI / etc. — capture raw body, NOT json.dumps(req.json))
result = verify(
    request.headers.get(HOOK_SIGNATURE_HEADER),
    request.get_data(),  # raw bytes
    os.environ["HOOK_SECRET"],
    tolerance_sec=300,
)
if not result.valid:
    abort(401, result.reason)  # "missing_header" | "malformed_header" | "stale" | "signature_mismatch"
```

Mirrors the npm sibling byte-for-byte against the same 13 golden vectors. Zero deps beyond `hmac` + `hashlib` from the stdlib.

## Coverage

13 of the 19 hook events have typed payload classes (`PreToolUsePayload`, `NotificationPayload`, etc.). The remaining 6 events stay envelope-only — their CC payloads aren't documented enough to lock down: `SessionEnd`, `Setup`, `InstructionsLoaded`, `WorktreeCreate`, `WorktreeRemove`, `ConfigChange`.

## Develop

```bash
cd packages/hook-contract-py
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
python scripts/codegen-py.py --check   # drift gate
python scripts/codegen-py.py           # regenerate from spec
mypy src/
ruff check src/ tests/
```

## Why this package exists

The hook event surface is the contract between OrchestKit's TypeScript hook fan-out and any Python receiver (yonatan-hq/platform, custom analytics consumers). When the contracts drift, fields go missing in transit and observability lies. This package + the npm sibling both regenerate from one spec, eliminating that drift class.
