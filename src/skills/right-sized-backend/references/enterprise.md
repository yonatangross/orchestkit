# Scenario 3: Enterprise

**Prompt:** "Migrate 50 microservices to new auth system"
**Timeline:** 6-18 months
**Team:** 20-100 engineers across multiple teams
**Goal:** Coordinated migration without breaking production

---

## When Enterprise Patterns ARE Justified

Enterprise patterns exist because enterprise problems are real. The question is never "should we use hexagonal architecture?" -- it is "does this codebase exhibit the problems that hexagonal architecture solves?"

### Hexagonal Architecture: Justified When

| Signal | Present? | Why It Matters |
|--------|----------|----------------|
| Multiple driving adapters | Yes (HTTP, gRPC, CLI, Celery workers) | Same business logic, different entry points |
| Multiple driven adapters | Yes (Postgres, Redis, S3, external APIs) | Need to swap implementations (test, prod, migration) |
| Team boundaries align with domains | Yes (auth team, billing team, NHI team) | Teams need to change their adapters without breaking others |
| Testability requirements | Yes (SOC2 requires test coverage) | Domain logic must be testable without infrastructure |
| 3+ consumers of same business logic | Yes | Duplication is worse than abstraction |

**Hexagonal is NOT justified when:**
- You have 1 entry point (just HTTP) and 1 database
- "We might add gRPC later" (YAGNI)
- The team is < 5 and everyone touches everything

### Event Sourcing: Justified When

| Signal | Present? | Alternative |
|--------|----------|-------------|
| Regulatory audit trail required | Maybe | Audit log table (99% of cases) |
| Need to reconstruct state at any point in time | Rarely | Soft deletes + versioned records |
| Complex state machines with compensating actions | Sometimes | State machine pattern without event store |
| Financial transactions requiring reconciliation | Yes | Event sourcing earns its keep here |
| CQRS already in place and read/write models diverge | Yes | Natural extension |

**Event sourcing is a last resort**, not a first choice. Most "audit trail" requirements are satisfied by:

```sql
CREATE TABLE auth_migration_audit (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'migration_started', 'migration_completed', 'rollback'
    old_auth_system VARCHAR(50),
    new_auth_system VARCHAR(50),
    changed_by VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_service ON auth_migration_audit(service_name);
CREATE INDEX idx_audit_created ON auth_migration_audit(created_at);
```

This is 12 lines of SQL vs 2,000+ lines of event sourcing infrastructure.

## Auth Migration Architecture

For migrating 50 microservices to a new auth system, the architecture pattern that matters most is the **Strangler Fig** combined with **Feature Flags**.

### Migration Strategy: Strangler Fig

```
Phase 1: Dual-Write (Month 1-3)
  +------------------+
  |   API Gateway    |
  |  (auth proxy)    |
  +--------+---------+
           |
    +------+------+
    |             |
    v             v
  Old Auth    New Auth
  (verify)    (shadow verify + log)

Phase 2: Dual-Read (Month 3-6)
  +------------------+
  |   API Gateway    |
  |  (auth proxy)    |
  +--------+---------+
           |
    +------+------+
    |             |
    v             v
  New Auth    Old Auth
  (primary)   (fallback)

Phase 3: Cut-Over (Month 6-9)
  +------------------+
  |   API Gateway    |
  +--------+---------+
           |
           v
        New Auth
        (sole)
```

### Governance Patterns That Are Actually Necessary

Not all governance is theater. For a 50-service migration, these are essential:

#### 1. Migration Tracker (NECESSARY)

```python
# Each service registers its migration status
class MigrationStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DUAL_AUTH = "dual_auth"      # Accepts both old and new
    NEW_AUTH_PRIMARY = "primary"  # New auth primary, old fallback
    COMPLETED = "completed"
    ROLLED_BACK = "rolled_back"

# Central registry
migration_registry = {
    "user-service": MigrationStatus.COMPLETED,
    "billing-service": MigrationStatus.DUAL_AUTH,
    "nhi-scanner": MigrationStatus.NOT_STARTED,
    # ... 47 more
}
```

#### 2. Compatibility Layer (NECESSARY)

Every service needs a middleware that handles both auth systems during transition:

```python
class DualAuthMiddleware:
    """Accept tokens from both old and new auth systems."""

    def __init__(self, old_verifier, new_verifier, migration_status: MigrationStatus):
        self.old = old_verifier
        self.new = new_verifier
        self.status = migration_status

    async def verify(self, token: str) -> AuthResult:
        if self.status == MigrationStatus.COMPLETED:
            return await self.new.verify(token)

        if self.status == MigrationStatus.NEW_AUTH_PRIMARY:
            result = await self.new.verify(token)
            if result.valid:
                return result
            # Fallback to old auth
            return await self.old.verify(token)

        # DUAL_AUTH: Try new first, fall back to old
        result = await self.new.verify(token)
        if result.valid:
            metrics.increment("auth.new_system.success")
            return result

        result = await self.old.verify(token)
        if result.valid:
            metrics.increment("auth.old_system.success")
            return result

        return AuthResult(valid=False)
```

#### 3. Contract Tests Between Services (NECESSARY)

With 50 services, you cannot manually verify that service A still works with service B after migration. Contract tests automate this:

```python
# Provider side (auth-service)
class AuthServiceContract:
    """Contract that auth-service promises to fulfill."""

    def test_valid_token_returns_user_claims(self):
        token = create_test_token(user_id="test-user", roles=["admin"])
        result = verify_token(token)
        assert result.user_id == "test-user"
        assert "admin" in result.roles

    def test_expired_token_returns_401(self):
        token = create_expired_token()
        with pytest.raises(AuthError):
            verify_token(token)

    def test_token_contains_required_claims(self):
        token = create_test_token(user_id="u1")
        claims = decode_token(token)
        assert "sub" in claims
        assert "exp" in claims
        assert "iss" in claims
        assert "aud" in claims
```

#### 4. Feature Flags for Gradual Rollout (NECESSARY)

```python
# Each service checks its migration flag
MIGRATION_FLAGS = {
    "auth.new_system.enabled": True,           # Global kill switch
    "auth.new_system.user_service": True,       # Per-service
    "auth.new_system.billing_service": False,   # Not yet
    "auth.new_system.percentage": 25,           # Percentage rollout
}

async def get_auth_verifier(service_name: str) -> AuthVerifier:
    if not flags.is_enabled("auth.new_system.enabled"):
        return OldAuthVerifier()

    if flags.is_enabled(f"auth.new_system.{service_name}"):
        return NewAuthVerifier()

    if flags.get_percentage("auth.new_system.percentage") > random.randint(0, 100):
        return NewAuthVerifier()

    return OldAuthVerifier()
```

### Governance Patterns That Are THEATER

These patterns look professional but add overhead without proportional value for an auth migration:

| Pattern | Sounds Good | Reality |
|---------|-------------|---------|
| **Architecture Review Board** for every service | Consistency | Bottleneck. 50 services waiting for 5-person board. |
| **Mandatory RFC for each migration** | Documentation | 50 identical RFCs that nobody reads. One umbrella RFC suffices. |
| **Full regression suite per service** | Safety | Time-prohibitive. Contract tests + canary deploy covers 95%. |
| **Zero-downtime requirement for all 50** | Reliability | Some internal services can tolerate 30s restart. Prioritize. |

## File Tree for Auth Migration Library

The shared library that all 50 services consume:

```
auth-migration-lib/
  src/
    auth_migration/
      __init__.py
      middleware.py          # DualAuthMiddleware
      verifiers/
        __init__.py
        old_auth.py          # Legacy auth verification
        new_auth.py          # New auth verification
        interface.py         # AuthVerifier Protocol
      migration/
        status.py            # MigrationStatus enum
        registry.py          # Service registry client
        feature_flags.py     # Flag checking
      testing/
        contracts.py         # Contract test helpers
        fixtures.py          # Shared test fixtures
        tokens.py            # Test token generators
  tests/
    test_dual_auth.py
    test_migration_status.py
    test_contracts.py
  pyproject.toml
```

### Per-Service Changes (~50-100 LOC each)

Each of the 50 services adds:

```python
# 1. Install the library
# pyproject.toml: auth-migration-lib = "^1.0"

# 2. Replace auth middleware (10-20 LOC change)
# Before:
from old_auth import verify_token

# After:
from auth_migration import DualAuthMiddleware
from auth_migration.verifiers import OldAuthVerifier, NewAuthVerifier

auth_middleware = DualAuthMiddleware(
    old_verifier=OldAuthVerifier(old_jwks_url),
    new_verifier=NewAuthVerifier(new_jwks_url),
    migration_status=MigrationStatus.DUAL_AUTH,
)

# 3. Add contract tests (30-50 LOC)
from auth_migration.testing import AuthContractTest

class TestAuthContract(AuthContractTest):
    """Verify this service works with new auth."""

    def test_protected_endpoint_accepts_new_token(self):
        token = self.create_new_auth_token(user_id="test")
        response = self.client.get("/api/protected", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
```

## Observability Requirements (Non-Negotiable at Enterprise)

For a 50-service migration, you MUST have:

```python
# Every auth verification emits metrics
metrics.increment("auth.verification", tags={
    "service": service_name,
    "auth_system": "new" | "old",
    "result": "success" | "failure" | "fallback",
})

# Migration progress dashboard
metrics.gauge("auth.migration.progress", tags={
    "status": migration_status.value,
    "service": service_name,
})

# Alert: If new auth failure rate > 1% in any service
# Action: Auto-revert that service to old auth
```

Without observability, you are migrating blind. This is the one area where "we'll add it later" is categorically wrong.

## When Enterprise Complexity IS the Right Answer

| Pattern | Justified For This Migration | LOC Cost | Payoff |
|---------|------|----------|--------|
| Hexagonal (auth lib) | YES -- 50 services consume the same auth port | +500 | Swap auth without changing consumers |
| Contract tests | YES -- 50 service pairs that must be compatible | +50 per service | Catch breaking changes before deploy |
| Feature flags | YES -- gradual rollout across 50 services | +200 for lib | Instant rollback per service |
| Dual-write middleware | YES -- zero downtime migration | +300 | Both systems verified before cutover |
| Event sourcing | NO -- audit log table suffices | +2,000 avoided | N/A |
| CQRS | NO -- auth is read-heavy but model is simple | +800 avoided | N/A |
| Architecture Review Board | NO -- one umbrella RFC covers all 50 | Weekly meetings avoided | N/A |

The enterprise answer is not "use everything." It is "use the patterns that solve the specific coordination problems of large-scale migration, and skip the ones that don't."
