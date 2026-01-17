---
name: contract-testing
description: Consumer-driven contract testing with Pact for API compatibility. Use when testing microservice integrations, verifying API contracts, preventing breaking changes, or implementing provider verification.
context: fork
agent: test-generator
version: 1.0.0
tags: [pact, contract, consumer-driven, api, microservices, testing, 2026]
author: SkillForge
user-invocable: false
---

# Contract Testing with Pact

Ensure API compatibility between services with consumer-driven contracts.

## When to Use

- Multiple teams consuming the same API
- Microservice-to-microservice communication
- Preventing breaking API changes
- Testing integrations without deploying all services
- Validating API evolution across versions

## Core Concepts

### Consumer-Driven Contracts

```
+-------------------------------------------------------------------+
|                Consumer-Driven Contract Flow                       |
+-------------------------------------------------------------------+
|                                                                   |
|   CONSUMER SIDE                       PROVIDER SIDE               |
|   +------------------+                +------------------+        |
|   |  1. Write Test   |                |                  |        |
|   |  - Define        |                |                  |        |
|   |    expectations  |                |                  |        |
|   +--------+---------+                |                  |        |
|            |                          |                  |        |
|            v                          |                  |        |
|   +------------------+                |                  |        |
|   |  2. Generate     |                |                  |        |
|   |     Contract     |  ------>       |  3. Verify       |        |
|   |     (pact.json)  |  (Pact Broker) |     Contract     |        |
|   +------------------+                +--------+---------+        |
|                                                |                  |
|                                                v                  |
|                                       +------------------+        |
|                                       |  4. Deploy if    |        |
|                                       |     verified     |        |
|                                       +------------------+        |
|                                                                   |
+-------------------------------------------------------------------+
```

### Why Contract Testing?

| Integration Testing | Contract Testing |
|---------------------|------------------|
| Requires all services running | Each service tests independently |
| Slow feedback loop | Fast feedback |
| Catches issues late | Catches issues early |
| Hard to maintain | Contracts are versioned |
| Environment-dependent | Environment-independent |

## Consumer Side (Pact Python)

### Writing Consumer Tests

```python
# test_user_consumer.py
import pytest
from pact import Consumer, Provider, Like, EachLike, Term

# Create pact
pact = Consumer("UserDashboard").has_pact_with(
    Provider("UserService"),
    pact_dir="./pacts",
)

@pytest.fixture
def user_service(pact):
    """Start mock server for pact interactions."""
    pact.start_service()
    yield pact
    pact.stop_service()

def test_get_user(user_service):
    """Test getting a user by ID."""
    # Define expected interaction
    expected_user = {
        "id": "user-123",
        "email": "test@example.com",
        "name": "Test User",
        "created_at": "2024-01-15T10:30:00Z",
    }

    (
        user_service
        .given("a user with ID user-123 exists")
        .upon_receiving("a request to get user user-123")
        .with_request("GET", "/api/users/user-123")
        .will_respond_with(200, body=expected_user)
    )

    with user_service:
        # Make actual call to mock server
        client = UserServiceClient(base_url=user_service.uri)
        user = client.get_user("user-123")

        assert user.id == "user-123"
        assert user.email == "test@example.com"
```

### Flexible Matching

```python
from pact import Like, EachLike, Term, Format

def test_list_users_with_matching(user_service):
    """Test with flexible matchers."""
    (
        user_service
        .given("multiple users exist")
        .upon_receiving("a request to list users")
        .with_request("GET", "/api/users", query={"limit": "10"})
        .will_respond_with(
            200,
            body={
                # Match structure, not exact values
                "users": EachLike(
                    {
                        "id": Like("user-abc"),      # Any string
                        "email": Term(
                            r".+@.+\..+",            # Regex pattern
                            "example@test.com"       # Example value
                        ),
                        "age": Like(25),             # Any integer
                        "created_at": Format().iso_8601_datetime(),
                    },
                    minimum=1,  # At least 1 user
                ),
                "total": Like(100),
                "page": Like(1),
            }
        )
    )

    with user_service:
        client = UserServiceClient(base_url=user_service.uri)
        result = client.list_users(limit=10)
        assert len(result.users) >= 1
```

### Testing Error Scenarios

```python
def test_user_not_found(user_service):
    """Test 404 response handling."""
    (
        user_service
        .given("no user with ID unknown-id exists")
        .upon_receiving("a request for non-existent user")
        .with_request("GET", "/api/users/unknown-id")
        .will_respond_with(
            404,
            body={
                "error": "not_found",
                "message": Like("User not found"),
            }
        )
    )

    with user_service:
        client = UserServiceClient(base_url=user_service.uri)
        with pytest.raises(UserNotFoundError):
            client.get_user("unknown-id")

def test_validation_error(user_service):
    """Test 422 validation error."""
    (
        user_service
        .given("validation is enabled")
        .upon_receiving("a request with invalid email")
        .with_request(
            "POST",
            "/api/users",
            body={"email": "invalid", "name": "Test"},
        )
        .will_respond_with(
            422,
            body={
                "errors": EachLike({
                    "field": Like("email"),
                    "message": Like("Invalid email format"),
                }),
            }
        )
    )

    with user_service:
        client = UserServiceClient(base_url=user_service.uri)
        with pytest.raises(ValidationError) as exc:
            client.create_user(email="invalid", name="Test")
        assert "email" in str(exc.value)
```

## Provider Side Verification

### FastAPI Provider

```python
# test_user_provider.py
import pytest
from pact import Verifier

@pytest.fixture
def provider_states():
    """Setup provider states."""
    states = {}

    def set_state(state_name, **params):
        if state_name == "a user with ID user-123 exists":
            # Create test user in database
            user = User(id="user-123", email="test@example.com")
            states["user"] = user

        elif state_name == "no user with ID unknown-id exists":
            # Ensure user doesn't exist
            pass

        elif state_name == "multiple users exist":
            # Create multiple users
            pass

    return set_state

def test_provider_honors_pact(provider_states):
    """Verify provider satisfies consumer contracts."""
    verifier = Verifier(
        provider="UserService",
        provider_base_url="http://localhost:8000",
    )

    # Fetch pacts from broker
    verifier.verify_with_broker(
        broker_url="https://pact-broker.example.com",
        enable_pending=True,
        consumer_version_selectors=[
            {"mainBranch": True},
            {"deployedOrReleased": True},
        ],
        provider_version="1.0.0",
        provider_version_branch="main",
        publish_verification_results=True,
    )
```

### Provider State Endpoint (FastAPI)

```python
# app/routes/pact_states.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["pact"])

class ProviderState(BaseModel):
    state: str
    params: dict = {}

@router.post("/_pact/provider-states")
async def setup_provider_state(state: ProviderState, db: Session = Depends(get_db)):
    """Handle provider state setup for pact verification."""

    if state.state == "a user with ID user-123 exists":
        # Create or ensure user exists
        user = User(id="user-123", email="test@example.com", name="Test User")
        db.merge(user)
        db.commit()

    elif state.state == "no user with ID unknown-id exists":
        # Delete user if exists
        db.query(User).filter(User.id == "unknown-id").delete()
        db.commit()

    elif state.state == "multiple users exist":
        # Create test users
        for i in range(5):
            user = User(id=f"user-{i}", email=f"user{i}@test.com")
            db.merge(user)
        db.commit()

    else:
        raise HTTPException(status_code=400, detail=f"Unknown state: {state.state}")

    return {"status": "ok"}
```

## Pact Broker Integration

### CI/CD Pipeline

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on: [push, pull_request]

jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run consumer tests
        run: pytest tests/contracts/consumer/

      - name: Publish pacts to broker
        run: |
          pact-broker publish ./pacts \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }} \
            --consumer-app-version=${{ github.sha }} \
            --branch=${{ github.ref_name }}

  provider-tests:
    runs-on: ubuntu-latest
    needs: consumer-tests  # Wait for pacts to be published
    steps:
      - uses: actions/checkout@v4

      - name: Start provider service
        run: docker-compose up -d api

      - name: Verify provider
        run: |
          pytest tests/contracts/provider/ \
            --provider-version=${{ github.sha }} \
            --publish-verification

  can-i-deploy:
    runs-on: ubuntu-latest
    needs: [consumer-tests, provider-tests]
    steps:
      - name: Check can-i-deploy
        run: |
          pact-broker can-i-deploy \
            --pacticipant=UserDashboard \
            --version=${{ github.sha }} \
            --to-environment=production
```

### Pact Broker Commands

```bash
# Publish pact files
pact-broker publish ./pacts \
  --broker-base-url=https://pact-broker.example.com \
  --consumer-app-version=$(git rev-parse HEAD) \
  --branch=$(git branch --show-current)

# Check if safe to deploy
pact-broker can-i-deploy \
  --pacticipant=UserDashboard \
  --version=$(git rev-parse HEAD) \
  --to-environment=production

# Record deployment
pact-broker record-deployment \
  --pacticipant=UserDashboard \
  --version=$(git rev-parse HEAD) \
  --environment=production

# List latest pacts
pact-broker list-latest-pact-versions \
  --broker-base-url=https://pact-broker.example.com
```

## Message Contracts (Async)

### Async Event Contracts

```python
from pact import MessageConsumer, MessageProvider

def test_user_created_event_consumer():
    """Consumer test for UserCreated event."""
    pact = MessageConsumer("EmailService").has_pact_with(
        MessageProvider("UserService"),
        pact_dir="./pacts",
    )

    expected_event = {
        "event_type": "user.created",
        "payload": {
            "user_id": Like("user-123"),
            "email": Term(r".+@.+", "test@example.com"),
            "created_at": Format().iso_8601_datetime(),
        },
    }

    (
        pact
        .given("a user is created")
        .expects_to_receive("a UserCreated event")
        .with_content(expected_event)
    )

    with pact:
        # Test event handler
        handler = UserCreatedHandler()
        event = pact.generate_content()
        result = handler.handle(event)
        assert result.success

def test_user_created_event_provider():
    """Provider verification for UserCreated event."""
    def message_producer():
        """Produce the actual event."""
        user = User.create(email="test@example.com")
        return UserCreatedEvent(
            event_type="user.created",
            payload={
                "user_id": user.id,
                "email": user.email,
                "created_at": user.created_at.isoformat(),
            },
        ).dict()

    verifier = MessageProvider(
        "UserService",
        message_providers={"a UserCreated event": message_producer},
    )

    verifier.verify()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Contract storage | Pact Broker (not git) |
| Consumer selectors | mainBranch + deployedOrReleased |
| Provider states | Dedicated test endpoint |
| Verification timing | After consumer publish |
| Pending pacts | Enable for new consumers |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER specify exact values when structure matters
.will_respond_with(
    200,
    body={
        "id": "user-123",  # WRONG - too specific
        "created_at": "2024-01-15T10:00:00Z",  # WRONG - exact timestamp
    }
)
# Use Like() and Term() matchers instead

# NEVER test provider implementation details
.given("database has 5 rows")  # WRONG - implementation detail
# Use business states: "multiple users exist"

# NEVER share provider states between tests
states = {"user": None}  # WRONG - shared mutable state

def setup_state(name):
    states["user"] = User(...)  # WRONG - leaks between tests

# NEVER skip provider state setup
.given("some complex state")  # Must be handled in provider!
# If state is ignored, verification passes incorrectly

# NEVER commit pact files to git
# Use Pact Broker for:
# - Versioning
# - can-i-deploy checks
# - Visualization
```

## Related Skills

- `integration-testing` - API endpoint testing
- `api-design-framework` - REST API design patterns
- `message-queues` - Async messaging patterns
- `unit-testing` - Basic testing patterns

## Capability Details

### consumer-tests
**Keywords:** consumer, pact, expectations, mock server
**Solves:**
- How do I write consumer-side contract tests?
- Define API expectations from consumer perspective
- Generate pact contracts

### provider-verification
**Keywords:** provider, verify, states, verification
**Solves:**
- How do I verify my provider honors contracts?
- Set up provider states for testing
- Publish verification results

### pact-broker
**Keywords:** broker, can-i-deploy, publish, environments
**Solves:**
- How do I share contracts between teams?
- Check deployment safety with can-i-deploy
- Manage contract versions

### matchers
**Keywords:** Like, EachLike, Term, matching, flexible
**Solves:**
- How do I write flexible contract expectations?
- Match structure without exact values
- Use regex patterns for validation

### message-contracts
**Keywords:** async, events, message, MessageConsumer, MessageProvider
**Solves:**
- How do I test async event contracts?
- Verify event producer/consumer compatibility
- Test message-driven architectures
