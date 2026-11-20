# Fixture for tests/unit/test-cover-behaviour-gate.mjs: every test here asserts behaviour.
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from app.pricing import apply_discount, parse_amount, send_receipt

CASES = json.loads((Path(__file__).parent / "fixtures" / "cases.json").read_text())


def test_returns_discounted_total():
    assert apply_discount(100, 0.2) == 80


def test_negative_rate_raises():
    with pytest.raises(ValueError, match="rate"):
        apply_discount(100, -1)


def test_sends_receipt_and_returns_id():
    mailer = MagicMock()
    mailer.send.return_value = {"id": "r1"}
    receipt = send_receipt(mailer, 42)
    mailer.send.assert_called_once()
    assert receipt["id"] == "r1"


def test_empty_cart():
    """Not raising on an empty cart is the contract: apply_discount never raises for zero totals."""
    apply_discount(0, 0)


class TestParse(unittest.TestCase):
    def test_parses_cents(self):
        self.assertEqual(parse_amount("1.50"), 150)

    def test_comment_mentions_assert_called_but_asserts_value(self):
        # mock.assert_called() would be rule (a); this test checks the value instead
        self.assertIsNone(parse_amount(""))
