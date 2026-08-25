"""Negative control: Cursor adapter is skills-only and matches source."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "src" / "cursor" / "ork-cursor"
PLUGIN = ROOT / "plugins" / "ork-cursor"
MARKET = ROOT / ".cursor-plugin" / "marketplace.json"
EXPECTED = (
    "ork-brainstorm",
    "ork-explore",
    "ork-assess",
    "ork-verify",
    "ork-review-pr",
)


def test_source_and_plugin_exist() -> None:
    assert SOURCE.is_dir()
    assert PLUGIN.is_dir()
    assert MARKET.is_file()


def test_five_skills_present() -> None:
    for name in EXPECTED:
        skill = PLUGIN / "skills" / name / "SKILL.md"
        assert skill.is_file(), name
        head = "\n".join(skill.read_text(encoding="utf-8").splitlines()[:8])
        assert f"name: {name}" in head
        assert "description:" in head


def test_no_mcp_hooks_or_roles() -> None:
    assert not (PLUGIN / "mcp.json").exists()
    assert not (PLUGIN / "hooks").exists()
    assert not (PLUGIN / "roles").exists()


def test_plugin_json_is_skills_only() -> None:
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    data = json.loads((PLUGIN / ".cursor-plugin" / "plugin.json").read_text(encoding="utf-8"))
    assert data["name"] == "ork-cursor"
    assert data["version"] == package_version
    assert data["skills"] == "./skills/"
    assert "mcpServers" not in data
    assert "hooks" not in data
    assert "commands" not in data
    assert data["description"]
    assert data["author"]["name"]


def test_marketplace_points_at_ork_cursor() -> None:
    data = json.loads(MARKET.read_text(encoding="utf-8"))
    assert data["name"] == "orchestkit"
    names = [p["name"] for p in data["plugins"]]
    assert names == ["ork-cursor"]
    assert data["plugins"][0]["source"] == "./plugins/ork-cursor"


def test_plugin_mirrors_source_except_stamped_version() -> None:
    source_files = {p.relative_to(SOURCE) for p in SOURCE.rglob("*") if p.is_file()}
    plugin_files = {p.relative_to(PLUGIN) for p in PLUGIN.rglob("*") if p.is_file()}
    assert source_files == plugin_files
    for rel in source_files:
        if rel.as_posix() == ".cursor-plugin/plugin.json":
            continue
        assert (SOURCE / rel).read_bytes() == (PLUGIN / rel).read_bytes()


if __name__ == "__main__":
    test_source_and_plugin_exist()
    test_five_skills_present()
    test_no_mcp_hooks_or_roles()
    test_plugin_json_is_skills_only()
    test_marketplace_points_at_ork_cursor()
    test_plugin_mirrors_source_except_stamped_version()
    print("PASS: Cursor plugin contract (5 skills, no MCP, no Claude hooks)")
