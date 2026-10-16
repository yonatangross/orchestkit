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

  AND HOLDS a credential, any of:
    - `id-token: write` in effective permissions (quoted or not), or
      `permissions: write-all`, which grants it
    - any `secrets.<NAME>` reference except GITHUB_TOKEN, whether in the
      job body OR in the top-level `env:` block (every job inherits it)
    - `secrets: inherit` on a reusable-workflow caller job

A job that only POSTS a comment from a file (`gh issue comment --body-file`)
does not read text and is not flagged by itself; a job with issues:write and
no text source is the safe apply side of the split.

Job keys are found at whatever indentation the file uses, not a hardcoded
two spaces (review round 2, SHOULD 5), and so are job properties; a job key
may be quoted. A jobs block holding a line the lint cannot place (an
unknown key form, a shallower line, a job with no block body) is an ERROR
(exit 2), never a pass (XREVIEW 6209271782). A file whose `jobs` block parses to
zero jobs is an ERROR (exit 2), never a pass: a gate that saw nothing
verified nothing.

Exit codes: 0 = clean, 1 = finding(s), 2 = scanner error.

Usage: check-workflow-issue-text.py <file-or-dir> [<file-or-dir> ...]
Directories are scanned for *.yml and *.yaml.
"""

import os
import re
import sys

TOP_KEY = re.compile(r"^([A-Za-z_-]+):")
JOB_PERM_INDENT = 4
SECRET = re.compile(r"secrets\.([A-Za-z_][A-Za-z0-9_]*)")
SECRETS_INHERIT = re.compile(r"^\s*secrets:\s*inherit\b", re.MULTILINE)
# Quoted keys and values grant the same thing (security review of 5b84e983).
ID_TOKEN_WRITE = re.compile(r"""["']?id-token["']?\s*:\s*["']?write\b""")
WRITE_ALL = re.compile(r"""(?<![A-Za-z-])["']?write-all\b""")
YAML_ALIAS = re.compile(r"(?:^|[\s:\[{,])(?:\*[A-Za-z0-9_-]+|<<\s*:)")

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


def block_value(lines, key_line_idx, key_indent):
    """The value of a `key:` line plus its deeper-indented continuation."""
    first = lines[key_line_idx]
    block = [first.split(":", 1)[1]]
    for line in lines[key_line_idx + 1 :]:
        if line.strip() == "" or line.lstrip().startswith("#"):
            block.append(line)
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= key_indent:
            break
        block.append(line)
    return "\n".join(block)


def job_key_indent(lines, js, je):
    """Indent of job keys inside the jobs block, whatever the file uses."""
    for i in range(js + 1, je):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        return indent if indent > 0 else None
    return None


def analyze_file(path):
    """Return (findings, errors) for one workflow file."""
    findings = []
    errors = []
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        return [], [f"{path}: cannot read: {exc}"]

    lines = text.splitlines()
    spans = top_level_spans(lines)

    top_perms = ""
    if "permissions" in spans:
        s, e = spans["permissions"]
        top_perms = block_value(lines, s, 0)

    # Secrets in the top-level env block are inherited by every job.
    top_env_secrets = set()
    if "env" in spans:
        s, e = spans["env"]
        env_text = block_value(lines, s, 0)
        for name in SECRET.findall(env_text):
            if name != "GITHUB_TOKEN":
                top_env_secrets.add(name)

    if "jobs" not in spans:
        errors.append(f"{path}: no jobs block; not a workflow the lint can verify")
        return findings, errors

    js, je = spans["jobs"]
    indent = job_key_indent(lines, js, je)
    if indent is None:
        errors.append(f"{path}: 'jobs' declared but no jobs parsed")
        return findings, errors

    # A job key may be bare or quoted. Any other line at job-key indent, or
    # any line shallower than it inside the jobs block, is a form this lint
    # cannot inspect, so it is an ERROR rather than silently skipped
    # (XREVIEW 6209271782, P2: a quoted unsafe job ahead of a safe one).
    job_re = re.compile(
        r"""^ {%d}(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s*:(\s*(?:#.*)?)$"""
        % indent
    )
    job_bounds = []
    for i in range(js + 1, je):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        line_indent = len(line) - len(line.lstrip())
        if line_indent < indent:
            errors.append(f"{path}:{i + 1}: line inside jobs is shallower than the job keys; cannot inspect")
            return findings, errors
        if line_indent > indent:
            continue
        m = job_re.match(line)
        if not m:
            errors.append(f"{path}:{i + 1}: job key form the lint cannot inspect: {line.strip()[:60]}")
            return findings, errors
        job_bounds.append((m.group(1) or m.group(2) or m.group(3), i))
    if not job_bounds:
        errors.append(f"{path}: 'jobs' declared but no jobs parsed")
        return findings, errors

    for idx, (name, start) in enumerate(job_bounds):
        end = job_bounds[idx + 1][1] if idx + 1 < len(job_bounds) else je
        job_lines = lines[start:end]
        job_text = "\n".join(job_lines)

        # Effective permissions: the job's own block when it declares one,
        # otherwise the top-level block (Actions semantics). The job-level
        # permissions key sits at the indent of the job's first property,
        # whatever the file uses (XREVIEW 6209271782, P2: properties at
        # eight spaces under a job at four).
        prop_indent = None
        for line in job_lines[1:]:
            if line.strip() and not line.lstrip().startswith("#"):
                prop_indent = len(line) - len(line.lstrip())
                break
        if prop_indent is None or prop_indent <= indent:
            errors.append(f"{path}: job '{name}' has no block body the lint can inspect")
            continue
        job_perms = top_perms
        perm_re = re.compile(r"^ {%d}permissions:(.*)$" % prop_indent)
        for j, line in enumerate(job_lines):
            if perm_re.match(line):
                job_perms = block_value(job_lines, j, prop_indent)
                break

        reads = []
        scrubbed = INERT_REFS.sub("", job_text)
        for label, pattern in READ_PATTERNS:
            if pattern.search(scrubbed):
                reads.append(label)

        if YAML_ALIAS.search(job_perms):
            errors.append(f"{path}: job '{name}' permissions use a YAML alias or merge key; cannot inspect")
            continue
        creds = []
        if ID_TOKEN_WRITE.search(job_perms):
            creds.append("id-token: write")
        if WRITE_ALL.search(job_perms):
            creds.append("permissions: write-all")
        if SECRETS_INHERIT.search(job_text):
            creds.append("secrets: inherit")
        secret_names = set(SECRET.findall(job_text)) | top_env_secrets
        for secret_name in sorted(secret_names):
            if secret_name != "GITHUB_TOKEN":
                creds.append(f"secrets.{secret_name}")

        if reads and creds:
            findings.append(
                f"{path}: job '{name}' reads issue/comment text "
                f"({', '.join(reads)}) while holding {', '.join(sorted(set(creds)))}. "
                "Split the job so no job holds both untrusted text and a credential (#4747)."
            )
    return findings, errors


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
        return 2
    findings = []
    errors = []
    files = collect_paths(sys.argv[1:])
    for path in files:
        f, e = analyze_file(path)
        findings.extend(f)
        errors.extend(e)
    for err in errors:
        print(f"ERROR {err}")
    for finding in findings:
        print(f"FAIL {finding}")
    if errors:
        print(f"{len(errors)} file(s) could not be verified")
        return 2
    if findings:
        print(f"{len(findings)} job(s) hold untrusted issue/comment text next to a credential")
        return 1
    print(f"PASS: {len(files)} workflow file(s) scanned, no job holds issue/comment text next to a credential")
    return 0


if __name__ == "__main__":
    sys.exit(main())
