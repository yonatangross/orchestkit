#!/usr/bin/env python3
"""Assert the shipped Codex mech profile is the shape codex-cli actually accepts.

Measured on codex-cli 0.153.4 (2026-09-08), which is why each assertion exists:

  * `--profile <name>` layers ``$CODEX_HOME/<name>.config.toml``. A legacy
    ``[profiles.<name>]`` table inside the file is a hard config-load error under
    that flag, so the shipped file must never contain one.
  * ``--strict-config`` rejects unknown keys, so the key set is pinned to what
    was measured to load rather than left open.
  * The mech lane must stay sandboxed. ``danger-full-access`` and the
    ``--dangerously-bypass-approvals-and-sandbox`` flag drop the sandbox, which
    is the wrong shape for an unattended worker, so both are refused anywhere in
    the file including its comments.

Usage: check-profile.py <profile.toml> [<profile.toml> ...]
"""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path

# Exactly the keys measured to load under `codex exec --strict-config`. A new
# key is not automatically wrong, but it has to be measured before it ships.
EXPECTED_TOP_LEVEL = {
    "approval_policy",
    "sandbox_mode",
    "model_reasoning_effort",
    "sandbox_workspace_write",
}

BANNED_SUBSTRINGS = (
    "danger-full-access",
    "dangerously-bypass-approvals-and-sandbox",
    "dangerously-bypass-hook-trust",
)


def check(path: Path) -> list[str]:
    if not path.is_file():
        return [f"{path}: missing"]

    raw = path.read_text(encoding="utf-8")
    problems: list[str] = []

    try:
        data = tomllib.loads(raw)
    except tomllib.TOMLDecodeError as exc:
        return [f"{path}: does not parse as TOML: {exc}"]

    if "profiles" in data:
        problems.append(
            f"{path}: carries a [profiles.*] table; codex rejects --profile "
            "while that legacy shape exists in the layered file"
        )

    keys = set(data)
    if keys != EXPECTED_TOP_LEVEL:
        problems.append(
            f"{path}: key set is {sorted(keys)}, expected {sorted(EXPECTED_TOP_LEVEL)}"
        )

    if data.get("approval_policy") != "never":
        problems.append(f"{path}: approval_policy is {data.get('approval_policy')!r}, expected 'never'")
    if data.get("sandbox_mode") != "workspace-write":
        problems.append(f"{path}: sandbox_mode is {data.get('sandbox_mode')!r}, expected 'workspace-write'")
    if data.get("sandbox_workspace_write", {}).get("network_access") is not True:
        problems.append(f"{path}: sandbox_workspace_write.network_access must be true")

    # Scan the ACTIVE lines only. The comment header names these tokens on
    # purpose, to say why they are absent; a check that cannot tell prose from
    # config would forbid its own rationale.
    active = "\n".join(
        line for line in raw.splitlines() if not line.lstrip().startswith("#")
    )
    for banned in BANNED_SUBSTRINGS:
        if banned in active:
            problems.append(f"{path}: names the sandbox-dropping token {banned!r}")

    # The two command-line contracts a profile file cannot express. If they are
    # not written down here they are not written down anywhere the operator of
    # a fleet worker will read.
    for needle, why in (("</dev/null", "the blocking-stdin contract"), ("--add-dir", "the worktree git-common-dir contract")):
        if needle not in raw:
            problems.append(f"{path}: does not document {why} ({needle})")

    return problems


def main() -> int:
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        print("usage: check-profile.py <profile.toml> [...]", file=sys.stderr)
        return 2

    problems = [p for path in paths for p in check(path)]
    for problem in problems:
        print(f"FAIL: {problem}")
    if problems:
        return 1

    print(f"  codex mech profile OK ({len(paths)} file(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
