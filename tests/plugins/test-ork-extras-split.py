"""The ork-extras split (#4936): 26 skills leave core ork for an opt-in plugin.

Four gates, each one a way the split can be half done:

1. Core: the built plugins/ork/skills holds none of the moved skills and still
   holds every business skill that was ruled to stay.
2. Extras: the built plugins/ork-extras/skills holds exactly the moved skills,
   no more and no fewer.
3. Marketplace: .claude-plugin/marketplace.json lists an ork-extras entry whose
   source path is plugins/ork-extras.
4. Reference sweep: no file outside a moved skill's own directory (in src or in
   the built extras plugin) still invokes a moved skill as `ork:<name>`, which
   would point a reader at a command core ork no longer ships. Files are found
   by walking the tree, not from a list, and the sweep fails if it scanned
   nothing. A positive control (a core skill such as `ork:verify` must still be
   found) proves the matcher can see a reference at all.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC_SKILLS = ROOT / "src" / "skills"
CORE = ROOT / "plugins" / "ork" / "skills"
EXTRAS_PLUGIN = ROOT / "plugins" / "ork-extras"
EXTRAS = EXTRAS_PLUGIN / "skills"
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"

MOVED = frozenset(
    {
        # library (16)
        "ai-ui-generation",
        "animation-motion-design",
        "async-jobs",
        "figma-design-handoff",
        "i18n-date-patterns",
        "langgraph",
        "llm-integration",
        "mcp-patterns",
        "monitoring-observability",
        "multimodal-llm",
        "portless",
        "rag-retrieval",
        "storybook-testing",
        "ui-components",
        "vite-advanced",
        "zustand-patterns",
        # engineering domain (10)
        "accessibility",
        "agent-orchestration",
        "design-stylecards",
        "distributed-systems",
        "documentation-patterns",
        "domain-driven-design",
        "golden-dataset",
        "interaction-patterns",
        "release-management",
        "responsive-patterns",
    }
)

BUSINESS_STAY = frozenset(
    {
        "business-case",
        "competitive-analysis",
        "market-sizing",
        "okr-design",
        "prioritization",
        "product-analytics",
        "product-frameworks",
        "user-research",
    }
)

# The sweep is the one gate that may run as expected-fail, and only while the
# re-points are still in the stacked follow-up branch. Set to None there.
SWEEP_EXPECTED_FAIL: str | None = None

# Directories the walk never enters: VCS data, other checkouts, installed
# dependencies and build caches. None of them is a file a reader opens.
SKIP_DIRS = frozenset(
    {
        ".git",
        ".worktrees",
        "node_modules",
        ".next",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".turbo",
        "coverage",
        "dist",
        ".instance",
    }
)

NAMES_ALT = "|".join(sorted(MOVED, key=len, reverse=True))
MOVED_REF = re.compile(r"(?<![a-z-])ork:(" + NAMES_ALT + r")(?![a-z-])")
CONTROL_REF = re.compile(r"(?<![a-z-])ork:verify(?![a-z-])")

failures: list[str] = []


def skill_dirs(base: Path) -> set[str]:
    if not base.is_dir():
        return set()
    return {p.name for p in base.iterdir() if p.is_dir()}


def check_source() -> None:
    present = skill_dirs(SRC_SKILLS)
    missing = sorted((MOVED | BUSINESS_STAY) - present)
    if missing:
        failures.append(f"source: src/skills lacks {missing}; the lists here are stale")


def check_core() -> None:
    built = skill_dirs(CORE)
    if not built:
        failures.append("core: plugins/ork/skills is missing or empty (run npm run build)")
        return
    leaked = sorted(MOVED & built)
    if leaked:
        failures.append(
            f"core: plugins/ork/skills still ships {len(leaked)} moved skills: {leaked}"
        )
    lost = sorted(BUSINESS_STAY - built)
    if lost:
        failures.append(f"core: plugins/ork/skills lost business skills that stay: {lost}")


def check_extras() -> None:
    built = skill_dirs(EXTRAS)
    if not built:
        failures.append("extras: plugins/ork-extras/skills is missing or empty")
        return
    if built != MOVED:
        failures.append(
            "extras: plugins/ork-extras/skills is not exactly the moved set; "
            f"missing {sorted(MOVED - built)}, extra {sorted(built - MOVED)}"
        )


def check_marketplace() -> None:
    data = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    entries = [p for p in data.get("plugins", []) if p.get("name") == "ork-extras"]
    if len(entries) != 1:
        failures.append(f"marketplace: expected one ork-extras entry, found {len(entries)}")
        return
    source = entries[0].get("source")
    path = source.get("path") if isinstance(source, dict) else source
    if not isinstance(path, str) or path.strip("./") != "plugins/ork-extras":
        failures.append(f"marketplace: ork-extras source path is {path!r}, want plugins/ork-extras")


def exempt(rel: Path) -> bool:
    parts = rel.parts
    if parts[:2] == ("plugins", "ork-extras"):
        return True
    return len(parts) >= 3 and parts[:2] == ("src", "skills") and parts[2] in MOVED


def check_sweep() -> list[str]:
    """Return the sweep's own failures so it can run as expected-fail."""
    errs: list[str] = []
    scanned = 0
    control_hits = 0
    offenders: list[str] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = Path(dirpath) / name
            rel = path.relative_to(ROOT)
            try:
                raw = path.read_bytes()
            except OSError:
                continue
            if b"\0" in raw[:4096]:
                continue
            text = raw.decode("utf-8", errors="replace")
            scanned += 1
            if CONTROL_REF.search(text):
                control_hits += 1
            if exempt(rel):
                continue
            hits = sorted({m.group(1) for m in MOVED_REF.finditer(text)})
            if hits:
                offenders.append(f"{rel} ({', '.join(hits)})")
    if scanned == 0:
        errs.append("sweep: scanned zero files; the walk is broken")
    if control_hits == 0:
        errs.append("sweep: positive control failed, no file says ork:verify; the matcher is blind")
    if offenders:
        shown = "\n    ".join(offenders[:40])
        more = f"\n    ... and {len(offenders) - 40} more" if len(offenders) > 40 else ""
        errs.append(
            f"sweep: {len(offenders)} files still invoke a moved skill as ork:<name> "
            f"(scanned {scanned}):\n    {shown}{more}"
        )
    print(
        f"sweep: scanned {scanned} files, control ork:verify in {control_hits}, offenders {len(offenders)}"
    )
    return errs


def main() -> int:
    check_source()
    check_core()
    check_extras()
    check_marketplace()
    sweep_errs = check_sweep()
    if SWEEP_EXPECTED_FAIL is None:
        failures.extend(sweep_errs)
    elif sweep_errs:
        print(
            f"XFAIL sweep ({SWEEP_EXPECTED_FAIL}): {len(sweep_errs)} problem(s), first: {sweep_errs[0].splitlines()[0]}"
        )
    else:
        failures.append(
            f"sweep: XPASS, marked expected-fail ({SWEEP_EXPECTED_FAIL}) but it passed; remove the mark"
        )

    if failures:
        print(f"FAIL test-ork-extras-split: {len(failures)} problem(s)")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"PASS test-ork-extras-split: core lacks {len(MOVED)} moved, keeps {len(BUSINESS_STAY)} business; extras exact; marketplace entry; sweep"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
