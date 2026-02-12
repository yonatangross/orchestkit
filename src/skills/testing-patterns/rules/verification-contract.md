---
title: "Verification: Contract Testing"
category: verification
impact: MEDIUM
---

# Contract Testing with Pact

## Consumer Test

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
            "id": Like("user-123"),
            "email": Like("test@example.com"),
        })
    )

    with user_service:
        client = UserServiceClient(base_url=user_service.uri)
        user = client.get_user("user-123")
        assert user.id == "user-123"
```

## Provider Verification

```python
def test_provider_honors_pact():
    verifier = Verifier(
        provider="UserService",
        provider_base_url="http://localhost:8000",
    )
    verifier.verify_with_broker(
        broker_url="https://pact-broker.example.com",
        consumer_version_selectors=[{"mainBranch": True}],
    )
```

## CI/CD Integration

```bash
pact-broker publish ./pacts \
  --broker-base-url=$PACT_BROKER_URL \
  --consumer-app-version=$(git rev-parse HEAD)

pact-broker can-i-deploy \
  --pacticipant=UserDashboard \
  --version=$(git rev-parse HEAD) \
  --to-environment=production
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Contract storage | Pact Broker (not git) |
| Consumer selectors | mainBranch + deployedOrReleased |
| Matchers | Use Like(), EachLike() for flexibility |
