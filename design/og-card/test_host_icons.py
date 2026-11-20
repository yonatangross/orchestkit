"""Tests for host_icons.mjs: argv is allowlisted and never reaches a pattern."""

import os
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "host_icons.mjs")


def run(*args):
    return subprocess.run(
        [os.environ.get("NODE", "node"), SCRIPT, *args],
        cwd=HERE,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_no_pattern_is_built_from_input():
    """CodeQL js/regex-injection: nothing in the script may compile a RegExp."""
    for name in ("host_icons.mjs", "brand.py", "card.py", "reserve.py", "gen.sh"):
        body = open(os.path.join(HERE, name)).read()
        assert "new RegExp" not in body, name
        assert "re.compile" not in body, name


def test_a_known_host_is_accepted():
    assert run("claude").returncode == 0


@pytest.mark.parametrize("arg", ["cla.*", "(claude|cursor)", "../../../etc/passwd", "nope"])
def test_unknown_or_crafted_args_are_refused(arg):
    r = run(arg)
    assert r.returncode != 0
    assert "unknown host id" in r.stderr
