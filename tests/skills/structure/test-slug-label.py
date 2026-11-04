#!/usr/bin/env python3
"""title_case in the docs generator keeps acronyms upper case."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GEN_PATH = ROOT / "scripts" / "_build-docs-generate.py"

CASES = {
    "ci-cd-engineer": "CI/CD Engineer",
    "ai-safety-auditor": "AI Safety Auditor",
    "api-design": "API Design",
    "mcp-visual-output": "MCP Visual Output",
    "llm-integrator": "LLM Integrator",
    "ui-finish-gate": "UI Finish Gate",
    "testing-e2e": "Testing E2E",
    "json-render-catalog": "Json Render Catalog",
    "database-engineer": "Database Engineer",
    "devops-deployment": "Devops Deployment",
}


def load_generator():
    spec = importlib.util.spec_from_file_location("ork_build_docs_generate", GEN_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    gen = load_generator()
    bad = [
        f"title_case({slug!r}) = {gen.title_case(slug)!r}, expected {want!r}"
        for slug, want in CASES.items()
        if gen.title_case(slug) != want
    ]
    for line in bad:
        print(f"FAIL {line}")
    if bad:
        return 1
    print(f"PASS title_case: {len(CASES)} slug labels")
    return 0


if __name__ == "__main__":
    sys.exit(main())
