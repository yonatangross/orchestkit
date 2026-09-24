# Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (b), no assertion on a result.
from contextlib import nullcontext as does_not_raise

from app.pricing import apply_discount


def test_runs_apply_discount():
    apply_discount(100, 0.1)


def test_large_order():
    with does_not_raise():
        apply_discount(10**9, 0.1)


def test_only_prints():
    print(apply_discount(1, 0))
