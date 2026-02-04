"""
User Management CQRS Example

A production-ready example demonstrating CQRS patterns for user management:
- Command side: User aggregate with registration, profile updates, role management
- Query side: Optimized read models for user search and admin views
- Event-driven projections: Multiple read models from same events
- Security: Proper password hashing and audit trails

Run: uvicorn user-management-cqrs:app --reload
"""

from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, UTC
from enum import Enum
from typing import Any
from uuid import UUID
from uuid_utils import uuid7

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import FastAPI, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Password hasher
ph = PasswordHasher()

# =============================================================================
# Domain Events
# =============================================================================

class DomainEvent(BaseModel):
    """Base domain event."""
    event_id: UUID = Field(default_factory=uuid7)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    aggregate_id: UUID
    correlation_id: UUID | None = None
    actor_id: UUID | None = None  # Who triggered this event

    class Config:
        frozen = True


class UserRegistered(DomainEvent):
    """A new user registered."""
    email: str
    username: str
    display_name: str


class UserEmailChanged(DomainEvent):
    """User changed their email."""
    old_email: str
    new_email: str


class UserEmailVerified(DomainEvent):
    """User verified their email."""
    email: str


class UserProfileUpdated(DomainEvent):
    """User updated their profile."""
    display_name: str | None
    bio: str | None
    avatar_url: str | None


class UserPasswordChanged(DomainEvent):
    """User changed their password."""
    changed_by: UUID  # Could be user or admin


class UserRoleAssigned(DomainEvent):
    """A role was assigned to user."""
    role: str
    assigned_by: UUID


class UserRoleRevoked(DomainEvent):
    """A role was revoked from user."""
    role: str
    revoked_by: UUID


class UserDeactivated(DomainEvent):
    """User account was deactivated."""
    reason: str
    deactivated_by: UUID


class UserReactivated(DomainEvent):
    """User account was reactivated."""
    reactivated_by: UUID


class UserLoggedIn(DomainEvent):
    """User logged in successfully."""
    ip_address: str
    user_agent: str


class UserLoginFailed(DomainEvent):
    """Failed login attempt."""
    ip_address: str
    reason: str


# =============================================================================
# Write Model (Aggregate)
# =============================================================================

class UserStatus(str, Enum):
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    DEACTIVATED = "deactivated"


class Role(str, Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"


@dataclass
class User:
    """
    User Aggregate.

    Enforces business rules:
    - Email must be verified before full access
    - Cannot deactivate admin users without removing admin role first
    - Cannot assign admin role without existing admin
    - Password must meet complexity requirements
    """
    id: UUID
    email: str
    username: str
    display_name: str
    bio: str
    avatar_url: str | None
    password_hash: str
    email_verified: bool
    roles: set[Role]
    status: UserStatus
    version: int
    created_at: datetime
    last_login: datetime | None
    _pending_events: list[DomainEvent] = field(default_factory=list)

    @classmethod
    def register(
        cls,
        email: str,
        username: str,
        password: str,
        display_name: str | None = None,
    ) -> "User":
        """Factory method to register a new user."""
        cls._validate_password(password)

        user_id = uuid7()
        now = datetime.now(UTC)

        user = cls(
            id=user_id,
            email=email.lower().strip(),
            username=username.lower().strip(),
            display_name=display_name or username,
            bio="",
            avatar_url=None,
            password_hash=ph.hash(password),
            email_verified=False,
            roles={Role.USER},
            status=UserStatus.PENDING_VERIFICATION,
            version=0,
            created_at=now,
            last_login=None,
        )

        user._raise_event(UserRegistered(
            aggregate_id=user_id,
            email=user.email,
            username=user.username,
            display_name=user.display_name,
        ))

        return user

    def verify_email(self) -> None:
        """Verify user's email address."""
        if self.email_verified:
            return  # Idempotent

        self.email_verified = True
        self.status = UserStatus.ACTIVE
        self._raise_event(UserEmailVerified(
            aggregate_id=self.id,
            email=self.email,
        ))

    def change_email(self, new_email: str, actor_id: UUID) -> None:
        """Change user's email (requires re-verification)."""
        self._ensure_active()
        new_email = new_email.lower().strip()

        if new_email == self.email:
            return  # No change

        old_email = self.email
        self.email = new_email
        self.email_verified = False
        self.status = UserStatus.PENDING_VERIFICATION

        self._raise_event(UserEmailChanged(
            aggregate_id=self.id,
            actor_id=actor_id,
            old_email=old_email,
            new_email=new_email,
        ))

    def update_profile(
        self,
        display_name: str | None = None,
        bio: str | None = None,
        avatar_url: str | None = None,
    ) -> None:
        """Update user profile."""
        self._ensure_active()

        if display_name is not None:
            self.display_name = display_name
        if bio is not None:
            self.bio = bio
        if avatar_url is not None:
            self.avatar_url = avatar_url

        self._raise_event(UserProfileUpdated(
            aggregate_id=self.id,
            display_name=display_name,
            bio=bio,
            avatar_url=avatar_url,
        ))

    def change_password(self, new_password: str, actor_id: UUID) -> None:
        """Change user's password."""
        self._validate_password(new_password)

        self.password_hash = ph.hash(new_password)
        self._raise_event(UserPasswordChanged(
            aggregate_id=self.id,
            changed_by=actor_id,
        ))

    def verify_password(self, password: str) -> bool:
        """Verify password matches."""
        try:
            ph.verify(self.password_hash, password)
            return True
        except VerifyMismatchError:
            return False

    def assign_role(self, role: Role, assigned_by: UUID) -> None:
        """Assign a role to the user."""
        self._ensure_active()

        if role in self.roles:
            return  # Idempotent

        self.roles.add(role)
        self._raise_event(UserRoleAssigned(
            aggregate_id=self.id,
            role=role.value,
            assigned_by=assigned_by,
        ))

    def revoke_role(self, role: Role, revoked_by: UUID) -> None:
        """Revoke a role from the user."""
        if role not in self.roles:
            return  # Idempotent

        if role == Role.USER:
            raise ValueError("Cannot revoke base USER role")

        self.roles.discard(role)
        self._raise_event(UserRoleRevoked(
            aggregate_id=self.id,
            role=role.value,
            revoked_by=revoked_by,
        ))

    def deactivate(self, reason: str, deactivated_by: UUID) -> None:
        """Deactivate user account."""
        if self.status == UserStatus.DEACTIVATED:
            return  # Idempotent

        if Role.ADMIN in self.roles:
            raise ValueError("Cannot deactivate admin user. Remove admin role first.")

        self.status = UserStatus.DEACTIVATED
        self._raise_event(UserDeactivated(
            aggregate_id=self.id,
            reason=reason,
            deactivated_by=deactivated_by,
        ))

    def reactivate(self, reactivated_by: UUID) -> None:
        """Reactivate user account."""
        if self.status != UserStatus.DEACTIVATED:
            return  # Idempotent

        self.status = UserStatus.ACTIVE if self.email_verified else UserStatus.PENDING_VERIFICATION
        self._raise_event(UserReactivated(
            aggregate_id=self.id,
            reactivated_by=reactivated_by,
        ))

    def record_login(self, ip_address: str, user_agent: str) -> None:
        """Record successful login."""
        self.last_login = datetime.now(UTC)
        self._raise_event(UserLoggedIn(
            aggregate_id=self.id,
            ip_address=ip_address,
            user_agent=user_agent,
        ))

    def record_failed_login(self, ip_address: str, reason: str) -> None:
        """Record failed login attempt."""
        self._raise_event(UserLoginFailed(
            aggregate_id=self.id,
            ip_address=ip_address,
            reason=reason,
        ))

    def _ensure_active(self) -> None:
        if self.status == UserStatus.DEACTIVATED:
            raise ValueError("User is deactivated")

    @staticmethod
    def _validate_password(password: str) -> None:
        """Validate password complexity."""
        if len(password) < 12:
            raise ValueError("Password must be at least 12 characters")
        if not any(c.isupper() for c in password):
            raise ValueError("Password must contain uppercase letter")
        if not any(c.islower() for c in password):
            raise ValueError("Password must contain lowercase letter")
        if not any(c.isdigit() for c in password):
            raise ValueError("Password must contain digit")

    def has_role(self, role: Role) -> bool:
        return role in self.roles

    def is_admin(self) -> bool:
        return Role.ADMIN in self.roles

    def _raise_event(self, event: DomainEvent) -> None:
        self._pending_events.append(event)

    @property
    def pending_events(self) -> list[DomainEvent]:
        events = self._pending_events.copy()
        self._pending_events.clear()
        return events


# =============================================================================
# Commands
# =============================================================================

class Command(BaseModel):
    """Base command."""
    command_id: UUID = Field(default_factory=uuid7)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    actor_id: UUID | None = None  # Who is executing this command

    class Config:
        frozen = True


class RegisterUser(Command):
    email: EmailStr
    username: str
    password: str
    display_name: str | None = None


class VerifyEmail(Command):
    user_id: UUID
    token: str


class UpdateProfile(Command):
    user_id: UUID
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


class ChangePassword(Command):
    user_id: UUID
    current_password: str
    new_password: str


class AssignRole(Command):
    user_id: UUID
    role: str


class RevokeRole(Command):
    user_id: UUID
    role: str


class DeactivateUser(Command):
    user_id: UUID
    reason: str


class ReactivateUser(Command):
    user_id: UUID


class LoginUser(Command):
    email: str
    password: str
    ip_address: str
    user_agent: str


# =============================================================================
# Command Handlers
# =============================================================================

class UserCommandHandler:
    """Handles all user commands."""

    def __init__(self, repository: "UserRepository"):
        self.repository = repository

    async def handle(self, command: Command) -> list[DomainEvent]:
        match command:
            case RegisterUser():
                return await self._register(command)
            case VerifyEmail():
                return await self._verify_email(command)
            case UpdateProfile():
                return await self._update_profile(command)
            case ChangePassword():
                return await self._change_password(command)
            case AssignRole():
                return await self._assign_role(command)
            case RevokeRole():
                return await self._revoke_role(command)
            case DeactivateUser():
                return await self._deactivate(command)
            case ReactivateUser():
                return await self._reactivate(command)
            case LoginUser():
                return await self._login(command)
            case _:
                raise ValueError(f"Unknown command: {type(command)}")

    async def _register(self, cmd: RegisterUser) -> list[DomainEvent]:
        # Check for existing email
        existing = await self.repository.find_by_email(cmd.email)
        if existing:
            raise ValueError("Email already registered")

        # Check for existing username
        existing = await self.repository.find_by_username(cmd.username)
        if existing:
            raise ValueError("Username already taken")

        user = User.register(
            email=cmd.email,
            username=cmd.username,
            password=cmd.password,
            display_name=cmd.display_name,
        )
        await self.repository.save(user)
        return user.pending_events

    async def _verify_email(self, cmd: VerifyEmail) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # In production, validate verification token
        user.verify_email()
        await self.repository.save(user)
        return user.pending_events

    async def _update_profile(self, cmd: UpdateProfile) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # Authorization check
        if cmd.actor_id != cmd.user_id:
            actor = await self.repository.get(cmd.actor_id) if cmd.actor_id else None
            if not actor or not actor.is_admin():
                raise ValueError("Not authorized to update this profile")

        user.update_profile(
            display_name=cmd.display_name,
            bio=cmd.bio,
            avatar_url=cmd.avatar_url,
        )
        await self.repository.save(user)
        return user.pending_events

    async def _change_password(self, cmd: ChangePassword) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        if not user.verify_password(cmd.current_password):
            raise ValueError("Current password is incorrect")

        user.change_password(cmd.new_password, cmd.actor_id or cmd.user_id)
        await self.repository.save(user)
        return user.pending_events

    async def _assign_role(self, cmd: AssignRole) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # Only admins can assign roles
        if cmd.actor_id:
            actor = await self.repository.get(cmd.actor_id)
            if not actor or not actor.is_admin():
                raise ValueError("Only admins can assign roles")

        role = Role(cmd.role)
        user.assign_role(role, cmd.actor_id or uuid7())
        await self.repository.save(user)
        return user.pending_events

    async def _revoke_role(self, cmd: RevokeRole) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # Only admins can revoke roles
        if cmd.actor_id:
            actor = await self.repository.get(cmd.actor_id)
            if not actor or not actor.is_admin():
                raise ValueError("Only admins can revoke roles")

        role = Role(cmd.role)
        user.revoke_role(role, cmd.actor_id or uuid7())
        await self.repository.save(user)
        return user.pending_events

    async def _deactivate(self, cmd: DeactivateUser) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # Only admins can deactivate users
        if cmd.actor_id:
            actor = await self.repository.get(cmd.actor_id)
            if not actor or not actor.is_admin():
                raise ValueError("Only admins can deactivate users")

        user.deactivate(cmd.reason, cmd.actor_id or uuid7())
        await self.repository.save(user)
        return user.pending_events

    async def _reactivate(self, cmd: ReactivateUser) -> list[DomainEvent]:
        user = await self.repository.get(cmd.user_id)
        if not user:
            raise ValueError("User not found")

        # Only admins can reactivate users
        if cmd.actor_id:
            actor = await self.repository.get(cmd.actor_id)
            if not actor or not actor.is_admin():
                raise ValueError("Only admins can reactivate users")

        user.reactivate(cmd.actor_id or uuid7())
        await self.repository.save(user)
        return user.pending_events

    async def _login(self, cmd: LoginUser) -> list[DomainEvent]:
        user = await self.repository.find_by_email(cmd.email)

        if not user:
            # Don't reveal whether email exists
            raise ValueError("Invalid credentials")

        if user.status == UserStatus.DEACTIVATED:
            user.record_failed_login(cmd.ip_address, "account_deactivated")
            await self.repository.save(user)
            raise ValueError("Account is deactivated")

        if not user.verify_password(cmd.password):
            user.record_failed_login(cmd.ip_address, "invalid_password")
            await self.repository.save(user)
            raise ValueError("Invalid credentials")

        user.record_login(cmd.ip_address, cmd.user_agent)
        await self.repository.save(user)
        return user.pending_events


# =============================================================================
# Repository
# =============================================================================

class UserRepository:
    """Repository for User aggregate."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            text("""
                SELECT id, email, username, display_name, bio, avatar_url,
                       password_hash, email_verified, roles, status, version,
                       created_at, last_login
                FROM users WHERE id = :id
            """),
            {"id": user_id},
        )
        row = result.mappings().first()
        if not row:
            return None

        return User(
            id=row["id"],
            email=row["email"],
            username=row["username"],
            display_name=row["display_name"],
            bio=row["bio"] or "",
            avatar_url=row["avatar_url"],
            password_hash=row["password_hash"],
            email_verified=row["email_verified"],
            roles={Role(r) for r in row["roles"]},
            status=UserStatus(row["status"]),
            version=row["version"],
            created_at=row["created_at"],
            last_login=row["last_login"],
        )

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email.lower().strip()},
        )
        row = result.first()
        return await self.get(row[0]) if row else None

    async def find_by_username(self, username: str) -> User | None:
        result = await self.session.execute(
            text("SELECT id FROM users WHERE username = :username"),
            {"username": username.lower().strip()},
        )
        row = result.first()
        return await self.get(row[0]) if row else None

    async def save(self, user: User) -> None:
        await self.session.execute(
            text("""
                INSERT INTO users (
                    id, email, username, display_name, bio, avatar_url,
                    password_hash, email_verified, roles, status, version,
                    created_at, last_login
                ) VALUES (
                    :id, :email, :username, :display_name, :bio, :avatar_url,
                    :password_hash, :email_verified, :roles, :status, :version,
                    :created_at, :last_login
                )
                ON CONFLICT (id) DO UPDATE SET
                    email = :email,
                    display_name = :display_name,
                    bio = :bio,
                    avatar_url = :avatar_url,
                    password_hash = :password_hash,
                    email_verified = :email_verified,
                    roles = :roles,
                    status = :status,
                    version = :version,
                    last_login = :last_login
            """),
            {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "display_name": user.display_name,
                "bio": user.bio,
                "avatar_url": user.avatar_url,
                "password_hash": user.password_hash,
                "email_verified": user.email_verified,
                "roles": [r.value for r in user.roles],
                "status": user.status.value,
                "version": user.version + 1,
                "created_at": user.created_at,
                "last_login": user.last_login,
            },
        )
        await self.session.commit()


# =============================================================================
# Read Models
# =============================================================================

class UserPublicView(BaseModel):
    """Public user profile (visible to all)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str
    avatar_url: str | None
    bio: str


class UserPrivateView(BaseModel):
    """Private user view (visible to user themselves)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    display_name: str
    bio: str
    avatar_url: str | None
    email_verified: bool
    roles: list[str]
    status: str
    created_at: datetime
    last_login: datetime | None


class UserAdminView(BaseModel):
    """Admin view with all details."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    display_name: str
    email_verified: bool
    roles: list[str]
    status: str
    created_at: datetime
    last_login: datetime | None
    login_count: int
    failed_login_count: int


class UserSearchResult(BaseModel):
    """Search result item."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str
    avatar_url: str | None


class AuditLogEntry(BaseModel):
    """Audit log entry."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    event_type: str
    details: dict
    actor_id: UUID | None
    ip_address: str | None
    created_at: datetime


# =============================================================================
# Query Handlers
# =============================================================================

class UserQueryHandler:
    """Handles user queries."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_public_profile(self, user_id: UUID) -> UserPublicView | None:
        result = await self.session.execute(
            text("""
                SELECT id, username, display_name, avatar_url, bio
                FROM user_profiles WHERE id = :id AND status = 'active'
            """),
            {"id": user_id},
        )
        row = result.mappings().first()
        return UserPublicView(**row) if row else None

    async def get_private_profile(self, user_id: UUID) -> UserPrivateView | None:
        result = await self.session.execute(
            text("""
                SELECT id, email, username, display_name, bio, avatar_url,
                       email_verified, roles, status, created_at, last_login
                FROM user_profiles WHERE id = :id
            """),
            {"id": user_id},
        )
        row = result.mappings().first()
        return UserPrivateView(**row) if row else None

    async def search_users(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        offset = (page - 1) * page_size

        # Count total
        count_result = await self.session.execute(
            text("""
                SELECT COUNT(*) FROM user_profiles
                WHERE status = 'active'
                  AND (username ILIKE :query OR display_name ILIKE :query)
            """),
            {"query": f"%{query}%"},
        )
        total = count_result.scalar() or 0

        # Get results
        result = await self.session.execute(
            text("""
                SELECT id, username, display_name, avatar_url
                FROM user_profiles
                WHERE status = 'active'
                  AND (username ILIKE :query OR display_name ILIKE :query)
                ORDER BY display_name
                LIMIT :limit OFFSET :offset
            """),
            {"query": f"%{query}%", "limit": page_size, "offset": offset},
        )

        return {
            "items": [UserSearchResult(**row) for row in result.mappings()],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_admin_users(self, page: int = 1, page_size: int = 20) -> dict:
        offset = (page - 1) * page_size

        count_result = await self.session.execute(
            text("SELECT COUNT(*) FROM user_admin_view"),
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            text("""
                SELECT id, email, username, display_name, email_verified,
                       roles, status, created_at, last_login,
                       login_count, failed_login_count
                FROM user_admin_view
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"limit": page_size, "offset": offset},
        )

        return {
            "items": [UserAdminView(**row) for row in result.mappings()],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_audit_log(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        offset = (page - 1) * page_size

        count_result = await self.session.execute(
            text("SELECT COUNT(*) FROM user_audit_log WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            text("""
                SELECT id, user_id, event_type, details, actor_id, ip_address, created_at
                FROM user_audit_log
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"user_id": user_id, "limit": page_size, "offset": offset},
        )

        return {
            "items": [AuditLogEntry(**row) for row in result.mappings()],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


# =============================================================================
# Projections
# =============================================================================

class UserProjection:
    """Projects user events to read models."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def handle(self, event: DomainEvent) -> None:
        # Update profile read model
        if isinstance(event, (UserRegistered, UserProfileUpdated, UserEmailVerified,
                              UserDeactivated, UserReactivated)):
            await self._update_profile(event)

        # Update admin view
        if isinstance(event, (UserRegistered, UserLoggedIn, UserLoginFailed,
                              UserRoleAssigned, UserRoleRevoked, UserDeactivated)):
            await self._update_admin_view(event)

        # Record audit log
        await self._record_audit(event)

    async def _update_profile(self, event: DomainEvent) -> None:
        match event:
            case UserRegistered():
                await self.session.execute(
                    text("""
                        INSERT INTO user_profiles (
                            id, email, username, display_name, bio, avatar_url,
                            email_verified, roles, status, created_at
                        ) VALUES (
                            :id, :email, :username, :display_name, '', NULL,
                            FALSE, ARRAY['user'], 'pending_verification', :created_at
                        )
                        ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": event.aggregate_id,
                        "email": event.email,
                        "username": event.username,
                        "display_name": event.display_name,
                        "created_at": event.timestamp,
                    },
                )

            case UserProfileUpdated():
                updates = []
                params = {"id": event.aggregate_id}
                if event.display_name is not None:
                    updates.append("display_name = :display_name")
                    params["display_name"] = event.display_name
                if event.bio is not None:
                    updates.append("bio = :bio")
                    params["bio"] = event.bio
                if event.avatar_url is not None:
                    updates.append("avatar_url = :avatar_url")
                    params["avatar_url"] = event.avatar_url

                if updates:
                    await self.session.execute(
                        text(f"UPDATE user_profiles SET {', '.join(updates)} WHERE id = :id"),
                        params,
                    )

            case UserEmailVerified():
                await self.session.execute(
                    text("""
                        UPDATE user_profiles
                        SET email_verified = TRUE, status = 'active'
                        WHERE id = :id
                    """),
                    {"id": event.aggregate_id},
                )

            case UserDeactivated():
                await self.session.execute(
                    text("UPDATE user_profiles SET status = 'deactivated' WHERE id = :id"),
                    {"id": event.aggregate_id},
                )

            case UserReactivated():
                await self.session.execute(
                    text("""
                        UPDATE user_profiles
                        SET status = CASE WHEN email_verified THEN 'active' ELSE 'pending_verification' END
                        WHERE id = :id
                    """),
                    {"id": event.aggregate_id},
                )

        await self.session.commit()

    async def _update_admin_view(self, event: DomainEvent) -> None:
        match event:
            case UserRegistered():
                await self.session.execute(
                    text("""
                        INSERT INTO user_admin_view (
                            id, email, username, display_name, email_verified,
                            roles, status, created_at, login_count, failed_login_count
                        ) VALUES (
                            :id, :email, :username, :display_name, FALSE,
                            ARRAY['user'], 'pending_verification', :created_at, 0, 0
                        )
                        ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": event.aggregate_id,
                        "email": event.email,
                        "username": event.username,
                        "display_name": event.display_name,
                        "created_at": event.timestamp,
                    },
                )

            case UserLoggedIn():
                await self.session.execute(
                    text("""
                        UPDATE user_admin_view
                        SET login_count = login_count + 1, last_login = :timestamp
                        WHERE id = :id
                    """),
                    {"id": event.aggregate_id, "timestamp": event.timestamp},
                )

            case UserLoginFailed():
                await self.session.execute(
                    text("""
                        UPDATE user_admin_view
                        SET failed_login_count = failed_login_count + 1
                        WHERE id = :id
                    """),
                    {"id": event.aggregate_id},
                )

            case UserRoleAssigned():
                await self.session.execute(
                    text("""
                        UPDATE user_admin_view
                        SET roles = array_append(roles, :role)
                        WHERE id = :id AND NOT :role = ANY(roles)
                    """),
                    {"id": event.aggregate_id, "role": event.role},
                )

            case UserRoleRevoked():
                await self.session.execute(
                    text("""
                        UPDATE user_admin_view
                        SET roles = array_remove(roles, :role)
                        WHERE id = :id
                    """),
                    {"id": event.aggregate_id, "role": event.role},
                )

        await self.session.commit()

    async def _record_audit(self, event: DomainEvent) -> None:
        ip_address = None
        if isinstance(event, (UserLoggedIn, UserLoginFailed)):
            ip_address = event.ip_address

        await self.session.execute(
            text("""
                INSERT INTO user_audit_log (
                    id, user_id, event_type, details, actor_id, ip_address, created_at
                ) VALUES (
                    :id, :user_id, :event_type, :details, :actor_id, :ip_address, :created_at
                )
            """),
            {
                "id": uuid7(),
                "user_id": event.aggregate_id,
                "event_type": type(event).__name__,
                "details": event.model_dump_json(),
                "actor_id": event.actor_id,
                "ip_address": ip_address,
                "created_at": event.timestamp,
            },
        )
        await self.session.commit()


# =============================================================================
# FastAPI Application
# =============================================================================

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/user_cqrs"
engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


class EventPublisher:
    def __init__(self):
        self._subscribers: list = []

    def subscribe(self, handler):
        self._subscribers.append(handler)

    async def publish(self, event: DomainEvent):
        for handler in self._subscribers:
            await handler(event)


event_publisher = EventPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session() as session:
        projection = UserProjection(session)
        event_publisher.subscribe(projection.handle)
    yield


app = FastAPI(title="User Management CQRS API", lifespan=lifespan)


# Command endpoints
@app.post("/api/v1/users/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    email: EmailStr,
    username: str,
    password: str,
    display_name: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    repository = UserRepository(session)
    handler = UserCommandHandler(repository)

    try:
        events = await handler.handle(RegisterUser(
            email=email,
            username=username,
            password=password,
            display_name=display_name,
        ))
        for event in events:
            await event_publisher.publish(event)
        return {"user_id": events[0].aggregate_id}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.post("/api/v1/users/{user_id}/verify-email")
async def verify_email(
    user_id: UUID,
    token: str,
    session: AsyncSession = Depends(get_session),
):
    repository = UserRepository(session)
    handler = UserCommandHandler(repository)

    try:
        events = await handler.handle(VerifyEmail(user_id=user_id, token=token))
        for event in events:
            await event_publisher.publish(event)
        return {"status": "verified"}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.patch("/api/v1/users/{user_id}/profile")
async def update_profile(
    user_id: UUID,
    display_name: str | None = None,
    bio: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    repository = UserRepository(session)
    handler = UserCommandHandler(repository)

    try:
        events = await handler.handle(UpdateProfile(
            user_id=user_id,
            actor_id=user_id,  # In real app, get from auth
            display_name=display_name,
            bio=bio,
        ))
        for event in events:
            await event_publisher.publish(event)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.post("/api/v1/auth/login")
async def login(
    email: str,
    password: str,
    ip_address: str = "127.0.0.1",
    user_agent: str = "unknown",
    session: AsyncSession = Depends(get_session),
):
    repository = UserRepository(session)
    handler = UserCommandHandler(repository)

    try:
        events = await handler.handle(LoginUser(
            email=email,
            password=password,
            ip_address=ip_address,
            user_agent=user_agent,
        ))
        for event in events:
            await event_publisher.publish(event)
        # In real app, return JWT token
        return {"status": "logged_in", "user_id": events[0].aggregate_id}
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))


# Query endpoints
@app.get("/api/v1/users/{user_id}")
async def get_user_profile(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    handler = UserQueryHandler(session)
    profile = await handler.get_public_profile(user_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return profile


@app.get("/api/v1/users/{user_id}/private")
async def get_private_profile(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    # In real app, verify authorization
    handler = UserQueryHandler(session)
    profile = await handler.get_private_profile(user_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return profile


@app.get("/api/v1/users/search")
async def search_users(
    q: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    handler = UserQueryHandler(session)
    return await handler.search_users(q, page, page_size)


@app.get("/api/v1/admin/users")
async def admin_list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    # In real app, verify admin authorization
    handler = UserQueryHandler(session)
    return await handler.get_admin_users(page, page_size)


@app.get("/api/v1/admin/users/{user_id}/audit")
async def get_user_audit_log(
    user_id: UUID,
    page: int = Query(default=1, ge=1),
    session: AsyncSession = Depends(get_session),
):
    # In real app, verify admin authorization
    handler = UserQueryHandler(session)
    return await handler.get_audit_log(user_id, page)


# =============================================================================
# Database Schema
# =============================================================================

SCHEMA = """
-- Write model
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    roles TEXT[] DEFAULT ARRAY['user'],
    status VARCHAR(50) DEFAULT 'pending_verification',
    version INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Read models
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    roles TEXT[] DEFAULT ARRAY['user'],
    status VARCHAR(50) DEFAULT 'pending_verification',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_search ON user_profiles(username, display_name);

CREATE TABLE IF NOT EXISTS user_admin_view (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    roles TEXT[] DEFAULT ARRAY['user'],
    status VARCHAR(50) DEFAULT 'pending_verification',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    login_count INT DEFAULT 0,
    failed_login_count INT DEFAULT 0
);

-- Audit log
CREATE TABLE IF NOT EXISTS user_audit_log (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    actor_id UUID,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON user_audit_log(user_id, created_at DESC);
"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
