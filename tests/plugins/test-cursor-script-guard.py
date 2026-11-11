"""Cursor commands run skill scripts only from the installed plugin directory.

Cursor does not substitute a plugin-root variable in command bodies (measured in
cursor-agent 2026.11.05: only mcpServers config gets one), so a plugin-relative
`skills/<name>/scripts/x` cannot name the installed plugin's own script. The
exporter therefore denies by default: any executed
interpreter plus a skills script path becomes a non-runnable
`<ORK_PLUGIN_DIR>/skills/...` placeholder, and the command gets a resolver that
accepts only a real installed plugin directory outside the workspace.

Four gates:
1. the rewrite turns an executed script line into the placeholder and leaves a
   read-only reference alone;
2. the resolver prints exactly one verdict line per case, refusing relative
   paths, traversal, paths inside the workspace, paths outside the installed
   Cursor plugin tree and directories that are not an OrchestKit plugin root;
3. the resolver runs in a subshell, so a refusal never ends the agent's shell;
4. no generated Cursor command file holds an unanchored skills
   script path, and each file with the placeholder carries the resolver.
"""

from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMANDS = ROOT / "plugins" / "ork" / ".cursor-plugin" / "commands"
EXPORTER = ROOT / "scripts" / "_cursor-export.py"

# Any skills script path not anchored to the installed plugin directory, whatever
# precedes it: an interpreter with or without flags, bare or ./ execution, or a
# mention in prose or a table. Default deny: only `<ORK_PLUGIN_DIR>/skills/...`
# (a path character before `skills/`) passes.
RUNNABLE = re.compile(r"(?<![A-Za-z0-9._/>-])(?:\./)?skills/[A-Za-z0-9._-]+/scripts/")


def exporter():
    spec = importlib.util.spec_from_file_location("ork_cursor_export", EXPORTER)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_rewrite_turns_executed_scripts_into_the_placeholder() -> None:
    ex = exporter()
    with tempfile.TemporaryDirectory() as tmp:
        skill = Path(tmp) / "demo"
        (skill / "scripts").mkdir(parents=True)
        (skill / "scripts" / "run.py").write_text("")
        (skill / "references").mkdir()
        (skill / "references" / "guide.md").write_text("")
        body = (
            "Read `${CLAUDE_SKILL_DIR}/references/guide.md` first.\n\n"
            "```bash\n"
            'python3 "${CLAUDE_SKILL_DIR}/scripts/run.py" --root ~/code\n'
            "bash ${CLAUDE_SKILL_DIR}/scripts/run.py\n"
            "python3 -I ${CLAUDE_SKILL_DIR}/scripts/run.py\n"
            "./${CLAUDE_SKILL_DIR}/scripts/run.py\n"
            "${CLAUDE_SKILL_DIR}/scripts/run.py --json\n"
            "```\n\n"
            "| step | command |\n|---|---|\n| check | `${CLAUDE_SKILL_DIR}/scripts/run.py` |\n"
        )
        out = ex.rewrite_command(body, "demo", skill)
    assert 'python3 "<ORK_PLUGIN_DIR>/skills/demo/scripts/run.py" --root ~/code' in out, out
    assert "bash <ORK_PLUGIN_DIR>/skills/demo/scripts/run.py" in out, out
    assert "`skills/demo/references/guide.md`" in out, out
    assert not RUNNABLE.search(out), out
    assert ex.GUARD_HEADING in out, out


def run_guard(ex, path: str, cwd: Path, home: Path, skill: str = "demo") -> tuple[int, str]:
    cmd = ex.script_guard(skill).replace("PASTE_PATH_HERE", path)
    r = subprocess.run(
        ["bash", "-c", cmd + "\necho AFTER-GUARD"],
        cwd=cwd,
        env={**os.environ, "HOME": str(home)},
        capture_output=True,
        text=True,
    )
    return r.returncode, r.stdout


def make_plugin(base: Path, skill: str = "demo") -> Path:
    (base / ".cursor-plugin").mkdir(parents=True)
    (base / ".cursor-plugin" / "plugin.json").write_text("{}")
    (base / "skills" / skill / "scripts").mkdir(parents=True)
    return base


def test_resolver_verdicts_are_exact() -> None:
    ex = exporter()
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp).resolve()
        home = t / "home"
        ws = t / "workspace"
        ws.mkdir()
        good = make_plugin(home / ".cursor" / "plugins" / "cache" / "ork")
        in_ws = make_plugin(ws / "vendored-ork")
        outside = make_plugin(t / "elsewhere" / "ork")
        bare = home / ".cursor" / "plugins" / "not-ork"
        bare.mkdir(parents=True)
        cases = [
            ("skills/demo", "REFUSED: not an absolute path"),
            (f"{good}/../ork", "REFUSED: path traversal"),
            (str(in_ws), "REFUSED: inside the workspace"),
            (str(outside), "REFUSED: not an installed Cursor plugin (outside ~/.cursor/plugins)"),
            (str(bare), "REFUSED: not an OrchestKit plugin root"),
            (str(t / "missing"), "REFUSED: not a directory"),
        ]
        for path, verdict in cases:
            rc, out = run_guard(ex, path, ws, home)
            lines = out.splitlines()
            assert lines == [verdict, "AFTER-GUARD"], (path, out)
        rc, out = run_guard(ex, str(good), ws, home)
        assert out.splitlines() == [f"ORK_PLUGIN_DIR={good}", "AFTER-GUARD"], out
        assert rc == 0


def test_no_unanchored_skill_script_in_export() -> None:
    files = sorted(COMMANDS.glob("*.md"))
    assert files, f"no Cursor command files under {COMMANDS}"
    ex = exporter()
    bad = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        for n, line in enumerate(text.splitlines(), 1):
            if RUNNABLE.search(line):
                bad.append(f"{f.name}:{n}: {line.strip()}")
        if "<ORK_PLUGIN_DIR>" in text and ex.GUARD_HEADING not in text:
            bad.append(f"{f.name}: uses <ORK_PLUGIN_DIR> without the resolver")
    assert not bad, "unanchored skill scripts:\n  " + "\n  ".join(bad)


TESTS = [
    test_rewrite_turns_executed_scripts_into_the_placeholder,
    test_resolver_verdicts_are_exact,
    test_no_unanchored_skill_script_in_export,
]

if __name__ == "__main__":
    failures = 0
    for test in TESTS:
        try:
            test()
            print(f"PASS: {test.__name__}")
        except (AssertionError, AttributeError) as exc:
            failures += 1
            print(f"FAIL: {test.__name__}\n{exc}")
    if failures:
        print(f"\n{failures} of {len(TESTS)} checks failed")
        sys.exit(1)
    print(f"\nPASS: Cursor commands run skill scripts only from the plugin ({len(TESTS)} checks)")
