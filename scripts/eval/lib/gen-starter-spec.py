#!/usr/bin/env python3
"""Generate a starter eval spec YAML from a component's frontmatter (#2192).

Seeds a minimal but structurally valid spec so a newly added skill or agent is
not silently uncovered. The output is a STARTER: the trigger prompt and the
single assertion are derived mechanically from the component description and are
meant to be refined by a human before the scores are trusted (hence the
`starter` tag and the header comment).

Usage:
    gen-starter-spec.py skill <component_md> <out_yaml> [--keywords "a|b|c"]
    gen-starter-spec.py agent <component_md> <out_yaml>

When --keywords is given (pipe-separated), the should-trigger prompt is
guaranteed to contain one of them, and the tool exits non-zero if it cannot.

Stdlib only. Deterministic. No network.
"""

import datetime
import json
import pathlib
import sys


def parse_frontmatter(text: str) -> dict[str, str]:
    """Extract top-level scalar keys from the leading YAML frontmatter block.

    Handles single-line values plus folded/literal/blank multi-line values by
    joining subsequent more-indented lines. Good enough for name + description;
    not a general YAML parser.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    fields: dict[str, str] = {}
    key = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal key, buf
        if key is not None:
            fields[key] = " ".join(part.strip() for part in buf if part.strip())
        key, buf = None, []

    for raw in lines[1:]:
        if raw.strip() == "---":
            break
        # A new top-level key: `name:` / `description:` (no leading indent).
        if raw and not raw[0].isspace() and ":" in raw:
            flush()
            k, _, v = raw.partition(":")
            key = k.strip()
            v = v.strip()
            # Strip block scalar indicators; the continuation lines carry text.
            if v in (">", "|", ">-", "|-", ">+", "|+"):
                v = ""
            buf = [v]
        elif key is not None:
            buf.append(raw)
    flush()

    # Strip matching surrounding quotes from scalar values.
    for k, v in list(fields.items()):
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            fields[k] = v[1:-1]
    return fields


def sanitize(text: str) -> str:
    """Drop typographic dashes (house style forbids em/en dashes everywhere)."""
    text = text.replace(" — ", ", ").replace("—", ", ").replace("–", "-").replace("--", ", ")
    text = " ".join(text.split())
    return text.replace(" ,", ",").replace(" .", ".")


def first_sentence(desc: str) -> str:
    desc = sanitize(desc)
    if not desc:
        return ""
    for sep in (". ", "! ", "? "):
        idx = desc.find(sep)
        if idx != -1:
            return desc[: idx + 1].strip()
    # Single sentence: keep it whole when reasonable, else break on a word.
    if len(desc) <= 200:
        return desc
    cut = desc[:197]
    space = cut.rfind(" ")
    return (cut[:space] if space > 0 else cut).rstrip() + "..."


def humanize(name: str) -> str:
    words = name.replace("-", " ").replace("_", " ").strip()
    return words[:1].upper() + words[1:] if words else name


def main() -> int:
    args = sys.argv[1:]
    keywords: list[str] = []
    if "--keywords" in args:
        k = args.index("--keywords")
        # Keywords arrive pipe-separated (keywords never contain '|').
        raw = args[k + 1] if k + 1 < len(args) else ""
        keywords = [w.strip() for w in raw.split("|") if w.strip()]
        del args[k : k + 2]
    if len(args) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    kind, comp_path, out_path = args[0], args[1], args[2]
    if kind not in ("skill", "agent"):
        print(f"unknown kind: {kind}", file=sys.stderr)
        return 2

    text = pathlib.Path(comp_path).read_text(encoding="utf-8")
    fm = parse_frontmatter(text)

    if kind == "skill":
        # src/skills/<name>/SKILL.md -> <name>
        name = pathlib.Path(comp_path).parent.name
        skill_path = f"src/skills/{name}/SKILL.md"
    else:
        # src/agents/<name>.md -> <name>
        name = pathlib.Path(comp_path).stem
        skill_path = f"src/agents/{name}.md"

    fm_name = fm.get("name", name)
    desc = fm.get("description", "")
    sentence = first_sentence(desc) or f"work handled by the {name} {kind}"
    # A plausible should-trigger user utterance derived from the description.
    trigger_prompt = sentence

    # When the skill declares trigger keywords, the should-trigger prompt MUST
    # contain one (tests/skills/triggering/test-trigger-keywords.sh requires it).
    # Keep the description sentence if it already contains a keyword; otherwise
    # seed the prompt from the most specific (longest) keyword.
    if keywords:
        low = trigger_prompt.lower()
        if not any(kw.lower() in low for kw in keywords):
            trigger_prompt = max(keywords, key=len)
        if not any(kw.lower() in trigger_prompt.lower() for kw in keywords):
            print(
                f"gen-starter-spec: {name}: could not build a trigger prompt "
                f"containing any of its keywords {keywords}",
                file=sys.stderr,
            )
            return 4

    if not trigger_prompt.strip():
        print(f"gen-starter-spec: {name}: empty trigger prompt", file=sys.stderr)
        return 4

    check = f"produces output consistent with: {sentence}"
    created = datetime.date.today().isoformat()

    def q(s: str) -> str:
        # JSON string literals are valid YAML flow (double-quoted) scalars.
        return json.dumps(s, ensure_ascii=False)

    header = (
        "# Generated by OrchestKit eval-coverage --fill (#2192)\n"
        "# STARTER spec: trigger prompt + assertion are derived mechanically from\n"
        "# the component description. Refine both before trusting the scores.\n"
        f"# Created: {created}\n\n"
    )

    display = humanize(fm_name) if fm_name == name else sanitize(fm_name)

    if kind == "skill":
        body = (
            f"id: {name}\n"
            f"name: {q(display + ' skill evaluation')}\n"
            f"skill_path: {skill_path}\n"
            "plugin_dir: plugins/ork\n\n"
            "trigger_evals:\n"
            f"  - prompt: {q(trigger_prompt)}\n"
            "    should_trigger: true\n\n"
            "quality_evals:\n"
            f"  - prompt: {q(trigger_prompt)}\n"
            "    assertions:\n"
            '      - name: "produces relevant output"\n'
            f"        check: {q(check)}\n\n"
            f"tags: [{name}, starter]\n"
        )
    else:
        body = (
            f"id: {name}\n"
            f"name: {q(display + ' agent evaluation')}\n"
            f"agent_path: {skill_path}\n\n"
            "agent_evals:\n"
            f"  - prompt: {q(trigger_prompt)}\n"
            "    scaffold: empty\n"
            "    assertions:\n"
            '      - name: "produces relevant output"\n'
            f"        check: {q(check)}\n\n"
            f"tags: [{name}, agent, starter]\n"
        )

    pathlib.Path(out_path).write_text(header + body, encoding="utf-8")
    print(f"wrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
