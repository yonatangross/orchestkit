"""Tests for reserve.py: the paid-generation caps hold, including in parallel."""

import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
import reserve  # noqa: E402


def test_index_counts_per_concept(tmp_path):
    ledger = str(tmp_path / "ledger.tsv")
    assert [reserve.reserve(ledger, "A") for _ in range(3)] == [1, 2, 3]
    assert reserve.reserve(ledger, "B") == 1


def test_per_concept_cap_stops_the_fourth(tmp_path):
    ledger = str(tmp_path / "ledger.tsv")
    for _ in range(3):
        reserve.reserve(ledger, "A")
    with pytest.raises(SystemExit):
        reserve.reserve(ledger, "A")
    assert len(open(ledger).read().splitlines()) == 3


def test_total_cap_stops_a_fresh_concept(tmp_path):
    ledger = str(tmp_path / "ledger.tsv")
    for concept in ("A", "B", "C"):
        for _ in range(3):
            reserve.reserve(ledger, concept)
    with pytest.raises(SystemExit):
        reserve.reserve(ledger, "A", 9, 4)
    assert len(open(ledger).read().splitlines()) == 9


def test_parallel_runs_cannot_overshoot_the_cap(tmp_path):
    """Six racing processes, cap of 3: exactly 3 reservations, indexes 1..3."""
    ledger = str(tmp_path / "ledger.tsv")
    script = os.path.join(os.path.dirname(__file__), "reserve.py")
    procs = [
        subprocess.Popen(
            [sys.executable, script, ledger, "A", "9", "3"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        for _ in range(6)
    ]
    done = [(p.wait(timeout=30), p.stdout.read().strip() if p.stdout else "") for p in procs]
    granted = sorted(out for code, out in done if code == 0)
    assert granted == ["1", "2", "3"], done
    assert len(open(ledger).read().splitlines()) == 3
