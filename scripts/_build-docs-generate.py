#!/usr/bin/env python3
"""
_build-docs-generate.py - Generate all Fumadocs MDX reference pages.

Called by build-docs.sh with env vars:
  PROJECT_ROOT, SKILLS_SRC, AGENTS_SRC, HOOKS_JSON,
  DOCS_OUT, SKILLS_OUT, AGENTS_OUT, HOOKS_OUT

Generates skills, agents, and hooks reference pages.
"""

import json
import os
import re
import shutil
from pathlib import Path

# ---------------------------------------------------------------------------
# YAML frontmatter parser (no external deps)
# ---------------------------------------------------------------------------


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown text. Returns (metadata, body)."""
    if not text.startswith("---"):
        return {}, text

    # Find the closing ---
    lines = text.split("\n")
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        return {}, text

    fm_lines = lines[1:end_idx]
    body = "\n".join(lines[end_idx + 1 :])
    meta = {}
    current_key = None
    current_list = None

    for line in fm_lines:
        # Skip empty lines and comments
        if not line.strip() or line.strip().startswith("#"):
            continue

        # Check if this is a list item (continuation of previous key)
        list_match = re.match(r"^(\s+)-\s+(.+)$", line)
        if list_match and current_key and current_list is not None:
            val = list_match.group(2).strip().strip("\"'")
            current_list.append(val)
            meta[current_key] = current_list
            continue

        # Key-value pair
        kv_match = re.match(r"^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)?$", line)
        if kv_match:
            key = kv_match.group(1)
            raw_val = (kv_match.group(2) or "").strip()

            # Inline list: [a, b, c]
            if raw_val.startswith("[") and raw_val.endswith("]"):
                items = raw_val[1:-1].split(",")
                meta[key] = [item.strip().strip("\"'") for item in items if item.strip()]
                current_key = key
                current_list = None
                continue

            # Empty value (multiline list follows)
            if raw_val == "" or raw_val == "[]":
                current_key = key
                current_list = []
                meta[key] = current_list
                continue

            # Boolean
            if raw_val.lower() in ("true", "false"):
                meta[key] = raw_val.lower() == "true"
                current_key = key
                current_list = None
                continue

            # Strip quotes
            val = raw_val.strip("\"'")
            meta[key] = val
            current_key = key
            current_list = None

    return meta, body


def title_case(slug: str) -> str:
    """Convert kebab-case to Title Case."""
    return " ".join(word.capitalize() for word in slug.split("-"))


# Languages not in Shiki's default bundle — replace with 'text'
UNSUPPORTED_LANGS = {
    "colang",
    "tape",
    "redis",
    "env",
    "dotenv",
    "properties",
    "conf",
    "cfg",
    "ini",
}


_INLINE_CODE = re.compile(r"(`+)(.+?)\1")

# Known-safe HTML/MDX component tags that may stay as markup.
_SAFE_TAGS = {
    "br",
    "hr",
    "img",
    "a",
    "div",
    "span",
    "p",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "strong",
    "em",
    "code",
    "pre",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "sup",
    "sub",
    "details",
    "summary",
    "Callout",
    "Card",
    "Tab",
    "Tabs",
    "Steps",
    "Step",
}


def _escape_angle(m: "re.Match[str]") -> str:
    full = m.group(0)
    # Keep a known safe tag: <tag or </tag
    tag_match = re.match(r"</?([a-zA-Z]\w*)", full)
    if tag_match and tag_match.group(1) in _SAFE_TAGS:
        return full
    return full.replace("<", "&lt;").replace(">", "&gt;")


def _escape_mdx_text(text: str) -> str:
    """Escape braces and JSX-like angle brackets in plain markdown text."""
    text = text.replace("{", "\\{").replace("}", "\\}")
    # Any < ... > pair that is not a safe tag, then any bare < that MDX could
    # read as the start of JSX.
    text = re.sub(r"<[^>]*>", _escape_angle, text)
    text = re.sub(r"<(?![a-zA-Z/!&])", "&lt;", text)
    return text


def _escape_outside_inline_code(line: str, escape=_escape_mdx_text) -> str:
    """Apply `escape` to everything except inline code spans.

    MDX renders inline code literally, so escaping inside it put visible
    backslashes and entities on generated pages (`$\\{ENV_VAR\\}`,
    `&lt;style&gt;`), visual audit 2026-09-25.
    """
    out, pos = [], 0
    for m in _INLINE_CODE.finditer(line):
        out.append(escape(line[pos : m.start()]))
        out.append(m.group(0))
        pos = m.end()
    out.append(escape(line[pos:]))
    return "".join(out)


def sanitize_mdx_body(body: str) -> str:
    """Escape MDX-incompatible content from raw markdown.

    Handles:
      1. Curly braces { } outside code blocks → \\{ \\}
      2. HTML-like <tags> outside code blocks → &lt;tags&gt;
      3. Unsupported Shiki languages in code fences → 'text'
    """
    lines = body.split("\n")
    out = []
    in_code_block = False

    for line in lines:
        stripped = line.strip()

        # Track code fences
        if stripped.startswith("```"):
            if not in_code_block:
                in_code_block = True
                # Check for unsupported language
                lang = stripped[3:].split()[0] if len(stripped) > 3 else ""
                if lang.lower() in UNSUPPORTED_LANGS:
                    line = line.replace(f"```{lang}", "```text", 1)
            else:
                in_code_block = False
            out.append(line)
            continue

        if in_code_block:
            out.append(line)
            continue

        # Outside code blocks: escape braces and JSX-like angles, but never
        # inside inline code spans: MDX renders those literally, so an escape
        # there shows up on the page (`$\\{ENV_VAR\\}`, `&lt;style&gt;`).
        line = _escape_outside_inline_code(line)

        out.append(line)

    # Guard: if we ended inside an unclosed code fence, re-process
    # the lines after the last opening fence as non-code-block content.
    if in_code_block:
        # Find last opening fence and re-escape everything after it
        last_fence = -1
        for i, ln in enumerate(out):
            if ln.strip().startswith("```") and i > 0:
                last_fence = i
        if last_fence >= 0:
            # Close the orphaned fence and re-sanitize trailing content
            out[last_fence] = out[last_fence] + "\n```"

    return "\n".join(out)


def quote_yaml_value(val: str) -> str:
    """Ensure a string is safely quoted for YAML frontmatter."""
    val = val.replace('"', '\\"')
    return f'"{val}"'


def build_answer_block(name: str, description: str) -> str:
    """Build a self-contained answer-block blockquote for search/AI retrieval.

    Returns a single markdown blockquote line of the form:
        > **<Name>** <summary>.

    The sentence is "chunk-isolated": it leads with the item's proper-noun name
    so the block stands on its own out of context (never starts with "This",
    "It", or a pronoun). The summary is derived from the item's ``description``
    frontmatter. A short description is kept verbatim (no filler padding); a long
    one is trimmed to ~60 words at a sentence boundary. Returns ``""`` when there
    is no usable description (caller skips the block).

    The whole page is regenerated from source on every run, so emitting this line
    unconditionally is idempotent — re-running never stacks duplicate blocks.
    """
    desc = (description or "").strip()
    if not desc:
        return ""

    # Trim only when materially over budget; keep shorter descriptions as-is.
    if len(desc.split()) > 60:
        sentences = re.split(r"(?<=[.!?])\s+", desc)
        acc: list[str] = []
        word_count = 0
        for sentence in sentences:
            sentence_words = len(sentence.split())
            if acc and word_count + sentence_words > 60:
                break
            acc.append(sentence)
            word_count += sentence_words
        trimmed = " ".join(acc).strip()
        # A single opening sentence longer than the budget: hard-cut at 60 words.
        if not trimmed or len(trimmed.split()) > 70:
            trimmed = " ".join(desc.split()[:60]).rstrip(",;:")
        desc = trimmed

    # Escape MDX-hostile characters (curly braces, stray angle brackets).
    desc = sanitize_mdx_body(desc).strip()

    if desc and desc[-1] not in ".!?":
        desc += "."

    return f"> **{name}** {desc}"


# ---------------------------------------------------------------------------
# SKILL SUBDIRECTORY HELPERS
# ---------------------------------------------------------------------------

# Ordered list of subdirectory types to surface in skill pages
SKILL_SUBDIRS = ["rules", "references", "checklists", "examples"]


def read_subdirectory_files(skill_dir: Path, subdir_name: str) -> list[dict]:
    """Read all .md files from a skill subdirectory.

    Skips files starting with '_' (e.g. _sections.md).
    Returns list of dicts with keys: filename, title, frontmatter, body.
    """
    subdir = skill_dir / subdir_name
    if not subdir.is_dir():
        return []

    results = []
    for md_file in sorted(subdir.glob("*.md")):
        if md_file.name.startswith("_"):
            continue
        text = md_file.read_text(encoding="utf-8")
        frontmatter, body = parse_frontmatter(text)
        title = frontmatter.get("title", "") or title_case(md_file.stem)
        results.append(
            {
                "filename": md_file.name,
                "title": title,
                "frontmatter": frontmatter,
                "body": body,
            }
        )
    return results


def featured_examples(skill_dir: Path) -> str:
    """Return the curated examples block for a skill, or "" (#3901).

    Source: ``<skill>/examples/_featured.md``. Frontmatter is dropped; the body
    is MDX-sanitized like every other page section. The leading underscore is
    what keeps ``read_subdirectory_files`` from also appending it at the bottom.
    """
    f = skill_dir / "examples" / "_featured.md"
    if not f.is_file():
        return ""
    _, body = parse_frontmatter(f.read_text(encoding="utf-8"))
    return sanitize_mdx_body(body).strip()


def subdir_entry_title(entry: dict) -> str:
    """Section title for one subdirectory file (rule titles carry their impact)."""
    sec_title = entry["title"]
    impact = entry["frontmatter"].get("impact", "")
    if impact:
        sec_title = f"{sec_title}: {impact}"
    return sec_title


def format_subdir_entry(entry: dict) -> list[str]:
    """MDX lines for one subdirectory file: its `###` heading plus sanitized body."""
    return [
        f"### {subdir_entry_title(entry)}",
        "",
        sanitize_mdx_body(entry["body"]),
        "",
    ]


def format_subdir_section(subdir_name: str, files: list[dict]) -> list[str]:
    """MDX lines for one subdirectory: `## Heading (N)` plus every file's section."""
    lines = ["", "---", "", f"## {title_case(subdir_name)} ({len(files)})", ""]
    for entry in files:
        lines.extend(format_subdir_entry(entry))
    return lines


def format_subdir_sections(skill_dir: Path) -> list[str]:
    """Generate MDX details/summary sections for skill subdirectory content."""
    all_lines: list[str] = []

    for subdir_name in SKILL_SUBDIRS:
        files = read_subdirectory_files(skill_dir, subdir_name)
        if not files:
            continue
        all_lines.extend(format_subdir_section(subdir_name, files))

    return all_lines


# ---------------------------------------------------------------------------
# PAGE TOKEN BUDGET (split oversized skill pages)
# ---------------------------------------------------------------------------

# ora.ai scores every docs page against a 25K-token ceiling (page-token-budget).
# At roughly 4 chars per token that is ~100 KB, so a skill whose assembled page
# would cross SPLIT_OVER_BYTES is written as a folder instead of one file:
#
#   reference/skills/<slug>/index.mdx        SKILL.md body + links to every part
#   reference/skills/<slug>/<subdir>.mdx     one subdir (rules, references, ...)
#   reference/skills/<slug>/<subdir>/<f>.mdx one file, when the subdir alone is
#                                            over budget
#   reference/skills/<slug>/<subdir>/<f>/NN-<slug>.mdx
#                                            `## Heading` chunks of one file
#                                            that is itself over budget
#                                            (#3902: doctor's 480-row CC
#                                            version Feature Matrix is the
#                                            case that forced this level; a
#                                            leading table header row is
#                                            repeated so each chunk still
#                                            renders as a table)
#
# The index keeps the original URL (fumadocs serves <slug>/index.mdx at
# /docs/reference/skills/<slug>), and every part reuses the `### <title>`
# heading the flat page carried, so the old anchor ids still resolve on the
# part page. Opt-in per skill for now: the split changes where the bottom of a
# page lives, so widen SPLIT_SKILLS deliberately rather than by size alone.
SPLIT_OVER_BYTES = 90_000
SPLIT_SKILLS = {"configure", "doctor", "implement", "verify", "brainstorm"}

# The part-page wrapper (frontmatter, part-of note) and the `### <title>`
# heading add bytes on top of the measured content. Every split decision
# budgets against SPLIT_OVER_BYTES minus this reserve, so a part page that
# measures just under the line cannot tip over it after the wrapper lands.
PART_PAGE_RESERVE = 1_024
CHUNK_BUDGET = SPLIT_OVER_BYTES - PART_PAGE_RESERVE


def first_prose_line(body: str, max_len: int = 160) -> str:
    """First sentence of the first prose paragraph, for a one-line page summary."""
    in_fence = False
    paragraph: list[str] = []
    for raw in body.splitlines() + [""]:
        line = raw.strip()
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if not line:
            if paragraph:
                break
            continue
        if not paragraph and (line[0] in "#>|-*<[!" or line.startswith("import ")):
            continue
        paragraph.append(line)
    if not paragraph:
        return ""
    text = re.sub(r"[*_`]", "", " ".join(paragraph))
    sentence = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0].rstrip(":")
    if len(sentence) > max_len:
        sentence = sentence[: max_len - 3].rstrip() + "..."
    return sentence


def body_h1(body: str) -> str:
    """The body's own `# Heading` text, or "" when it has none."""
    for raw in body.splitlines():
        if raw.startswith("# "):
            return raw[2:].strip()
    return ""


def _lines_bytes(lines: list[str]) -> int:
    return len("\n".join(lines).encode("utf-8"))


def _is_table_header(lines: list[str]) -> bool:
    """True when the list opens with a markdown table header row + separator."""
    if len(lines) < 2:
        return False
    first, second = lines[0].strip(), lines[1].strip()
    return (
        first.startswith("|")
        and first.endswith("|")
        and second.startswith("|")
        and set(second) <= set("|-: ")
    )


def _section_table_header(lines: list[str]) -> list[str]:
    """Header row + separator of the table that opens a `##` section, if any.

    Skips the section's own heading line and blank lines first, so it works on
    a section list whose first element is the `## Heading` line.
    """
    i = 1 if (lines and lines[0].startswith("## ")) else 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    return lines[i : i + 2] if _is_table_header(lines[i:]) else []


def heading_slug(text: str) -> str:
    """Kebab-case slug for use in a chunk page filename."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "part"


def chunk_file_sections(entry: dict) -> list[tuple[str, str, list[str]]]:
    """Split one subdirectory file that is itself over the page budget (#3902).

    Whole `## Heading` sections are merged greedily under SPLIT_OVER_BYTES. A
    section that alone is over budget is cut by lines, repeating a leading
    table header row on every part so the table still renders. Every chunk
    keeps the `### <file title>` heading the flat page carried, so old anchor
    ids still resolve on the part page.

    Returns [(page_title, filename_slug, body_lines), ...] in document order.
    """
    title = subdir_entry_title(entry)
    title_lines = [f"### {title}", ""]

    # Sanitize the whole body first (MDX-hostile braces and angle brackets,
    # unsupported code-fence languages), then cut the sanitized lines into
    # `## Heading` sections. The heading line rides with its section, any
    # preamble before the first `##` becomes its own section, and a `## ` line
    # inside a code fence does not split anything.
    sections: list[tuple[str, list[str]]] = []
    cur_head, cur_lines = "", []
    in_fence = False
    for line in sanitize_mdx_body(entry["body"]).rstrip("\n").split("\n"):
        if line.strip().startswith("```"):
            in_fence = not in_fence
            cur_lines.append(line)
            continue
        if line.startswith("## ") and not in_fence:
            if cur_head or any(l.strip() for l in cur_lines):
                sections.append((cur_head, cur_lines))
                cur_lines = []
            cur_head = line[3:].strip()
        cur_lines.append(line)
    if cur_head or any(l.strip() for l in cur_lines):
        sections.append((cur_head, cur_lines))

    chunks: list[tuple[str, str, list[str]]] = []

    def push(label: str, slug: str, lines: list[str]) -> None:
        page_title = f"{title}: {label}" if label else title
        chunks.append((page_title, slug, title_lines + lines))

    label, slug = "", ""
    cur_lines: list[str] = []
    for head, lines in sections:
        if cur_lines and _lines_bytes(cur_lines) + _lines_bytes(lines) + 1 > CHUNK_BUDGET:
            push(label, slug, cur_lines)
            label, slug, cur_lines = "", "", []
        if _lines_bytes(lines) + 1 > CHUNK_BUDGET:
            # One section alone is over budget: cut it by lines. Repeat the
            # section's leading table header (row + separator) on every part
            # after the first, so each part renders as a table instead of a
            # broken fragment of headerless rows.
            header = _section_table_header(lines)
            part_no, buf = 1, []
            for line in lines:
                if buf and _lines_bytes(buf) + len(line.encode("utf-8")) + 1 > CHUNK_BUDGET:
                    prefix = header if part_no > 1 else []
                    push(f"{head} (part {part_no})", f"{heading_slug(head)}-part-{part_no}", prefix + buf)
                    part_no += 1
                    buf = []
                buf.append(line)
            if buf:
                prefix = header if part_no > 1 else []
                push(f"{head} (part {part_no})", f"{heading_slug(head)}-part-{part_no}", prefix + buf)
            label, slug, cur_lines = "", "", []
            continue
        cur_lines.extend(lines)
        if not label:
            label, slug = head, heading_slug(head)
    if any(l.strip() for l in cur_lines):
        push(label, slug, cur_lines)
    return chunks


def write_part_page(
    out_file: Path, skill_title: str, skill_url: str, page_title: str, blurb: str, lines: list[str]
) -> None:
    """Write one companion page of a split skill reference."""
    page = [
        "---",
        f"title: {quote_yaml_value(f'{skill_title}: {page_title}')}",
        f"description: {quote_yaml_value(blurb)}",
        "---",
        "",
        f"> Part of the [{skill_title}]({skill_url}) skill reference. "
        "The main page carries the skill itself; this page holds material "
        "that used to sit at the bottom of it.",
        "",
    ]
    page.extend(lines)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text("\n".join(page), encoding="utf-8")


def write_split_skill(
    out_dir: Path, skill_dir: Path, slug: str, title: str, head_lines: list[str]
) -> list[Path]:
    """Write an oversized skill as index + companion pages. Returns written files."""
    skill_url = f"/docs/reference/skills/{slug}"
    skill_out = out_dir / slug
    skill_out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    parts: list[tuple[str, str, str]] = []  # (url, label, blurb)

    for subdir_name in SKILL_SUBDIRS:
        files = read_subdirectory_files(skill_dir, subdir_name)
        if not files:
            continue
        heading = title_case(subdir_name)
        section_lines = format_subdir_section(subdir_name, files)
        section_bytes = len("\n".join(section_lines).encode("utf-8"))

        if section_bytes + PART_PAGE_RESERVE <= SPLIT_OVER_BYTES:
            # Whole subdir fits on one page.
            titles = "; ".join(e["title"] for e in files)
            blurb = f"{len(files)} {heading.lower()} for the {title} skill: {titles}"
            out_file = skill_out / f"{subdir_name}.mdx"
            write_part_page(out_file, title, skill_url, heading, blurb, section_lines[3:])
            written.append(out_file)
            parts.append((f"{skill_url}/{subdir_name}", heading, blurb))
            continue

        # Subdir alone is over budget: one page per file, and a file that is
        # itself over budget becomes `## Heading` chunks under <subdir>/<stem>/.
        for entry in files:
            stem = Path(entry["filename"]).stem
            entry_lines = format_subdir_entry(entry)
            if _lines_bytes(entry_lines) + PART_PAGE_RESERVE <= SPLIT_OVER_BYTES:
                page_title = body_h1(entry["body"]) or entry["title"]
                blurb = first_prose_line(entry["body"]) or f"{page_title} for the {title} skill."
                out_file = skill_out / subdir_name / f"{stem}.mdx"
                write_part_page(out_file, title, skill_url, page_title, blurb, entry_lines)
                written.append(out_file)
                parts.append(
                    (f"{skill_url}/{subdir_name}/{stem}", f"{heading}: {page_title}", blurb)
                )
                continue

            chunk_dir = skill_out / subdir_name / stem
            chunks = chunk_file_sections(entry)
            for i, (page_title, chunk_slug, chunk_lines) in enumerate(chunks):
                blurb = (
                    first_prose_line("\n".join(chunk_lines))
                    or f"Part {i + 1} of {len(chunks)} of {entry['title']} for the {title} skill."
                )
                out_file = chunk_dir / f"{i:02d}-{chunk_slug}.mdx"
                write_part_page(out_file, title, skill_url, page_title, blurb, chunk_lines)
                written.append(out_file)
                parts.append(
                    (
                        f"{skill_url}/{subdir_name}/{stem}/{i:02d}-{chunk_slug}",
                        f"{heading}: {page_title}",
                        blurb,
                    )
                )

    lines = list(head_lines)
    lines.extend(
        [
            "",
            "---",
            "",
            "## Companion pages",
            "",
            f"This reference is split across {len(parts) + 1} pages so each stays "
            "under the 25K-token page budget. The rules and reference material "
            "that used to sit at the bottom of this page now live at:",
            "",
        ]
    )
    for url, label, blurb in parts:
        lines.append(f"- [{label}]({url}): {blurb}")
    lines.append("")

    index_file = skill_out / "index.mdx"
    index_file.write_text("\n".join(lines), encoding="utf-8")
    written.insert(0, index_file)
    return written


# ---------------------------------------------------------------------------
# SKILLS
# ---------------------------------------------------------------------------


def generate_skills(skills_src: str, skills_out: str) -> int:
    """Generate skill MDX pages. Returns count."""
    skills_dir = Path(skills_src)
    out_dir = Path(skills_out)
    index_rows = []
    slugs = []

    # Only count dirs that actually carry a SKILL.md — `src/shared/` is a
    # shared-helpers dir with no SKILL.md and must not inflate the published count.
    skill_dirs = sorted(d for d in skills_dir.iterdir() if d.is_dir() and (d / "SKILL.md").exists())
    count = len(skill_dirs)
    print(f"Generating {count} skill pages...")

    for skill_dir in skill_dirs:
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            continue

        slug = skill_dir.name
        slugs.append(slug)
        text = skill_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)

        description = meta.get("description", "")
        user_invocable = meta.get("user-invocable", False)
        complexity = meta.get("complexity", "")
        skills_list = meta.get("skills", [])
        if isinstance(skills_list, str):
            skills_list = [skills_list]

        title = title_case(slug)

        # Type badge
        if user_invocable:
            type_badge = '<span className="badge badge-blue">Command</span>'
            type_label = "Command"
        else:
            type_badge = '<span className="badge badge-gray">Reference</span>'
            type_label = "Reference"

        # Complexity badge
        complexity_badges = {
            "low": '<span className="badge badge-green">low</span>',
            "medium": '<span className="badge badge-yellow">medium</span>',
            "high": '<span className="badge badge-orange">high</span>',
            "max": '<span className="badge badge-red">max</span>',
        }
        complexity_badge = complexity_badges.get(complexity, "")

        # Build MDX content
        lines = []
        lines.append("---")
        lines.append(f"title: {quote_yaml_value(title)}")
        lines.append(f"description: {quote_yaml_value(description)}")
        lines.append("---")
        lines.append("")
        lines.append(f"{type_badge} {complexity_badge}")
        lines.append("")

        # Invocation CTA (#1082). Three-way, not two (#3313): for a skill with
        # disable-model-invocation: true the old "Auto-activated" claim was
        # false on all 29 such pages at once \u2014 nothing auto-activates a skill
        # the model is barred from selecting. parse_frontmatter coerces YAML
        # booleans, so the .get returns a real bool.
        if user_invocable:
            lines.append('```bash title="Invoke"')
            lines.append(f"/ork:{slug}")
            lines.append("```")
            lines.append("")
        elif meta.get("disable-model-invocation", False):
            lines.append(
                "> **Not directly invocable** \u2014 no slash command and no "
                "model auto-selection. An agent loads it explicitly via "
                "`Read()`."
            )
            lines.append("")
        else:
            lines.append(
                "> **Auto-activated** \u2014 this skill loads automatically "
                "when Claude detects matching context."
            )
            lines.append("")

        # Contextual sidebar (#1080)
        lines.append(f'<ContextualSkillSidebar slug="{slug}" />')
        lines.append("")

        # Answer block for search/AI retrieval: a self-contained, name-led
        # summary placed after badges/sidebar and before the body's first H1.
        answer_block = build_answer_block(title, description)
        if answer_block:
            lines.append(answer_block)
            lines.append("")

        # Curated examples block (#3901). A skill that wants a page a human can
        # be ROUTED to (what it draws, the picks, real renders, the exact
        # invocation) keeps that in examples/_featured.md. The underscore keeps
        # it out of the bottom "Examples (N)" dump that format_subdir_sections
        # builds, and this placement puts it before the SKILL.md body, where a
        # reader who was sent the URL lands. The heading anchors as #examples.
        featured = featured_examples(skill_dir)
        if featured:
            lines.append("## Examples")
            lines.append("")
            lines.append(featured)
            lines.append("")
            lines.append("---")
            lines.append("")

        lines.append(sanitize_mdx_body(body))

        # Surface subdirectory content (rules, references, checklists, examples)
        subdir_lines = format_subdir_sections(skill_dir)
        page_bytes = len("\n".join(lines + subdir_lines).encode("utf-8"))

        if slug in SPLIT_SKILLS and page_bytes > SPLIT_OVER_BYTES:
            # Over the page token budget: folder with index + companion pages.
            write_split_skill(out_dir, skill_dir, slug, title, lines)
        else:
            if subdir_lines:
                lines.extend(subdir_lines)
            out_file = out_dir / f"{slug}.mdx"
            out_file.write_text("\n".join(lines), encoding="utf-8")

        # Index row — escape description for markdown table
        safe_desc = description.replace("|", "\\|")
        cplx_display = complexity if complexity else "\u2014"
        index_rows.append(
            f"| [{title}](/docs/reference/skills/{slug}) "
            f"| {type_label} | {cplx_display} | {safe_desc} |"
        )

    # Write index page
    index_lines = [
        "---",
        "title: Skills Reference",
        f'description: "Complete reference for all {count} OrchestKit skills."',
        "---",
        "",
        "import { SkillAtlas } from '@/components/world/skill-atlas';",
        "",
        "<SkillAtlas />",
        "",
        "# Skills Reference",
        "",
        f"OrchestKit includes **{count} skills** \u2014 reusable knowledge modules "
        "that provide patterns, frameworks, and workflows.",
        "",
        "| Skill | Type | Complexity | Description |",
        "|-------|------|------------|-------------|",
    ]
    index_lines.extend(index_rows)
    (out_dir / "index.mdx").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    # Write meta.json. Sidebar shows only the index (the Skill Atlas); the
    # 114 leaf routes still build from their .mdx files but stay out of the
    # nav so it isn't a wall. Full slug list kept for any downstream use.
    pages = ["index"] + slugs
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Skills", "defaultOpen": False, "pages": pages}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"  -> {count} skill pages written to {skills_out}")
    return count


# ---------------------------------------------------------------------------
# AGENTS
# ---------------------------------------------------------------------------


def build_agent_hooks_map(project_root: str) -> dict[str, list[dict]]:
    """Scan src/hooks/src/agent/*.ts and build a mapping of agent_slug -> [hook_info].

    Parses "Used by:" lines in TSDoc to find which agents each hook applies to.
    Returns e.g. {"debug-investigator": [{"hook": "block-writes", "description": "...", "behavior": "blocks"}], ...}
    """
    agent_hooks_dir = Path(project_root) / "src" / "hooks" / "src" / "agent"
    if not agent_hooks_dir.is_dir():
        return {}

    agent_map: dict[str, list[dict]] = {}

    for ts_file in sorted(agent_hooks_dir.glob("*.ts")):
        source = ts_file.read_text(encoding="utf-8")
        hook_name = ts_file.stem

        # Extract "Used by:" from TSDoc, handling multiline continuation
        # Matches "Used by: name1, name2,\n *          name3, name4"
        used_by_match = re.search(
            r"Used by:\s*(.+?)(?:\n\s*\*\s*\n|\n\s*\*\s*[A-Z]|\*/)",
            source,
            re.DOTALL,
        )
        if not used_by_match:
            continue

        # Clean up multiline: remove " * " continuation markers
        used_by_text = re.sub(r"\n\s*\*\s*", " ", used_by_match.group(1)).strip()
        # Split by commas and clean up
        agent_names = []
        for part in re.split(r",\s*", used_by_text):
            # Remove trailing "agent", "agents", etc.
            name = re.sub(r"\s+agents?\s*$", "", part.strip())
            if name:
                agent_names.append(name)

        # Extract description from TSDoc
        description = _extract_jsdoc_description(source)

        # Detect behavior
        behavior = _detect_behavior(source, "")

        hook_info = {
            "hook": hook_name,
            "description": description,
            "behavior": behavior,
        }

        for agent_name in agent_names:
            agent_map.setdefault(agent_name, []).append(hook_info)

    return agent_map


def generate_agents(agents_src: str, agents_out: str) -> int:
    """Generate agent MDX pages. Returns count."""
    agents_dir = Path(agents_src)
    out_dir = Path(agents_out)
    index_rows = []
    slugs = []

    # Build agent-scoped hooks mapping
    project_root = os.environ.get("PROJECT_ROOT", "")
    agent_hooks_map = build_agent_hooks_map(project_root) if project_root else {}

    # Exclude README.md — it documents the agents dir, it is not an agent. Counting
    # it inflates the published agent count (38 vs 37) and emits a bogus README.mdx.
    agent_files = sorted(f for f in agents_dir.glob("*.md") if f.stem.lower() != "readme")
    count = len(agent_files)
    print(f"Generating {count} agent pages...")

    for agent_file in agent_files:
        slug = agent_file.stem
        slugs.append(slug)
        text = agent_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)

        description = meta.get("description", "")
        model = meta.get("model", "")
        category = meta.get("category", "")
        tools_list = meta.get("tools", [])
        skills_list = meta.get("skills", [])
        if isinstance(tools_list, str):
            tools_list = [tools_list]
        if isinstance(skills_list, str):
            skills_list = [skills_list]

        title = title_case(slug)

        # Model badge
        model_badges = {
            "haiku": '<span className="badge badge-green">haiku</span>',
            "sonnet": '<span className="badge badge-blue">sonnet</span>',
            "opus": '<span className="badge badge-purple">opus</span>',
        }
        model_badge = model_badges.get(
            model, f'<span className="badge badge-gray">{model or "unknown"}</span>'
        )

        # Extract activation keywords
        activation_keywords = ""
        if "Activates for" in description or "activates for" in description:
            match = re.search(r"[Aa]ctivates for (.+)", description)
            if match:
                activation_keywords = match.group(1)
        elif "Use when" in description or "use when" in description:
            match = re.search(r"[Uu]se when (.+)", description)
            if match:
                activation_keywords = match.group(1)

        # Short description (before activation keywords)
        short_desc = re.split(r"\s*[Aa]ctivates for\s*|\s*[Uu]se when\s*", description)[0].rstrip(
            ". "
        )

        # Build MDX
        lines = []
        lines.append("---")
        lines.append(f"title: {quote_yaml_value(title)}")
        lines.append(f"description: {quote_yaml_value(short_desc)}")
        lines.append("---")
        lines.append("")
        lines.append(model_badge)
        if category:
            lines.append(f' <span className="badge badge-gray">{category}</span>')
        lines.append("")
        # Answer block for search/AI retrieval: a self-contained, name-led
        # summary derived from the agent description, placed after badges and
        # before the body's first H1. Replaces the old bare-description quote.
        answer_block = build_answer_block(title, description)
        if not answer_block:
            answer_block = f"> {short_desc}"
        lines.append(answer_block)
        lines.append("")

        if activation_keywords:
            lines.append("## Activation Keywords")
            lines.append("")
            lines.append(f"This agent activates for: {activation_keywords}")
            lines.append("")

        if tools_list:
            lines.append("## Tools Available")
            lines.append("")
            for tool in tools_list:
                tool = tool.strip()
                if tool:
                    lines.append(f"- `{tool}`")
            lines.append("")

        if skills_list:
            lines.append("## Skills Used")
            lines.append("")
            for sk in skills_list:
                sk = sk.strip()
                if sk:
                    lines.append(f"- [{sk}](/docs/reference/skills/{sk})")
            lines.append("")

        # Agent-scoped hooks cross-links
        agent_hooks = agent_hooks_map.get(slug, [])
        if agent_hooks:
            lines.append("## Agent-Scoped Hooks")
            lines.append("")
            lines.append(
                "These hooks activate exclusively when this agent runs, "
                "enforcing safety and compliance boundaries."
            )
            lines.append("")
            lines.append("| Hook | Behavior | Description |")
            lines.append("|------|----------|-------------|")
            for ah in agent_hooks:
                badge = BEHAVIOR_BADGES.get(ah["behavior"], ah["behavior"])
                desc = _ref_table_cell(ah["description"] or "\u2014")
                lines.append(f"| `{ah['hook']}` | {badge} | {desc} |")
            lines.append("")

        lines.append(sanitize_mdx_body(body))

        out_file = out_dir / f"{slug}.mdx"
        out_file.write_text("\n".join(lines), encoding="utf-8")

        # Index row — escape description for markdown table
        safe_desc = short_desc.replace("|", "\\|")
        index_rows.append(
            f"| [{title}](/docs/reference/agents/{slug}) | {model or '\u2014'} | {safe_desc} |"
        )

    # Write index page
    index_lines = [
        "---",
        "title: Agents Reference",
        f'description: "Complete reference for all {count} OrchestKit agents."',
        "---",
        "",
        "# Agents Reference",
        "",
        f"OrchestKit includes **{count} specialized agents** \u2014 AI personas "
        "with curated tools, skills, and behavioral directives.",
        "",
        "| Agent | Model | Description |",
        "|-------|-------|-------------|",
    ]
    index_lines.extend(index_rows)
    (out_dir / "index.mdx").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    # Write meta.json. Sidebar shows only the index; agent leaf routes still
    # build from their .mdx files but stay out of the nav.
    pages = ["index"] + slugs
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Agents", "defaultOpen": False, "pages": pages}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"  -> {count} agent pages written to {agents_out}")
    return count


# ---------------------------------------------------------------------------
# HOOKS
# ---------------------------------------------------------------------------


def slug_from_category(cat: str) -> str:
    """Convert PascalCase to kebab-case: PreToolUse -> pre-tool-use"""
    return re.sub(r"([A-Z])", r"-\1", cat).strip("-").lower()


def hook_invocation(entry: dict) -> str:
    """Flatten a hooks.json command entry into one string.

    Current CC entries are `{command: "node", args: [run-hook.mjs, id]}`.
    Older entries stuffed the whole invocation into `command`.
    """
    parts = [str(entry.get("command") or "")]
    parts.extend(str(a) for a in (entry.get("args") or []))
    return " ".join(p for p in parts if p).strip()


def hook_name_from_command(cmd: str) -> tuple[str, str]:
    """Extract (full_path, short_name) from a run-hook command."""
    for splitter in ["run-hook.mjs ", "run-hook-silent.mjs "]:
        if splitter in cmd:
            hook_path = cmd.split(splitter)[1].strip().split()[0]
            return hook_path, hook_path.split("/")[-1]
    name = cmd.split("/")[-1] if "/" in cmd else cmd
    return name, name


def scope_from_path(hook_path: str) -> str:
    """Determine scope type from hook path prefix."""
    if hook_path.startswith("agent/"):
        return "Agent"
    if hook_path.startswith("skill/"):
        return "Skill"
    return "Global"


# Behavior labels. No emoji: Fumadocs/GFM turns some glyphs into <img>
# that 404, and 🔇/🛑/🔥 are outside the visual-style vocabulary.
BEHAVIOR_BADGES = {
    "blocks": "Blocks",
    "injects": "Injects",
    "silent": "Silent",
    "fire-and-forget": "Fire-and-forget",
}


def _find_hook_ts_file(hooks_src_dir: Path, hook_path: str) -> Path | None:
    """Resolve a hook path (e.g. 'pretool/bash/dangerous-command-blocker') to its .ts source."""
    ts_file = hooks_src_dir / f"{hook_path}.ts"
    if ts_file.is_file():
        return ts_file
    return None


def _is_jsdoc_skip_line(line: str) -> bool:
    """Headers and stamps that are not the hook's description."""
    if re.match(r"@\w+", line):
        return True
    if re.match(r"CC \d[\d.]*\s+Compliant", line):
        return True
    if re.match(r"Hook:", line):
        return True
    if re.match(r"Version:", line):
        return True
    if re.match(r"Issue #\d+", line):
        return True
    if re.match(
        r"(SECURITY|Purpose|Hooks consolidated|NOT consolidated|Created|Consolidated hooks):",
        line,
    ):
        return True
    return False


def _is_jsdoc_title_line(line: str) -> bool:
    if re.match(r".+ - .+(Hook|Dispatcher)\b", line, re.IGNORECASE):
        return True
    if re.search(r"(Hook|Dispatcher)\b", line, re.IGNORECASE) and (" — " in line or " - " in line):
        # "Name — SessionEnd Hook" or "Name — Stop Hook (M140 …)"
        head = re.split(r"\s+[—-]\s+", line, maxsplit=1)[0]
        return len(head.split()) <= 8
    if (
        re.match(r".+(Hook|Dispatcher)$", line, re.IGNORECASE)
        and " - " not in line
        and " — " not in line
    ):
        # Bare "Foo Hook" / "Foo Dispatcher" titles only, not prose ending in Hook.
        return len(line.split()) <= 8
    return False


def _trim_jsdoc_sentence(text: str, max_len: int = 280) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    period = cut.rfind(". ")
    if period >= 80:
        return cut[: period + 1]
    return cut.rstrip(" ,;:") + "…"


def _extract_jsdoc_description(source: str) -> str:
    """First JSDoc paragraph, joining wrapped lines so tables do not cut mid-sentence."""
    match = re.search(r"/\*\*(.*?)\*/", source, re.DOTALL)
    if not match:
        return ""

    raw_lines = [line.strip().lstrip("* ").strip() for line in match.group(1).split("\n")]

    paragraphs: list[list[str]] = []
    buf: list[str] = []
    first_content = True
    for line in raw_lines:
        if (
            not line
            or _is_jsdoc_skip_line(line)
            or line.startswith("- ")
            or re.match(r"\d+\.", line)
        ):
            if buf:
                paragraphs.append(buf)
                buf = []
            first_content = False
            continue
        if _is_jsdoc_title_line(line):
            title_desc = re.match(r".+ - (.+)", line)
            if (
                first_content
                and title_desc
                and not re.search(r"(Hook|Dispatcher)$", title_desc.group(1), re.I)
            ):
                buf.append(title_desc.group(1))
            first_content = False
            continue
        buf.append(line)
        first_content = False
    if buf:
        paragraphs.append(buf)

    for para in paragraphs:
        text = _trim_jsdoc_sentence(" ".join(para))
        if len(text) >= 12:
            return text
    return ""


def _detect_behavior(source: str, command: str) -> str:
    """Detect hook behavior type from source code and command string.

    Returns: 'blocks', 'injects', 'silent', or 'fire-and-forget'.
    """
    # Explicit TSDoc override: @behavior silent|blocks|injects|fire-and-forget
    override_match = re.search(r"@behavior\s+(blocks|injects|silent|fire-and-forget)", source)
    if override_match:
        return override_match.group(1)

    # Fire-and-forget: uses run-hook-silent.mjs
    if "run-hook-silent.mjs" in command:
        return "fire-and-forget"

    # Strip comments before pattern matching to avoid false positives
    # (e.g., "never produce additionalContext" in a comment)
    code_only = re.sub(r"/\*\*[\s\S]*?\*/", "", source)  # block comments
    code_only = re.sub(r"//.*$", "", code_only, flags=re.MULTILINE)  # line comments

    # Blocks: continue:false, PreToolUse deny, or event-agnostic outputBlock
    if (
        re.search(r"continue\s*:\s*false", code_only)
        or "outputDeny" in code_only
        or "outputBlock" in code_only
    ):
        return "blocks"

    # Injects: produces additionalContext
    if "additionalContext" in code_only or "outputAllowWithContext" in code_only:
        return "injects"

    # Silent: suppressOutput or outputSilentSuccess without blocking/injecting
    if "suppressOutput" in code_only or "outputSilentSuccess" in code_only:
        return "silent"

    return "silent"


def extract_hook_metadata(hooks_src_dir: Path, hook_path: str, command: str) -> dict:
    """Extract TSDoc description and behavior type from hook TypeScript source.

    Args:
        hooks_src_dir: Path to src/hooks/src/
        hook_path: Hook path like 'pretool/bash/dangerous-command-blocker'
        command: Full command string from hooks.json

    Returns:
        {"description": "...", "behavior": "blocks|injects|silent|fire-and-forget"}
    """
    ts_file = _find_hook_ts_file(hooks_src_dir, hook_path)
    if not ts_file:
        # Fallback: detect behavior from command alone
        behavior = "fire-and-forget" if "run-hook-silent.mjs" in command else "silent"
        return {"description": "", "behavior": behavior}

    source = ts_file.read_text(encoding="utf-8")
    description = _extract_jsdoc_description(source)
    behavior = _detect_behavior(source, command)
    return {"description": description, "behavior": behavior}


def generate_hooks(hooks_json: str, hooks_out: str) -> int:
    """Generate hook category MDX pages. Returns total hook count."""
    print("Generating hook category pages...")

    with open(hooks_json) as f:
        data = json.load(f)

    hooks_data = data.get("hooks", {})
    categories = list(hooks_data.keys())
    total_hooks = 0
    out_dir = Path(hooks_out)

    # Resolve hooks source directory for TSDoc extraction
    project_root = os.environ.get("PROJECT_ROOT", "")
    hooks_src_dir = Path(project_root) / "src" / "hooks" / "src" if project_root else None

    category_pages = {}
    for cat in categories:
        matchers = hooks_data[cat]
        rows = []
        for m in matchers:
            matcher_name = m.get("matcher", "*")
            for h in m.get("hooks", []):
                cmd = hook_invocation(h)
                hook_path, hook_name = hook_name_from_command(cmd)
                scope = scope_from_path(hook_path)

                # Extract TSDoc metadata
                if hooks_src_dir and hooks_src_dir.is_dir():
                    meta = extract_hook_metadata(hooks_src_dir, hook_path, cmd)
                else:
                    behavior = "fire-and-forget" if "run-hook-silent.mjs" in cmd else "silent"
                    meta = {"description": "", "behavior": behavior}
                if h.get("async") and meta["behavior"] == "silent":
                    meta["behavior"] = "fire-and-forget"

                rows.append(
                    {
                        "name": hook_name,
                        "path": hook_path,
                        "matcher": matcher_name,
                        "scope": scope,
                        "behavior": meta["behavior"],
                        "description": meta["description"],
                    }
                )
                total_hooks += 1
        category_pages[cat] = rows

    # Generate one MDX per category
    cat_slugs = []
    for cat, rows in category_pages.items():
        slug = slug_from_category(cat)
        cat_slugs.append((slug, cat, len(rows)))

        lines = [
            "---",
            f'title: "{cat}"',
            f'description: "Hooks triggered on {cat} events ({len(rows)} hooks)."',
            "---",
            "",
            f"# {cat} Hooks",
            "",
            f"**{len(rows)} hooks** registered for the `{cat}` lifecycle event.",
            "",
        ]

        if rows:
            lines.append("| Hook | Matcher | Behavior | Description |")
            lines.append("|------|---------|----------|-------------|")
            for r in rows:
                badge = BEHAVIOR_BADGES.get(r["behavior"], r["behavior"])
                desc = _ref_table_cell(r["description"]) if r["description"] else "\u2014"
                matcher_escaped = r["matcher"].replace("|", "\\|")
                lines.append(f"| `{r['name']}` | `{matcher_escaped}` | {badge} | {desc} |")
        else:
            lines.append("*No hooks registered for this event.*")
        lines.append("")

        (out_dir / f"{slug}.mdx").write_text("\n".join(lines), encoding="utf-8")

    # Index page
    index_lines = [
        "---",
        "title: Hooks Reference",
        f'description: "Complete reference for all {total_hooks} global lifecycle '
        f'hook entries across {len(categories)} event categories."',
        "---",
        "",
        "# Hooks Reference",
        "",
        f"OrchestKit includes **{total_hooks} global lifecycle hook entries** across "
        f"**{len(categories)} lifecycle event categories**, listed below by event. "
        "These are the *global* hooks that fire on Claude Code lifecycle events; "
        "agent- and skill-scoped hooks ship with their respective agents and skills, "
        "so the plugin's total hook count is higher than the number here.",
        "",
        "| Category | Hooks | Description |",
        "|----------|-------|-------------|",
    ]
    for slug, cat, count in cat_slugs:
        index_lines.append(
            f"| [{cat}](/docs/reference/hooks/{slug}) | {count} | Hooks for `{cat}` events |"
        )
    (out_dir / "index.mdx").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    # Copy spotlights from docs/hooks/spotlights/ source directory
    spotlights_dir = out_dir / "spotlights"
    spotlights_dir.mkdir(parents=True, exist_ok=True)
    spotlights_src = (
        Path(project_root) / "docs" / "site" / "content" / "docs" / "hooks" / "spotlights"
    )
    if spotlights_src.exists():
        for src_file in spotlights_src.iterdir():
            shutil.copy2(src_file, spotlights_dir / src_file.name)
    else:
        # Fallback: empty spotlights if source doesn't exist
        spotlights_meta = {"title": "Spotlights", "pages": []}
        (spotlights_dir / "meta.json").write_text(
            json.dumps(spotlights_meta, indent=2) + "\n", encoding="utf-8"
        )

    # meta.json. Sidebar shows only the index; hook category + spotlight
    # routes still build from their .mdx files but stay out of the nav.
    pages = ["index"] + [s for s, _, _ in cat_slugs] + ["spotlights"]
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Hooks", "defaultOpen": False, "pages": pages}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"  -> {total_hooks} hooks across {len(categories)} category pages written to {hooks_out}"
    )
    return total_hooks


# ---------------------------------------------------------------------------
# CATEGORY INDEX PAGES
# ---------------------------------------------------------------------------

CATEGORY_RULES = {
    "backend": {
        "label": "Backend",
        "desc": "API design, databases, Python, async patterns, distributed systems.",
        "tags": {
            "rest",
            "fastapi",
            "database",
            "sqlalchemy",
            "postgresql",
            "graphql",
            "grpc",
            "asyncio",
            "python",
            "api-design",
            "distributed-systems",
            "domain-driven-design",
            "event-driven",
            "microservices",
            "cqrs",
            "architecture",
        },
        "agents": {
            "backend-system-architect",
            "database-engineer",
            "event-driven-architect",
            "python-performance-engineer",
        },
    },
    "frontend": {
        "label": "Frontend",
        "desc": "React, components, design systems, animations, responsive patterns.",
        "tags": {
            "react",
            "ui",
            "component",
            "design-tokens",
            "css",
            "animation",
            "framer-motion",
            "responsive",
            "storybook",
            "zustand",
            "figma",
            "shadcn",
            "vite",
            "next",
            "i18n",
        },
        "agents": {
            "frontend-ui-developer",
            "design-system-architect",
            "accessibility-specialist",
            "component-curator",
            "frontend-performance-engineer",
        },
    },
    "testing": {
        "label": "Testing",
        "desc": "Unit, integration, E2E, performance, and LLM testing patterns.",
        "tags": {
            "testing",
            "unit",
            "integration",
            "e2e",
            "playwright",
            "vitest",
            "jest",
            "pytest",
            "coverage",
            "mocking",
            "msw",
            "code-review",
            "evaluation",
            "verification",
            "golden-dataset",
            "llm-testing",
            "debugging",
            "troubleshooting",
        },
        "agents": {
            "test-generator",
            "code-quality-reviewer",
            "data-pipeline-engineer",
        },
    },
    "security": {
        "label": "Security",
        "desc": "OWASP, auth patterns, defense-in-depth, vulnerability scanning.",
        "tags": {
            "security",
            "owasp",
            "authentication",
            "pii",
            "vulnerability",
            "audit",
        },
        "agents": {
            "security-auditor",
            "security-layer-auditor",
            "ai-safety-auditor",
        },
    },
    "ai-llm": {
        "label": "AI & LLM",
        "desc": "LLM integration, RAG, agent orchestration, MCP, embeddings.",
        "tags": {
            "llm",
            "rag",
            "mcp",
            "embedding",
            "vector",
            "langchain",
            "langgraph",
            "multimodal",
            "function-calling",
            "streaming",
            "prompt",
            "orchestration",
            "multi-agent",
            "memory",
        },
        "agents": {
            "llm-integrator",
            "multimodal-specialist",
            "workflow-architect",
        },
    },
    "devops": {
        "label": "DevOps",
        "desc": "CI/CD, deployment, monitoring, infrastructure, containers.",
        "tags": {
            "devops",
            "ci-cd",
            "docker",
            "kubernetes",
            "terraform",
            "monitoring",
            "observability",
            "deployment",
            "github-actions",
            "github",
            "analytics",
            "metrics",
            "configuration",
            "releases",
        },
        "agents": {
            "ci-cd-engineer",
            "deployment-manager",
            "infrastructure-architect",
            "monitoring-engineer",
            "release-engineer",
        },
    },
    "product": {
        "label": "Product",
        "desc": "PRDs, market sizing, competitive analysis, OKRs, user research.",
        "tags": {
            "prd",
            "product",
            "roi",
            "persona",
            "market",
            "competitive",
            "okr",
            "prioritization",
            "user-research",
            "business-case",
            "strategy",
            "demo",
            "marketing",
        },
        "agents": {"product-strategist", "market-intelligence"},
    },
    "workflows": {
        "label": "Workflows",
        "desc": "User-invocable commands for common development workflows.",
        "tags": {"workflow", "wizard"},
        "agents": set(),
        "match_invocable": True,
    },
}


def _collect_skill_metadata(skills_src: str) -> list[dict]:
    """Read all SKILL.md frontmatter and return metadata list."""
    skills_dir = Path(skills_src)
    results = []
    for skill_dir in sorted(d for d in skills_dir.iterdir() if d.is_dir()):
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            continue
        text = skill_file.read_text(encoding="utf-8")
        meta, _ = parse_frontmatter(text)
        slug = skill_dir.name
        tags = meta.get("tags", [])
        if isinstance(tags, str):
            tags = [tags]
        results.append(
            {
                "slug": slug,
                "title": title_case(slug),
                "description": meta.get("description", ""),
                "tags": set(tags),
                "user_invocable": meta.get("user-invocable", False),
                "complexity": meta.get("complexity", ""),
                "agent": meta.get("agent", ""),
            }
        )
    return results


def _match_category(skill: dict, rule: dict) -> bool:
    """Check if a skill matches a category rule."""
    # Match by user-invocable flag
    if rule.get("match_invocable") and skill["user_invocable"]:
        return True
    # Match by tag overlap
    if skill["tags"] & rule.get("tags", set()):
        return True
    # Match by agent
    if skill["agent"] and skill["agent"] in rule.get("agents", set()):
        return True
    return False


def generate_categories(skills_src: str, categories_out: str) -> int:
    """Generate category index MDX pages. Returns count of categories."""
    out_dir = Path(categories_out)
    out_dir.mkdir(parents=True, exist_ok=True)

    skills = _collect_skill_metadata(skills_src)
    cat_slugs = []
    print(f"Generating {len(CATEGORY_RULES)} category pages...")

    for cat_slug, rule in CATEGORY_RULES.items():
        matched = [s for s in skills if _match_category(s, rule)]
        matched.sort(key=lambda s: s["slug"])

        cat_slugs.append(cat_slug)
        label = rule["label"]
        desc = rule["desc"]
        count = len(matched)

        lines = [
            "---",
            f"title: {quote_yaml_value(f'{label} Skills')}",
            f"description: {quote_yaml_value(desc)}",
            "---",
            "",
            f"# {label} Skills",
            "",
            f"**{count} skills** for {desc.lower().rstrip('.')}.",
            "",
        ]

        if matched:
            lines.append("| Skill | Type | Complexity | Description |")
            lines.append("|-------|------|------------|-------------|")
            for s in matched:
                type_label = "Command" if s["user_invocable"] else "Reference"
                cplx = s["complexity"] or "-"
                safe_desc = s["description"].replace("|", "\\|")
                # House rule: no em/en dashes in generated docs text.
                safe_desc = (
                    safe_desc.replace("\u2014", ",")
                    .replace("\u2013", ",")
                    .replace(" ,", ",")
                )
                # Truncate long descriptions for the table
                if len(safe_desc) > 120:
                    safe_desc = safe_desc[:117] + "..."
                lines.append(
                    f"| [{s['title']}](/docs/reference/skills/{s['slug']}) "
                    f"| {type_label} | {cplx} | {safe_desc} |"
                )
            lines.append("")

        # Related agents section
        related_agents = rule.get("agents", set())
        if related_agents:
            lines.append("## Related Agents")
            lines.append("")
            for agent_slug in sorted(related_agents):
                lines.append(f"- [{title_case(agent_slug)}](/docs/reference/agents/{agent_slug})")
            lines.append("")

        (out_dir / f"{cat_slug}.mdx").write_text("\n".join(lines), encoding="utf-8")

    # Write meta.json
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "By Category", "pages": cat_slugs}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"  -> {len(cat_slugs)} category pages written to {categories_out}")
    return len(cat_slugs)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

# Friendly section titles for agent slugs. Skill membership is derived entirely
# from each skill's `agent:` frontmatter, so the page cannot drift; this map only
# prettifies headings and is optional — unknown agents fall back to title_case.
AGENT_SECTION_TITLES = {
    "backend-system-architect": "Backend & Distributed Systems",
    "frontend-ui-developer": "Frontend & UI",
    "frontend-performance-engineer": "Frontend Performance",
    "database-engineer": "Database",
    "test-generator": "Testing",
    "security-auditor": "Security",
    "llm-integrator": "LLM, RAG & AI",
    "data-pipeline-engineer": "Data Pipelines & RAG",
    "workflow-architect": "LangGraph & Workflows",
    "code-quality-reviewer": "Code Quality",
    "demo-producer": "Video & Demo Production",
    "product-strategist": "Product & Strategy",
    "accessibility-specialist": "Accessibility",
    "monitoring-engineer": "Observability & Metrics",
    "event-driven-architect": "Event-Driven Architecture",
    "web-research-analyst": "Web Research",
    "python-performance-engineer": "Python Performance",
    "debug-investigator": "Debugging",
    "ci-cd-engineer": "CI/CD",
    "emulate-engineer": "API Emulation",
}


def _ref_table_cell(text: str) -> str:
    """Escape a description for an MDX table cell (pipes, braces, angles).

    Pipes are escaped everywhere, since a GFM table splits on them even inside
    a code span. Braces and angles are left alone inside inline code, which
    MDX renders literally.
    """
    return _escape_outside_inline_code(
        text.replace("|", "\\|"),
        lambda s: (
            s.replace("{", "\\{").replace("}", "\\}").replace("<", "&lt;").replace(">", "&gt;")
        ),
    )


def generate_reference_skills(skills_src: str, out_file: str) -> int:
    """Generate the Reference Skills page from skill frontmatter (#2120).

    Lists every `user-invocable: false` skill, grouped by its `agent:` field, so
    the page can never drift from the actual skill set. Returns the count.
    """
    skills_dir = Path(skills_src)
    by_agent: dict[str, list[tuple[str, str]]] = {}
    cross_cutting: list[tuple[str, str]] = []

    for skill_dir in sorted(d for d in skills_dir.iterdir() if d.is_dir()):
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            continue
        meta, _ = parse_frontmatter(skill_file.read_text(encoding="utf-8"))
        if meta.get("user-invocable", False):
            continue  # command skill, not a reference skill
        slug = skill_dir.name
        desc = _ref_table_cell((meta.get("description", "") or "").strip())
        agent = (meta.get("agent", "") or "").strip()
        if agent:
            by_agent.setdefault(agent, []).append((slug, desc))
        else:
            cross_cutting.append((slug, desc))

    count = sum(len(v) for v in by_agent.values()) + len(cross_cutting)

    def emit_table(rows):
        out = ["| Skill | Description |", "|-------|-------------|"]
        for slug, desc in sorted(rows):
            out.append(f"| `{slug}` | {desc} |")
        return out

    lines = [
        "---",
        'title: "Reference Skills"',
        f'description: "The {count} user-invocable:false skills auto-injected into '
        'agent context — the knowledge library behind OrchestKit agents."',
        "---",
        "",
        "{/* GENERATED by scripts/_build-docs-generate.py from skill frontmatter "
        "(#2120) — do not edit by hand. */}",
        "",
        "## What Are Reference Skills?",
        "",
        f"Reference skills are the **{count} skills** with `user-invocable: false` in "
        "their frontmatter. You never invoke them directly — they are automatically "
        "injected into agent context through three paths:",
        "",
        "1. **Agent frontmatter** — each agent declares the skills it needs; when the "
        "agent spawns, those skills load automatically.",
        "2. **Command-skill composition** — a command skill (e.g. `/ork:implement`) "
        "pulls in reference skills via its `skills:` field.",
        "3. **Keyword auto-suggest** — the `skill-auto-suggest` hook injects matching "
        "skills based on keywords in your prompt.",
        "",
        "Skills are grouped below by the `agent:` field they declare. Skills with no "
        "`agent:` are cross-cutting — shared across agents or the core system.",
        "",
    ]

    for agent in sorted(by_agent):
        title = AGENT_SECTION_TITLES.get(agent, title_case(agent))
        lines += ["---", "", f"## {title}", "", f"**Primary agent:** `{agent}`", ""]
        lines += emit_table(by_agent[agent])
        lines.append("")

    if cross_cutting:
        lines += [
            "---",
            "",
            "## Cross-Cutting Skills",
            "",
            "These skills do not declare an `agent:` field — they serve multiple "
            "agents or the core system.",
            "",
        ]
        lines += emit_table(cross_cutting)
        lines.append("")

    lines += [
        "---",
        "",
        "## How Reference Skills Get to Agents",
        "",
        "The link between a reference skill and its agent is bidirectional: the "
        "skill's `agent:` field names its owning agent, and the agent's `skills:` "
        "array lists the skills it loads. When an agent spawns, Claude Code injects "
        "each listed skill's content into the agent's context window.",
        "",
        "---",
        "",
        "## What's Next",
        "",
        "- [Command Skills](/docs/skills/command-skills) — the commands that "
        "orchestrate these reference skills.",
        "- [Composing Skills Into Workflows](/docs/skills/skill-composition) — how "
        "everything fits together.",
        "- [Writing Skills](/docs/skills/writing-skills) — add reference skills for "
        "your own domain.",
        "",
    ]

    Path(out_file).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"Generated reference-skills page: {count} reference skills "
        f"({len(by_agent)} agents + {len(cross_cutting)} cross-cutting)"
    )
    return count


def main():
    skills_src = os.environ["SKILLS_SRC"]
    agents_src = os.environ["AGENTS_SRC"]
    hooks_json = os.environ["HOOKS_JSON"]
    docs_out = os.environ["DOCS_OUT"]
    skills_out = os.environ["SKILLS_OUT"]
    agents_out = os.environ["AGENTS_OUT"]
    hooks_out = os.environ["HOOKS_OUT"]

    generate_skills(skills_src, skills_out)
    generate_agents(agents_src, agents_out)
    generate_hooks(hooks_json, hooks_out)

    # Category index pages (#9003)
    categories_out = os.environ.get("CATEGORIES_OUT", "")
    if categories_out:
        generate_categories(skills_src, categories_out)

    # Reference-skills narrative page, generated from frontmatter (#2120)
    refskills_out = os.environ.get("REFSKILLS_OUT", "")
    if refskills_out:
        generate_reference_skills(skills_src, refskills_out)

    # Update reference meta.json
    print("Updating reference meta.json...")
    meta = {
        "title": "Reference",
        "description": "Generated reference for every skill, agent, and hook",
        "root": True,  # own sidebar tab; keeps 192 generated pages out of the main tree
        "pages": ["index", "skills", "agents", "hooks"],
    }
    meta_path = Path(docs_out) / "meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
