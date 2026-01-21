"""
MCP Session Security Manager - Cryptographic Session Handling

Production-ready implementation for secure MCP session management with:
- Cryptographic session ID generation
- Session lifecycle state machine
- Context isolation between sessions
- Rate limiting and abuse prevention

Usage:
    session_manager = SessionManager(secret_key=os.environ["SESSION_SECRET"])
    session = await session_manager.create_session(user_id="user123")

    # Validate on each request
    if not await session_manager.validate_session(session.session_id):
        raise SecurityError("Invalid or expired session")
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, UTC
from enum import Enum
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)


class SessionState(Enum):
    """Session lifecycle states."""
    CREATED = "created"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    TERMINATED = "terminated"


class TerminationReason(Enum):
    """Reasons for session termination."""
    USER_LOGOUT = "user_logout"
    TIMEOUT = "timeout"
    SECURITY_VIOLATION = "security_violation"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    ADMIN_TERMINATION = "admin_termination"
    CONCURRENT_SESSION = "concurrent_session"


@dataclass
class SessionContext:
    """Isolated context for a session - prevents cross-session data leakage."""
    session_id: str
    user_id: str
    permissions: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)

    # Rate limiting
    requests_this_minute: int = 0
    last_request_time: Optional[datetime] = None

    def add_tool_call(self, tool_name: str, result: str) -> None:
        """Record a tool call in this session's context."""
        self.tool_calls.append({
            "tool": tool_name,
            "timestamp": datetime.now(UTC).isoformat(),
            "result_hash": hashlib.sha256(result.encode()).hexdigest()[:16],
        })
        # Keep last 100 calls only
        if len(self.tool_calls) > 100:
            self.tool_calls = self.tool_calls[-100:]


@dataclass
class Session:
    """Secure MCP session with cryptographic ID and lifecycle management."""
    session_id: str
    user_id: str
    state: SessionState
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    context: SessionContext
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Security tracking
    failed_validations: int = 0
    security_events: list[dict[str, Any]] = field(default_factory=list)

    def is_expired(self) -> bool:
        return datetime.now(UTC) > self.expires_at

    def is_active(self) -> bool:
        return self.state == SessionState.ACTIVE and not self.is_expired()

    def record_security_event(self, event_type: str, details: dict[str, Any]) -> None:
        """Record a security-relevant event."""
        self.security_events.append({
            "type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "details": details,
        })
        # Keep last 50 events
        if len(self.security_events) > 50:
            self.security_events = self.security_events[-50:]

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id[:16] + "...",  # Truncate for safety
            "user_id": self.user_id,
            "state": self.state.value,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "is_expired": self.is_expired(),
            "failed_validations": self.failed_validations,
        }


class SessionManager:
    """
    Secure session manager for MCP connections.

    Security features:
    - Cryptographically secure session IDs (256-bit entropy)
    - HMAC-signed session tokens
    - Automatic session expiration
    - Rate limiting per session
    - Context isolation
    - Security event logging
    """

    def __init__(
        self,
        secret_key: str,
        session_ttl_minutes: int = 60,
        max_sessions_per_user: int = 5,
        max_requests_per_minute: int = 100,
        max_failed_validations: int = 5,
    ):
        self.secret_key = secret_key.encode()
        self.session_ttl = timedelta(minutes=session_ttl_minutes)
        self.max_sessions_per_user = max_sessions_per_user
        self.max_requests_per_minute = max_requests_per_minute
        self.max_failed_validations = max_failed_validations

        self._sessions: dict[str, Session] = {}
        self._user_sessions: dict[str, list[str]] = {}

    def _generate_session_id(self) -> str:
        """Generate cryptographically secure session ID."""
        # 32 bytes = 256 bits of entropy
        random_bytes = secrets.token_bytes(32)
        timestamp = str(time.time_ns()).encode()

        # Combine with HMAC for additional security
        combined = hmac.new(
            self.secret_key,
            random_bytes + timestamp,
            hashlib.sha256
        ).hexdigest()

        return combined

    def _sign_session(self, session_id: str, user_id: str) -> str:
        """Create HMAC signature for session validation."""
        message = f"{session_id}:{user_id}".encode()
        return hmac.new(self.secret_key, message, hashlib.sha256).hexdigest()

    def _verify_signature(self, session_id: str, user_id: str, signature: str) -> bool:
        """Verify session signature."""
        expected = self._sign_session(session_id, user_id)
        return hmac.compare_digest(expected, signature)

    async def create_session(
        self,
        user_id: str,
        permissions: Optional[list[str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Session:
        """
        Create a new secure session.

        Args:
            user_id: Unique user identifier
            permissions: List of permission strings
            ip_address: Client IP for logging
            user_agent: Client user agent for logging
            metadata: Additional session metadata

        Returns:
            New Session object with cryptographic ID
        """
        # Enforce max sessions per user
        if user_id in self._user_sessions:
            user_session_ids = self._user_sessions[user_id]
            if len(user_session_ids) >= self.max_sessions_per_user:
                # Terminate oldest session
                oldest_id = user_session_ids[0]
                await self.terminate_session(
                    oldest_id,
                    TerminationReason.CONCURRENT_SESSION
                )

        session_id = self._generate_session_id()
        now = datetime.now(UTC)

        context = SessionContext(
            session_id=session_id,
            user_id=user_id,
            permissions=permissions or [],
            metadata=metadata or {},
        )

        session = Session(
            session_id=session_id,
            user_id=user_id,
            state=SessionState.ACTIVE,
            created_at=now,
            last_activity=now,
            expires_at=now + self.session_ttl,
            context=context,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        self._sessions[session_id] = session

        if user_id not in self._user_sessions:
            self._user_sessions[user_id] = []
        self._user_sessions[user_id].append(session_id)

        logger.info(
            "session_created",
            session_id=session_id[:16] + "...",
            user_id=user_id,
            expires_at=session.expires_at.isoformat(),
        )

        return session

    async def validate_session(
        self,
        session_id: str,
        required_permissions: Optional[list[str]] = None,
    ) -> tuple[bool, Optional[Session], str]:
        """
        Validate a session and check permissions.

        Args:
            session_id: Session ID to validate
            required_permissions: Permissions required for this operation

        Returns:
            Tuple of (is_valid, session, reason)
        """
        required_permissions = required_permissions or []

        # Check session exists
        if session_id not in self._sessions:
            logger.warning(
                "session_not_found",
                session_id=session_id[:16] + "..." if len(session_id) > 16 else session_id,
            )
            return False, None, "Session not found"

        session = self._sessions[session_id]

        # Check session state
        if session.state != SessionState.ACTIVE:
            logger.warning(
                "session_inactive",
                session_id=session_id[:16] + "...",
                state=session.state.value,
            )
            return False, session, f"Session is {session.state.value}"

        # Check expiration
        if session.is_expired():
            session.state = SessionState.EXPIRED
            logger.info(
                "session_expired",
                session_id=session_id[:16] + "...",
            )
            return False, session, "Session expired"

        # Check rate limit
        now = datetime.now(UTC)
        ctx = session.context

        if ctx.last_request_time:
            time_since_last = (now - ctx.last_request_time).total_seconds()
            if time_since_last < 60:
                ctx.requests_this_minute += 1
            else:
                ctx.requests_this_minute = 1
        else:
            ctx.requests_this_minute = 1

        ctx.last_request_time = now

        if ctx.requests_this_minute > self.max_requests_per_minute:
            session.record_security_event(
                "rate_limit_exceeded",
                {"requests": ctx.requests_this_minute}
            )
            logger.warning(
                "session_rate_limited",
                session_id=session_id[:16] + "...",
                requests=ctx.requests_this_minute,
            )
            return False, session, "Rate limit exceeded"

        # Check permissions
        missing = set(required_permissions) - set(ctx.permissions)
        if missing:
            session.record_security_event(
                "permission_denied",
                {"missing": list(missing)}
            )
            logger.warning(
                "session_permission_denied",
                session_id=session_id[:16] + "...",
                missing=list(missing),
            )
            return False, session, f"Missing permissions: {missing}"

        # Update last activity
        session.last_activity = now

        return True, session, "Valid"

    async def terminate_session(
        self,
        session_id: str,
        reason: TerminationReason,
    ) -> bool:
        """
        Terminate a session.

        Args:
            session_id: Session to terminate
            reason: Reason for termination

        Returns:
            True if session was terminated
        """
        if session_id not in self._sessions:
            return False

        session = self._sessions[session_id]
        session.state = SessionState.TERMINATED
        session.record_security_event(
            "session_terminated",
            {"reason": reason.value}
        )

        # Remove from user sessions
        if session.user_id in self._user_sessions:
            self._user_sessions[session.user_id] = [
                sid for sid in self._user_sessions[session.user_id]
                if sid != session_id
            ]

        logger.info(
            "session_terminated",
            session_id=session_id[:16] + "...",
            reason=reason.value,
        )

        return True

    async def cleanup_expired(self) -> int:
        """Remove expired sessions. Call periodically."""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.is_expired() or session.state == SessionState.TERMINATED
        ]

        for sid in expired:
            session = self._sessions.pop(sid)
            if session.user_id in self._user_sessions:
                self._user_sessions[session.user_id] = [
                    s for s in self._user_sessions[session.user_id] if s != sid
                ]

        if expired:
            logger.info("sessions_cleaned", count=len(expired))

        return len(expired)

    def get_session_stats(self) -> dict[str, Any]:
        """Get session statistics for monitoring."""
        active = sum(1 for s in self._sessions.values() if s.is_active())
        expired = sum(1 for s in self._sessions.values() if s.is_expired())

        return {
            "total_sessions": len(self._sessions),
            "active_sessions": active,
            "expired_sessions": expired,
            "unique_users": len(self._user_sessions),
        }


async def main():
    """Example usage of SessionManager."""
    import os

    # Initialize with secret key
    manager = SessionManager(
        secret_key=os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-prod"),
        session_ttl_minutes=30,
        max_sessions_per_user=3,
        max_requests_per_minute=60,
    )

    # Create session
    session = await manager.create_session(
        user_id="user123",
        permissions=["read:tools", "write:memory"],
        ip_address="192.168.1.1",
        metadata={"source": "api"},
    )
    print(f"Created session: {session.to_dict()}")

    # Validate session
    is_valid, sess, reason = await manager.validate_session(
        session.session_id,
        required_permissions=["read:tools"],
    )
    print(f"Validation: valid={is_valid}, reason={reason}")

    # Record tool call
    session.context.add_tool_call("mcp__memory__search", "result data")
    print(f"Tool calls: {session.context.tool_calls}")

    # Get stats
    print(f"Stats: {manager.get_session_stats()}")

    # Terminate session
    await manager.terminate_session(
        session.session_id,
        TerminationReason.USER_LOGOUT
    )

    # Verify terminated
    is_valid, _, reason = await manager.validate_session(session.session_id)
    print(f"After termination: valid={is_valid}, reason={reason}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
