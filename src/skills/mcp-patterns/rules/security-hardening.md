---
title: Security Hardening
impact: HIGH
impactDescription: "Without zero-trust verification, a compromised MCP server can silently change tool behavior (rug pull) or exfiltrate data through tool responses"
tags: security, allowlist, hash-verification, rug-pull, capabilities, zero-trust, session
---

## Security Hardening

Verify every tool with hash-based integrity checks. Use zero-trust allowlists, capability enforcement, and secure sessions.

**Incorrect -- trust all tools without verification:**
```python
tools = await mcp.list_tools()       # No vetting!
result = await mcp.call_tool(name, args)  # No integrity check!
session_id = f"{user_id}:{auth_token}"    # CREDENTIAL LEAK in session ID!
```

**Correct -- zero-trust tool allowlist with hash verification:**
```python
from hashlib import sha256
from dataclasses import dataclass
from datetime import datetime, timezone

@dataclass
class AllowedTool:
    name: str
    description_hash: str
    capabilities: list[str]
    approved_by: str
    max_calls_per_minute: int = 60

class MCPToolAllowlist:
    def __init__(self):
        self._allowed: dict[str, AllowedTool] = {}
        self._call_counts: dict[str, list[datetime]] = {}

    def register(self, tool: AllowedTool) -> None:
        self._allowed[tool.name] = tool
        self._call_counts[tool.name] = []

    def validate(self, name: str, description: str) -> tuple[bool, str]:
        if name not in self._allowed:
            return False, f"Tool '{name}' not in allowlist"

        expected = self._allowed[name]
        actual_hash = sha256(description.encode('utf-8')).hexdigest()
        if actual_hash != expected.description_hash:
            return False, "Description changed (possible rug pull)"

        # Rate limit
        now = datetime.now(timezone.utc)
        recent = [t for t in self._call_counts[name]
                  if (now - t).total_seconds() < 60]
        if len(recent) >= expected.max_calls_per_minute:
            return False, "Rate limit exceeded"

        self._call_counts[name] = recent + [now]
        return True, "OK"
```

**Correct -- capability enforcement (least privilege):**
```python
from enum import Enum

class ToolCapability(Enum):
    READ_FILE = "read:file"
    WRITE_FILE = "write:file"
    EXECUTE_COMMAND = "execute:command"
    NETWORK_REQUEST = "network:request"

SENSITIVE_PATHS = ["/etc/passwd", "~/.ssh", ".env", "credentials"]

class CapabilityEnforcer:
    def __init__(self):
        self._declarations: dict[str, set[ToolCapability]] = {}

    def register(self, tool_name: str, caps: set[ToolCapability]) -> None:
        self._declarations[tool_name] = caps

    def check(self, tool_name: str, cap: ToolCapability, resource: str = "") -> tuple[bool, str]:
        if tool_name not in self._declarations:
            return False, "No capability declaration"
        if cap not in self._declarations[tool_name]:
            return False, f"Capability {cap.value} not allowed"
        if cap in (ToolCapability.READ_FILE, ToolCapability.WRITE_FILE):
            if any(s in resource for s in SENSITIVE_PATHS):
                return False, "Sensitive path denied"
        return True, "Allowed"
```

**Correct -- secure session management:**
```python
import secrets

def generate_session_id() -> str:
    return secrets.token_urlsafe(32)  # 256 bits of entropy

# NEVER: session_id = f"{user_id}:{auth_token}"
# ALWAYS: session_id = secrets.token_urlsafe(32)
```

**Rug pull detection -- hash comparison on every call:**
```python
class ToolIntegrityMonitor:
    def __init__(self):
        self._fingerprints: dict[str, str] = {}

    def register(self, tool: dict) -> None:
        desc = tool.get("description", "")
        params = json.dumps(tool.get("parameters", {}), sort_keys=True)
        combined = sha256(f"{desc}:{params}".encode()).hexdigest()
        self._fingerprints[tool["name"]] = combined

    def verify(self, tool: dict) -> tuple[bool, str | None]:
        name = tool["name"]
        if name not in self._fingerprints:
            return False, "Tool not registered"
        desc = tool.get("description", "")
        params = json.dumps(tool.get("parameters", {}), sort_keys=True)
        current = sha256(f"{desc}:{params}".encode()).hexdigest()
        if current != self._fingerprints[name]:
            return False, f"Tool '{name}' modified since registration"
        return True, None
```

**Key rules:**
- Every tool must be explicitly vetted before use (zero-trust)
- Hash-verify description + parameters on every invocation
- Use `secrets.token_urlsafe(32)` for session IDs, never embed auth tokens
- Enforce least-privilege capabilities per tool
- Rate limit tool calls (per-tool and per-session)
- Auto-suspend tools that fail integrity checks
