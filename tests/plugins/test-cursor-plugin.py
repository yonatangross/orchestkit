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
    assert names == ["ork"]
    assert data["plugins"][0]["source"] == "./plugins/ork"


def test_cursor_manifest_is_the_full_plugin() -> None:
    claude = json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    cursor = json.loads((PLUGIN / ".cursor-plugin" / "plugin.json").read_text(encoding="utf-8"))
    assert cursor["name"] == "ork"
    assert cursor["version"] == claude["version"]
    assert cursor["skills"] == "./skills/"
    assert cursor["commands"] == "./commands/"
    assert cursor["agents"] == "./agents/"
    assert "hooks" not in cursor
    assert "mcpServers" not in cursor
    assert (PLUGIN / "skills").is_dir()
    skill_dirs = [p for p in (PLUGIN / "skills").iterdir() if p.is_dir()]
    assert len(skill_dirs) >= 100


def test_no_thin_cursor_fork() -> None:
    assert not (ROOT / "plugins" / "ork-cursor").exists()
    assert not (ROOT / "src" / "cursor").exists()


if __name__ == "__main__":
    test_marketplace_points_at_ork()
    test_cursor_manifest_is_the_full_plugin()
    test_no_thin_cursor_fork()
    print("PASS: Cursor marketplace loads the full ork plugin")
