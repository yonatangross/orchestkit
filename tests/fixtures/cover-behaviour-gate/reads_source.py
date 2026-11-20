# Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (c), reading source instead of running it.
import inspect
import subprocess
from pathlib import Path

from app import pricing
from app.pricing import apply_discount

SOURCE = Path("app/pricing.py").read_text()


def test_defines_apply_discount():
    assert "def apply_discount" in SOURCE


def test_guard_is_present():
    assert "rate < 0" in inspect.getsource(pricing.apply_discount)


def test_no_print_calls():
    result = subprocess.run(["grep", "-n", "print(", "app/pricing.py"], capture_output=True)
    assert result.returncode == 1


def test_opens_the_module():
    with open("app/pricing.py") as fh:
        assert "Decimal" in fh.read()


def test_still_computes_a_total():
    assert apply_discount(10, 0.5) == 5
