#!/usr/bin/env python3
"""disk-cleanup: inventory and reclaim the disk that AI agents and worktrees leave behind.

Dry run by default. `--apply` removes only SAFE (caches that refill) and
REGENERABLE (merged, clean, idle worktrees; rebuildable stores) items. ASK FIRST
items are listed with the command to run, never run by this script.

Exit codes: 0 clean or applied, 2 could not look or refused, 3 findings (dry
run) or some action failed (apply).

Standard library only. macOS first, Linux second.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import time
import unicodedata
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import TextIO

REPORT_MARKER = "# ork-disk-cleanup report v1"
WIDTH = 76
DEFAULT_IDLE_MINUTES = 60
ORPHAN_MIN_AGE_S = 24 * 3600
MAX_WORKTREE_COMMANDS = 5
TIERS = ("safe", "regenerable", "ask", "keep")
SKIP_DIRS = {"node_modules", ".worktrees", ".git", "Library", ".Trash", ".cache", ".npm"}


# --------------------------------------------------------------------- runner


class Runner:
    """Runs external tools. Tests replace it; nothing else shells out."""

    def run(
        self, argv: Sequence[str], cwd: Path | str | None = None, timeout: int = 30
    ) -> tuple[int, str]:
        try:
            r = subprocess.run(
                list(argv),
                cwd=str(cwd) if cwd else None,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except FileNotFoundError:
            return (127, "")
        except subprocess.TimeoutExpired:
            return (124, "")
        except OSError:
            return (126, "")
        return (r.returncode, r.stdout)


# --------------------------------------------------------------------- model


@dataclass
class Item:
    id: str
    section: str
    tier: str
    label: str
    icon: str
    size: int = 0
    reason: str = ""
    verb: str = ""
    action: tuple | None = None
    ask_cmd: str = ""


@dataclass
class Inventory:
    items: list[Item] = field(default_factory=list)
    caveats: list[str] = field(default_factory=list)
    disk: tuple[int, int, int] = (0, 0, 0)

    def tier(self, name: str) -> list[Item]:
        return [i for i in self.items if i.tier == name]

    def total(self, name: str) -> int:
        return sum(i.size for i in self.tier(name))


@dataclass
class Env:
    home: Path
    platform: str
    runner: Runner
    roots: list[Path] = field(default_factory=list)
    now: float = field(default_factory=time.time)
    user: str = ""
    uid: int = -1
    idle_minutes: int = DEFAULT_IDLE_MINUTES
    disk_usage: Callable[[Path], tuple[int, int, int]] = shutil.disk_usage  # type: ignore[assignment]
    ledger: Path | None = None

    @property
    def ledger_path(self) -> Path:
        return self.ledger or self.home / ".local" / "state" / "ork" / "disk-cleanup-ledger.jsonl"


# --------------------------------------------------------------------- helpers


def measure(path: Path, older_than: float | None = None) -> int:
    """Allocated bytes under path. Never follows symlinks, counts a hardlink once.

    With `older_than` (epoch seconds) only files last modified before it count.
    """
    try:
        st = os.lstat(path)
    except OSError:
        return 0
    if stat.S_ISLNK(st.st_mode):
        return 0
    seen: set[tuple[int, int]] = set()
    total = 0

    def add(s: os.stat_result) -> int:
        if s.st_nlink > 1:
            key = (s.st_dev, s.st_ino)
            if key in seen:
                return 0
            seen.add(key)
        return s.st_blocks * 512

    if not stat.S_ISDIR(st.st_mode):
        if older_than is not None and st.st_mtime >= older_than:
            return 0
        return add(st)
    for dirpath, _dirnames, filenames in os.walk(path, followlinks=False):
        if older_than is None:
            with contextlib.suppress(OSError):
                total += os.lstat(dirpath).st_blocks * 512
        for name in filenames:
            try:
                fs = (Path(dirpath) / name).lstat()
            except OSError:
                continue
            if stat.S_ISLNK(fs.st_mode):
                continue
            if older_than is not None and fs.st_mtime >= older_than:
                continue
            total += add(fs)
    return total


_UNITS = {"B": 1, "KB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12}


def parse_size(text: str) -> int:
    m = re.match(r"\s*([0-9]*\.?[0-9]+)\s*([kKMGT]?B)", text or "")
    if not m:
        return 0
    return round(float(m.group(1)) * _UNITS[m.group(2).upper()])


def parse_etime(text: str) -> int | None:
    """ps etime [[dd-]hh:]mm:ss to seconds."""
    m = re.fullmatch(r"(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)", (text or "").strip())
    if not m:
        return None
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def fmt(n: float) -> str:
    for unit, div in (("T", 1e12), ("G", 1e9), ("M", 1e6), ("K", 1e3)):
        if n >= div:
            return f"{n / div:.1f} {unit}"
    return f"{int(n)} B"


def cells(s: str) -> int:
    n = 0
    for ch in s:
        if unicodedata.combining(ch) or ch == "️":
            continue
        n += 2 if (unicodedata.east_asian_width(ch) in "WF" or ord(ch) >= 0x1F300) else 1
    return n


def trunc(s: str, width: int) -> str:
    if cells(s) <= width:
        return s
    out = ""
    for ch in s:
        if cells(out + ch) > width - 1:
            break
        out += ch
    return out + "…"


def padc(s: str, width: int) -> str:
    return s + " " * max(0, width - cells(s))


def short(env: Env, path: Path | str) -> str:
    p = str(path)
    h = str(env.home)
    return "~" + p[len(h) :] if p == h or p.startswith(h + os.sep) else p


def inside(path: Path, parent: Path) -> bool:
    try:
        rp = os.path.realpath(path)
        rq = os.path.realpath(parent)
    except OSError:
        return False
    return rp == rq or rp.startswith(rq + os.sep)


# --------------------------------------------------------------------- catalog


@dataclass(frozen=True)
class Spec:
    id: str
    label: str
    icon: str
    tier: str
    darwin: tuple[str, ...] = ()
    linux: tuple[str, ...] = ()
    min_age_days: int | None = None
    ask_template: str = ""  # {p} is the quoted path


CATALOG: tuple[Spec, ...] = (
    Spec("npm-cache", "npm cache", "📦", "safe", ("~/.npm/_cacache",), ("~/.npm/_cacache",)),
    Spec("yarn-cache", "Yarn cache", "📦", "safe", ("~/Library/Caches/Yarn",), ("~/.cache/yarn",)),
    Spec("pip-cache", "pip cache", "🐍", "safe", ("~/Library/Caches/pip",), ("~/.cache/pip",)),
    Spec("uv-cache", "uv cache", "🐍", "safe", ("~/.cache/uv",), ("~/.cache/uv",)),
    Spec(
        "cargo-registry",
        "Cargo registry cache",
        "📦",
        "safe",
        ("~/.cargo/registry/cache",),
        ("~/.cargo/registry/cache",),
    ),
    Spec(
        "go-build",
        "Go build cache",
        "📦",
        "safe",
        ("~/Library/Caches/go-build",),
        ("~/.cache/go-build",),
    ),
    Spec(
        "homebrew",
        "Homebrew downloads",
        "📦",
        "safe",
        ("~/Library/Caches/Homebrew",),
        ("~/.cache/Homebrew",),
    ),
    Spec(
        "xcode-derived-data",
        "Xcode DerivedData",
        "🛠️",
        "safe",
        ("~/Library/Developer/Xcode/DerivedData",),
        (),
    ),
    Spec(
        "browser-caches",
        "Browser caches",
        "🌐",
        "safe",
        ("~/Library/Caches/Google/Chrome", "~/Library/Caches/Chromium"),
        ("~/.cache/google-chrome", "~/.cache/chromium"),
    ),
    Spec(
        "agent-debug-logs",
        "Agent debug logs older than 14 d",
        "🧠",
        "safe",
        ("~/.claude/debug",),
        ("~/.claude/debug",),
        min_age_days=14,
    ),
    Spec(
        "agent-shell-snapshots",
        "Agent shell snapshots older than 30 d",
        "🧠",
        "safe",
        ("~/.claude/shell-snapshots",),
        ("~/.claude/shell-snapshots",),
        # a session that runs for days still sources its own snapshot
        min_age_days=30,
    ),
    Spec(
        "pnpm-store",
        "pnpm store",
        "📦",
        "regenerable",
        ("~/Library/pnpm/store",),
        ("~/.local/share/pnpm/store",),
    ),
    Spec(
        "gradle-caches",
        "Gradle caches",
        "📦",
        "regenerable",
        ("~/.gradle/caches",),
        ("~/.gradle/caches",),
    ),
    Spec(
        "playwright",
        "Playwright browsers",
        "🌐",
        "regenerable",
        ("~/Library/Caches/ms-playwright",),
        ("~/.cache/ms-playwright",),
    ),
    Spec(
        "puppeteer",
        "Puppeteer browsers",
        "🌐",
        "regenerable",
        ("~/.cache/puppeteer",),
        ("~/.cache/puppeteer",),
    ),
    Spec(
        "xcode-device-support",
        "Xcode device support",
        "🛠️",
        "regenerable",
        ("~/Library/Developer/Xcode/iOS DeviceSupport",),
        (),
    ),
    Spec(
        "agent-transcripts",
        "Agent session transcripts",
        "🧠",
        "ask",
        ("~/.claude/projects",),
        ("~/.claude/projects",),
        ask_template="find {p} -type f -mtime +30 -delete",
    ),
    Spec(
        "codex-sessions",
        "Codex session logs",
        "🧠",
        "ask",
        ("~/.codex/sessions",),
        ("~/.codex/sessions",),
        ask_template="find {p} -type f -mtime +30 -delete",
    ),
    Spec(
        "downloads",
        "Downloads",
        "📥",
        "ask",
        ("~/Downloads",),
        ("~/Downloads",),
        ask_template="du -sk {p}/* | sort -rn | head -20",
    ),
    Spec(
        "trash",
        "Trash",
        "🗑️",
        "ask",
        ("~/.Trash",),
        ("~/.local/share/Trash",),
        ask_template="rm -rf {p}/*",
    ),
)


def expand(env: Env, spec_path: str) -> Path:
    return env.home / spec_path[2:] if spec_path.startswith("~/") else Path(spec_path)


def deletable(env: Env, path: Path) -> str:
    """Empty string when path may be emptied, else the reason it may not."""
    try:
        if path.is_symlink():
            return "symlink, not followed"
        rel = os.path.relpath(os.path.realpath(path), os.path.realpath(env.home))
    except (OSError, ValueError):
        return "unreadable path"
    if rel.startswith("..") or rel == ".":
        return "outside home"
    if len(Path(rel).parts) < 2:
        return "too shallow to empty"
    if not inside(path, env.home):
        return "outside home"
    return ""


def scan_catalog(env: Env, inv: Inventory) -> None:
    for spec in CATALOG:
        raw = spec.darwin if env.platform == "darwin" else spec.linux
        cutoff = env.now - spec.min_age_days * 86400 if spec.min_age_days else None
        live = [expand(env, p) for p in raw if os.path.lexists(expand(env, p))]
        if not live:
            continue
        # symlinks are reported, never followed or emptied
        links = [p for p in live if p.is_symlink()]
        real = [p for p in live if p not in links]
        for p in links:
            inv.items.append(
                Item(
                    f"{spec.id}:link",
                    "caches",
                    "keep",
                    spec.label,
                    spec.icon,
                    0,
                    f"symlink, not followed ({short(env, p)})",
                )
            )
        if not real:
            continue
        size = sum(measure(p, cutoff) for p in real)
        if size <= 0:
            continue
        refused = next((r for r in (deletable(env, p) for p in real) if r), "")
        if spec.tier == "ask":
            quoted = " ".join(
                shlex.quote(short(env, p).replace("~", str(env.home), 1)) for p in real
            )
            cmd = spec.ask_template.format(p=quoted) if spec.ask_template else f"rm -rf {quoted}"
            inv.items.append(
                Item(spec.id, "caches", "ask", spec.label, spec.icon, size, "", "ask", None, cmd)
            )
            continue
        if refused:
            inv.items.append(Item(spec.id, "caches", "keep", spec.label, spec.icon, size, refused))
            continue
        inv.items.append(
            Item(
                spec.id,
                "caches",
                spec.tier,
                spec.label,
                spec.icon,
                size,
                "",
                "clear",
                ("clear", tuple(str(p) for p in real), cutoff),
            )
        )


# --------------------------------------------------------------------- docker


def scan_docker(env: Env, inv: Inventory) -> None:
    rc, _ = env.runner.run(["docker", "info"], timeout=15)
    if rc == 127:
        return
    if rc != 0:
        inv.caveats.append(
            "docker is installed but its daemon is not reachable, Docker items skipped"
        )
        return
    rc, out = env.runner.run(["docker", "system", "df", "--format", "{{json .}}"], timeout=60)
    if rc != 0:
        inv.caveats.append("docker system df failed, Docker items skipped")
        return
    rows: dict[str, int] = {}
    for line in out.splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        rows[d.get("Type", "")] = parse_size(d.get("Reclaimable", ""))
    rc, out = env.runner.run(
        ["docker", "images", "-f", "dangling=true", "--format", "{{.Size}}"], timeout=60
    )
    dangling = sum(parse_size(s) for s in out.splitlines()) if rc == 0 else 0
    cache = rows.get("Build Cache", 0)
    if cache > 0:
        inv.items.append(
            Item(
                "docker-build-cache",
                "docker",
                "safe",
                "Docker build cache",
                "🐳",
                cache,
                "",
                "prune",
                ("cmd", ("docker", "builder", "prune", "-f")),
            )
        )
    if dangling > 0:
        inv.items.append(
            Item(
                "docker-dangling-images",
                "docker",
                "safe",
                "Docker dangling images",
                "🐳",
                dangling,
                "",
                "prune",
                ("cmd", ("docker", "image", "prune", "-f")),
            )
        )
    unused = rows.get("Images", 0) - dangling
    if unused > 0:
        inv.items.append(
            Item(
                "docker-unused-images",
                "docker",
                "ask",
                "Docker unused images",
                "🐳",
                unused,
                # a pulled image comes back, a locally built one needs its build context
                "locally built ones cannot be pulled back",
                "ask",
                None,
                "docker image prune -a",
            )
        )
    vols = rows.get("Local Volumes", 0)
    if vols > 0:
        inv.items.append(
            Item(
                "docker-volumes",
                "docker",
                "ask",
                "Docker unused volumes",
                "💾",
                vols,
                "",
                "ask",
                None,
                "docker volume prune",
            )
        )
    if env.platform == "darwin":
        inv.caveats.append("Docker Desktop's disk image stays full size until it compacts")


# --------------------------------------------------------------------- processes


_ORPHAN = re.compile(
    r"(--headless|--remote-debugging|playwright|agent-browser|mcp|http\.server|portless)"
)
_AGENTS = {"claude", "codex", "cursor"}


def scan_processes(env: Env, inv: Inventory) -> None:
    rc, out = env.runner.run(["ps", "-axo", "pid=,ppid=,user=,etime=,rss=,command="], timeout=20)
    if rc != 0 or not out.strip():
        return
    for line in out.splitlines():
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        pid, ppid, user, etime, rss, cmd = parts
        age = parse_etime(etime)
        if ppid != "1" or user != env.user or age is None or age < ORPHAN_MIN_AGE_S:
            continue
        if not _ORPHAN.search(cmd) or Path(cmd.split()[0]).name in _AGENTS:
            continue
        mb = int(rss) // 1024 if rss.isdigit() else 0
        name = Path(cmd.split()[0]).name
        inv.items.append(
            Item(
                f"process:{pid}",
                "processes",
                "ask",
                f"{name} (pid {pid})",
                "🤖",
                0,
                f"up {age // 86400}d, {mb} MB RAM",
                "ask",
                None,
                f"kill {pid}",
            )
        )


# --------------------------------------------------------------------- worktrees


def read_cwds(env: Env) -> list[tuple[int, str]] | None:
    """(pid, cwd) pairs, or None when the process list cannot be read."""
    rc, out = env.runner.run(["lsof", "-d", "cwd", "-Fpn"], timeout=60)
    if rc == 127 and env.platform == "linux":
        pairs = []
        for entry in Path("/proc").iterdir():
            if entry.name.isdigit():
                try:
                    pairs.append((int(entry.name), str((entry / "cwd").readlink())))
                except OSError:
                    continue
        return pairs or None
    if not out.strip():
        return None
    pairs, pid = [], 0
    for line in out.splitlines():
        if line.startswith("p") and line[1:].isdigit():
            pid = int(line[1:])
        elif line.startswith("n") and pid:
            pairs.append((pid, line[1:]))
    return pairs or None


def discover_repos(env: Env) -> list[Path]:
    found: dict[str, Path] = {}

    def add(p: Path) -> None:
        found.setdefault(os.path.realpath(p), p)

    for root in env.roots:
        if (root / ".git").is_dir():
            add(root)
            continue
        base = len(root.parts)
        for dirpath, dirnames, _ in os.walk(root, followlinks=False):
            depth = len(Path(dirpath).parts) - base
            if (Path(dirpath) / ".git").is_dir():
                add(Path(dirpath))
                dirnames[:] = []
                continue
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS] if depth < 3 else []
    return list(found.values())


def parse_worktrees(out: str) -> list[dict[str, str]]:
    entries, cur = [], {}
    for line in out.splitlines() + [""]:
        if not line.strip():
            if cur:
                entries.append(cur)
            cur = {}
            continue
        key, _, val = line.partition(" ")
        cur[key] = val
    return entries


def default_branch(env: Env, repo: Path) -> str | None:
    rc, out = env.runner.run(
        ["git", "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd=repo
    )
    if rc == 0 and out.strip():
        return out.strip()
    for cand in ("origin/main", "origin/master"):
        rc, _ = env.runner.run(["git", "rev-parse", "--verify", "--quiet", cand], cwd=repo)
        if rc == 0:
            return cand
    return None


def merged_prs(
    env: Env, repo: Path, caveat_once: set[str], inv: Inventory
) -> dict[str, tuple[str, int]] | None:
    rc, out = env.runner.run(
        [
            "gh",
            "pr",
            "list",
            "--state",
            "merged",
            "--limit",
            "300",
            "--json",
            "headRefName,headRefOid,number",
        ],
        cwd=repo,
        timeout=60,
    )
    if rc != 0:
        return None
    try:
        return {d["headRefName"]: (d["headRefOid"], d.get("number", 0)) for d in json.loads(out)}
    except (ValueError, KeyError, TypeError):
        return None


def newest_mtime(env: Env, wt: Path) -> float:
    times: list[float] = []
    with contextlib.suppress(OSError):
        times.append(wt.lstat().st_mtime)
    rc, out = env.runner.run(["git", "rev-parse", "--absolute-git-dir"], cwd=wt)
    if rc == 0 and out.strip():
        for name in ("HEAD", "index"):
            with contextlib.suppress(OSError):
                times.append((Path(out.strip()) / name).lstat().st_mtime)
    return max(times) if times else env.now


# Ignored directories a worktree can lose because a tool rebuilds them. Any other
# ignored path (.env.local, a local database, notes) keeps the tree.
REGENERABLE_IGNORED_DIRS = frozenset(
    {
        "node_modules",
        ".venv",
        "venv",
        "dist",
        "build",
        ".next",
        ".turbo",
        "__pycache__",
        ".pytest_cache",
        "coverage",
    }
)


def regenerable_path(path: str) -> bool:
    """True when a `git status --ignored` path lies inside a regenerable directory."""
    parts = [p for p in path.strip().strip('"').split("/") if p]
    dirs = parts if path.rstrip().endswith("/") else parts[:-1]
    return any(d in REGENERABLE_IGNORED_DIRS for d in dirs)


def classify_worktree(
    env: Env,
    inv: Inventory,
    repo: Path,
    entry: dict[str, str],
    default: str | None,
    cwds: list[tuple[int, str]] | None,
    gh: dict[str, tuple[str, int]] | None,
    gh_state: dict[str, bool],
) -> Item:
    wt = Path(entry["worktree"])
    label = f"{repo.name}/{wt.name}"
    base = dict(id=f"worktree:{wt}", section="worktrees", label=label, icon="🗂️")

    def keep(reason: str, size: int = 0) -> Item:
        return Item(tier="keep", reason=reason, size=size, **base)

    if not inside(wt, env.home):
        return keep("outside home")
    if "locked" in entry:
        return keep("locked")
    if default is None:
        return keep("default branch unknown")
    if cwds is None:
        return keep("process list unreadable")
    held = next((pid for pid, cwd in cwds if inside(Path(cwd), wt)), None)
    if held is not None:
        return keep(f"process cwd inside (pid {held})")
    # --ignored: git worktree remove deletes ignored files with the tree, and plain
    # --porcelain never lists them, so a hand-written .env.local read as clean.
    # =matching names the path the ignore rule matched (packages/a/node_modules/),
    # where the default collapses an all-ignored parent into packages/.
    rc, out = env.runner.run(["git", "-C", str(wt), "status", "--porcelain", "--ignored=matching"])
    if rc != 0:
        return keep("git status failed")
    lines = [line for line in out.splitlines() if line.strip()]
    dirty = [line for line in lines if not line.startswith("!! ")]
    if dirty:
        return keep(f"dirty ({len(dirty)} files)")
    precious = [
        p for p in (line[3:] for line in lines if line.startswith("!! ")) if not regenerable_path(p)
    ]
    if precious:
        shown = ", ".join(precious[:3]) + (
            f" and {len(precious) - 3} more" if len(precious) > 3 else ""
        )
        return keep(f"ignored files would be deleted: {shown}")
    idle = env.idle_minutes * 60
    age = env.now - newest_mtime(env, wt)
    if age < idle:
        return keep(f"touched {max(0, int(age // 60))} min ago")
    head = entry.get("HEAD", "")
    size = measure(wt)
    rc, _ = env.runner.run(["git", "merge-base", "--is-ancestor", head, default], cwd=repo)
    if rc == 0:
        return Item(
            tier="regenerable",
            reason=f"merged into {default}",
            size=size,
            verb="remove",
            action=("worktree", str(repo), str(wt)),
            **base,
        )
    if rc != 1:
        return keep("merge check failed")
    branch = entry.get("branch", "").removeprefix("refs/heads/")
    if branch and gh is not None and branch in gh:
        oid, number = gh[branch]
        if oid == head:
            return Item(
                tier="regenerable",
                reason=f"merged PR #{number}",
                size=size,
                verb="remove",
                action=("worktree", str(repo), str(wt)),
                **base,
            )
    if gh is None:
        gh_state["missing"] = True
    rc, ahead = env.runner.run(["git", "rev-list", "--count", f"{default}..{head}"], cwd=repo)
    n = ahead.strip() if rc == 0 else "?"
    kind = "unmerged" if branch else "detached"
    remove = f"git -C {shlex.quote(str(repo))} worktree remove {shlex.quote(str(wt))}"
    if branch:
        cmd = remove  # the branch and its commits stay; git refuses if the tree is dirty
    else:
        # a detached tip is reachable only from this tree: park it on a branch first
        rescue = f"rescue/{wt.name}"
        cmd = f"git -C {shlex.quote(str(wt))} branch {shlex.quote(rescue)} && {remove}"
    return Item(tier="ask", reason=f"{kind}, +{n}", size=size, verb="ask", ask_cmd=cmd, **base)


def scan_worktrees(env: Env, inv: Inventory) -> None:
    repos = discover_repos(env)
    if not repos:
        return
    cwds = read_cwds(env)
    if cwds is None:
        inv.caveats.append("process list unreadable (lsof), every worktree is kept")
    gh_missing = False
    for repo in repos:
        rc, out = env.runner.run(["git", "worktree", "list", "--porcelain"], cwd=repo)
        if rc != 0:
            inv.caveats.append(f"git worktree list failed in {repo.name}, skipped")
            continue
        entries = parse_worktrees(out)[1:]  # first entry is the primary tree
        if not entries:
            continue
        default = default_branch(env, repo)
        gh = merged_prs(env, repo, set(), inv) if default else None
        state: dict[str, bool] = {}
        for e in entries:
            if "prunable" in e:
                inv.items.append(
                    Item(
                        f"worktree-prune:{repo}",
                        "worktrees",
                        "safe",
                        f"{repo.name}: stale registrations",
                        "🗂️",
                        0,
                        "directory gone",
                        "prune",
                        ("prune", str(repo)),
                    )
                )
                continue
            inv.items.append(classify_worktree(env, inv, repo, e, default, cwds, gh, state))
        gh_missing = gh_missing or state.get("missing", False)
    if gh_missing:
        inv.caveats.append(
            "gh unavailable or failed: squash-merged worktrees read as unmerged (ASK FIRST)"
        )


# --------------------------------------------------------------------- inventory


def build_inventory(env: Env) -> Inventory:
    inv = Inventory()
    try:
        inv.disk = tuple(env.disk_usage(env.home))  # type: ignore[assignment]
    except OSError:
        inv.caveats.append("disk usage unreadable")
    scan_catalog(env, inv)
    scan_docker(env, inv)
    scan_worktrees(env, inv)
    scan_processes(env, inv)
    order = {"safe": 0, "regenerable": 1, "ask": 2, "keep": 3}
    inv.items.sort(key=lambda i: (order[i.tier], -i.size))
    return inv


# --------------------------------------------------------------------- apply


@dataclass
class Result:
    id: str
    tier: str
    ok: bool
    message: str
    estimate: int


def clear_dir(path: Path, cutoff: float | None) -> list[str]:
    errors: list[str] = []
    if cutoff is None:
        for child in path.iterdir():
            try:
                if child.is_symlink() or not child.is_dir():
                    child.unlink()
                else:
                    shutil.rmtree(child)
            except OSError as exc:
                errors.append(f"{child.name}: {exc.strerror}")
        return errors
    for dirpath, _dirnames, filenames in os.walk(path, topdown=False, followlinks=False):
        here = Path(dirpath)
        for name in filenames:
            fp = here / name
            try:
                if fp.lstat().st_mtime < cutoff:
                    fp.unlink()
            except OSError as exc:
                errors.append(f"{name}: {exc.strerror}")
        if here != path:
            with contextlib.suppress(OSError):
                here.rmdir()  # only succeeds when empty
    return errors


def do_action(env: Env, item: Item) -> tuple[bool, str]:
    kind = item.action[0] if item.action else ""
    if kind == "clear":
        _, paths, cutoff = item.action  # type: ignore[misc]
        errors: list[str] = []
        for p in paths:
            why = deletable(env, Path(p))
            if why:
                return False, why
            errors += clear_dir(Path(p), cutoff)
        return (not errors, "; ".join(errors[:3]) or "cleared")
    if kind == "cmd":
        rc, _ = env.runner.run(list(item.action[1]), timeout=600)  # type: ignore[index]
        return (rc == 0, "ok" if rc == 0 else f"exit {rc}")
    if kind == "worktree":
        _, repo, wt = item.action  # type: ignore[misc]
        rc, _ = env.runner.run(["git", "-C", repo, "worktree", "remove", wt], timeout=120)
        return (rc == 0, "removed" if rc == 0 else f"git refused (exit {rc}), left in place")
    if kind == "prune":
        rc, _ = env.runner.run(["git", "-C", item.action[1], "worktree", "prune"])  # type: ignore[index]
        return (rc == 0, "pruned" if rc == 0 else f"exit {rc}")
    return False, "no action"


def append_ledger(env: Env, rows: Iterable[dict[str, object]]) -> None:
    path = env.ledger_path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, sort_keys=True) + "\n")
    except OSError:
        pass


def apply_inventory(
    env: Env, inv: Inventory, only: Sequence[str], tiers: Sequence[str]
) -> list[Result]:
    results: list[Result] = []
    rows: list[dict[str, object]] = []
    for item in inv.items:
        if item.tier not in tiers or item.action is None:
            continue
        if only and item.id not in only and item.section not in only:
            continue
        ok, msg = do_action(env, item)
        results.append(Result(item.id, item.tier, ok, msg, item.size))
        rows.append(
            {
                "kind": "action",
                "ts": int(env.now),
                "id": item.id,
                "tier": item.tier,
                "estimate_bytes": item.size,
                "result": "ok" if ok else "failed",
                "message": msg,
            }
        )
    rows.append(
        {
            "kind": "summary",
            "ts": int(env.now),
            "actions": len(results),
            "failed": sum(1 for r in results if not r.ok),
        }
    )
    append_ledger(env, rows)
    return results


# --------------------------------------------------------------------- render


def bar(n: int, scale: int, width: int = 7) -> str:
    fill = 0 if n <= 0 or scale <= 0 else max(1, round(width * n / scale))
    return "▓" * fill + "░" * (width - fill)


def meter(disk: tuple[int, int, int], width: int = 21) -> list[str]:
    total, used, free = disk
    if total <= 0:
        return ["[disk usage unknown]"]
    fill = round(width * used / total)
    pct = round(100 * used / total)
    return [
        "[" + "▓" * fill + "░" * (width - fill) + "]",
        f" used {fmt(used)}    free {fmt(free)}    {pct} % full · {fmt(total)} total",
    ]


SECTION_HEAD = {
    "safe": "🟢 SAFE  caches that refill on their own",
    "regenerable": "🟡 REGENERABLE  merged worktrees and rebuildable stores",
    "ask": "🔴 ASK FIRST  never deleted by this script",
}
RULE = "─" * 72


def render_rows(items: list[Item], scale: int) -> list[str]:
    if not items:
        return []
    lw = min(max(cells(i.label) for i in items), 30)
    nw = min(max((cells(i.reason) + 1 if i.reason else 0) for i in items), 48 - lw)
    lines = []
    for it in items:
        label = padc(trunc(it.label, lw), lw)
        note = padc(trunc(" " + it.reason, nw), nw) if nw else ""
        size = f"{fmt(it.size):>7}" if it.size else "      -"
        lines.append(f"{it.icon} {label}{note} {bar(it.size, scale)} {size}  {it.verb}".rstrip())
    return lines


def render(
    env: Env, inv: Inventory, results: list[Result] | None = None, freed: int | None = None
) -> str:
    safe, regen, ask = inv.total("safe"), inv.total("regenerable"), inv.total("ask")
    scale = max([i.size for i in inv.items] + [1])
    out: list[str] = []
    mode = "applied" if results is not None else "dry run"
    if not any(i.tier in ("safe", "regenerable", "ask") for i in inv.items):
        out.append(f"disk-cleanup {mode}: nothing to clean")
    else:
        out.append(
            f"disk-cleanup {mode}: {fmt(safe + regen)} reclaimable, {fmt(ask)} more needs you"
        )
    out.append("")
    out.append(
        f"DISK  {short(env, env.home)}  ({'macOS' if env.platform == 'darwin' else 'Linux'})"
    )
    out += meter(inv.disk)
    for tier in ("safe", "regenerable", "ask"):
        items = inv.tier(tier)
        keeps = inv.tier("keep") if tier == "regenerable" else []
        if not items and not keeps:
            continue
        out += [RULE, SECTION_HEAD[tier], RULE]
        out += render_rows(items, scale)
        if items:
            out.append(" " * 41 + f"── {fmt(sum(i.size for i in items))}")
        for k in keeps:
            out.append(trunc(f"        KEEP  {k.label}  {k.reason}", WIDTH))
    out.append("")
    if safe or regen:
        out.append(
            f"🟢 {fmt(safe)} + 🟡 {fmt(regen)} = {fmt(safe + regen)} estimated"
            + (
                f"  →  free {fmt(inv.disk[2])} → ~{fmt(inv.disk[2] + safe + regen)}"
                if inv.disk[0]
                else ""
            )
        )
    asks = [i for i in inv.items if i.ask_cmd]
    if asks:
        out += ["", "ask-first commands (copy one and run it yourself):"]
        shown_wt = 0
        for i in asks:
            if i.section == "worktrees":
                shown_wt += 1
                if shown_wt > MAX_WORKTREE_COMMANDS:
                    continue
            out.append(f"    $ {i.ask_cmd}")
        hidden = shown_wt - MAX_WORKTREE_COMMANDS
        if hidden > 0:
            out.append(f"  ... {hidden} more worktree commands in --json (ask_cmd)")
    if results is not None:
        out.append("")
        for r in results:
            out.append(trunc(f"{'✅' if r.ok else '❌'} {r.id}: {r.message}", WIDTH))
        if freed is not None:
            est = sum(r.estimate for r in results if r.ok)
            out.append(
                f"freed (measured, before and after): {fmt(max(freed, 0))}   estimate was {fmt(est)}"
            )
    for c in inv.caveats:
        out.append(trunc(f"ℹ️  {c}", WIDTH))
    out.append("ℹ️  Sizes are allocated blocks, so sparse files read small.")
    if results is None and (safe or regen):
        # --apply scans again; pinning the ids keeps it to the list confirmed here
        ids = [i.id for i in inv.items if i.tier in ("safe", "regenerable") and i.action]
        pinned = " ".join(f"--only {shlex.quote(i)}" for i in ids)
        out += [
            "",
            "Run with --apply after you confirm. Exit: 0 clean, 3 findings, 2 refused.",
            "To act on exactly this list (nothing found after this run):",
            f"    $ python3 {shlex.quote(str(Path(__file__).resolve()))} --apply {pinned}",
        ]
    return "\n".join(out) + "\n"


def to_json(env: Env, inv: Inventory, results: list[Result] | None, freed: int | None) -> str:
    items = []
    for i in inv.items:
        d = asdict(i)
        d.pop("action", None)
        items.append(d)
    data: dict[str, object] = {
        "platform": env.platform,
        "disk": {"total": inv.disk[0], "used": inv.disk[1], "free": inv.disk[2]},
        "items": items,
        "caveats": inv.caveats,
        "totals": {
            "safe_bytes": inv.total("safe"),
            "regenerable_bytes": inv.total("regenerable"),
            "ask_bytes": inv.total("ask"),
            "estimate_bytes": inv.total("safe") + inv.total("regenerable"),
        },
    }
    if results is not None:
        data["results"] = [asdict(r) for r in results]
        data["freed_bytes_measured"] = freed
    return json.dumps(data, indent=2)


# --------------------------------------------------------------------- main


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="disk_cleanup.py", description=__doc__.split("\n\n")[0])
    p.add_argument(
        "--apply", action="store_true", help="remove SAFE and REGENERABLE items (dry run otherwise)"
    )
    p.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="ID",
        help="limit --apply to an item id or section",
    )
    p.add_argument(
        "--tier", action="append", choices=["safe", "regenerable"], help="limit --apply to a tier"
    )
    p.add_argument(
        "--root",
        action="append",
        default=[],
        metavar="DIR",
        help="scan DIR for git repos (default: the current repo)",
    )
    p.add_argument("--home", metavar="DIR", help="home directory to inspect (default: $HOME)")
    p.add_argument("--platform", choices=["darwin", "linux"], help="override platform detection")
    p.add_argument(
        "--idle-minutes",
        type=int,
        default=DEFAULT_IDLE_MINUTES,
        help="worktree must be untouched this long",
    )
    p.add_argument(
        "--ledger",
        metavar="FILE",
        help="audit log (default: ~/.local/state/ork/disk-cleanup-ledger.jsonl)",
    )
    p.add_argument(
        "--report", metavar="FILE", help="also write the inventory to FILE (refuses foreign files)"
    )
    p.add_argument(
        "--json", action="store_true", help="print JSON instead of the rendered inventory"
    )
    return p.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    runner: Runner | None = None,
    now: float | None = None,
    disk_usage: Callable[[Path], tuple[int, int, int]] | None = None,
    cwd: Path | None = None,
    stdout: TextIO | None = None,
) -> int:
    args = parse_args(argv)
    out = stdout or sys.stdout
    platform = args.platform or (
        "darwin"
        if sys.platform == "darwin"
        else "linux"
        if sys.platform.startswith("linux")
        else ""
    )
    if not platform:
        print("disk-cleanup supports macOS and Linux only", file=sys.stderr)
        return 2
    home = Path(args.home) if args.home else Path.home()
    if not home.is_dir():
        print(f"home is not a directory: {home}", file=sys.stderr)
        return 2
    if args.report:
        rp = Path(args.report)
        if rp.exists() and not rp.read_text(errors="replace").startswith(REPORT_MARKER):
            print(f"refusing to overwrite {rp}: not a disk-cleanup report", file=sys.stderr)
            return 2
    run = runner or Runner()
    roots = [Path(r) for r in args.root]
    if not roots:
        rc, top = run.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd or Path.cwd())
        if rc == 0 and top.strip():
            roots = [Path(top.strip())]
    env = Env(
        home=home,
        platform=platform,
        runner=run,
        roots=roots,
        now=now if now is not None else time.time(),
        user=os.environ.get("USER", "") or _current_user(),
        uid=os.getuid() if hasattr(os, "getuid") else -1,
        idle_minutes=args.idle_minutes,
        ledger=Path(args.ledger) if args.ledger else None,
    )
    if disk_usage:
        env.disk_usage = disk_usage
    inv = build_inventory(env)
    results: list[Result] | None = None
    freed: int | None = None
    if args.apply:
        tiers = tuple(args.tier) if args.tier else ("safe", "regenerable")
        before = env.disk_usage(home)[2]
        results = apply_inventory(env, inv, args.only, tiers)
        after = env.disk_usage(home)[2]
        freed = after - before
    text = (
        to_json(env, inv, results, freed) + "\n" if args.json else render(env, inv, results, freed)
    )
    out.write(text)
    if args.report:
        Path(args.report).write_text(
            REPORT_MARKER + "\n" + render(env, inv, results, freed), encoding="utf-8"
        )
    if results is not None:
        return 0 if all(r.ok for r in results) else 3
    return 3 if inv.tier("safe") or inv.tier("regenerable") else 0


def _current_user() -> str:
    try:
        import pwd

        return pwd.getpwuid(os.getuid()).pw_name
    except (ImportError, KeyError, AttributeError):
        return ""


if __name__ == "__main__":
    sys.exit(main())
