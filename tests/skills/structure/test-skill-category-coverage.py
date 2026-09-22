#!/usr/bin/env python3
"""Assert every skill matches at least one by-category rule and appears in MDX."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GEN_PATH = ROOT / "scripts" / "_build-docs-generate.py"
SKILLS_SRC = ROOT / "src" / "skills"
BY_CATEGORY = ROOT / "docs" / "site" / "content" / "docs" / "skills" / "by-category"


def load_generator():
    spec = importlib.util.spec_from_file_location("ork_build_docs_generate", GEN_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    print("=== Skill by-category coverage ===\n")
    if not GEN_PATH.is_file():
        print(f"FAIL: missing {GEN_PATH}")
        return 1

    mod = load_generator()
    skills = mod._collect_skill_metadata(str(SKILLS_SRC))
    orphans: list[str] = []
    for skill in skills:
        cats = [
            slug
            for slug, rule in mod.CATEGORY_RULES.items()
            if mod._match_category(skill, rule)
        ]
        if not cats:
            orphans.append(skill["slug"])

    mdx_text = ""
    if BY_CATEGORY.is_dir():
        for mdx in sorted(BY_CATEGORY.glob("*.mdx")):
            mdx_text += mdx.read_text(encoding="utf-8")

    missing_from_pages: list[str] = []
    for skill in skills:
        slug = skill["slug"]
        if slug in orphans:
            continue
        if f"/docs/reference/skills/{slug}" not in mdx_text:
            missing_from_pages.append(slug)

    print(f"skills={len(skills)}")
    print(f"orphans={len(orphans)}")
    print(f"mdx_drift={len(missing_from_pages)}")
    if orphans:
        print("ORPHAN_LIST=" + ",".join(orphans))
    if missing_from_pages:
        print("MDX_DRIFT_LIST=" + ",".join(missing_from_pages))

    if orphans or missing_from_pages:
        print(
            "\nFAIL: every skill must match at least one by-category rule "
            "and appear on a regenerated page."
        )
        print(
            "      Fix: add a CATEGORY_RULES tag in skill frontmatter "
            "(or extend CATEGORY_RULES), then run scripts/build-docs.sh"
        )
        return 1

    print("\nPASS: every skill appears on at least one by-category page")
    return 0


if __name__ == "__main__":
    sys.exit(main())
