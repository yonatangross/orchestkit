"""Cursor loads the real ork plugin, not a skill fork."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "plugins" / "ork"
MARKET = ROOT / ".cursor-plugin" / "marketplace.json"


def test_marketplace_points_at_ork() -> None:
    data = json.loads(MARKET.read_text(encoding="utf-8"))
    assert data["name"] == "orchestkit"
    names = [p["name"] for p in data["plugins"]]
    # The opt-in ork-extras plugin (#4936) is listed next to the full ork plugin.
    assert names == ["ork", "ork-extras"], names
    # Cursor Import Marketplace rejects "./plugins/ork" as invalid_argument.
    # Official cursor/plugins uses bare relative paths (e.g. "third_party/gmail").
    sources = {p["name"]: p["source"] for p in data["plugins"]}
    assert sources == {"ork": "plugins/ork", "ork-extras": "plugins/ork-extras"}, sources


def test_cursor_manifest_is_the_full_plugin() -> None:
    claude = json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    cursor = json.loads((PLUGIN / ".cursor-plugin" / "plugin.json").read_text(encoding="utf-8"))
    assert cursor["name"] == "ork"
    assert cursor["version"] == claude["version"]
    assert cursor["skills"] == "./skills/"
    # #3541: wrappers are a Cursor-only artifact now; CC surfaces skills natively.
    assert cursor["commands"] == "./.cursor-plugin/commands/"
    assert "commands" not in claude
    assert not (PLUGIN / "commands").exists()
    assert (PLUGIN / ".cursor-plugin" / "commands").is_dir()
    assert cursor["agents"] == "./agents/"
    assert "hooks" not in cursor
    assert "mcpServers" not in cursor
    assert (PLUGIN / "skills").is_dir()
    # Core ships src/skills minus the manifest's skillsExclude (#4936), compared
    # by name so equal counts cannot hide wrong membership.
    excluded = set(
        json.loads((ROOT / "manifests" / "ork.json").read_text(encoding="utf-8")).get(
            "skillsExclude", []
        )
    )
    assert excluded, (
        "manifests/ork.json skillsExclude is empty or missing; the split check would be vacuous"
    )
    src = {p.name for p in (ROOT / "src" / "skills").iterdir() if (p / "SKILL.md").is_file()}
    built = {p.name for p in (PLUGIN / "skills").iterdir() if (p / "SKILL.md").is_file()}
    assert src, "src/skills has no skills"
    assert built == src - excluded, sorted(built ^ (src - excluded))


def test_no_thin_cursor_fork() -> None:
    assert not (ROOT / "plugins" / "ork-cursor").exists()
    assert not (ROOT / "src" / "cursor").exists()


if __name__ == "__main__":
    test_marketplace_points_at_ork()
    test_cursor_manifest_is_the_full_plugin()
    test_no_thin_cursor_fork()
    print("PASS: Cursor marketplace loads the full ork plugin")
