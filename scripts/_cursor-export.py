#!/usr/bin/env python3
"""Cursor export: plugin-relative paths in the command wrappers, plus a rules export.

Called from scripts/build-plugins.sh after the command wrappers are generated.
Two jobs, one script, because both need the same path rewriter.

WHY (#3941): a command wrapper is written to
`plugins/ork/.cursor-plugin/commands/<skill>.md`, outside the skill directory the
body was authored in. A same-skill reference therefore cannot resolve from there
in either historical form:

  * before #3940 the body carried `${CLAUDE_PLUGIN_ROOT}/skills/<s>/references/x.md`,
    and Cursor never substitutes that variable (it is a Claude Code contract);
  * after #3940 the body carries bare `references/x.md`, which the Agent Skills
    spec resolves against the SKILL.md directory. The wrapper is not in it.

So both forms are rewritten here, at generation time, to plugin-relative paths
(`skills/<name>/references/x.md`), which is the anchor Cursor's plugin loader
uses for every other manifest path.

WHY (#4003, rules): Cursor's plugin manifest schema carries a `rules` key
alongside `skills`, `agents`, `commands` and `hooks`, and its loader discovers
`.md`, `.mdc` and `.markdown` under it. Measured 2026-09-08 against
cursor-agent 2026.09.02-c22c1a3 `index.js`:

    rules: r.KC([r.Yj(), r.YO(r.Yj())]).optional()          # string | string[]
    ...a.rules ? discoverFromManifestPaths(i, a.rules, !1, fc, s)
               : c.has("rules") ? discoverMarkdownComponents(`${i}rules`, fc, s)
    fc = [".md", ".mdc", ".markdown"]

and each rule's frontmatter is read for `name`, `description`, `globs`,
`alwaysApply`, with the routing `alwaysApply -> global`, `globs -> fileGlobbed`,
`description -> agentFetched`, else `manuallyAttached`. We emit description-only
rules so they are agent-fetched on relevance rather than pinned into every
session's context.

Scope note: `.claude/rules/` is NOT exported. Those rules are scoped by `paths:`
to this repository's own source tree (`src/hooks/**`, `tests/**`, manifests) and
instruct an agent on how to build OrchestKit. A downstream Cursor user installing
the plugin has no such tree, so shipping them would inject wrong instructions.
The exported set is `src/rules/` (host-neutral engineering rules) and
`src/shared/rules/` (the rules the skill bodies actually cite).
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

# Subdirectories a SKILL.md may reference relative to its own directory.
# Kept in lockstep with tests/plugins/test-cursor-paths.py.
SKILL_SUBDIRS = (
    "references",
    "rules",
    "scripts",
    "checklists",
    "assets",
    "workflows",
    "examples",
)

# `$SKILL_DIR` joins the two documented placeholders because it fails identically:
# nothing defines it in a Cursor session, so `bash "$SKILL_DIR/scripts/x.sh"`
# expands to `/scripts/x.sh`. Source-side it should be `${CLAUDE_SKILL_DIR}`
# (three occurrences in visualize-plan), but the export must not ship a path that
# cannot open regardless of which side is eventually corrected.
#
# The doubled-brace spellings are not a typo. Several skills emit a shell command
# from inside a Python f-string, where `{` has to be escaped:
#   Bash(command=f"bash ${{CLAUDE_PLUGIN_ROOT}}/skills/verify/scripts/x.sh ...")
# That renders to `${CLAUDE_PLUGIN_ROOT}/...` at runtime and is exactly as
# unresolvable in Cursor as the plain form. Three lines in the export carried it
# and the single-brace matcher walked straight past them. Longest spelling first,
# so a shorter one cannot eat the prefix of a longer one.
SKILL_DIR_VARS = (
    "${{CLAUDE_SKILL_DIR}}",
    "${CLAUDE_SKILL_DIR}",
    "$CLAUDE_SKILL_DIR",
    "${{SKILL_DIR}}",
    "${SKILL_DIR}",
    "$SKILL_DIR",
)
PLUGIN_ROOT_VARS = (
    "${{CLAUDE_PLUGIN_ROOT}}",
    "${CLAUDE_PLUGIN_ROOT}",
    "$CLAUDE_PLUGIN_ROOT",
)

# A path character before a candidate means the reference is already anchored
# (`shared/rules/x.md`, `skills/foo/references/x.md`, `$SKILL_DIR/scripts/x.sh`)
# and must be left alone. Single-character class, so Python's fixed-width
# lookbehind accepts it.
NOT_PATH_CHAR = r"(?<![A-Za-z0-9._/-])"


def strip_plugin_root(text: str) -> str:
    """`${CLAUDE_PLUGIN_ROOT}/x` -> `x`. Cursor never substitutes the variable."""
    for var in PLUGIN_ROOT_VARS:
        text = text.replace(var + "/", "")
    return text


def rewrite_skill_dir(text: str, skill_name: str) -> str:
    """`${CLAUDE_SKILL_DIR}/scripts/x.py` -> `skills/<name>/scripts/x.py`."""
    for var in SKILL_DIR_VARS:
        text = text.replace(var + "/", f"skills/{skill_name}/")
    return text


def skill_relative_files(skill_dir: Path) -> list[str]:
    """Every file under the skill's reference subdirectories, skill-relative.

    Existence on disk is the whole discriminator. A prose mention of
    `scripts/build-plugins.sh` is this repository's build script, not the skill's,
    and rewriting it to `skills/<name>/scripts/build-plugins.sh` would invent a
    path. Only files that are really there get rewritten, so the rewrite can
    never manufacture a broken reference: the gate in
    tests/plugins/test-cursor-paths.py asserts exactly that, in reverse.
    """
    found: list[str] = []
    for sub in SKILL_SUBDIRS:
        base = skill_dir / sub
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file():
                found.append(path.relative_to(skill_dir).as_posix())
    # Longest first so a nested path is never shadowed by a prefix of itself.
    return sorted(found, key=len, reverse=True)


def rewrite_bare_refs(text: str, skill_name: str, skill_dir: Path) -> str:
    for rel in skill_relative_files(skill_dir):
        text = re.sub(
            NOT_PATH_CHAR + re.escape(rel),
            f"skills/{skill_name}/{rel}",
            text,
        )
    return text


def rewrite_command(text: str, skill_name: str, skill_dir: Path) -> str:
    # Order matters, though not for the reason it first looks like. A
    # cross-skill `${CLAUDE_PLUGIN_ROOT}/skills/other/references/x.md` is safe
    # either way: NOT_PATH_CHAR sees the slash before `references/` and refuses
    # it whichever pass runs first. The case that actually needs this order is
    # `${CLAUDE_PLUGIN_ROOT}/references/x.md`, where the same slash HIDES a
    # reference that should be anchored. Strip first and the bare-ref pass sees
    # `references/x.md` at a word boundary and anchors it; run the passes the
    # other way round and it survives as a bare relative path, which is the
    # defect this whole file exists to remove.
    # Measured, not assumed: reversing these three lines leaves
    # `Read("references/guide.md")` where `Read("skills/demo/references/guide.md")`
    # belongs.
    text = strip_plugin_root(text)
    text = rewrite_skill_dir(text, skill_name)
    return rewrite_bare_refs(text, skill_name, skill_dir)


FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def split_frontmatter(text: str) -> tuple[str, str]:
    match = FRONTMATTER.match(text)
    if not match:
        return "", text
    return match.group(1), text[match.end() :]


def frontmatter_value(frontmatter: str, key: str) -> str:
    for line in frontmatter.splitlines():
        if line.startswith(f"{key}:"):
            return line[len(key) + 1 :].strip().strip('"').strip("'")
    return ""


def first_prose_sentence(body: str) -> str:
    """First sentence of the first prose paragraph, for the rule description.

    Headings, code fences, tables, blockquotes and list markers are skipped, so
    the result is a pure function of the file and stable across builds.
    """
    in_fence = False
    for raw in body.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not line:
            continue
        if line[0] in "#|>-*" or line.startswith("---"):
            continue
        sentence = re.split(r"(?<=[.!?])\s", line, maxsplit=1)[0]
        return re.sub(r"[*`_\[\]]", "", sentence).strip()
    return ""


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def render_rule(source: Path, origin: str) -> tuple[str, str]:
    """Return (slug, .mdc text) for one source rule."""
    raw = source.read_text(encoding="utf-8")
    frontmatter, body = split_frontmatter(raw)
    slug = source.stem.lstrip("_") or source.stem
    title = frontmatter_value(frontmatter, "title") or slug.replace("-", " ")

    # Cursor selects an agent-fetched rule by matching this description against
    # the task, so it is the whole retrieval surface. `impactDescription` is
    # hand-written for exactly that job and 9 of the 14 sources carry one; the
    # first prose sentence is the fallback for the rest.
    lead = (
        frontmatter_value(frontmatter, "description")
        or frontmatter_value(frontmatter, "impactDescription")
        or first_prose_sentence(body)
    )
    description = f"{title}. {lead}" if lead else title
    if len(description) > 300:
        description = description[:297].rstrip() + "..."

    body = strip_plugin_root(body).lstrip("\n")

    header = "\n".join(
        [
            "---",
            f"name: {slug}",
            f"description: {yaml_quote(description)}",
            # No globs and alwaysApply false puts the rule in Cursor's
            # "agentFetched" class: pulled in when the description matches the
            # task, never pinned into every session. 14 rules pinned globally
            # would be a context tax nobody asked for.
            "alwaysApply: false",
            "---",
            "",
            f"<!-- Generated by scripts/_cursor-export.py from {origin}. Do not edit. -->",
            "",
        ]
    )
    return slug, header + body.rstrip() + "\n"


def export_rules(plugin_dir: Path, src_dir: Path) -> int:
    out_dir = plugin_dir / ".cursor-plugin" / "rules"
    if out_dir.exists():
        shutil.rmtree(out_dir)

    sources: list[tuple[Path, str]] = []
    for rel in ("rules", "shared/rules"):
        base = src_dir / rel
        if base.is_dir():
            sources += [(p, f"src/{rel}/{p.name}") for p in sorted(base.glob("*.md"))]

    if not sources:
        return 0

    out_dir.mkdir(parents=True)
    seen: dict[str, str] = {}
    for source, origin in sources:
        slug, text = render_rule(source, origin)
        if slug in seen:
            # Silently overwriting would drop a rule and keep the count looking
            # right, which is the failure this whole lane exists to stop.
            raise SystemExit(f"ERROR: rule slug collision '{slug}': {seen[slug]} and {origin}")
        seen[slug] = origin
        (out_dir / f"{slug}.mdc").write_text(text, encoding="utf-8")
    return len(seen)


def export_commands(plugin_dir: Path) -> int:
    commands_dir = plugin_dir / ".cursor-plugin" / "commands"
    if not commands_dir.is_dir():
        return 0
    count = 0
    for command in sorted(commands_dir.glob("*.md")):
        skill_name = command.stem
        skill_dir = plugin_dir / "skills" / skill_name
        if not skill_dir.is_dir():
            raise SystemExit(f"ERROR: command wrapper {command.name} has no skill at {skill_dir}")
        original = command.read_text(encoding="utf-8")
        rewritten = rewrite_command(original, skill_name, skill_dir)
        if rewritten != original:
            command.write_text(rewritten, encoding="utf-8")
        count += 1
    return count


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: _cursor-export.py <plugin_dir> <src_dir>", file=sys.stderr)
        return 2
    plugin_dir = Path(argv[1]).resolve()
    src_dir = Path(argv[2]).resolve()

    commands = export_commands(plugin_dir)
    rules = export_rules(plugin_dir, src_dir)
    print(f"  Cursor export: {commands} command wrappers rewritten, {rules} rules emitted")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
