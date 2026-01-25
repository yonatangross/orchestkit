# Session Security for MCP

## Overview

MCP sessions must be secured against hijacking, replay attacks, and unauthorized access. This reference covers secure session ID generation, authorization patterns, context isolation, and rate limiting.

## Secure Session ID Generation

### Cryptographic Session IDs

```python
import secrets
import hashlib
import re
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional
from enum import Enum

def generate_secure_session_id(
    entropy_bytes: int = 32,
    prefix: Optional[str] = None,
) -> str:
    """
    Generate cryptographically secure session ID.

    Args:
        entropy_bytes: Number of random bytes (default 32 = 256 bits)
        prefix: Optional prefix for session type identification

    Returns:
        URL-safe base64 encoded session ID
    """
    # Use secrets module for cryptographic randomness
    token = secrets.token_urlsafe(entropy_bytes)

    if prefix:
        # Validate prefix contains only safe characters
        if not re.match(r'^[a-z]+$', prefix):
            raise ValueError("Prefix must be lowercase letters only")
        return f"{prefix}_{token}"

    return token


def generate_session_with_checksum(entropy_bytes: int = 32) -> str:
    """
    Generate session ID with embedded checksum for tampering detection.
    """
    random_part = secrets.token_urlsafe(entropy_bytes)

    # Add checksum (last 4 chars of hash)
    checksum = hashlib.sha256(random_part.encode()).hexdigest()[:8]

    return f"{random_part}.{checksum}"


def validate_session_checksum(session_id: str) -> bool:
    """Validate session ID checksum."""
    if '.' not in session_id:
        return False

    random_part, checksum = session_id.rsplit('.', 1)
    expected = hashlib.sha256(random_part.encode()).hexdigest()[:8]

    return secrets.compare_digest(checksum, expected)


# Session ID format validation
SESSION_ID_PATTERNS = {
    "standard": r'^[A-Za-z0-9_-]{43}$',  # token_urlsafe(32)
    "prefixed": r'^[a-z]+_[A-Za-z0-9_-]{43}$',
    "checksummed": r'^[A-Za-z0-9_-]{43}\.[a-f0-9]{8}$',
}


def validate_session_format(
    session_id: str,
    format_type: str = "standard",
) -> bool:
    """Validate session ID matches expected format."""
    if format_type not in SESSION_ID_PATTERNS:
        raise ValueError(f"Unknown format type: {format_type}")

    pattern = SESSION_ID_PATTERNS[format_type]
    return bool(re.match(pattern, session_id))
```

### Anti-Patterns to Avoid

```python
# ❌ NEVER use predictable session IDs
import uuid
session_id = str(uuid.uuid4())  # UUID v4 has only 122 bits, and format is predictable

# ❌ NEVER use timestamp-based IDs
session_id = f"session_{int(time.time())}"  # Easily guessable

# ❌ NEVER encode sensitive data in session ID
session_id = base64.b64encode(f"{user_id}:{role}".encode())  # Data leak

# ❌ NEVER use simple incrementing IDs
session_id = f"sess_{counter}"  # Trivially enumerable

# ✅ ALWAYS use cryptographic randomness
session_id = secrets.token_urlsafe(32)  # 256 bits of entropy

# ✅ ALWAYS validate format before use
if not validate_session_format(session_id):
    raise SecurityError("Invalid session ID format")
```

## Session Lifecycle Management

### Session State Machine

```python
class SessionState(Enum):
    """Session lifecycle states."""
    CREATED = "created"
    ACTIVE = "active"
    IDLE = "idle"
    EXPIRED = "expired"
    REVOKED = "revoked"

@dataclass
class MCPSession:
    """Secure MCP session with lifecycle management."""
    session_id: str
    state: SessionState
    created_at: datetime
    last_activity: datetime
    client_info: dict
    capabilities: set[str]

    # Security settings
    max_idle_minutes: int = 30
    max_lifetime_hours: int = 24
    max_requests_per_minute: int = 100

    # Tracking
    request_count: int = 0
    request_timestamps: list[datetime] = None

    def __post_init__(self):
        if self.request_timestamps is None:
            self.request_timestamps = []

    def check_state(self) -> tuple[SessionState, str]:
        """Check current session state."""
        now = datetime.now(timezone.utc)

        # Check if revoked
        if self.state == SessionState.REVOKED:
            return SessionState.REVOKED, "Session was revoked"

        # Check lifetime expiry
        lifetime = now - self.created_at
        if lifetime > timedelta(hours=self.max_lifetime_hours):
            self.state = SessionState.EXPIRED
            return SessionState.EXPIRED, "Session lifetime exceeded"

        # Check idle timeout
        idle_time = now - self.last_activity
        if idle_time > timedelta(minutes=self.max_idle_minutes):
            self.state = SessionState.EXPIRED
            return SessionState.EXPIRED, "Session idle timeout"

        # Check if idle
        if idle_time > timedelta(minutes=5):
            self.state = SessionState.IDLE
            return SessionState.IDLE, "Session idle"

        self.state = SessionState.ACTIVE
        return SessionState.ACTIVE, "Session active"

    def record_activity(self) -> tuple[bool, str]:
        """Record session activity and check rate limits."""
        now = datetime.now(timezone.utc)

        # Clean old timestamps (keep last minute)
        cutoff = now - timedelta(minutes=1)
        self.request_timestamps = [
            ts for ts in self.request_timestamps if ts > cutoff
        ]

        # Check rate limit
        if len(self.request_timestamps) >= self.max_requests_per_minute:
            return False, "Rate limit exceeded"

        self.request_timestamps.append(now)
        self.last_activity = now
        self.request_count += 1
        self.state = SessionState.ACTIVE

        return True, "Activity recorded"

    def revoke(self, reason: str = "") -> None:
        """Revoke session immediately."""
        self.state = SessionState.REVOKED


class SecureSessionManager:
    """
    Secure session manager with lifecycle and security controls.
    """

    def __init__(
        self,
        max_sessions_per_client: int = 5,
        cleanup_interval_minutes: int = 5,
    ):
        self._sessions: dict[str, MCPSession] = {}
        self._client_sessions: dict[str, set[str]] = {}
        self._max_per_client = max_sessions_per_client
        self._last_cleanup = datetime.now(timezone.utc)
        self._cleanup_interval = timedelta(minutes=cleanup_interval_minutes)

    def create_session(
        self,
        client_id: str,
        client_info: dict,
        capabilities: set[str],
    ) -> MCPSession:
        """Create a new secure session."""
        # Enforce session limit per client
        if client_id in self._client_sessions:
            if len(self._client_sessions[client_id]) >= self._max_per_client:
                # Revoke oldest session
                oldest = min(
                    (self._sessions[sid] for sid in self._client_sessions[client_id]),
                    key=lambda s: s.created_at,
                )
                self.revoke_session(oldest.session_id, "Max sessions exceeded")

        # Generate secure session ID
        session_id = generate_secure_session_id(prefix="mcp")
        now = datetime.now(timezone.utc)

        session = MCPSession(
            session_id=session_id,
            state=SessionState.CREATED,
            created_at=now,
            last_activity=now,
            client_info=client_info,
            capabilities=capabilities,
        )

        self._sessions[session_id] = session

        if client_id not in self._client_sessions:
            self._client_sessions[client_id] = set()
        self._client_sessions[client_id].add(session_id)

        return session

    def get_session(self, session_id: str) -> Optional[MCPSession]:
        """Get session if valid and active."""
        # Validate format first
        if not validate_session_format(session_id, "prefixed"):
            return None

        session = self._sessions.get(session_id)
        if not session:
            return None

        state, _ = session.check_state()
        if state not in {SessionState.ACTIVE, SessionState.IDLE}:
            return None

        return session

    def validate_request(
        self,
        session_id: str,
        capability: str,
    ) -> tuple[bool, str]:
        """Validate a request against session."""
        session = self.get_session(session_id)
        if not session:
            return False, "Invalid or expired session"

        # Check capability
        if capability not in session.capabilities:
            return False, f"Capability {capability} not granted to session"

        # Record activity and check rate limit
        allowed, reason = session.record_activity()
        if not allowed:
            return False, reason

        return True, "Request allowed"

    def revoke_session(self, session_id: str, reason: str = "") -> None:
        """Revoke a session."""
        session = self._sessions.get(session_id)
        if session:
            session.revoke(reason)
            # Don't remove immediately - keep for audit
            logger.info(
                "session_revoked",
                session_id=session_id[:16] + "...",
                reason=reason,
            )

    def cleanup_expired(self) -> int:
        """Clean up expired sessions."""
        now = datetime.now(timezone.utc)

        # Only run if interval passed
        if now - self._last_cleanup < self._cleanup_interval:
            return 0

        self._last_cleanup = now
        expired = []

        for sid, session in self._sessions.items():
            state, _ = session.check_state()
            if state in {SessionState.EXPIRED, SessionState.REVOKED}:
                expired.append(sid)

        for sid in expired:
            # Remove from client tracking
            session = self._sessions[sid]
            for client_sessions in self._client_sessions.values():
                client_sessions.discard(sid)
            del self._sessions[sid]

        return len(expired)
```

## Authorization Verification

### Request Authorization

```python
from dataclasses import dataclass
from typing import Callable
from datetime import datetime, timezone
import structlog

logger = structlog.get_logger()

@dataclass
class AuthorizationContext:
    """Context for authorization decisions."""
    session_id: str
    client_id: str
    tool_name: str
    capability: str
    resource: str
    action: str
    metadata: dict

class AuthorizationResult:
    """Result of authorization check."""
    def __init__(
        self,
        allowed: bool,
        reason: str,
        requires_mfa: bool = False,
        audit_level: str = "info",
    ):
        self.allowed = allowed
        self.reason = reason
        self.requires_mfa = requires_mfa
        self.audit_level = audit_level

class MCPAuthorizer:
    """
    Authorization engine for MCP requests.
    Implements defense-in-depth with multiple check layers.
    """

    def __init__(self, session_manager: SecureSessionManager):
        self._session_manager = session_manager
        self._policy_checks: list[Callable] = []
        self._audit_log: list[dict] = []

    def add_policy_check(
        self,
        check: Callable[[AuthorizationContext], Optional[AuthorizationResult]],
    ) -> None:
        """Add a policy check function."""
        self._policy_checks.append(check)

    async def authorize(self, context: AuthorizationContext) -> AuthorizationResult:
        """
        Authorize a request through all policy checks.
        Returns first denial or final approval.
        """
        # Layer 1: Session validation
        session = self._session_manager.get_session(context.session_id)
        if not session:
            return self._deny("Invalid or expired session")

        # Layer 2: Capability check
        if context.capability not in session.capabilities:
            return self._deny(f"Missing capability: {context.capability}")

        # Layer 3: Rate limit check
        allowed, reason = self._session_manager.validate_request(
            context.session_id,
            context.capability,
        )
        if not allowed:
            return self._deny(reason)

        # Layer 4: Custom policy checks
        for check in self._policy_checks:
            result = check(context)
            if result and not result.allowed:
                return result

        # All checks passed
        return self._allow("Authorized")

    def _deny(self, reason: str) -> AuthorizationResult:
        """Create denial result."""
        return AuthorizationResult(
            allowed=False,
            reason=reason,
            audit_level="warn",
        )

    def _allow(self, reason: str) -> AuthorizationResult:
        """Create approval result."""
        return AuthorizationResult(
            allowed=True,
            reason=reason,
            audit_level="info",
        )


# Example policy checks
def sensitive_resource_policy(context: AuthorizationContext) -> Optional[AuthorizationResult]:
    """Require MFA for sensitive resources."""
    sensitive_patterns = [".env", "secret", "credential", "password", "key"]

    if any(p in context.resource.lower() for p in sensitive_patterns):
        return AuthorizationResult(
            allowed=True,  # Allow but flag
            reason="Sensitive resource access",
            requires_mfa=True,
            audit_level="warn",
        )
    return None


def time_based_policy(context: AuthorizationContext) -> Optional[AuthorizationResult]:
    """Deny certain operations outside business hours."""
    import datetime

    now = datetime.datetime.now(timezone.utc)
    hour = now.hour

    if context.action in ["delete", "admin"] and (hour < 8 or hour > 18):
        return AuthorizationResult(
            allowed=False,
            reason="Destructive operations only allowed during business hours",
            audit_level="warn",
        )
    return None
```

## Context Isolation

### Isolated Execution Contexts

```python
from dataclasses import dataclass, field
from typing import Any
import copy

@dataclass
class IsolatedContext:
    """
    Isolated execution context for MCP operations.
    Prevents cross-session data leakage.
    """
    session_id: str
    namespace: str
    variables: dict[str, Any] = field(default_factory=dict)
    secrets_accessed: set[str] = field(default_factory=set)

    # Isolation settings
    allow_external_network: bool = False
    allow_file_system: bool = False
    max_memory_mb: int = 256
    max_execution_seconds: int = 30

    def get_variable(self, key: str, default: Any = None) -> Any:
        """Get variable with copy to prevent reference leaks."""
        value = self.variables.get(key, default)
        return copy.deepcopy(value)

    def set_variable(self, key: str, value: Any) -> None:
        """Set variable with copy to prevent reference leaks."""
        self.variables[key] = copy.deepcopy(value)

    def clear(self) -> None:
        """Clear all context data."""
        self.variables.clear()
        self.secrets_accessed.clear()


class ContextIsolationManager:
    """
    Manages isolated contexts for MCP sessions.
    Ensures strict separation between sessions.
    """

    def __init__(self):
        self._contexts: dict[str, IsolatedContext] = {}

    def create_context(
        self,
        session_id: str,
        namespace: str = "default",
        **settings,
    ) -> IsolatedContext:
        """Create isolated context for session."""
        key = f"{session_id}:{namespace}"

        if key in self._contexts:
            raise ValueError(f"Context already exists: {key}")

        context = IsolatedContext(
            session_id=session_id,
            namespace=namespace,
            **settings,
        )

        self._contexts[key] = context
        return context

    def get_context(
        self,
        session_id: str,
        namespace: str = "default",
    ) -> Optional[IsolatedContext]:
        """Get context for session."""
        key = f"{session_id}:{namespace}"
        return self._contexts.get(key)

    def destroy_context(
        self,
        session_id: str,
        namespace: str = "default",
    ) -> None:
        """Destroy context and clear all data."""
        key = f"{session_id}:{namespace}"
        context = self._contexts.get(key)

        if context:
            context.clear()
            del self._contexts[key]

    def destroy_all_for_session(self, session_id: str) -> int:
        """Destroy all contexts for a session."""
        keys_to_remove = [
            k for k in self._contexts
            if k.startswith(f"{session_id}:")
        ]

        for key in keys_to_remove:
            self._contexts[key].clear()
            del self._contexts[key]

        return len(keys_to_remove)
```

## Rate Limiting Implementation

### Multi-Level Rate Limiting

```python
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from enum import Enum
import threading

class RateLimitLevel(Enum):
    """Rate limit levels."""
    GLOBAL = "global"       # Across all sessions
    SESSION = "session"     # Per session
    TOOL = "tool"          # Per tool per session
    OPERATION = "operation" # Per specific operation

@dataclass
class RateLimitConfig:
    """Configuration for a rate limit."""
    requests_per_window: int
    window_seconds: int
    burst_allowance: int = 0  # Extra requests allowed in burst

class RateLimitResult:
    """Result of rate limit check."""
    def __init__(
        self,
        allowed: bool,
        remaining: int,
        reset_at: datetime,
        retry_after_seconds: Optional[int] = None,
    ):
        self.allowed = allowed
        self.remaining = remaining
        self.reset_at = reset_at
        self.retry_after_seconds = retry_after_seconds

class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter with multiple levels.
    Thread-safe implementation.
    """

    DEFAULT_LIMITS = {
        RateLimitLevel.GLOBAL: RateLimitConfig(
            requests_per_window=10000,
            window_seconds=60,
        ),
        RateLimitLevel.SESSION: RateLimitConfig(
            requests_per_window=100,
            window_seconds=60,
            burst_allowance=20,
        ),
        RateLimitLevel.TOOL: RateLimitConfig(
            requests_per_window=30,
            window_seconds=60,
        ),
        RateLimitLevel.OPERATION: RateLimitConfig(
            requests_per_window=10,
            window_seconds=60,
        ),
    }

    def __init__(self, custom_limits: Optional[dict] = None):
        self._limits = {**self.DEFAULT_LIMITS, **(custom_limits or {})}
        self._windows: dict[str, list[datetime]] = defaultdict(list)
        self._lock = threading.Lock()

    def _make_key(
        self,
        level: RateLimitLevel,
        session_id: str = "",
        tool_name: str = "",
        operation: str = "",
    ) -> str:
        """Create rate limit key."""
        parts = [level.value]
        if session_id:
            parts.append(session_id[:16])  # Truncate for privacy
        if tool_name:
            parts.append(tool_name)
        if operation:
            parts.append(operation)
        return ":".join(parts)

    def check_and_record(
        self,
        level: RateLimitLevel,
        session_id: str = "",
        tool_name: str = "",
        operation: str = "",
    ) -> RateLimitResult:
        """Check rate limit and record request if allowed."""
        key = self._make_key(level, session_id, tool_name, operation)
        config = self._limits[level]
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=config.window_seconds)

        with self._lock:
            # Clean old entries
            self._windows[key] = [
                ts for ts in self._windows[key]
                if ts > window_start
            ]

            current_count = len(self._windows[key])
            max_allowed = config.requests_per_window + config.burst_allowance

            if current_count >= max_allowed:
                # Calculate retry time
                oldest = min(self._windows[key])
                reset_at = oldest + timedelta(seconds=config.window_seconds)
                retry_after = int((reset_at - now).total_seconds()) + 1

                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_at=reset_at,
                    retry_after_seconds=retry_after,
                )

            # Record this request
            self._windows[key].append(now)

            remaining = max_allowed - current_count - 1
            reset_at = now + timedelta(seconds=config.window_seconds)

            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                reset_at=reset_at,
            )

    def check_all_levels(
        self,
        session_id: str,
        tool_name: str,
        operation: str = "",
    ) -> tuple[bool, Optional[RateLimitResult]]:
        """
        Check all applicable rate limit levels.
        Returns (allowed, first_blocking_result).
        """
        checks = [
            (RateLimitLevel.GLOBAL, "", "", ""),
            (RateLimitLevel.SESSION, session_id, "", ""),
            (RateLimitLevel.TOOL, session_id, tool_name, ""),
        ]

        if operation:
            checks.append((RateLimitLevel.OPERATION, session_id, tool_name, operation))

        for level, sid, tool, op in checks:
            result = self.check_and_record(level, sid, tool, op)
            if not result.allowed:
                return False, result

        return True, None
```

## Testing Session Security

```python
import pytest

class TestSessionSecurity:
    def test_session_id_entropy(self):
        """Verify session IDs have sufficient entropy."""
        ids = [generate_secure_session_id() for _ in range(1000)]

        # All unique
        assert len(set(ids)) == 1000

        # Correct length (43 chars for 32 bytes base64)
        assert all(len(sid) == 43 for sid in ids)

    def test_session_checksum_validation(self):
        session_id = generate_session_with_checksum()
        assert validate_session_checksum(session_id)

        # Tamper with session ID
        tampered = session_id[:-1] + ('1' if session_id[-1] != '1' else '0')
        assert not validate_session_checksum(tampered)

    def test_session_idle_timeout(self):
        session = MCPSession(
            session_id=generate_secure_session_id(),
            state=SessionState.ACTIVE,
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
            last_activity=datetime.now(timezone.utc) - timedelta(minutes=35),
            client_info={},
            capabilities=set(),
            max_idle_minutes=30,
        )

        state, reason = session.check_state()
        assert state == SessionState.EXPIRED
        assert "idle" in reason.lower()

    def test_rate_limit_enforcement(self):
        limiter = SlidingWindowRateLimiter({
            RateLimitLevel.SESSION: RateLimitConfig(
                requests_per_window=5,
                window_seconds=60,
            ),
        })

        session_id = "test_session"

        # First 5 requests should succeed
        for _ in range(5):
            result = limiter.check_and_record(
                RateLimitLevel.SESSION,
                session_id=session_id,
            )
            assert result.allowed

        # 6th request should be blocked
        result = limiter.check_and_record(
            RateLimitLevel.SESSION,
            session_id=session_id,
        )
        assert not result.allowed
        assert result.retry_after_seconds > 0

    def test_context_isolation(self):
        manager = ContextIsolationManager()

        ctx1 = manager.create_context("session1")
        ctx2 = manager.create_context("session2")

        ctx1.set_variable("secret", "session1_secret")
        ctx2.set_variable("secret", "session2_secret")

        # Contexts are isolated
        assert ctx1.get_variable("secret") == "session1_secret"
        assert ctx2.get_variable("secret") == "session2_secret"

        # Destroying one doesn't affect other
        manager.destroy_context("session1")
        assert manager.get_context("session1") is None
        assert manager.get_context("session2") is not None
```

---

**Key Takeaway:** Secure session management requires cryptographic IDs, proper lifecycle management, multi-level rate limiting, strict context isolation, and comprehensive authorization checks at every layer.
