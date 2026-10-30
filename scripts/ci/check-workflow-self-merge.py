#!/usr/bin/env python3
r"""Workflow lint for #4914 and #4931: no workflow merges or arms a PR itself.

Why this exists: release.yml opened the stable-pin PR and armed it with
`gh pr merge --squash --auto`. The required checks are CI only, so #4913
merged on CI alone, before any reviewer read it. On this repo a PR merges
through the merge desk after a LAND names its head; a workflow only opens
it.

SCOPE: lint against accidental re-adds; not exhaustive against deliberate evasion; the real control is review + branch protection.
The threat is us re-adding an arm to our own workflow files by mistake,
not an attacker hiding one. A spelling found later that this misses goes
to a follow-up issue, not a bigger rule here.

How a file is read (XREVIEW 6411315417): the file is PARSED as YAML, so a
folded (`>`) or literal (`|`) run value is judged after YAML has folded
it, and YAML comments never count. A file that cannot be parsed is a
finding: this lint fails closed on anything it cannot read.

Each `run:` value is then judged twice, and a hit from either counts:
  1. split into words with shell quoting rules (shlex), so `gh pr 'merge'`
     and `gh pr me"rge"` read as `gh pr merge`;
  2. scanned with every quote and backslash removed, which reaches the
     same words when the value cannot be split (an unbalanced quote) and
     never reads less than step 1.
Before both, a backslash-newline is removed with nothing in its place,
as the shell does, so `mer\` + newline + `ge` reads as `merge`
(XREVIEW 6413344349). Shell comment lines are skipped by both.

FLAGGED, no allowlist:
  - `gh pr merge` in any form, with or without --auto, with flags before
    `pr` (`gh --repo o/r pr`) or between `pr` and the subcommand
  - a `gh pr` subcommand that comes from a variable or a substitution,
    since nothing can show it is not merge, global flags before `pr`
    included
  - the REST merge endpoint `pulls/<n>/merge` (gh api, curl, scripts).
    A GET of that path (is it merged?) is flagged too: deliberately
    conservative, use `pulls/<n>` and read `.merged` instead
  - the GraphQL mergePullRequest, enablePullRequestAutoMerge and
    enqueuePullRequest mutations
  - `github.rest.pulls.merge(`, `pulls?.merge(` and the bracket form
    `pulls["merge"]` in a github-script `script:` value, and the REST
    endpoint there too
  - any `uses:` action whose name says automerge or merge-pull-request

Usage: check-workflow-self-merge.py FILE [FILE ...]
Prints `FILE: line N: problem` per finding. Exit 0 clean, 1 findings,
2 the lint could not run (PyYAML missing, bad usage).
"""

from __future__ import annotations

import re
import shlex
import sys

try:
    import yaml
except ImportError:  # fail closed: a missing parser is not a pass
    print("check-workflow-self-merge: PyYAML is not installed", file=sys.stderr)
    sys.exit(2)

SHELL_PUNCT = ";&|()<>"
WORD_SPLIT = re.compile(r"[\s;&|()<>`]+")
QUOTES_AND_BACKSLASHES = re.compile(r"[\"'\\]")
REST_MERGE = re.compile(r"pulls/[^/\n]+/merge(?![A-Za-z0-9_-])")
GRAPHQL_MERGE = re.compile(r"\b(mergePullRequest|enablePullRequestAutoMerge|enqueuePullRequest)\b")
SCRIPT_MERGE = re.compile(
    r"\bpulls\s*\??\.\s*merge\s*\("  # pulls.merge( and pulls?.merge(
    r"|\bpulls\s*\??\.?\s*\[\s*([\"'`])merge\1\s*\]"  # pulls["merge"], pulls?.["merge"]
)
MERGE_ACTION = re.compile(r"auto-?merge|merge-?pull-?request|merge-?pr\b", re.I)


def looks_like_gh(word: str) -> bool:
    """`gh`, a path ending in /gh, or a variable that could hold it."""
    return word == "gh" or word.endswith("/gh") or word.startswith("$")


def gh_before(words: list[str], i: int) -> bool:
    """Is the `pr` at index i run by gh, global flags in between allowed?

    Directly before `pr`, gh or a variable that could hold it counts
    (`gh pr`, `$GH pr`). `gh --repo o/r pr ...` puts a flag value there
    instead (XREVIEW 6413344349), so also walk back over flags and their
    values, but that walk only matches a LITERAL gh: a flag can take more
    than one value (`jq --arg ts "$(date)" --arg pr "$n"`,
    ci-sentinel.yml:298), so a $-word met on the walk is never taken as gh.
    """
    if i >= 1 and looks_like_gh(words[i - 1]):
        return True
    j = i - 1
    while j >= 0:
        w = words[j]
        if w == "gh" or w.endswith("/gh"):
            return True
        if w.startswith("-"):
            j -= 1
            continue
        prev = words[j - 1] if j >= 1 else ""
        if prev.startswith("-") and "=" not in prev:
            j -= 2  # w is the value of a flag such as `--repo o/r`
            continue
        return False
    return False


def subcommand_after(words: list[str], i: int) -> str | None:
    """The word after `pr` at index i, skipping flags and their values."""
    j = i + 1
    while j < len(words):
        w = words[j]
        if w.startswith("-"):
            j += 1 if "=" in w else 2  # `-R x` takes a value, `--repo=x` does not
            continue
        return w
    return None


def judge_words(words: list[str]) -> set[str]:
    found: set[str] = set()
    for i, w in enumerate(words):
        if w != "pr":
            continue
        if i + 1 < len(words) and words[i + 1] == "merge":
            found.add("runs gh pr merge")
        if not gh_before(words, i):
            continue
        sub = subcommand_after(words, i)
        if sub == "merge":
            found.add("runs gh pr merge")
        elif sub is not None and re.search(r"[$`]", sub):
            found.add(
                "runs a gh pr subcommand taken from a variable or substitution"
                " (cannot be shown not to be merge)"
            )
    return found


def judge_text(text: str) -> set[str]:
    found: set[str] = set()
    if REST_MERGE.search(text):
        found.add("calls the REST merge endpoint pulls/<n>/merge")
    m = GRAPHQL_MERGE.search(text)
    if m:
        found.add(f"calls the GraphQL {m.group(1)} mutation")
    return found


def judge_run(value: str) -> set[str]:
    # The shell removes a backslash-newline and inserts nothing, so a
    # continuation inside a word joins the word (XREVIEW 6413344349).
    joined = re.sub(r"\\\r?\n", "", value)
    code = "\n".join(line for line in joined.splitlines() if not line.lstrip().startswith("#"))
    found: set[str] = set()

    try:
        lex = shlex.shlex(code, posix=True, punctuation_chars=SHELL_PUNCT)
        lex.whitespace_split = True
        found |= judge_words(list(lex))
    except ValueError:
        pass  # the stripped scan below still reads every word

    stripped = QUOTES_AND_BACKSLASHES.sub("", code)
    found |= judge_words([w for w in WORD_SPLIT.split(stripped) if w])
    found |= judge_text(stripped)
    return found


def judge_script(value: str) -> set[str]:
    found = judge_text(value)
    if SCRIPT_MERGE.search(value):
        found.add("calls pulls.merge from a script")
    return found


def judge_uses(value: str) -> set[str]:
    name = value.split("@", 1)[0]
    if MERGE_ACTION.search(name):
        return {f"uses a merge or automerge action ({name})"}
    return set()


JUDGES = {"run": judge_run, "script": judge_script, "uses": judge_uses}


def walk(node: yaml.Node, out: list[tuple[int, str]]) -> None:
    if isinstance(node, yaml.MappingNode):
        for key, value in node.value:
            judge = JUDGES.get(key.value) if isinstance(key, yaml.ScalarNode) else None
            if judge and isinstance(value, yaml.ScalarNode):
                line = value.start_mark.line + 1
                for problem in sorted(judge(str(value.value))):
                    out.append((line, problem))
            walk(value, out)
    elif isinstance(node, yaml.SequenceNode):
        for item in node.value:
            walk(item, out)


def check_file(path: str) -> list[str]:
    try:
        with open(path, encoding="utf-8") as fh:
            docs = list(yaml.compose_all(fh))
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        reason = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
        return [f"{path}: cannot be read as YAML ({reason}); failing closed"]
    found: list[tuple[int, str]] = []
    for doc in docs:
        if doc is not None:
            walk(doc, found)
    return [f"{path}: line {line}: {problem}" for line, problem in found]


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: check-workflow-self-merge.py FILE [FILE ...]", file=sys.stderr)
        return 2
    problems: list[str] = []
    for path in argv[1:]:
        problems.extend(check_file(path))
    for p in problems:
        print(p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
