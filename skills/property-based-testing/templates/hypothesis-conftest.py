"""
Hypothesis configuration template for pytest.

Includes:
- Profile configuration for dev/CI/thorough testing
- Database integration patterns
- Custom strategies
"""
import os
import pytest
from hypothesis import settings, Verbosity, Phase, HealthCheck

# =============================================================================
# HYPOTHESIS PROFILES
# =============================================================================

# Development: Fast iteration
settings.register_profile(
    "dev",
    max_examples=10,
    verbosity=Verbosity.verbose,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)

# CI: Thorough testing
settings.register_profile(
    "ci",
    max_examples=100,
    deadline=None,  # No time limit
    print_blob=True,  # Print reproduction blob on failure
)

# Release: Maximum coverage
settings.register_profile(
    "thorough",
    max_examples=1000,
    phases=[Phase.generate, Phase.shrink],
    deadline=None,
)

# Database tests: Limited examples, explicit mode
settings.register_profile(
    "database",
    max_examples=20,
    database=None,  # Don't persist examples
    deadline=None,
)

# Load profile from environment
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))


# =============================================================================
# CUSTOM STRATEGIES
# =============================================================================

from hypothesis import strategies as st
from decimal import Decimal


@st.composite
def money_strategy(draw, min_amount=0, max_amount=10000, currencies=None):
    """Generate valid Money objects."""
    from app.domain.value_objects import Money

    amount = draw(st.decimals(
        min_value=Decimal(str(min_amount)),
        max_value=Decimal(str(max_amount)),
        places=2,
    ))
    currency = draw(st.sampled_from(currencies or ["USD", "EUR", "GBP"]))
    return Money(amount=amount, currency=currency)


@st.composite
def email_strategy(draw):
    """Generate valid email addresses."""
    local = draw(st.text(
        alphabet=st.characters(whitelist_categories=('L', 'N')),
        min_size=1,
        max_size=64,
    ))
    domain = draw(st.text(
        alphabet=st.characters(whitelist_categories=('L',)),
        min_size=1,
        max_size=20,
    ))
    tld = draw(st.sampled_from(["com", "org", "net", "io", "dev"]))
    return f"{local}@{domain}.{tld}"


@st.composite
def user_create_strategy(draw):
    """Generate valid UserCreate objects."""
    from app.schemas import UserCreate

    return UserCreate(
        email=draw(st.emails()),
        name=draw(st.text(min_size=1, max_size=100)),
        age=draw(st.integers(min_value=0, max_value=150)),
    )


# =============================================================================
# DATABASE FIXTURES FOR HYPOTHESIS
# =============================================================================

@pytest.fixture
def hypothesis_db_session(db_session):
    """
    Database session for Hypothesis tests.

    Rolls back after each example, not just each test.
    """
    # Start nested transaction
    nested = db_session.begin_nested()
    yield db_session
    # Rollback to before this example
    nested.rollback()


# =============================================================================
# REGISTER STRATEGIES
# =============================================================================

# Make strategies available via st.register_type_strategy
# so st.from_type() works with your domain types

def register_custom_strategies():
    """Register strategies for domain types."""
    from app.domain.value_objects import Money
    from app.schemas import UserCreate

    st.register_type_strategy(Money, money_strategy(st.DrawFn))  # type: ignore
    st.register_type_strategy(UserCreate, user_create_strategy(st.DrawFn))  # type: ignore


# Call at import time if types are available
try:
    register_custom_strategies()
except ImportError:
    pass  # Types not available yet
