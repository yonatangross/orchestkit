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
    body = "\n".join(lines[end_idx + 1:])
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
    "colang", "tape", "redis", "env", "dotenv",
    "properties", "conf", "cfg", "ini",
}


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

        # Outside code blocks: escape curly braces
        line = line.replace("{", "\\{").replace("}", "\\}")

        # Escape ALL < that could be interpreted as JSX by MDX.
        # Only keep known-safe HTML/MDX component tags.
        safe_tags = {
            "br", "hr", "img", "a", "div", "span", "p", "ul", "ol", "li",
            "table", "thead", "tbody", "tr", "td", "th", "strong", "em",
            "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
            "sup", "sub", "details", "summary", "Callout", "Card", "Tab",
            "Tabs", "Steps", "Step", "details", "summary",
        }

        def escape_angle(m):
            full = m.group(0)
            # Check if it's a known safe tag: <tag or </tag
            tag_match = re.match(r"</?([a-zA-Z]\w*)", full)
            if tag_match and tag_match.group(1) in safe_tags:
                return full
            return full.replace("<", "&lt;").replace(">", "&gt;")

        # Match any < ... > pair, or bare < followed by non-space
        line = re.sub(r"<[^>]*>", escape_angle, line)
        # Also catch bare < not followed by space or already-escaped
        line = re.sub(r"<(?![a-zA-Z/!&])", "&lt;", line)

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
        results.append({
            "filename": md_file.name,
            "title": title,
            "frontmatter": frontmatter,
            "body": body,
        })
    return results


def format_subdir_sections(skill_dir: Path) -> list[str]:
    """Generate MDX details/summary sections for skill subdirectory content."""
    all_lines: list[str] = []

    for subdir_name in SKILL_SUBDIRS:
        files = read_subdirectory_files(skill_dir, subdir_name)
        if not files:
            continue
        heading = title_case(subdir_name)
        count = len(files)

        all_lines.append("")
        all_lines.append("---")
        all_lines.append("")
        all_lines.append(f"## {heading} ({count})")
        all_lines.append("")
        for entry in files:
            # Build section title
            sec_title = entry["title"]
            impact = entry["frontmatter"].get("impact", "")
            if impact:
                sec_title = f"{sec_title} — {impact}"

            all_lines.append(f"### {sec_title}")
            all_lines.append("")
            all_lines.append(sanitize_mdx_body(entry["body"]))
            all_lines.append("")

    return all_lines


# ---------------------------------------------------------------------------
# SKILLS
# ---------------------------------------------------------------------------

def generate_skills(skills_src: str, skills_out: str) -> int:
    """Generate skill MDX pages. Returns count."""
    skills_dir = Path(skills_src)
    out_dir = Path(skills_out)
    index_rows = []
    slugs = []

    skill_dirs = sorted(d for d in skills_dir.iterdir() if d.is_dir())
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
        agent_field = meta.get("agent", "")
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

        if agent_field:
            lines.append(
                f"**Primary Agent:** [{agent_field}](/docs/reference/agents/{agent_field})"
            )
            lines.append("")

        if skills_list:
            lines.append("## Related Skills")
            lines.append("")
            for sk in skills_list:
                sk = sk.strip()
                if sk:
                    lines.append(f"- [{sk}](/docs/reference/skills/{sk})")
            lines.append("")

        lines.append(sanitize_mdx_body(body))

        # Surface subdirectory content (rules, references, checklists, examples)
        subdir_lines = format_subdir_sections(skill_dir)
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

    # Write meta.json
    pages = ["index"] + slugs
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Skills", "pages": pages}, indent=2) + "\n",
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
            source, re.DOTALL,
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

    agent_files = sorted(agents_dir.glob("*.md"))
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
        short_desc = re.split(
            r"\s*[Aa]ctivates for\s*|\s*[Uu]se when\s*", description
        )[0].rstrip(". ")

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
        lines.append(f"> {short_desc}")
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
                desc = ah["description"] or "\u2014"
                lines.append(
                    f"| `{ah['hook']}` | {badge} | {desc} |"
                )
            lines.append("")

        lines.append(sanitize_mdx_body(body))

        out_file = out_dir / f"{slug}.mdx"
        out_file.write_text("\n".join(lines), encoding="utf-8")

        # Index row — escape description for markdown table
        safe_desc = short_desc.replace("|", "\\|")
        index_rows.append(
            f"| [{title}](/docs/reference/agents/{slug}) "
            f"| {model or '\u2014'} | {safe_desc} |"
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

    # Write meta.json
    pages = ["index"] + slugs
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Agents", "pages": pages}, indent=2) + "\n",
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


def hook_name_from_command(cmd: str) -> tuple[str, str]:
    """Extract (full_path, short_name) from a run-hook command."""
    for splitter in ["run-hook.mjs ", "run-hook-silent.mjs "]:
        if splitter in cmd:
            hook_path = cmd.split(splitter)[1].strip()
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


# Behavior badge labels
BEHAVIOR_BADGES = {
    "blocks": "\U0001f6d1 Blocks",
    "injects": "\U0001f4a1 Injects",
    "silent": "\U0001f507 Silent",
    "fire-and-forget": "\U0001f525 Fire-and-forget",
}


def _find_hook_ts_file(hooks_src_dir: Path, hook_path: str) -> Path | None:
    """Resolve a hook path (e.g. 'pretool/bash/dangerous-command-blocker') to its .ts source."""
    ts_file = hooks_src_dir / f"{hook_path}.ts"
    if ts_file.is_file():
        return ts_file
    return None


def _extract_jsdoc_description(source: str) -> str:
    """Extract the first meaningful description line from a JSDoc comment block.

    Skips the title line (typically 'Name - HookType Hook') and CC compliance lines.
    """
    match = re.match(r"/\*\*(.*?)\*/", source, re.DOTALL)
    if not match:
        return ""

    comment_body = match.group(1)
    lines = [
        line.strip().lstrip("* ").strip()
        for line in comment_body.split("\n")
    ]
    # Filter to non-empty lines
    lines = [l for l in lines if l]

    for line in lines:
        # Title line with hook type: "Name - PreToolUse Hook" or "Name - Dispatcher"
        if re.match(r".+ - .+(Hook|Dispatcher)$", line, re.IGNORECASE):
            continue
        # Bare title line ending with Hook/Dispatcher (no " - ")
        if re.match(r".+(Hook|Dispatcher)$", line) and lines.index(line) == 0:
            continue
        # Title line with description: "Name - Does something useful"
        # Extract the part after " - " as the description
        title_desc = re.match(r".+ - (.+)", line)
        if title_desc and lines.index(line) == 0:
            return title_desc.group(1)
        # Skip CC compliance lines
        if re.match(r"CC \d", line):
            continue
        # Skip Hook: lines
        if re.match(r"Hook:", line):
            continue
        # Skip Version: lines
        if re.match(r"Version:", line):
            continue
        # Skip Issue references: "Issue #235: Hook Architecture Refactor"
        if re.match(r"Issue #\d+", line):
            continue
        # Skip SECURITY: or Purpose: or Hooks consolidated here: style headers
        if re.match(r"(SECURITY|Purpose|Hooks consolidated|NOT consolidated|Created):", line):
            continue
        # Skip list items (sub-hook descriptions in dispatchers)
        if line.startswith("- "):
            continue
        # Skip numbered items
        if re.match(r"\d+\.", line):
            continue
        # Found a real description line
        return line

    return ""


def _detect_behavior(source: str, command: str) -> str:
    """Detect hook behavior type from source code and command string.

    Returns: 'blocks', 'injects', 'silent', or 'fire-and-forget'.
    """
    # Fire-and-forget: uses run-hook-silent.mjs
    if "run-hook-silent.mjs" in command:
        return "fire-and-forget"

    # Blocks: has continue: false or outputDeny
    if re.search(r"continue\s*:\s*false", source) or "outputDeny" in source:
        return "blocks"

    # Injects: produces additionalContext
    if "additionalContext" in source or "outputAllowWithContext" in source:
        return "injects"

    # Silent: suppressOutput or outputSilentSuccess without blocking/injecting
    if "suppressOutput" in source or "outputSilentSuccess" in source:
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
                cmd = h.get("command", "")
                hook_path, hook_name = hook_name_from_command(cmd)
                scope = scope_from_path(hook_path)

                # Extract TSDoc metadata
                if hooks_src_dir and hooks_src_dir.is_dir():
                    meta = extract_hook_metadata(hooks_src_dir, hook_path, cmd)
                else:
                    behavior = "fire-and-forget" if "run-hook-silent.mjs" in cmd else "silent"
                    meta = {"description": "", "behavior": behavior}

                rows.append({
                    "name": hook_name,
                    "path": hook_path,
                    "matcher": matcher_name,
                    "scope": scope,
                    "behavior": meta["behavior"],
                    "description": meta["description"],
                })
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
                desc = r["description"].replace("|", "\\|") if r["description"] else "\u2014"
                matcher_escaped = r["matcher"].replace("|", "\\|")
                lines.append(
                    f"| `{r['name']}` | `{matcher_escaped}` | {badge} | {desc} |"
                )
        else:
            lines.append("*No hooks registered for this event.*")
        lines.append("")

        (out_dir / f"{slug}.mdx").write_text("\n".join(lines), encoding="utf-8")

    # Index page
    index_lines = [
        "---",
        "title: Hooks Reference",
        f'description: "Complete reference for all {total_hooks} OrchestKit hooks '
        f'across {len(categories)} event categories."',
        "---",
        "",
        "# Hooks Reference",
        "",
        f"OrchestKit includes **{total_hooks} hook entries** across "
        f"**{len(categories)} lifecycle event categories**.",
        "",
        "| Category | Hooks | Description |",
        "|----------|-------|-------------|",
    ]
    for slug, cat, count in cat_slugs:
        index_lines.append(
            f"| [{cat}](/docs/reference/hooks/{slug}) | {count} | "
            f"Hooks for `{cat}` events |"
        )
    (out_dir / "index.mdx").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    # Generate spotlights directory structure
    spotlights_dir = out_dir / "spotlights"
    spotlights_dir.mkdir(parents=True, exist_ok=True)
    spotlights_meta = {"title": "Spotlights", "pages": []}
    (spotlights_dir / "meta.json").write_text(
        json.dumps(spotlights_meta, indent=2) + "\n", encoding="utf-8"
    )

    # meta.json — include spotlights section
    pages = ["index"] + [s for s, _, _ in cat_slugs] + ["spotlights"]
    (out_dir / "meta.json").write_text(
        json.dumps({"title": "Hooks", "pages": pages}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"  -> {total_hooks} hooks across {len(categories)} category pages "
        f"written to {hooks_out}"
    )
    return total_hooks


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

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

    # Update reference meta.json
    print("Updating reference meta.json...")
    meta = {"title": "Reference", "pages": ["index", "skills", "agents", "hooks"]}
    meta_path = Path(docs_out) / "meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
