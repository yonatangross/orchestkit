# Provider Verification

## FastAPI Provider Setup

```python
# tests/contracts/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, TestSessionLocal

@pytest.fixture
def test_client():
    """Create test client with test database."""
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)
```

## Provider State Handler

```python
# tests/contracts/provider_states.py
from app.models import User, Order, Product
from app.database import TestSessionLocal

class ProviderStateManager:
    """Manage provider states for contract verification."""

    def __init__(self):
        self.db = TestSessionLocal()
        self.handlers = {
            "user USR-001 exists": self._create_user,
            "order ORD-001 exists with user USR-001": self._create_order,
            "product PROD-001 has 10 items in stock": self._create_product,
            "no users exist": self._clear_users,
        }

    def setup(self, state: str, params: dict = None):
        """Setup provider state."""
        handler = self.handlers.get(state)
        if not handler:
            raise ValueError(f"Unknown state: {state}")
        handler(params or {})
        self.db.commit()

    def teardown(self):
        """Clean up after verification."""
        self.db.rollback()
        self.db.close()

    def _create_user(self, params: dict):
        user = User(
            id="USR-001",
            email="user@example.com",
            name="Test User",
        )
        self.db.merge(user)

    def _create_order(self, params: dict):
        self._create_user({})
        order = Order(
            id="ORD-001",
            user_id="USR-001",
            status="pending",
        )
        self.db.merge(order)

    def _create_product(self, params: dict):
        product = Product(
            id="PROD-001",
            name="Test Product",
            stock=10,
            price=29.99,
        )
        self.db.merge(product)

    def _clear_users(self, params: dict):
        self.db.query(User).delete()
```

## Verification Test

```python
# tests/contracts/test_provider.py
import pytest
from pact import Verifier

@pytest.fixture
def provider_state_manager():
    manager = ProviderStateManager()
    yield manager
    manager.teardown()

def test_provider_honors_contracts(provider_state_manager, test_client):
    """Verify provider satisfies all consumer contracts."""

    def state_setup(name: str, params: dict):
        provider_state_manager.setup(name, params)

    verifier = Verifier(
        provider="UserService",
        provider_base_url="http://testserver",
    )

    # Verify from local pact files (CI) or broker (production)
    success, logs = verifier.verify_pacts(
        "./pacts/orderservice-userservice.json",
        provider_states_setup_url="http://testserver/_pact/setup",
    )

    assert success, f"Pact verification failed: {logs}"
```

## Provider State Endpoint

```python
# app/routes/pact.py (only in test/dev)
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/_pact", tags=["pact"])

class ProviderState(BaseModel):
    state: str
    params: dict = {}

@router.post("/setup")
async def setup_state(
    state: ProviderState,
    manager: ProviderStateManager = Depends(get_state_manager),
):
    """Handle Pact provider state setup."""
    manager.setup(state.state, state.params)
    return {"status": "ok"}
```

## Broker Verification (Production)

```python
def test_verify_with_broker():
    """Verify against Pact Broker contracts."""
    verifier = Verifier(
        provider="UserService",
        provider_base_url="http://localhost:8000",
    )

    verifier.verify_with_broker(
        broker_url=os.environ["PACT_BROKER_URL"],
        broker_token=os.environ["PACT_BROKER_TOKEN"],
        publish_verification_results=True,
        provider_version=os.environ["GIT_SHA"],
        provider_version_branch=os.environ["GIT_BRANCH"],
        enable_pending=True,  # Don't fail on WIP pacts
        consumer_version_selectors=[
            {"mainBranch": True},
            {"deployedOrReleased": True},
        ],
    )
```
