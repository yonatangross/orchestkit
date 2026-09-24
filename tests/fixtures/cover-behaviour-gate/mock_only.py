# Fixture for tests/unit/test-cover-behaviour-gate.mjs: rule (a), mock-call assertions only.
from unittest.mock import MagicMock, patch

from app.checkout import checkout


def test_calls_gateway():
    gateway = MagicMock()
    checkout(gateway, total=10)
    gateway.charge.assert_called_once_with(10)


def test_logs_once():
    log = MagicMock()
    checkout(MagicMock(), total=0, log=log)
    assert log.call_count == 1


@patch("app.checkout.audit")
def test_audits(audit):
    checkout(MagicMock(), total=1)
    assert audit.called
    audit.assert_has_calls([])
