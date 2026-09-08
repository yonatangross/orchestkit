#!/usr/bin/env python3
"""Assert manifests/codex/ork-codex.json names exactly the profiles on disk.

Two sources of truth, no warning when they drift: a profile added to
src/codex/ork-codex/profiles/ and not to the manifest is invisible to anyone
reading the manifest to learn what the pack ships, and a renamed profile leaves
the manifest pointing at nothing. This is the count-sync rule applied to the one
component type the manifest did not previously list.

Usage: check-manifest-profiles.py <manifest.json> <profiles-dir>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SUFFIX = ".config.toml"


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check-manifest-profiles.py <manifest.json> <profiles-dir>", file=sys.stderr)
        return 2

    manifest, profiles_dir = Path(sys.argv[1]), Path(sys.argv[2])

    if not manifest.is_file():
        print(f"FAIL: missing manifest {manifest}")
        return 1
    if not profiles_dir.is_dir():
        print(f"FAIL: missing profiles directory {profiles_dir}")
        return 1

    declared = sorted(json.loads(manifest.read_text(encoding="utf-8")).get("profiles", []))
    on_disk = sorted(p.name[: -len(SUFFIX)] for p in profiles_dir.glob(f"*{SUFFIX}"))

    if declared != on_disk:
        print(f"FAIL: manifest profiles {declared} != tree {on_disk}")
        return 1

    print(f"  codex profiles declared and present: {', '.join(on_disk)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
