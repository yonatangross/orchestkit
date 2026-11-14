"""scripts/bump-stable-pin.sh pins the stable set, ork and ork-extras, together (#4936).

Runs the real script on fixture copies under TMPDIR and reads the file it
wrote, so the gate checks the rendered marketplace, not two records agreeing.

Cases:
1. Bump to 1.1.0: ork and ork-extras both end at version 1.1.0 and ref
   v1.1.0 (the intended tag, not merely each other); ork-alpha and the mod
   entry are byte-for-byte untouched; exit 0.
2. Rerun at 1.1.0: exit 3, file unchanged.
3. ork-extras missing from the marketplace: exit 1, file unchanged.
4. ork and ork-extras already pinned to different tags: exit 1, file
   unchanged (skew must not be papered over).
5. Prerelease 1.2.0-alpha.1: exit 3, file unchanged.

Case 1 is the positive control: a harness that refuses everything fails it.
The run counter fails the gate if the script ran fewer times than planned.
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "bump-stable-pin.sh"


def entry(name: str, path: str, ref: str, version: str) -> dict:
    return {
        "name": name,
        "version": version,
        "description": f"{name} fixture",
        "source": {
            "source": "git-subdir",
            "url": "https://example.invalid/orchestkit.git",
            "path": path,
            "ref": ref,
        },
    }


BASE = {
    "name": "orchestkit",
    "version": "1.0.0",
    "plugins": [
        entry("ork", "plugins/ork", "v1.0.0", "1.0.0"),
        entry("ork-alpha", "plugins/ork", "main", "1.0.0"),
        entry("ork-extras", "plugins/ork-extras", "main", "1.0.0"),
        entry("a-mod", "mods/a-mod", "main", "0.0.1"),
    ],
}

failures: list[str] = []
ran = 0


def run(fixture: dict, version: str) -> tuple[int, dict, str]:
    global ran
    tmp = Path(tempfile.mkdtemp(prefix="bump-stable-pin-"))
    try:
        mkt = tmp / "marketplace.json"
        mkt.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
        proc = subprocess.run(
            ["bash", str(SCRIPT), version, str(mkt)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        ran += 1
        out = json.loads(mkt.read_text(encoding="utf-8"))
        return proc.returncode, out, (proc.stdout + proc.stderr).strip()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def by_name(data: dict) -> dict[str, dict]:
    return {p["name"]: p for p in data["plugins"]}


def expect(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)


def case_bump_both() -> None:
    rc, out, log = run(BASE, "1.1.0")
    expect(rc == 0, f"bump both: exit {rc}, want 0 ({log})")
    got = by_name(out)
    for name in ("ork", "ork-extras"):
        e = got.get(name, {})
        expect(
            e.get("version") == "1.1.0", f"bump both: {name} version {e.get('version')}, want 1.1.0"
        )
        expect(
            e.get("source", {}).get("ref") == "v1.1.0",
            f"bump both: {name} ref {e.get('source', {}).get('ref')}, want v1.1.0",
        )
    base = by_name(BASE)
    for name in ("ork-alpha", "a-mod"):
        expect(got.get(name) == base[name], f"bump both: {name} changed, must stay untouched")


def case_rerun_noop() -> None:
    pinned = copy.deepcopy(BASE)
    for p in pinned["plugins"]:
        if p["name"] in ("ork", "ork-extras"):
            p["version"] = "1.1.0"
            p["source"]["ref"] = "v1.1.0"
    rc, out, log = run(pinned, "1.1.0")
    expect(rc == 3, f"rerun: exit {rc}, want 3 ({log})")
    expect(out == pinned, "rerun: file changed on a no-op")


def case_extras_missing() -> None:
    fixture = copy.deepcopy(BASE)
    fixture["plugins"] = [p for p in fixture["plugins"] if p["name"] != "ork-extras"]
    rc, out, log = run(fixture, "1.1.0")
    expect(rc == 1, f"extras missing: exit {rc}, want 1 ({log})")
    expect(out == fixture, "extras missing: file changed on a refusal")


def case_pins_disagree() -> None:
    fixture = copy.deepcopy(BASE)
    for p in fixture["plugins"]:
        if p["name"] == "ork-extras":
            p["source"]["ref"] = "v0.9.0"
            p["version"] = "0.9.0"
    rc, out, log = run(fixture, "1.1.0")
    expect(rc == 1, f"pins disagree: exit {rc}, want 1 ({log})")
    expect(out == fixture, "pins disagree: file changed on a refusal")


def case_prerelease() -> None:
    rc, out, log = run(BASE, "1.2.0-alpha.1")
    expect(rc == 3, f"prerelease: exit {rc}, want 3 ({log})")
    expect(out == BASE, "prerelease: file changed")


def main() -> int:
    if shutil.which("bash") is None or shutil.which("jq") is None:
        print("FAIL test-bump-stable-pin: bash and jq are required")
        return 1
    if not SCRIPT.is_file():
        print(f"FAIL test-bump-stable-pin: missing {SCRIPT}")
        return 1
    os.environ.setdefault("TMPDIR", tempfile.gettempdir())
    case_bump_both()
    case_rerun_noop()
    case_extras_missing()
    case_pins_disagree()
    case_prerelease()
    expect(ran == 5, f"harness: ran the script {ran} times, want 5")
    if failures:
        print(f"FAIL test-bump-stable-pin: {len(failures)} problem(s)")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"PASS test-bump-stable-pin: {ran} runs, ork and ork-extras pinned together")
    return 0


if __name__ == "__main__":
    sys.exit(main())
