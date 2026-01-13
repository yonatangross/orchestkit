#!/usr/bin/env python3
"""
Migrate agents to CC 2.1.6 frontmatter format.

Changes:
- model_preference: X -> model: X
- Removes max_tokens (not CC 2.1.6 field)
- skills: comma,list -> skills:\n  - skill1\n  - skill2
- tools: comma,list -> tools:\n  - tool1\n  - tool2
"""

import os
import re
import sys
from pathlib import Path


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Extract frontmatter and body from markdown."""
    match = re.match(r'^---\n(.*?)\n---\n?(.*)', content, re.DOTALL)
    if not match:
        return {}, content

    fm_text = match.group(1)
    body = match.group(2)

    # Parse YAML-ish frontmatter (simple key: value parsing)
    fm = {}
    current_key = None
    current_list = []

    for line in fm_text.split('\n'):
        # Check for hooks section (complex nested YAML)
        if line.startswith('hooks:'):
            current_key = 'hooks'
            current_list = [line]
            continue

        # If in hooks section, accumulate
        if current_key == 'hooks' and (line.startswith('  ') or line.startswith('\t')):
            current_list.append(line)
            continue

        # End hooks section
        if current_key == 'hooks' and current_list:
            fm['hooks'] = '\n'.join(current_list)
            current_key = None
            current_list = []

        # Parse key: value
        if ':' in line and not line.startswith(' '):
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip()
            fm[key] = value

    # Handle trailing hooks
    if current_key == 'hooks' and current_list:
        fm['hooks'] = '\n'.join(current_list)

    return fm, body


def convert_comma_list_to_yaml(comma_str: str, indent: str = "  ") -> str:
    """Convert 'a, b, c' to YAML list format."""
    items = [item.strip() for item in comma_str.split(',') if item.strip()]
    return '\n'.join(f"{indent}- {item}" for item in items)


def migrate_agent(filepath: Path) -> None:
    """Migrate a single agent file."""
    content = filepath.read_text()
    fm, body = parse_frontmatter(content)

    if not fm:
        print(f"  Skipping (no frontmatter): {filepath.name}")
        return

    # Get required fields
    name = fm.get('name', '')
    description = fm.get('description', '')
    model = fm.get('model_preference', fm.get('model', 'inherit'))
    color = fm.get('color', 'blue')
    tools = fm.get('tools', '')
    skills = fm.get('skills', '')
    hooks = fm.get('hooks', '')

    # Build new frontmatter
    new_fm_lines = [
        "---",
        f"name: {name}",
        f"description: {description}",
        f"model: {model}",
        f"color: {color}",
    ]

    # Add tools as YAML array
    if tools:
        new_fm_lines.append("tools:")
        new_fm_lines.append(convert_comma_list_to_yaml(tools))

    # Add skills as YAML array
    if skills:
        new_fm_lines.append("skills:")
        new_fm_lines.append(convert_comma_list_to_yaml(skills))

    # Add hooks section
    if hooks:
        new_fm_lines.append(hooks)

    new_fm_lines.append("---")

    # Reconstruct file
    new_content = '\n'.join(new_fm_lines) + '\n' + body.lstrip('\n')

    filepath.write_text(new_content)

    tools_count = len([t for t in tools.split(',') if t.strip()]) if tools else 0
    skills_count = len([s for s in skills.split(',') if s.strip()]) if skills else 0
    print(f"  Migrated: {name} (model: {model}, {tools_count} tools, {skills_count} skills)")


def main():
    agents_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "agents")

    if not agents_dir.exists():
        print(f"Error: Directory not found: {agents_dir}")
        sys.exit(1)

    print(f"Migrating agents in: {agents_dir}")
    print()

    for agent_file in sorted(agents_dir.glob("*.md")):
        migrate_agent(agent_file)

    print()
    print("Migration complete!")


if __name__ == "__main__":
    main()