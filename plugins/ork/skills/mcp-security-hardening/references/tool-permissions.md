# Tool Permissions and Capability Management

## Overview

MCP tools should operate under the principle of least privilege. Every tool must declare its required capabilities upfront, and the system must enforce these declarations at runtime.

## Capability Declaration Model

### Core Capability Types

```python
from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Optional

class Capability(Enum):
    """Standardized capability types for MCP tools."""

    # File System
    FILE_READ = "file:read"
    FILE_WRITE = "file:write"
    FILE_DELETE = "file:delete"
    FILE_LIST = "file:list"

    # Command Execution
    EXEC_SAFE = "exec:safe"          # Allowlisted commands only
    EXEC_UNRESTRICTED = "exec:unrestricted"  # Any command (requires approval)

    # Network
    NETWORK_OUTBOUND = "network:outbound"
    NETWORK_INBOUND = "network:inbound"
    NETWORK_LOCAL = "network:local"

    # Database
    DB_READ = "database:read"
    DB_WRITE = "database:write"
    DB_ADMIN = "database:admin"

    # Sensitive Data
    SENSITIVE_READ = "sensitive:read"
    SENSITIVE_WRITE = "sensitive:write"
    PII_ACCESS = "pii:access"

    # System
    ENV_READ = "env:read"
    ENV_WRITE = "env:write"
    PROCESS_SPAWN = "process:spawn"
    PROCESS_KILL = "process:kill"


class ApprovalLevel(Enum):
    """Required approval level for capability use."""
    AUTO = "auto"                    # Automatic approval
    NOTIFY = "notify"                # Notify user, proceed
    CONFIRM = "confirm"              # Require user confirmation
    ADMIN = "admin"                  # Require admin approval
    BLOCKED = "blocked"              # Never allow
```

### Capability Declaration Schema

```python
@dataclass
class PathRestriction:
    """Restricts file operations to specific paths."""
    allowed_patterns: list[str] = field(default_factory=list)
    denied_patterns: list[str] = field(default_factory=list)
    max_depth: Optional[int] = None

@dataclass
class NetworkRestriction:
    """Restricts network operations to specific targets."""
    allowed_hosts: list[str] = field(default_factory=list)
    allowed_ports: list[int] = field(default_factory=list)
    denied_hosts: list[str] = field(default_factory=list)
    max_request_size_bytes: int = 1_000_000

@dataclass
class ResourceLimits:
    """Resource consumption limits."""
    max_memory_mb: int = 256
    max_cpu_seconds: int = 30
    max_output_bytes: int = 1_000_000
    max_calls_per_minute: int = 60

@dataclass
class CapabilityDeclaration:
    """
    Complete capability declaration for an MCP tool.
    Tools must declare all capabilities upfront.
    """
    tool_name: str
    tool_version: str
    required_capabilities: set[Capability]
    optional_capabilities: set[Capability] = field(default_factory=set)

    # Restrictions
    path_restrictions: Optional[PathRestriction] = None
    network_restrictions: Optional[NetworkRestriction] = None
    resource_limits: ResourceLimits = field(default_factory=ResourceLimits)

    # Approval requirements
    approval_overrides: dict[Capability, ApprovalLevel] = field(default_factory=dict)

    # Metadata
    declared_at: Optional[str] = None
    declared_by: Optional[str] = None

    def requires_approval(self, capability: Capability) -> ApprovalLevel:
        """Determine approval level for a capability."""
        if capability in self.approval_overrides:
            return self.approval_overrides[capability]

        # Default approval levels by capability type
        defaults = {
            Capability.FILE_READ: ApprovalLevel.AUTO,
            Capability.FILE_WRITE: ApprovalLevel.CONFIRM,
            Capability.FILE_DELETE: ApprovalLevel.CONFIRM,
            Capability.EXEC_SAFE: ApprovalLevel.NOTIFY,
            Capability.EXEC_UNRESTRICTED: ApprovalLevel.ADMIN,
            Capability.NETWORK_OUTBOUND: ApprovalLevel.NOTIFY,
            Capability.DB_READ: ApprovalLevel.AUTO,
            Capability.DB_WRITE: ApprovalLevel.CONFIRM,
            Capability.DB_ADMIN: ApprovalLevel.ADMIN,
            Capability.SENSITIVE_READ: ApprovalLevel.CONFIRM,
            Capability.SENSITIVE_WRITE: ApprovalLevel.ADMIN,
            Capability.PII_ACCESS: ApprovalLevel.ADMIN,
            Capability.ENV_READ: ApprovalLevel.NOTIFY,
            Capability.ENV_WRITE: ApprovalLevel.BLOCKED,
            Capability.PROCESS_SPAWN: ApprovalLevel.CONFIRM,
            Capability.PROCESS_KILL: ApprovalLevel.ADMIN,
        }

        return defaults.get(capability, ApprovalLevel.CONFIRM)
```

## Enforcement Engine

### Runtime Capability Enforcer

```python
from datetime import datetime, timezone
from typing import Callable, Awaitable
import fnmatch
import structlog

logger = structlog.get_logger()

@dataclass
class EnforcementResult:
    """Result of capability enforcement check."""
    allowed: bool
    reason: str
    approval_required: ApprovalLevel
    restrictions_applied: list[str] = field(default_factory=list)

class CapabilityEnforcer:
    """
    Runtime enforcement of capability declarations.
    Validates all tool operations against declared capabilities.
    """

    # Capabilities that require human-in-the-loop
    HITL_CAPABILITIES = {
        Capability.EXEC_UNRESTRICTED,
        Capability.DB_ADMIN,
        Capability.SENSITIVE_WRITE,
        Capability.PII_ACCESS,
        Capability.ENV_WRITE,
        Capability.PROCESS_KILL,
    }

    # Paths that are always denied
    ALWAYS_DENIED_PATHS = [
        "/etc/passwd",
        "/etc/shadow",
        "**/.ssh/**",
        "**/.gnupg/**",
        "**/id_rsa*",
        "**/*.pem",
        "**/.env",
        "**/credentials*",
        "**/secrets*",
    ]

    def __init__(self):
        self._declarations: dict[str, CapabilityDeclaration] = {}
        self._usage_log: list[dict] = []
        self._approval_callbacks: dict[ApprovalLevel, Callable] = {}

    def register_declaration(self, declaration: CapabilityDeclaration) -> None:
        """Register a tool's capability declaration."""
        self._declarations[declaration.tool_name] = declaration
        logger.info(
            "capability_declaration_registered",
            tool=declaration.tool_name,
            capabilities=[c.value for c in declaration.required_capabilities],
        )

    def register_approval_callback(
        self,
        level: ApprovalLevel,
        callback: Callable[[str, Capability, dict], Awaitable[bool]],
    ) -> None:
        """Register callback for approval level."""
        self._approval_callbacks[level] = callback

    async def check_capability(
        self,
        tool_name: str,
        capability: Capability,
        context: dict,
    ) -> EnforcementResult:
        """
        Check if a tool can use a capability in the given context.
        """
        # Check if tool has a declaration
        if tool_name not in self._declarations:
            return EnforcementResult(
                allowed=False,
                reason="No capability declaration found for tool",
                approval_required=ApprovalLevel.BLOCKED,
            )

        declaration = self._declarations[tool_name]
        restrictions = []

        # Check if capability is declared
        all_capabilities = (
            declaration.required_capabilities |
            declaration.optional_capabilities
        )

        if capability not in all_capabilities:
            return EnforcementResult(
                allowed=False,
                reason=f"Capability {capability.value} not declared",
                approval_required=ApprovalLevel.BLOCKED,
            )

        # Apply path restrictions for file operations
        if capability in {
            Capability.FILE_READ,
            Capability.FILE_WRITE,
            Capability.FILE_DELETE,
        }:
            path = context.get("path", "")
            path_result = self._check_path_restrictions(
                path,
                declaration.path_restrictions,
            )
            if not path_result[0]:
                return EnforcementResult(
                    allowed=False,
                    reason=path_result[1],
                    approval_required=ApprovalLevel.BLOCKED,
                )
            restrictions.append(f"path_validated:{path}")

        # Apply network restrictions
        if capability in {
            Capability.NETWORK_OUTBOUND,
            Capability.NETWORK_INBOUND,
        }:
            host = context.get("host", "")
            port = context.get("port", 0)
            network_result = self._check_network_restrictions(
                host,
                port,
                declaration.network_restrictions,
            )
            if not network_result[0]:
                return EnforcementResult(
                    allowed=False,
                    reason=network_result[1],
                    approval_required=ApprovalLevel.BLOCKED,
                )
            restrictions.append(f"network_validated:{host}:{port}")

        # Determine approval level
        approval = declaration.requires_approval(capability)

        # Check if HITL is required
        if capability in self.HITL_CAPABILITIES:
            approval = max(approval, ApprovalLevel.CONFIRM, key=lambda x: x.value)

        # Get approval if needed
        if approval in {ApprovalLevel.CONFIRM, ApprovalLevel.ADMIN}:
            if approval in self._approval_callbacks:
                approved = await self._approval_callbacks[approval](
                    tool_name, capability, context
                )
                if not approved:
                    return EnforcementResult(
                        allowed=False,
                        reason="User denied approval",
                        approval_required=approval,
                    )

        # Log usage
        self._log_usage(tool_name, capability, context, True)

        return EnforcementResult(
            allowed=True,
            reason="Capability allowed",
            approval_required=approval,
            restrictions_applied=restrictions,
        )

    def _check_path_restrictions(
        self,
        path: str,
        restrictions: Optional[PathRestriction],
    ) -> tuple[bool, str]:
        """Check if path is allowed."""
        # Always check denied paths
        for pattern in self.ALWAYS_DENIED_PATHS:
            if fnmatch.fnmatch(path, pattern):
                return False, f"Path matches always-denied pattern: {pattern}"

        if not restrictions:
            return True, "No restrictions"

        # Check custom denied patterns
        for pattern in restrictions.denied_patterns:
            if fnmatch.fnmatch(path, pattern):
                return False, f"Path matches denied pattern: {pattern}"

        # Check allowed patterns (if specified)
        if restrictions.allowed_patterns:
            allowed = any(
                fnmatch.fnmatch(path, pattern)
                for pattern in restrictions.allowed_patterns
            )
            if not allowed:
                return False, "Path not in allowed patterns"

        return True, "Path allowed"

    def _check_network_restrictions(
        self,
        host: str,
        port: int,
        restrictions: Optional[NetworkRestriction],
    ) -> tuple[bool, str]:
        """Check if network target is allowed."""
        # Always deny localhost unless explicitly allowed
        if host in {"localhost", "127.0.0.1", "::1"}:
            if restrictions and host in restrictions.allowed_hosts:
                return True, "Localhost explicitly allowed"
            return False, "Localhost access denied by default"

        if not restrictions:
            return True, "No restrictions"

        # Check denied hosts
        if host in restrictions.denied_hosts:
            return False, f"Host {host} is denied"

        # Check allowed hosts (if specified)
        if restrictions.allowed_hosts:
            if host not in restrictions.allowed_hosts:
                return False, f"Host {host} not in allowed list"

        # Check allowed ports (if specified)
        if restrictions.allowed_ports:
            if port not in restrictions.allowed_ports:
                return False, f"Port {port} not in allowed list"

        return True, "Network target allowed"

    def _log_usage(
        self,
        tool_name: str,
        capability: Capability,
        context: dict,
        allowed: bool,
    ) -> None:
        """Log capability usage for audit."""
        self._usage_log.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool": tool_name,
            "capability": capability.value,
            "context": {k: str(v)[:100] for k, v in context.items()},
            "allowed": allowed,
        })
```

## Human-in-the-Loop Integration

### Approval Workflow

```python
from abc import ABC, abstractmethod
from typing import Optional
import asyncio

class ApprovalProvider(ABC):
    """Abstract base for approval providers."""

    @abstractmethod
    async def request_approval(
        self,
        tool_name: str,
        capability: Capability,
        context: dict,
        timeout_seconds: int = 30,
    ) -> bool:
        """Request user approval. Returns True if approved."""
        pass

class CLIApprovalProvider(ApprovalProvider):
    """Command-line approval provider."""

    async def request_approval(
        self,
        tool_name: str,
        capability: Capability,
        context: dict,
        timeout_seconds: int = 30,
    ) -> bool:
        print(f"\n{'='*60}")
        print("APPROVAL REQUIRED")
        print(f"{'='*60}")
        print(f"Tool: {tool_name}")
        print(f"Capability: {capability.value}")
        print(f"Context: {context}")
        print(f"\nApprove this action? [y/N] ", end="", flush=True)

        try:
            # Non-blocking input with timeout
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, input),
                timeout=timeout_seconds,
            )
            return response.lower() in {"y", "yes"}
        except asyncio.TimeoutError:
            print("\nApproval timed out - defaulting to DENY")
            return False

class QueuedApprovalProvider(ApprovalProvider):
    """
    Approval provider that queues requests for external processing.
    Useful for integration with UI or webhook systems.
    """

    def __init__(self):
        self._pending: dict[str, asyncio.Future] = {}

    async def request_approval(
        self,
        tool_name: str,
        capability: Capability,
        context: dict,
        timeout_seconds: int = 30,
    ) -> bool:
        request_id = f"{tool_name}:{capability.value}:{datetime.now(timezone.utc).timestamp()}"
        future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future

        # Emit event for external system
        logger.info(
            "approval_requested",
            request_id=request_id,
            tool=tool_name,
            capability=capability.value,
            context=context,
            timeout=timeout_seconds,
        )

        try:
            return await asyncio.wait_for(future, timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return False
        finally:
            self._pending.pop(request_id, None)

    def resolve_approval(self, request_id: str, approved: bool) -> None:
        """External system calls this to resolve a pending approval."""
        if request_id in self._pending:
            self._pending[request_id].set_result(approved)
```

## Zero-Trust Allowlist Implementation

```python
from hashlib import sha256
from datetime import datetime, timedelta, timezone
import json

@dataclass
class AllowlistEntry:
    """An entry in the zero-trust tool allowlist."""
    tool_name: str
    server_url: str
    declaration_hash: str
    capabilities_granted: set[Capability]
    approved_by: str
    approved_at: datetime
    expires_at: Optional[datetime] = None
    conditions: list[str] = field(default_factory=list)

class ZeroTrustAllowlist:
    """
    Zero-trust allowlist for MCP tools.
    Tools must be explicitly added and periodically re-approved.
    """

    def __init__(self, default_expiry_days: int = 30):
        self._entries: dict[str, AllowlistEntry] = {}
        self._default_expiry = timedelta(days=default_expiry_days)

    def _make_key(self, tool_name: str, server_url: str) -> str:
        return f"{server_url}:{tool_name}"

    def compute_declaration_hash(self, declaration: CapabilityDeclaration) -> str:
        """Compute hash of capability declaration for integrity check."""
        data = {
            "tool_name": declaration.tool_name,
            "tool_version": declaration.tool_version,
            "required": sorted(c.value for c in declaration.required_capabilities),
            "optional": sorted(c.value for c in declaration.optional_capabilities),
        }
        return sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def add_tool(
        self,
        declaration: CapabilityDeclaration,
        server_url: str,
        approved_by: str,
        capabilities_granted: Optional[set[Capability]] = None,
        conditions: Optional[list[str]] = None,
        expiry_days: Optional[int] = None,
    ) -> AllowlistEntry:
        """
        Add a tool to the allowlist.
        Only specified capabilities are granted (least privilege).
        """
        key = self._make_key(declaration.tool_name, server_url)

        # Default to required capabilities only
        if capabilities_granted is None:
            capabilities_granted = declaration.required_capabilities

        # Ensure granted capabilities are subset of declared
        all_declared = (
            declaration.required_capabilities |
            declaration.optional_capabilities
        )
        if not capabilities_granted.issubset(all_declared):
            raise ValueError("Cannot grant undeclared capabilities")

        expiry = timedelta(days=expiry_days) if expiry_days else self._default_expiry

        entry = AllowlistEntry(
            tool_name=declaration.tool_name,
            server_url=server_url,
            declaration_hash=self.compute_declaration_hash(declaration),
            capabilities_granted=capabilities_granted,
            approved_by=approved_by,
            approved_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + expiry,
            conditions=conditions or [],
        )

        self._entries[key] = entry
        return entry

    def check(
        self,
        tool_name: str,
        server_url: str,
        capability: Capability,
        declaration: CapabilityDeclaration,
    ) -> tuple[bool, str]:
        """
        Check if a tool capability is allowed.
        Verifies allowlist entry and declaration integrity.
        """
        key = self._make_key(tool_name, server_url)

        if key not in self._entries:
            return False, "Tool not in allowlist"

        entry = self._entries[key]

        # Check expiry
        if entry.expires_at and datetime.now(timezone.utc) > entry.expires_at:
            return False, "Allowlist entry expired"

        # Check declaration integrity (rug pull detection)
        current_hash = self.compute_declaration_hash(declaration)
        if current_hash != entry.declaration_hash:
            return False, "Declaration changed since approval (possible rug pull)"

        # Check capability is granted
        if capability not in entry.capabilities_granted:
            return False, f"Capability {capability.value} not granted"

        return True, "Allowed"

    def revoke(self, tool_name: str, server_url: str, reason: str) -> None:
        """Revoke a tool's allowlist entry."""
        key = self._make_key(tool_name, server_url)
        if key in self._entries:
            logger.warning(
                "allowlist_entry_revoked",
                tool=tool_name,
                server=server_url,
                reason=reason,
            )
            del self._entries[key]

    def get_expiring_soon(self, days: int = 7) -> list[AllowlistEntry]:
        """Get entries expiring within specified days."""
        cutoff = datetime.now(timezone.utc) + timedelta(days=days)
        return [
            entry for entry in self._entries.values()
            if entry.expires_at and entry.expires_at < cutoff
        ]
```

## Testing Permission System

```python
import pytest

class TestPermissionSystem:
    @pytest.fixture
    def enforcer(self):
        enforcer = CapabilityEnforcer()

        declaration = CapabilityDeclaration(
            tool_name="file_reader",
            tool_version="1.0.0",
            required_capabilities={Capability.FILE_READ},
            path_restrictions=PathRestriction(
                allowed_patterns=["./data/**"],
                denied_patterns=["**/*.secret"],
            ),
        )
        enforcer.register_declaration(declaration)
        return enforcer

    @pytest.mark.asyncio
    async def test_allows_declared_capability(self, enforcer):
        result = await enforcer.check_capability(
            "file_reader",
            Capability.FILE_READ,
            {"path": "./data/test.txt"},
        )
        assert result.allowed

    @pytest.mark.asyncio
    async def test_denies_undeclared_capability(self, enforcer):
        result = await enforcer.check_capability(
            "file_reader",
            Capability.FILE_WRITE,  # Not declared
            {"path": "./data/test.txt"},
        )
        assert not result.allowed
        assert "not declared" in result.reason

    @pytest.mark.asyncio
    async def test_enforces_path_restrictions(self, enforcer):
        result = await enforcer.check_capability(
            "file_reader",
            Capability.FILE_READ,
            {"path": "/etc/passwd"},  # Not in allowed patterns
        )
        assert not result.allowed

    @pytest.mark.asyncio
    async def test_blocks_always_denied_paths(self, enforcer):
        result = await enforcer.check_capability(
            "file_reader",
            Capability.FILE_READ,
            {"path": "./data/.ssh/id_rsa"},
        )
        assert not result.allowed
        assert "always-denied" in result.reason
```

---

**Key Takeaway:** Every MCP tool must declare its capabilities upfront. The system enforces these declarations at runtime with path/network restrictions, automatic HITL for sensitive operations, and periodic re-approval via the zero-trust allowlist.
