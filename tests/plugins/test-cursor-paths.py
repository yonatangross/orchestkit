"""Every path in the Cursor export opens (#3941, #4003).

The Cursor command wrappers live in `.cursor-plugin/commands/`, one directory
away from the skills whose bodies they carry, and the rules export is generated.
Three failure modes get a gate each:

1. A Claude Code placeholder used as a path prefix. Cursor never substitutes
   `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_SKILL_DIR}`, so `${CLAUDE_PLUGIN_ROOT}/x`
   is a path that cannot open. A bare mention of an env var in prose is NOT this
   (`$CLAUDE_EFFORT` scales agent count, `CLAUDE_CODE_OAUTH_TOKEN` is a CI
   secret name) and must stay readable, so the gate keys on the trailing slash
   that makes it a path.

2. A bare same-skill reference left un-rewritten. `references/x.md` resolves
   against the SKILL.md directory per the Agent Skills spec; from
   `.cursor-plugin/commands/` it resolves against nothing.

3. A rewritten path that points at a file which is not there. This is the
   positive check and the one that would catch a rewriter bug: it walks every
   `skills/<name>/<sub>/<path>` the export emits and stats it in the plugin.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "plugins" / "ork"
CURSOR = PLUGIN / ".cursor-plugin"
COMMANDS = CURSOR / "commands"
RULES = CURSOR / "rules"

# Keep in lockstep with SKILL_SUBDIRS in scripts/_cursor-export.py.
SKILL_SUBDIRS = (
    "references",
    "rules",
    "scripts",
    "checklists",
    "assets",
    "workflows",
    "examples",
)

# `${CLAUDE_X}/`, `${{CLAUDE_X}}/` (Python f-string) or `$CLAUDE_X/`, i.e. the
# variable used as a path prefix. The trailing slash is the discriminator.
PLACEHOLDER_PATH = re.compile(r"\$\{{0,2}CLAUDE_[A-Z_]+\}{0,2}/")
SKILL_DIR_PATH = re.compile(r"\$\{{0,2}SKILL_DIR\}{0,2}/")

# The tail must END on an alphanumeric. Without that anchor the class eats the
# sentence period after "... load `references/safe-deletes.md`." and the check
# reports a missing file whose only defect is punctuation.
PATH_TAIL = r"[A-Za-z0-9._/-]*[A-Za-z0-9]"
BARE_REF = re.compile(
    r"(?<![A-Za-z0-9._/-])(" + "|".join(SKILL_SUBDIRS) + r")/" + PATH_TAIL
)
REWRITTEN_REF = re.compile(
    r"skills/([a-z0-9][a-z0-9-]*)/((?:" + "|".join(SKILL_SUBDIRS) + r")/" + PATH_TAIL + r")"
)


def export_files() -> list[Path]:
    files = sorted(COMMANDS.glob("*.md"))
    files += sorted(RULES.glob("*.mdc"))
    return files


def test_export_exists() -> None:
    assert COMMANDS.is_dir(), f"missing {COMMANDS}"
    assert RULES.is_dir(), f"missing {RULES}, run npm run build"
    assert len(list(COMMANDS.glob("*.md"))) > 0
    assert len(list(RULES.glob("*.mdc"))) > 0


def test_no_placeholder_used_as_a_path() -> None:
    offenders: list[str] = []
    for path in export_files():
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for pattern in (PLACEHOLDER_PATH, SKILL_DIR_PATH):
                hit = pattern.search(line)
                if hit:
                    rel = path.relative_to(ROOT)
                    offenders.append(f"{rel}:{lineno}: {hit.group(0)}")
    assert not offenders, "placeholder used as a path prefix:\n  " + "\n  ".join(offenders)


def test_no_bare_same_skill_reference() -> None:
    """A bare `references/x.md` that names a real file in the wrapper's own skill.

    Scoped to references that actually resolve inside the skill so prose about
    this repository's own `scripts/build-plugins.sh` is not swept up: that file
    does not exist under any skill, was never rewritten, and is not a defect.
    """
    offenders: list[str] = []
    for command in sorted(COMMANDS.glob("*.md")):
        skill_dir = PLUGIN / "skills" / command.stem
        for lineno, line in enumerate(command.read_text(encoding="utf-8").splitlines(), 1):
            for match in BARE_REF.finditer(line):
                candidate = match.group(0)
                if (skill_dir / candidate).is_file():
                    rel = command.relative_to(ROOT)
                    offenders.append(f"{rel}:{lineno}: {candidate}")
    assert not offenders, (
        "bare same-skill path in a Cursor command wrapper (#3941):\n  "
        + "\n  ".join(offenders)
    )


def test_rewritten_paths_resolve() -> None:
    """Every `skills/<name>/<sub>/<path>` the export emits is a real file.

    This is the check that fails if the rewriter ever invents a target, which is
    the way a path-rewriting fix goes wrong: the grep for placeholders passes and
    the plugin ships confident, unopenable paths instead of obvious ones.
    """
    missing: list[str] = []
    for path in export_files():
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for match in REWRITTEN_REF.finditer(line):
                target = PLUGIN / "skills" / match.group(1) / match.group(2)
                if not target.exists():
                    rel = path.relative_to(ROOT)
                    missing.append(f"{rel}:{lineno}: {match.group(0)}")
    assert not missing, "rewritten path does not resolve in the plugin:\n  " + "\n  ".join(
        missing
    )


def test_manifest_registers_rules() -> None:
    import json

    manifest = json.loads((CURSOR / "plugin.json").read_text(encoding="utf-8"))
    # Cursor's manifest schema takes `rules` as a string or a list of strings and
    # discovers .md/.mdc/.markdown under it (cursor-agent 2026.09.02, index.js).
    assert manifest["rules"] == "./.cursor-plugin/rules/"
    claude = json.loads(
        (PLUGIN / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8")
    )
    # Claude Code has no `rules` manifest key. Adding one there would be inert.
    assert "rules" not in claude


def test_rules_carry_frontmatter_cursor_reads() -> None:
    """name + description + alwaysApply, which is Cursor's agent-fetched shape.

    Its loader routes a rule by frontmatter: alwaysApply -> global (every
    session), globs -> file-globbed, description -> agent-fetched, none of them
    -> manually attached. Description-only is the one that costs no context until
    the rule is relevant.
    """
    for rule in sorted(RULES.glob("*.mdc")):
        text = rule.read_text(encoding="utf-8")
        assert text.startswith("---\n"), f"{rule.name}: no frontmatter"
        frontmatter = text.split("---\n", 2)[1]
        assert f"name: {rule.stem}\n" in frontmatter, f"{rule.name}: name mismatch"
        assert "description: " in frontmatter, f"{rule.name}: no description"
        assert "alwaysApply: false" in frontmatter, f"{rule.name}: must not be global"


def test_repo_local_rules_are_not_shipped() -> None:
    """`.claude/rules/` stays out of the export.

    Those rules are scoped by `paths:` to this repository's own tree (src/hooks,
    tests, manifests) and tell an agent how to build OrchestKit. A downstream
    Cursor user has no such tree, so shipping them would inject instructions
    about a codebase that is not theirs.
    """
    shipped = {p.stem for p in RULES.glob("*.mdc")}
    repo_local = {p.stem for p in (ROOT / ".claude" / "rules").glob("*.md")}
    leaked = sorted(shipped & repo_local)
    assert not leaked, f"repo-local rules leaked into the Cursor export: {leaked}"


TESTS = [
    test_export_exists,
    test_no_placeholder_used_as_a_path,
    test_no_bare_same_skill_reference,
    test_rewritten_paths_resolve,
    test_manifest_registers_rules,
    test_rules_carry_frontmatter_cursor_reads,
    test_repo_local_rules_are_not_shipped,
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
    print(f"\nPASS: Cursor export paths resolve ({len(TESTS)} checks)")
