#!/usr/bin/env python3
"""A hook event page says so when the shipped plugin does not run that event.

The hook reference pages are generated from src/hooks/hooks.json, the
per-handler registry. The plugin ships plugins/ork/hooks/hooks.json, built
from it, which can leave an event out: since 2026-11-11 it drops
PostToolBatch. Its page still read "1 hooks registered" as if the observer
ran. The generator now reads the shipped file too and marks such pages.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GEN_PATH = ROOT / "scripts" / "_build-docs-generate.py"
NOTE = "Not in the shipped plugin"


def load_generator():
    spec = importlib.util.spec_from_file_location("ork_build_docs_generate", GEN_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def entry(name: str) -> dict:
    return {"type": "command", "command": "node", "args": ["run-hook.mjs", name]}


def main() -> int:
    gen = load_generator()
    registry = {
        "hooks": {
            "PreToolUse": [{"matcher": "Bash", "hooks": [entry("pretool/bash/x")]}],
            "PostToolBatch": [{"matcher": "*", "hooks": [entry("posttool/tool-batch-observer")]}],
        }
    }
    shipped = {"hooks": {"PreToolUse": [{"hooks": [entry("pretool/tool-dispatcher")]}]}}
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / "registry.json").write_text(json.dumps(registry))
        (t / "shipped.json").write_text(json.dumps(shipped))
        out = t / "out"
        out.mkdir()
        gen.generate_hooks(str(t / "registry.json"), str(out), shipped_json=str(t / "shipped.json"))
        pages = {p.name: p.read_text() for p in out.glob("*.mdx")}
        batch = next((v for k, v in pages.items() if "batch" in k), None)
        pre = next((v for k, v in pages.items() if "pre-tool-use" in k), None)
        if batch is None or pre is None:
            failures.append(f"expected PostToolBatch and PreToolUse pages, got {sorted(pages)}")
        else:
            if NOTE not in batch:
                failures.append("PostToolBatch page does not say it is not in the shipped plugin")
            if NOTE in pre:
                failures.append("PreToolUse page is marked unshipped, but the shipped file has it")
    for f in failures:
        print(f"FAIL: {f}")
    if failures:
        return 1
    print("PASS: hook pages mark events the shipped plugin does not run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
