"""The memory docs say what the graph tier needs, the way the remember skill does.

The remember skill says the graph tier's tools come from a memory MCP server
that OrchestKit does not bundle, and that without it every graph step does
nothing. A docs page that calls that tier zero-config or always available
sends a reader (or an agent following the page) to a setup that stores
nothing. Three gates:
1. the skill still says the server is not bundled (the source of truth);
2. no docs page pairs the memory MCP graph tier with "zero-config" or
   "always available";
3. the setup-memory recipe names the server to install and the command that
   confirms it.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SKILL = ROOT / "src" / "skills" / "remember" / "SKILL.md"
DOCS = ROOT / "docs" / "site" / "content" / "docs"
RECIPE = DOCS / "cookbook" / "setup-memory.mdx"

MEMORY_TIER = re.compile(
    r"mcp__memory__|(?<!in-)\bmemory\b|knowledge graph|\*\*1\. Graph\*\*|all 3 tiers|1\. Graph",
    re.I,
)
OVERCLAIM = re.compile(
    r"zero[- ]config|always available|out of the box|no setup|no configuration", re.I
)
# A line that also states the server requirement is honest even when it says
# another tier needs no setup.
HONEST = re.compile(
    r"not bundle|needs a memory MCP server|only with a memory MCP server|only if a memory MCP server",
    re.I,
)
# Table cells that claim "no setup" for the graph tier through their column header.
CLAIM_HEADER = re.compile(r"config|setup|always available", re.I)
CLAIM_CELL = re.compile(r"^(none|yes|none \(zero-config\))$", re.I)
GRAPH_ROW = re.compile(r"mcp__memory__|graph", re.I)


def doc_files() -> list[Path]:
    files = sorted(DOCS.rglob("*.mdx"))
    files += sorted((ROOT / "src" / "skills").rglob("*.md"))
    return files


def table_overclaims(lines: list[str]) -> list[int]:
    """Line numbers of graph-tier table rows whose config or availability cell claims no setup."""
    hits: list[int] = []
    header: list[str] = []
    for n, line in enumerate(lines, 1):
        s = line.strip()
        if not s.startswith("|"):
            header = []
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        if not header:
            header = cells
            continue
        if not GRAPH_ROW.search(s):
            continue
        for h, c in zip(header, cells):
            if CLAIM_HEADER.search(h) and CLAIM_CELL.match(c):
                hits.append(n)
                break
    return hits


def test_skill_says_the_server_is_not_bundled() -> None:
    text = SKILL.read_text(encoding="utf-8")
    assert "does not bundle" in text, (
        "remember SKILL.md no longer says the memory server is not bundled"
    )


def test_no_page_calls_the_graph_tier_zero_config() -> None:
    bad = []
    for page in doc_files():
        lines = page.read_text(encoding="utf-8").splitlines()
        for n, line in enumerate(lines, 1):
            if MEMORY_TIER.search(line) and OVERCLAIM.search(line) and not HONEST.search(line):
                bad.append(f"{page.relative_to(ROOT)}:{n}: {line.strip()[:160]}")
        for n in table_overclaims(lines):
            bad.append(f"{page.relative_to(ROOT)}:{n} (table cell): {lines[n - 1].strip()[:160]}")
    assert not bad, "graph memory described as zero-config or always available:\n  " + "\n  ".join(
        bad
    )


def test_recipe_names_the_server_and_the_check() -> None:
    text = RECIPE.read_text(encoding="utf-8")
    missing = [
        s
        for s in ("@modelcontextprotocol/server-memory", "claude mcp list", "--scope user")
        if s not in text
    ]
    assert not missing, f"setup-memory.mdx does not name: {missing}"


TESTS = [
    test_skill_says_the_server_is_not_bundled,
    test_no_page_calls_the_graph_tier_zero_config,
    test_recipe_names_the_server_and_the_check,
]

if __name__ == "__main__":
    failures = 0
    for test in TESTS:
        try:
            test()
            print(f"PASS: {test.__name__}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL: {test.__name__}\n{exc}")
    if failures:
        print(f"\n{failures} of {len(TESTS)} checks failed")
        sys.exit(1)
    print(f"\nPASS: memory docs say what the graph tier needs ({len(TESTS)} checks)")
