"""Unit tests for the Cursor export rewriter (scripts/_cursor-export.py).

tests/plugins/test-cursor-paths.py checks the shipped artifact: no placeholder
used as a path, no bare same-skill reference left, every rewritten path resolves.
That is the right gate for what ships, and it cannot test the half that matters
most for a rewriter, which is what it REFUSES to touch. The export happens to
contain no line where a wrong rewrite would be visible, so the artifact gate
would stay green while the rewriter quietly retargeted prose.

These tests drive the pure functions directly against a fixture skill, so the
negatives are real assertions rather than an absence of evidence.
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# The module is underscore-prefixed and not a package, so import it by path.
#
# Bytecode writing is disabled first, and that is not hygiene. Python validates a
# cached .pyc by (source mtime, source size), and a mutation that reorders lines
# changes NEITHER. During a mutation run of this suite the restored source was
# served from a .pyc compiled from the mutated one: the suite reported a failure
# against a file that was already correct on disk, and `git diff` showed nothing
# wrong. A test that can be answered by a stale artifact is not measuring the
# tree it claims to measure.
sys.dont_write_bytecode = True

_spec = importlib.util.spec_from_file_location(
    "cursor_export", ROOT / "scripts" / "_cursor-export.py"
)
CE = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(CE)


def make_skill(tmp: Path) -> Path:
    """A fixture skill with two real files and nothing else."""
    skill = tmp / "skills" / "demo"
    (skill / "references").mkdir(parents=True)
    (skill / "scripts").mkdir()
    (skill / "references" / "guide.md").write_text("x", encoding="utf-8")
    (skill / "references" / "deep" / "nested.md").parent.mkdir()
    (skill / "references" / "deep" / "nested.md").write_text("x", encoding="utf-8")
    (skill / "scripts" / "run.sh").write_text("x", encoding="utf-8")
    return skill


# --------------------------------------------------------------------------
# strip_plugin_root
# --------------------------------------------------------------------------


def test_strip_plugin_root_all_three_spellings() -> None:
    got = CE.strip_plugin_root(
        "a ${CLAUDE_PLUGIN_ROOT}/x.md b $CLAUDE_PLUGIN_ROOT/y.md c ${{CLAUDE_PLUGIN_ROOT}}/z.md"
    )
    assert got == "a x.md b y.md c z.md", got


def test_strip_plugin_root_leaves_prose_alone() -> None:
    """A mention of the variable that is not a path prefix must survive.

    `commands/help.md` documents what the variable means. Stripping it there
    would edit documentation, which is not what a path rewriter is for.
    """
    prose = "# ${CLAUDE_PLUGIN_ROOT} is set by the plugin runtime."
    assert CE.strip_plugin_root(prose) == prose


# --------------------------------------------------------------------------
# rewrite_skill_dir
# --------------------------------------------------------------------------


def test_rewrite_skill_dir_covers_every_spelling() -> None:
    got = CE.rewrite_skill_dir(
        "${CLAUDE_SKILL_DIR}/a.py $CLAUDE_SKILL_DIR/b.py "
        "${{CLAUDE_SKILL_DIR}}/c.py $SKILL_DIR/d.sh ${SKILL_DIR}/e.sh",
        "demo",
    )
    assert got == (
        "skills/demo/a.py skills/demo/b.py "
        "skills/demo/c.py skills/demo/d.sh skills/demo/e.sh"
    ), got


def test_doubled_brace_is_not_reachable_by_the_single_brace_form() -> None:
    """The reason both spellings are listed, stated as a test.

    `${CLAUDE_PLUGIN_ROOT}` is not a substring of `${{CLAUDE_PLUGIN_ROOT}}`, so a
    matcher that knows only the single-brace form walks past the f-string form
    and the placeholder count still reads clean. Three lines in the export were
    exactly this.
    """
    assert "${CLAUDE_PLUGIN_ROOT}" not in "${{CLAUDE_PLUGIN_ROOT}}"


# --------------------------------------------------------------------------
# skill_relative_files
# --------------------------------------------------------------------------


def test_skill_relative_files_finds_only_real_files_longest_first() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        found = CE.skill_relative_files(skill)
        assert set(found) == {
            "references/guide.md",
            "references/deep/nested.md",
            "scripts/run.sh",
        }, found
        lengths = [len(f) for f in found]
        assert lengths == sorted(lengths, reverse=True), found


def test_skill_relative_files_ignores_unknown_subdirs() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        (skill / "evals").mkdir()
        (skill / "evals" / "cases.jsonl").write_text("x", encoding="utf-8")
        assert not any(f.startswith("evals/") for f in CE.skill_relative_files(skill))


# --------------------------------------------------------------------------
# rewrite_bare_refs: the refusals
# --------------------------------------------------------------------------


def test_bare_ref_to_a_real_file_is_rewritten() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        got = CE.rewrite_bare_refs('Read("references/guide.md")', "demo", skill)
        assert got == 'Read("skills/demo/references/guide.md")', got


def test_bare_ref_to_a_file_that_does_not_exist_is_left_alone() -> None:
    """The discriminator that keeps the rewriter honest.

    Skill bodies talk about this repository's own `scripts/build-plugins.sh`.
    Rewriting that to `skills/demo/scripts/build-plugins.sh` would invent a path
    that opens nowhere, and the artifact gate would still pass its placeholder
    check while shipping it.
    """
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        text = "Run `scripts/build-plugins.sh` and read `references/absent.md`."
        assert CE.rewrite_bare_refs(text, "demo", skill) == text


def test_already_anchored_paths_are_left_alone() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        for anchored in (
            "shared/references/guide.md",
            "skills/other/references/guide.md",
            "docs/scripts/run.sh",
            "$SOMEVAR/references/guide.md",
            "a-references/guide.md",
        ):
            assert CE.rewrite_bare_refs(anchored, "demo", skill) == anchored, anchored


def test_nested_ref_is_not_shadowed_by_its_own_prefix() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        got = CE.rewrite_bare_refs("see references/deep/nested.md", "demo", skill)
        assert got == "see skills/demo/references/deep/nested.md", got


# --------------------------------------------------------------------------
# rewrite_command: order is load-bearing
# --------------------------------------------------------------------------


def test_cross_skill_ref_is_not_retargeted_at_this_skill() -> None:
    """A reference naming ANOTHER skill keeps naming it.

    Protected by the boundary guard rather than by pass order: the slash before
    `references/` is a path character, so the bare-ref pass refuses it whichever
    pass ran first. Asserted anyway, because it is the outcome that matters.
    """
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        got = CE.rewrite_command(
            'Read("${CLAUDE_PLUGIN_ROOT}/skills/other/references/guide.md")',
            "demo",
            skill,
        )
        assert got == 'Read("skills/other/references/guide.md")', got


def test_plugin_root_strip_runs_before_the_bare_ref_pass() -> None:
    """The case where pass ORDER is the only thing that decides the answer.

    `${CLAUDE_PLUGIN_ROOT}/references/guide.md` carries a slash before
    `references/`, which HIDES it from the bare-ref pass. Strip the prefix first
    and the reference reaches a word boundary and gets anchored; run the passes
    the other way round and it survives as a bare relative path, the exact
    defect this module removes.

    The first version of this suite asserted the ordering with the cross-skill
    case above, which the boundary guard already covers, so reversing the three
    lines in rewrite_command left the suite green. This is the assertion that
    actually fails when the order is wrong.
    """
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        got = CE.rewrite_command(
            'Read("${CLAUDE_PLUGIN_ROOT}/references/guide.md")', "demo", skill
        )
        assert got == 'Read("skills/demo/references/guide.md")', got


def test_rewrite_command_is_idempotent() -> None:
    with tempfile.TemporaryDirectory() as td:
        skill = make_skill(Path(td))
        once = CE.rewrite_command('Read("references/guide.md")', "demo", skill)
        assert CE.rewrite_command(once, "demo", skill) == once


# --------------------------------------------------------------------------
# rule rendering
# --------------------------------------------------------------------------


def write_rule(tmp: Path, name: str, frontmatter: str, body: str) -> Path:
    path = tmp / name
    path.write_text(f"---\n{frontmatter}\n---\n\n{body}\n", encoding="utf-8")
    return path


def test_description_precedence_prefers_impact_description() -> None:
    with tempfile.TemporaryDirectory() as td:
        src = write_rule(
            Path(td),
            "gate.md",
            'title: Verification Gate\nimpactDescription: Prevents premature completion claims',
            "## HEADING\n\nBefore any claim of success:",
        )
        slug, text = CE.render_rule(src, "src/shared/rules/gate.md")
        assert slug == "gate"
        assert 'description: "Verification Gate. Prevents premature completion claims"' in text


def test_description_falls_back_to_first_prose_sentence() -> None:
    with tempfile.TemporaryDirectory() as td:
        src = write_rule(
            Path(td),
            "quality.md",
            "title: Code Quality",
            "# Heading\n\n```\nfenced text\n```\n\n| a | b |\n\n- bullet\n\n"
            "Keep functions under 50 lines. Second sentence.",
        )
        _, text = CE.render_rule(src, "src/rules/quality.md")
        assert 'description: "Code Quality. Keep functions under 50 lines."' in text


def test_rendered_rule_carries_the_agent_fetched_shape() -> None:
    with tempfile.TemporaryDirectory() as td:
        src = write_rule(Path(td), "_sections.md", "title: Shared", "Body sentence.")
        slug, text = CE.render_rule(src, "src/shared/rules/_sections.md")
        # A leading underscore is stripped so the rule name reads as a name.
        assert slug == "sections"
        assert "name: sections\n" in text
        assert "alwaysApply: false\n" in text
        assert "globs:" not in text


def test_rendered_rule_body_has_no_plugin_root() -> None:
    with tempfile.TemporaryDirectory() as td:
        src = write_rule(
            Path(td), "r.md", "title: R", "See ${CLAUDE_PLUGIN_ROOT}/shared/assets/x.html"
        )
        _, text = CE.render_rule(src, "src/shared/rules/r.md")
        assert "CLAUDE_PLUGIN_ROOT" not in text
        assert "See shared/assets/x.html" in text


def test_internal_quotes_survive_as_valid_yaml() -> None:
    with tempfile.TemporaryDirectory() as td:
        src = write_rule(
            Path(td), "d.md", "title: Docstrings", 'Use """docstring""" on public functions.'
        )
        _, text = CE.render_rule(src, "src/rules/d.md")
        frontmatter = text.split("---\n", 2)[1]
        try:
            import yaml
        except ImportError:
            assert '\\"\\"\\"docstring\\"\\"\\"' in frontmatter
            return
        parsed = yaml.safe_load(frontmatter)
        assert '"""docstring"""' in parsed["description"]


def test_slug_collision_is_refused_not_overwritten() -> None:
    """Two sources with one slug must fail loudly.

    Overwriting would drop a rule while the emitted count still looked
    plausible, which is the exact failure shape this lane exists to close.
    """
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for rel in ("rules", "shared/rules"):
            d = tmp / "src" / rel
            d.mkdir(parents=True)
            write_rule(d, "same.md", "title: Same", "Body.")
        plugin = tmp / "plugin"
        (plugin / ".cursor-plugin").mkdir(parents=True)
        try:
            CE.export_rules(plugin, tmp / "src")
        except SystemExit as exc:
            assert "collision" in str(exc), exc
        else:
            raise AssertionError("a duplicate slug was accepted")


def test_export_commands_refuses_a_wrapper_with_no_skill() -> None:
    with tempfile.TemporaryDirectory() as td:
        plugin = Path(td) / "plugin"
        commands = plugin / ".cursor-plugin" / "commands"
        commands.mkdir(parents=True)
        (commands / "ghost.md").write_text("body", encoding="utf-8")
        try:
            CE.export_commands(plugin)
        except SystemExit as exc:
            assert "no skill at" in str(exc), exc
        else:
            raise AssertionError("a wrapper with no skill was accepted")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    failures = 0
    for test in TESTS:
        try:
            test()
            print(f"PASS: {test.__name__}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL: {test.__name__}: {exc}")
    if failures:
        print(f"\n{failures} of {len(TESTS)} unit checks failed")
        sys.exit(1)
    print(f"\nPASS: Cursor export rewriter ({len(TESTS)} unit checks)")
