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
SWEEP_EXPECTED_FAIL: str | None = (
    "the ork:<moved> re-points land in the stacked follow-up PR on feat/ork-extras-split-refs"
)

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


CORE_PLUGIN = ROOT / "plugins" / "ork"
RELEASE_PLEASE = ROOT / ".release-please-config.json"
# A plugin-root path cited from inside the extras plugin: shared/... or
# skills/<name>/... with a file extension, optionally behind CLAUDE_PLUGIN_ROOT.
CITED_PATH = re.compile(
    r"(?:\$\{CLAUDE_PLUGIN_ROOT\}/)?(?<![\w./-])((?:shared|skills)/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*\.(?:md|mdc|json|sh|py|mjs|js|ts|tsx|yaml|yml))"
)


def check_no_shared() -> None:
    """ork-extras must not duplicate core files: shared/ and Cursor rules stay in ork."""
    if not EXTRAS_PLUGIN.is_dir():
        return  # check_extras already reported the missing plugin
    if (EXTRAS_PLUGIN / "shared").exists():
        failures.append("shared: plugins/ork-extras/shared exists; core files would ship twice")
    rules = EXTRAS_PLUGIN / ".cursor-plugin" / "rules"
    if rules.exists():
        n = len(list(rules.glob("*.mdc")))
        failures.append(
            f"shared: plugins/ork-extras/.cursor-plugin/rules holds {n} rules; Cursor loads them twice next to ork"
        )
    cursor_manifest = EXTRAS_PLUGIN / ".cursor-plugin" / "plugin.json"
    if cursor_manifest.is_file() and "rules" in json.loads(
        cursor_manifest.read_text(encoding="utf-8")
    ):
        failures.append("shared: plugins/ork-extras/.cursor-plugin/plugin.json declares rules")
    # Positive control: the gate must not have stripped core as well.
    if not (CORE_PLUGIN / "shared").is_dir():
        failures.append("shared: control failed, plugins/ork/shared is gone")
    core_rules = list((CORE_PLUGIN / ".cursor-plugin" / "rules").glob("*.mdc"))
    if not core_rules:
        failures.append("shared: control failed, plugins/ork/.cursor-plugin/rules is empty")


def check_cited_paths() -> None:
    """Every plugin-root path cited inside ork-extras resolves inside ork-extras."""
    if not EXTRAS_PLUGIN.is_dir():
        return
    scanned = 0
    broken: list[str] = []
    for path in sorted(EXTRAS_PLUGIN.rglob("*")):
        if not path.is_file() or path.suffix not in {".md", ".mdc", ".json"}:
            continue
        scanned += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        # HTML comments carry provenance (SYNCED from upstream skills/x/...),
        # not paths a reader opens.
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        for m in CITED_PATH.finditer(text):
            cited = m.group(1)
            if not (EXTRAS_PLUGIN / cited).exists():
                broken.append(f"{path.relative_to(ROOT)} -> {cited}")
    if scanned == 0:
        failures.append("cited paths: scanned zero files in plugins/ork-extras")
    if broken:
        shown = "\n    ".join(sorted(set(broken))[:30])
        failures.append(
            f"cited paths: {len(set(broken))} paths in ork-extras do not resolve inside it:\n    {shown}"
        )


CURSOR_MARKETPLACE = ROOT / ".cursor-plugin" / "marketplace.json"


def check_cursor_marketplace() -> None:
    """Every built plugins/X/.cursor-plugin has a Cursor marketplace entry, and the reverse.

    A Cursor build nobody can install is dead weight, and an entry with no
    build is a broken install; both happened silently before this case.
    """
    built = sorted(p.parent.name for p in (ROOT / "plugins").glob("*/.cursor-plugin") if p.is_dir())
    if not built:
        failures.append(
            "cursor: found zero plugins/*/.cursor-plugin dirs; the build or the glob is broken"
        )
        return
    data = json.loads(CURSOR_MARKETPLACE.read_text(encoding="utf-8"))
    listed: dict[str, str] = {}
    for p in data.get("plugins", []):
        src = p.get("source")
        path = src.get("path") if isinstance(src, dict) else src
        if isinstance(path, str):
            listed[p.get("name", "?")] = path.strip("./")
    sources = set(listed.values())
    for name in built:
        if f"plugins/{name}" not in sources:
            failures.append(
                f"cursor: plugins/{name}/.cursor-plugin is built but .cursor-plugin/marketplace.json has no entry for it"
            )
    for name, path in sorted(listed.items()):
        if not (ROOT / path / ".cursor-plugin").is_dir():
            failures.append(
                f"cursor: marketplace entry {name} points at {path}, which has no .cursor-plugin build"
            )
    if "plugins/ork" not in sources:
        failures.append(
            "cursor: control failed, the ork entry is missing from the Cursor marketplace"
        )


def check_release_please() -> None:
    """Every ork-extras version file is bumped by release-please, so versions cannot drift."""
    cfg = json.loads(RELEASE_PLEASE.read_text(encoding="utf-8"))
    entries = [e for pkg in cfg.get("packages", {}).values() for e in pkg.get("extra-files", [])]
    listed = {
        e.get("path")
        for e in entries
        if isinstance(e, dict) and e.get("type") == "json" and e.get("jsonpath") == "$.version"
    }
    want = {"manifests/ork-extras.json"}
    plugin_jsons = sorted(
        str(p.relative_to(ROOT))
        for p in EXTRAS_PLUGIN.rglob("plugin.json")
        if "node_modules" not in p.parts
    )
    if EXTRAS_PLUGIN.is_dir() and not plugin_jsons:
        failures.append("release-please: found zero plugin.json files under plugins/ork-extras")
    want.update(plugin_jsons)
    missing = sorted(want - listed)
    if missing:
        failures.append(f"release-please: extra-files lacks $.version for {missing}")
    # Control: a core file known to be listed must be seen by the same parser.
    if "manifests/ork.json" not in listed:
        failures.append(
            "release-please: control failed, manifests/ork.json not seen in extra-files"
        )
    # The extras marketplace entry is owned by bump-stable-pin once pinned,
    # so release-please must not write it by index.
    mkt = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    names = [p.get("name") for p in mkt.get("plugins", [])]
    for e in entries:
        jp = e.get("jsonpath", "") if isinstance(e, dict) else ""
        m = re.fullmatch(r"\$\.plugins\[(\d+)\]\.version", jp)
        if e.get("path") == ".claude-plugin/marketplace.json" and m:
            idx = int(m.group(1))
            name = names[idx] if idx < len(names) else None
            if name != "ork-alpha":
                failures.append(
                    f"release-please: writes marketplace plugins[{idx}] ({name}); only ork-alpha may be bumped by index"
                )
    extras_manifest = ROOT / "manifests" / "ork-extras.json"
    if extras_manifest.is_file():
        v_extras = json.loads(extras_manifest.read_text(encoding="utf-8")).get("version")
        v_core = json.loads((ROOT / "manifests" / "ork.json").read_text(encoding="utf-8")).get(
            "version"
        )
        if v_extras != v_core:
            failures.append(
                f"release-please: manifests/ork-extras.json version {v_extras} != ork {v_core}"
            )


THIS_PAGE = "feat" + "-" * 2 + "ork-extras-split"
HISTORICAL_REASON = (
    "historical playground pages record what was true when their PR shipped; they are not rewritten"
)


def historical(rel: Path) -> bool:
    """docs/<type><two hyphens><slug>/ pages and their published docs/site/public/lab copies, except this PR's own."""
    parts = rel.parts
    pair = "-" * 2
    if len(parts) >= 3 and parts[0] == "docs" and pair in parts[1]:
        return parts[1] != THIS_PAGE
    if parts[:4] == ("docs", "site", "public", "lab") and len(parts) == 5:
        return not parts[4].startswith(THIS_PAGE)
    return False


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
    skipped_historical: list[str] = []
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
            if hits and historical(rel):
                skipped_historical.append(str(rel))
                continue
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
    # Visible skip: every historical file that still names a moved skill is listed.
    print(f"sweep: SKIP {len(skipped_historical)} historical files ({HISTORICAL_REASON})")
    for rel in skipped_historical:
        print(f"  skip {rel}")
    return errs


def main() -> int:
    check_source()
    check_core()
    check_extras()
    check_marketplace()
    check_no_shared()
    check_cited_paths()
    check_release_please()
    check_cursor_marketplace()
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
    sweep_state = "sweep" if SWEEP_EXPECTED_FAIL is None else "sweep XFAIL"
    print(
        f"PASS test-ork-extras-split: core lacks {len(MOVED)} moved, keeps {len(BUSINESS_STAY)} business; "
        f"extras exact; marketplace entry; {sweep_state}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
