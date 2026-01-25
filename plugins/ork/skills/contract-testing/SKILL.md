---
name: contract-testing
description: Consumer-driven contract testing with Pact for API compatibility. Use when testing microservice integrations, verifying API contracts, preventing breaking changes, or implementing provider verification.
context: fork
agent: test-generator
version: 1.0.0
tags: [pact, contract, consumer-driven, api, microservices, testing, 2026]
author: OrchestKit
user-invocable: false
---

# Contract Testing with Pact

Ensure API compatibility between services with consumer-driven contracts.

## Contract Testing vs Integration Testing

| Integration Testing | Contract Testing |
|---------------------|------------------|
| Requires all services | Each service tests independently |
| Slow feedback loop | Fast feedback |
| Environment-dependent | Environment-independent |

## Quick Reference

### Consumer Test

```python
from pact import Consumer, Provider, Like, EachLike

pact = Consumer("UserDashboard").has_pact_with(
    Provider("UserService"), pact_dir="./pacts"
)

def test_get_user(user_service):
    (
        user_service
        .given("a user with ID user-123 exists")
        .upon_receiving("a request to get user")
        .with_request("GET", "/api/users/user-123")
        .will_respond_with(200, body={
            "id": Like("user-123"),      # Any string
            "email": Like("test@example.com"),
        })
    )

    with user_service:
        client = UserServiceClient(base_url=user_service.uri)
        user = client.get_user("user-123")
        assert user.id == "user-123"
```

See [consumer-tests.md](references/consumer-tests.md) for matchers and patterns.

### Provider Verification

```python
from pact import Verifier

def test_provider_honors_pact():
    verifier = Verifier(
        provider="UserService",
        provider_base_url="http://localhost:8000",
    )

    verifier.verify_with_broker(
        broker_url="https://pact-broker.example.com",
        consumer_version_selectors=[{"mainBranch": True}],
        publish_verification_results=True,
    )
```

See [provider-verification.md](references/provider-verification.md) for state setup.

### Pact Broker CI/CD

```bash
# Publish consumer pacts
pact-broker publish ./pacts \
  --broker-base-url=$PACT_BROKER_URL \
  --consumer-app-version=$(git rev-parse HEAD)

# Check if safe to deploy
pact-broker can-i-deploy \
  --pacticipant=UserDashboard \
  --version=$(git rev-parse HEAD) \
  --to-environment=production
```

See [pact-broker.md](references/pact-broker.md) for CI/CD integration.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Contract storage | Pact Broker (not git) |
| Consumer selectors | mainBranch + deployedOrReleased |
| Provider states | Dedicated test endpoint |
| Verification timing | After consumer publish |
| Matchers | Use Like(), EachLike() for flexibility |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER specify exact values when structure matters
.will_respond_with(200, body={
    "id": "user-123",  # WRONG - too specific
})
# Use: "id": Like("user-123")

# NEVER test provider implementation details
.given("database has 5 rows")  # WRONG
# Use: "multiple users exist"

# NEVER skip provider state setup
.given("some state")  # Must be handled!

# NEVER commit pact files to git
# Use Pact Broker for versioning
```

## Related Skills

- `integration-testing` - API endpoint testing
- `api-design-framework` - REST API design patterns
- `property-based-testing` - Hypothesis integration

## References

- [Consumer Tests](references/consumer-tests.md) - Consumer-side patterns
- [Provider Verification](references/provider-verification.md) - Provider state setup
- [Pact Broker](references/pact-broker.md) - CI/CD integration

## Capability Details

### consumer-tests
**Keywords:** consumer, pact, expectations, mock server
**Solves:** Write consumer-side tests, define expectations, generate pacts

### provider-verification
**Keywords:** provider, verify, states, verification
**Solves:** Verify provider honors contracts, set up provider states

### pact-broker
**Keywords:** broker, can-i-deploy, publish, environments
**Solves:** Share contracts, check deployment safety, manage versions

### matchers
**Keywords:** Like, EachLike, Term, matching, flexible
**Solves:** Write flexible expectations, match structure not values

### message-contracts
**Keywords:** async, events, message, MessageConsumer
**Solves:** Test async event contracts, verify event compatibility
