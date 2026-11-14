"""Cursor commands run plugin scripts only from the installed plugin directory.

Cursor does not substitute a plugin-root variable in command bodies (measured in
cursor-agent 2026.11.05: only mcpServers config gets one), so a plugin-relative
`skills/<name>/scripts/x` or `hooks/bin/x` cannot name the installed plugin's
own file. The exporter therefore denies by default: every unanchored skill
script path, `skills/<name>/../` path and `hooks/bin/` path becomes a
non-runnable `<ORK_PLUGIN_DIR>/...` placeholder, and the command gets a resolver
that finds the installed plugin directory itself (nothing is pasted in).

Four gates:
1. the rewrite turns every plugin script path into the placeholder and leaves a
   read-only reference alone;
2. the resolver prints exactly one verdict line per case: it accepts only an
   OrchestKit plugin root (plugin name `ork`, holding this skill) under
   ~/.cursor/plugins and outside the workspace, also when the workspace is HOME;
3. the resolver runs in a subshell, so a refusal never ends the agent's shell;
4. no generated Cursor command file holds an unanchored plugin script path, and
   each file with the placeholder carries the resolver.
"""

from __future__ import annotations

import importlib.util
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMANDS = ROOT / "plugins" / "ork" / ".cursor-plugin" / "commands"
EXPORTER = ROOT / "scripts" / "_cursor-export.py"

# A plugin script path not anchored to the installed plugin directory, whatever
# precedes it: an interpreter with or without flags, bare or ./ execution, or a
# mention in prose or a table. Default deny: only `<ORK_PLUGIN_DIR>/...` (a path
# character before the match) passes.
RUNNABLE = re.compile(
    r"(?<![A-Za-z0-9._/>-])(?:\./)?"
    r"(?:skills/[A-Za-z0-9._-]+/(?:scripts/|\.\./)|hooks/bin/)"
)

NOT_FOUND = "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"


def exporter():
    spec = importlib.util.spec_from_file_location("ork_cursor_export", EXPORTER)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_rewrite_turns_plugin_scripts_into_the_placeholder() -> None:
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
            "| step | command |\n|---|---|\n| check | `${CLAUDE_SKILL_DIR}/scripts/run.py` |\n\n"
            "!`echo '{}' | node \"${CLAUDE_SKILL_DIR}/../../hooks/bin/run-hook.mjs\" skill/x 2>/dev/null || true`\n\n"
            'Or run `node "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs" <loader>` yourself.\n'
        )
        out = ex.rewrite_command(body, "demo", skill)
    assert 'python3 "<ORK_PLUGIN_DIR>/skills/demo/scripts/run.py" --root ~/code' in out, out
    assert "bash <ORK_PLUGIN_DIR>/skills/demo/scripts/run.py" in out, out
    assert 'node "<ORK_PLUGIN_DIR>/hooks/bin/run-hook.mjs" skill/x' in out, out
    assert 'node "<ORK_PLUGIN_DIR>/hooks/bin/run-hook.mjs" <loader>' in out, out
    assert "`skills/demo/references/guide.md`" in out, out
    assert not RUNNABLE.search(out), out
    assert ex.GUARD_HEADING in out, out


# The agent may run the resolver under any of these; each one present is tested
# (macOS /bin/bash is 3.2 and /bin/sh is bash in POSIX mode; Ubuntu's is dash).
SHELLS = [s for s in ("/bin/sh", "/bin/bash", "/bin/dash", "/bin/zsh") if Path(s).exists()]
for _name in ("bash", "zsh", "dash"):
    _found = shutil.which(_name)
    if _found and _found not in SHELLS:
        SHELLS.append(_found)


def run_guard(ex, cwd: Path, home: Path, shell: str, skill: str = "demo") -> tuple[int, str]:
    r = subprocess.run(
        [shell, "-c", ex.script_guard(skill) + "\necho AFTER-GUARD"],
        cwd=cwd,
        env={**os.environ, "HOME": str(home)},
        capture_output=True,
        text=True,
    )
    return r.returncode, r.stdout


def make_plugin(
    base: Path, skill: str = "demo", name: str = "ork", author: str = "OrchestKit"
) -> Path:
    (base / ".cursor-plugin").mkdir(parents=True)
    (base / ".cursor-plugin" / "plugin.json").write_text(
        f'{{\n  "name": "{name}",\n  "author": {{\n    "name": "{author}"\n  }}\n}}\n'
    )
    (base / "skills" / skill / "scripts").mkdir(parents=True)
    return base


def test_resolver_verdicts_are_exact() -> None:
    ex = exporter()
    assert "PASTE" not in ex.script_guard("demo"), "the resolver must not take a pasted path"
    assert SHELLS, "no shell to run the resolver under"
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp).resolve()

        def layout(label: str) -> tuple[Path, Path]:
            home = t / label / "home"
            ws = t / label / "workspace"
            home.mkdir(parents=True)
            ws.mkdir(parents=True)
            return home, ws

        def plugins(home: Path) -> Path:
            return home / ".cursor" / "plugins"

        cases: list[tuple[str, Path, Path, str]] = []

        home, ws = layout("empty")
        cases.append(("nothing installed", ws, home, NOT_FOUND))

        home, ws = layout("other")
        make_plugin(plugins(home) / "cache" / "x", name="not-ork")
        cases.append(("another plugin name", ws, home, NOT_FOUND))

        home, ws = layout("author")
        make_plugin(plugins(home) / "cache" / "x", name="not-ork", author="ork")
        cases.append(("ork only as the author name", ws, home, NOT_FOUND))

        home, ws = layout("noskill")
        make_plugin(plugins(home) / "cache" / "ork", skill="other")
        cases.append(("ork without this skill", ws, home, NOT_FOUND))

        home, ws = layout("inws")
        vendored = make_plugin(ws / "vendored-ork")
        plugins(home).mkdir(parents=True)
        (plugins(home) / "linked").symlink_to(vendored)
        cases.append(("a link from the plugin tree into the workspace", ws, home, NOT_FOUND))

        home, ws = layout("baselink")
        make_plugin(ws / "plugins" / "cache" / "ork")
        (home / ".cursor").mkdir(parents=True)
        plugins(home).symlink_to(ws / "plugins")
        cases.append(("~/.cursor/plugins itself links into the workspace", ws, home, NOT_FOUND))

        home, ws = layout("wsinside")
        inside = make_plugin(plugins(home) / "cache" / "ork")
        cases.append(("a workspace inside the plugin", inside, home, NOT_FOUND))

        home, ws = layout("good")
        good = make_plugin(plugins(home) / "cache" / "ork")
        cases.append(("the installed plugin", ws, home, f"ORK_PLUGIN_DIR={good}"))
        cases.append(
            ("the installed plugin, workspace is HOME", home, home, f"ORK_PLUGIN_DIR={good}")
        )

        home, ws = layout("two")
        old = make_plugin(plugins(home) / "aaa" / "ork" / "1")
        new = make_plugin(plugins(home) / "cache" / "ork" / "2")
        os.utime(old / ".cursor-plugin" / "plugin.json", (1_000_000_000, 1_000_000_000))
        os.utime(new / ".cursor-plugin" / "plugin.json", (2_000_000_000, 2_000_000_000))
        cases.append(("two installs, the newest wins", ws, home, f"ORK_PLUGIN_DIR={new}"))

        bad = []
        for shell in SHELLS:
            for label, cwd, home, verdict in cases:
                rc, out = run_guard(ex, cwd, home, shell)
                if out.splitlines() != [verdict, "AFTER-GUARD"]:
                    bad.append(f"{shell}: {label}: {out!r}")
                elif verdict.startswith("ORK_PLUGIN_DIR=") and rc != 0:
                    bad.append(f"{shell}: {label}: rc {rc}")
        assert not bad, "resolver verdicts:\n  " + "\n  ".join(bad)


def test_no_unanchored_plugin_script_in_export() -> None:
    files = sorted(COMMANDS.glob("*.md"))
    assert files, f"no Cursor command files under {COMMANDS}"
    ex = exporter()
    bad = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        for n, line in enumerate(text.splitlines(), 1):
            if RUNNABLE.search(line):
                bad.append(f"{f.name}:{n}: {line.strip()[:160]}")
        if "<ORK_PLUGIN_DIR>" in text and ex.GUARD_HEADING not in text:
            bad.append(f"{f.name}: uses <ORK_PLUGIN_DIR> without the resolver")
    assert not bad, "unanchored plugin scripts:\n  " + "\n  ".join(bad)


TESTS = [
    test_rewrite_turns_plugin_scripts_into_the_placeholder,
    test_resolver_verdicts_are_exact,
    test_no_unanchored_plugin_script_in_export,
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
    print(f"\nPASS: Cursor commands run plugin scripts only from the plugin ({len(TESTS)} checks)")
