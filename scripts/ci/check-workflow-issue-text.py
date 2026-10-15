#!/usr/bin/env python3
"""Workflow lint for #4747: a job that reads untrusted issue or comment text
must not also hold a token secret or id-token: write.

Why this exists: `.github/workflows/claude-triage.yml` ran the model in the
same job that held `id-token: write` (the OIDC exchange can mint a
write-scoped app token) plus the CLAUDE_CODE_OAUTH_TOKEN secret while issue
text was in scope. Public attacks on this exact shape: Flatt Security
2026-06-01 and Microsoft 2026-06-05.

Rule, per job (job-level permissions win over top-level, like Actions):

  READS issue/comment text, any of:
    - `github.event.issue.<field>`   (`.number` alone is inert metadata)
    - `github.event.comment.<field>` (`.id` alone is inert metadata)
    - `gh issue view`
    - a `gh issue|pr|api` command fed an `issue_number` (e.g. the dispatch
      input, which is how untrusted issue text is pulled in)

  AND HOLDS a credential, either of:
    - `id-token: write` in effective permissions
    - any `secrets.<NAME>` reference except GITHUB_TOKEN (the ambient
      GITHUB_TOKEN is permission-scoped; named secrets are not)

A job that only POSTS a comment from a file (`gh issue comment --body-file`)
does not read text and is not flagged by itself; a job with issues:write and
no text source is the safe apply side of the split.

Usage: check-workflow-issue-text.py <file-or-dir> [<file-or-dir> ...]
Directories are scanned for *.yml and *.yaml. Exit 1 when a violation is
found, 0 otherwise.
"""

import os
import re
import sys

TOP_KEY = re.compile(r"^([A-Za-z_-]+):")
JOB_KEY = re.compile(r"^  ([A-Za-z_][A-Za-z0-9_-]*):")
JOB_PERM = re.compile(r"^    permissions:(.*)$")
SECRET = re.compile(r"secrets\.([A-Za-z_][A-Za-z0-9_]*)")
ID_TOKEN_WRITE = re.compile(r"id-token:\s*write")

INERT_REFS = re.compile(
    r"github\.event\.issue\.number\b|github\.event\.comment\.id\b"
)

# The four read shapes named in #4747. Known gaps, kept deliberately so the
# gate stays green on shapes this PR does not own: `gh pr view`,
# `gh issue list`, `gh api` on issue endpoints addressed by a hardcoded or
# env-carried number, and the github-script `issue_number:` key. The adjacent
# surfaces (ultrareview.yml's comment fetch, ci-sentinel.yml's PR reads,
# claude-health.yml's issue list) are follow-up scope under epic #4748.
READ_PATTERNS = [
    ("github.event.issue.*", re.compile(r"github\.event\.issue\b")),
    ("github.event.comment.*", re.compile(r"github\.event\.comment\b")),
    ("gh issue view", re.compile(r"\bgh\s+issue\s+view\b")),
    (
        "gh command fed an issue_number",
        re.compile(r"\bgh\s+(?:issue|pr|api)\b[^\n|&;]*\bissue_number\b"),
    ),
]


def top_level_spans(lines):
    """Map top-level key -> (start, end) line span of its block."""
    spans = {}
    for i, line in enumerate(lines):
        if not line or line[0].isspace() or line.startswith("#"):
            continue
        m = TOP_KEY.match(line)
        if m:
            spans.setdefault(m.group(1), []).append(i)
    result = {}
    starts = sorted(i for idxs in spans.values() for i in idxs)
    for key, idxs in spans.items():
        start = idxs[0]
        end = next((s for s in starts if s > start), len(lines))
        result[key] = (start, end)
    return result


def perm_block(lines, perm_line_idx, key_indent):
    """Lines belonging to a `permissions:` mapping at perm_line_idx.

    Collects the inline value plus following lines indented deeper than the
    key. Stops at the first line at or under key indent.
    """
    first = lines[perm_line_idx]
    block = [first.split(":", 1)[1]]
    for line in lines[perm_line_idx + 1 :]:
        if line.strip() == "" or line.lstrip().startswith("#"):
            block.append(line)
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= key_indent:
            break
        block.append(line)
    return "\n".join(block)


def analyze_file(path):
    """Return a list of violation strings for one workflow file."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    lines = text.splitlines()
    spans = top_level_spans(lines)

    top_perms = ""
    if "permissions" in spans:
        s, e = spans["permissions"]
        seg = lines[s:e]
        first = seg[0].split(":", 1)[1]
        top_perms = "\n".join([first] + [ln for ln in seg[1:] if ln[:1].isspace() or not ln.strip()])

    findings = []
    if "jobs" not in spans:
        return findings
    js, je = spans["jobs"]

    job_bounds = []
    for i in range(js + 1, je):
        m = JOB_KEY.match(lines[i])
        if m:
            job_bounds.append((m.group(1), i))
    for idx, (name, start) in enumerate(job_bounds):
        end = job_bounds[idx + 1][1] if idx + 1 < len(job_bounds) else je
        job_lines = lines[start:end]
        job_text = "\n".join(job_lines)

        # Effective permissions: the job's own block when it declares one,
        # otherwise the top-level block (Actions semantics).
        job_perms = top_perms
        for j, line in enumerate(job_lines):
            if JOB_PERM.match(line):
                job_perms = perm_block(job_lines, j, 4)
                break

        reads = []
        scrubbed = INERT_REFS.sub("", job_text)
        for label, pattern in READ_PATTERNS:
            if pattern.search(scrubbed):
                reads.append(label)

        creds = []
        if ID_TOKEN_WRITE.search(job_perms):
            creds.append("id-token: write")
        for secret_name in set(SECRET.findall(job_text)):
            if secret_name != "GITHUB_TOKEN":
                creds.append(f"secrets.{secret_name}")

        if reads and creds:
            findings.append(
                f"{path}: job '{name}' reads issue/comment text "
                f"({', '.join(reads)}) while holding {', '.join(sorted(creds))}. "
                "Split the job so no job holds both untrusted text and a credential (#4747)."
            )
    return findings


def collect_paths(args):
    files = []
    for arg in args:
        if os.path.isdir(arg):
            for root, _dirs, names in os.walk(arg):
                for name in sorted(names):
                    if name.endswith((".yml", ".yaml")):
                        files.append(os.path.join(root, name))
        else:
            files.append(arg)
    return files


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 1
    findings = []
    files = collect_paths(sys.argv[1:])
    for path in files:
        try:
            findings.extend(analyze_file(path))
        except OSError as exc:
            print(f"check-workflow-issue-text: cannot read {path}: {exc}", file=sys.stderr)
            return 1
    for finding in findings:
        print(f"FAIL {finding}")
    if findings:
        print(f"{len(findings)} job(s) hold untrusted issue/comment text next to a credential")
        return 1
    print(f"PASS: {len(files)} workflow file(s) scanned, no job holds issue/comment text next to a credential")
    return 0


if __name__ == "__main__":
    sys.exit(main())
