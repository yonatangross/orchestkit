"""Shared inputs for the OrchestKit link card: brand tokens, fonts, host list,
the repo-derived counts and the art plate lookup. No drawing happens here."""

import glob
import os
import re
import sys

from PIL import Image, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
W, H = 1200, 630
SAFE_BOTTOM = H - 95  # X title bar covers everything below this line

# Indigo Ledger tokens (docs/site/app/global.css, .dark), converted from OKLCH.
BG = (5, 7, 15)
FG = (229, 232, 240)
MUTED = (175, 180, 193)
DIM = (140, 146, 163)
INDIGO = (69, 124, 253)
VIOLET = (153, 130, 248)

# Every host the docs ship an install path for, in card order. Marks come from
# docs/site/components/host-marks.tsx or marks/ (see marks/SOURCES.md).
HOSTS = [
    ("claude", "Claude"),
    ("cursor", "Cursor"),
    ("codex", "Codex"),
    ("muse", "Muse"),
    ("agy", "Antigravity"),
    ("devin", "Devin"),
    ("opencode", "OpenCode"),
    ("pi", "Pi"),
]


def tagline() -> str:
    """"For Claude Code and N more agents", with N counted from HOSTS, the same
    list the logo row renders, so adding or removing a host updates both."""
    lead, _ = HOSTS[0]
    if lead != "claude":
        sys.exit(f"HOSTS must start with claude for the tagline, got {lead!r}")
    return f"For Claude Code and {len(HOSTS) - 1} more agents"


# Words beside the counts, matching the home page stats row (app/(home)/page.tsx).
STAT_WORDS = {"skills": "skills", "agents": "agents", "hooks": "hooks"}


def skill_count() -> int:
    """Number of skills in the repo, counted from src/skills/*/SKILL.md."""
    n = len(glob.glob(os.path.join(ROOT, "src", "skills", "*", "SKILL.md")))
    if n == 0:
        sys.exit("no src/skills/*/SKILL.md found; refusing to print a zero")
    return n


def agent_count() -> int:
    """Number of agents in the repo, counting src/agents/*.md the way
    scripts/generate-docs-data.js does (README/INDEX/CONTRIBUTING excluded)."""
    skip = {"README.md", "INDEX.md", "CONTRIBUTING.md"}
    agents = os.path.join(ROOT, "src", "agents")
    return len([f for f in os.listdir(agents) if f.endswith(".md") and f not in skip])


def totals() -> dict[str, int]:
    """Skill, agent and hook counts exactly as the site shows them.

    Hooks are counted by scripts/generate-docs-data.js (global + agent-scoped +
    skill-scoped), so read its output rather than re-deriving it. Skills and
    agents are re-counted here; a mismatch means the generated file is stale.
    """
    gen = os.path.join(ROOT, "docs", "site", "lib", "generated", "shared-data.ts")
    with open(gen) as f:
        src = f.read()
    block = re.search(r"TOTALS: Totals = \{(.*?)\}", src, re.S)
    if not block:
        sys.exit(f"no TOTALS block in {gen}")
    got = {k: int(v) for k, v in re.findall(r'"(\w+)":\s*(\d+)', block.group(1))}
    direct = {"skills": skill_count(), "agents": agent_count()}
    for k, v in direct.items():
        if got.get(k) != v:
            sys.exit(f"{gen} says {k}={got.get(k)} but the repo has {v}; run npm run build")
    return {"skills": got["skills"], "agents": got["agents"], "hooks": got["hooks"]}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """Load a vendored Geist face from fonts/ at `size` px."""
    return ImageFont.truetype(os.path.join(HERE, "fonts", name), size)


def cover(img: Image.Image, w: int = W, h: int = H) -> Image.Image:
    """Scale `img` to fill w by h and centre-crop the overflow."""
    img = img.convert("RGB")
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.Resampling.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def plate_index(p: str) -> int:
    """The trailing number in an art plate path, 0 when it has none."""
    m = re.search(r"-(\d+)\.png$", p)
    return int(m.group(1)) if m else 0


def newest_plate(concept: str) -> str:
    """Path of the highest-numbered art plate for `concept`."""
    plates = sorted(glob.glob(os.path.join(HERE, "art", f"{concept}-[0-9].png")), key=plate_index)
    if not plates:
        sys.exit(f"no art/{concept}-<n>.png yet; run gen.sh {concept} first")
    return plates[-1]
