#!/usr/bin/env python3
"""Workflow lint for #4747: a job that reads untrusted issue or comment text
must not also hold a token secret or id-token: write.

Why this exists: `.github/workflows/claude-triage.yml` ran the model in the
same job that held `id-token: write` (the OIDC exchange can mint a
write-scoped app token) plus the CLAUDE_CODE_OAUTH_TOKEN secret while issue
text was in scope. Public attacks on this exact shape: Flatt Security
2026-06-01 and Microsoft 2026-06-05.

TRUST BOUNDARY (what this lint certifies, XREVIEW 6212345276):
  - CERTIFIED: a workflow whose trigger carries untrusted text (issues,
    issue_comment, discussion, discussion_comment, pull_request_target,
    pull_request_review, pull_request_review_comment, workflow_run, and
    workflow_call, which inherits its caller's event) holds NO credential in
    any job. A workflow_call job must also restrict its permissions
    explicitly (job or top level): without that it runs with the caller's
    grants, which no file-local reader can see. That holds however the text is read (shell spellings, the event
    file, github-script, scripts, composite actions, reusable workflows, job
    outputs, artifacts), because no reader has to be right.
  - BEST EFFORT, outside the boundary (push, schedule, workflow_dispatch and
    the rest): the read rules below catch the named shapes only. A
    credential job on such a trigger that fetches issue text in any other
    way needs human review; this lint does not certify it.

Rule, per job (job-level permissions win over top-level, like Actions):

  READS issue/comment text, in the job OR in the workflow env and defaults
  that every job inherits, any of:
    - `github.event.issue.<field>`   (`.number` alone is inert metadata)
    - `github.event.comment.<field>` (`.id` alone is inert metadata)
      in any spelling Actions accepts: index access, any letter case,
      spaces around the dots
    - the whole `github.event`, or the whole `github` context passed on
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

Two layers, and a file is clean only when BOTH are (round 6 of XREVIEW
on #4755, conductor189 ruling): layer 1 loads the file with a YAML safe
loader (PyYAML, duplicate keys refused, exactly one document) and lints the
parsed mapping; layer 2 is the strict-subset line reader below. A parser
differential then has to fool two different readers at once. Without
PyYAML layer 1 refuses every file, so the lint fails closed.

Exit codes: 0 = clean, 1 = finding(s), 2 = scanner error.

Usage: check-workflow-issue-text.py <file-or-dir> [<file-or-dir> ...]
Directories are scanned for *.yml and *.yaml.
"""

import os
import re
import sys

# A YAML key may be bare or quoted; both are the same key (XREVIEW 6209698795).
TOP_KEY = re.compile(r"""^(?:"([^"]+)"|'([^']+)'|([A-Za-z_-]+))\s*:""")
JOB_PERM_INDENT = 4
# Actions context names are case-insensitive and the runner reads an
# expression through quoted strings (a `}}` inside quotes does not end it),
# so the line layer does not cut expressions at all: any text that holds an
# expression and names the secrets context, in any case, is a credential
# unless the only reference is GITHUB_TOKEN (XREVIEW 6210628528).
LINE_SECRET_REF = re.compile(
    r"""\bsecrets\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])""",
    re.IGNORECASE,
)
LINE_SECRETS_WORD = re.compile(r"\bsecrets\b", re.IGNORECASE)


def line_secret_creds(text):
    """Layer 2 secret read on raw text: case-insensitive, no expression cut.

    No comment strip and no `${{` requirement: a quoted " #" is not a
    comment, and an `if:` reads expressions without the braces (security
    review of 5a127563). A false match only matters in a job that also
    reads issue text, which must be split anyway.
    """
    text = SECRETS_INHERIT.sub("", text)
    creds = set()
    for m in LINE_SECRET_REF.finditer(text):
        name = m.group(1) or m.group(2)
        if name.upper() != "GITHUB_TOKEN":
            creds.add(f"secrets.{name}")
    if LINE_SECRETS_WORD.search(LINE_SECRET_REF.sub("", text)):
        creds.add("secrets (whole object or computed name)")
    return creds
SECRETS_INHERIT = re.compile(r"""^\s*["']?secrets["']?\s*:\s*["']?inherit\b""", re.MULTILINE)
# Quoted keys and values grant the same thing (security review of 5b84e983).
ID_TOKEN_WRITE = re.compile(r"""["']?id-token["']?\s*:\s*["']?write\b""")
WRITE_ALL = re.compile(r"""(?<![A-Za-z-])["']?write-all\b""")
YAML_ALIAS = re.compile(r"(?:^|[\s:\[{,])(?:\*[A-Za-z0-9_-]+|<<\s*:)")

# The four read shapes named in #4747. Known gaps, kept deliberately so the
# gate stays green on shapes this PR does not own: `gh pr view`,
# `gh issue list`, `gh api` on issue endpoints addressed by a hardcoded or
# env-carried number, and the github-script `issue_number:` key. The adjacent
# surfaces (ultrareview.yml's comment fetch, ci-sentinel.yml's PR reads,
# claude-health.yml's issue list) are follow-up scope under epic #4748.
# The gh CLI read shapes, shared by both layers. The github context reads
# are matched by each layer with its own code (XREVIEW 6211162308: a
# shared matcher was a common-mode miss).
READ_PATTERNS = [
    ("gh issue view", re.compile(r"\bgh\s+issue\s+view\b")),
    (
        "gh command fed an issue_number",
        re.compile(r"\bgh\s+(?:issue|pr|api)\b[^\n|&;]*\bissue_number\b"),
    ),
]


# Layer 2 github context read: one flexible regex on raw text. Property and
# index access, any letter case, spaces around the dots
# (github['event']['issue']['body'], GITHUB.EVENT.ISSUE.BODY,
# github . event . issue . body) are the same read. Inert fields: the
# issue number and the comment id. The whole event, or the whole github
# context passed to a function, carries the issue text too.
def _seg(name):
    return r"""\s*(?:\.\s*%s\b|\[\s*['"]%s['"]\s*\])""" % (name, name)


LINE_ISSUE_REF = re.compile(
    r"\bgithub" + _seg("event") + r"""\s*(?:\.\s*(issue|comment)\b|\[\s*['"](issue|comment)['"]\s*\])"""
    + r"""(?:\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)\b|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]))?""",
    re.IGNORECASE,
)
LINE_WHOLE_EVENT = re.compile(r"\bgithub" + _seg("event") + r"(?!\s*[.\[\w])", re.IGNORECASE)
# Fail closed on what this regex cannot classify (XREVIEW 6211906464): a
# computed index on github, github.event or the issue/comment object, and
# the whole github context followed by any expression operator or closer
# (toJSON(github || null)), are reads.
_LITERAL_INDEX = r"""\s*\[\s*['"][A-Za-z_][A-Za-z0-9_-]*['"]\s*\]"""
LINE_COMPUTED_INDEX = re.compile(
    r"\bgithub(?:" + _seg("event")
    + r"""(?:\s*(?:\.\s*(?:issue|comment)\b|\[\s*['"](?:issue|comment)['"]\s*\]))?)?"""
    + r"\s*\[(?!" + _LITERAL_INDEX[len(r"\s*\["):] + ")",
    re.IGNORECASE,
)
LINE_WHOLE_GITHUB = re.compile(r"\bgithub\s*(?=[)\],|&=!<>}?])", re.IGNORECASE)
LINE_WILDCARD = re.compile(
    r"\bgithub(?:" + _seg("event")
    + r"""(?:\s*(?:\.\s*(?:issue|comment)\b|\[\s*['"](?:issue|comment)['"]\s*\]))?)?\s*\.\s*\*""",
    re.IGNORECASE,
)

# The trust boundary (XREVIEW 6212345276 full sweep). Matching YAML text can
# never prove how a job reads issue text: shell spellings, the event file,
# github-script, called scripts, composite actions, reusable workflows, job
# outputs and artifacts all reach it. So a workflow whose trigger carries
# untrusted issue, comment, discussion or fork text may hold NO credential
# in any job. workflow_call inherits its caller's event, so it is inside.
# Outside the boundary (push, schedule, workflow_dispatch, ...) the read
# checks are best effort over the shapes named above; a credential job
# there that fetches issue text in another way needs human review.
UNTRUSTED_TRIGGERS = (
    "issues", "issue_comment", "discussion", "discussion_comment",
    "pull_request_target", "pull_request_review", "pull_request_review_comment",
    "workflow_run", "workflow_call",
)
LINE_UNTRUSTED_TRIGGER = re.compile(r"\b(" + "|".join(UNTRUSTED_TRIGGERS) + r")\b")


def on_trigger_names(lines, spans):
    """Layer 2 trigger read: the names in `on:` as a scalar, a flow list, or
    the keys and list items at the first indent of its block. Comments and
    nested values (descriptions, branch filters) are not triggers."""
    if "on" not in spans:
        return []
    start, end = spans["on"]
    first = re.sub(r"(?:^|\s)#.*$", "", lines[start].split(":", 1)[1]).strip()
    names = re.findall(r"[A-Za-z_]+", first) if first else []
    body = [re.sub(r"(?:^|\s)#.*$", "", ln) for ln in lines[start + 1:end]]
    body = [ln for ln in body if ln.strip()]
    if body:
        indent = min(len(ln) - len(ln.lstrip()) for ln in body)
        for ln in body:
            if len(ln) - len(ln.lstrip()) != indent:
                continue
            m = re.match(r"""\s*(?:-\s*)?["']?([A-Za-z_]+)["']?\s*(?::|$)""", ln)
            if m:
                names.append(m.group(1))
    return names
INERT_FIELD = {"issue": "number", "comment": "id"}


def line_issue_reads(text):
    reads = set()
    for m in LINE_ISSUE_REF.finditer(text):
        kind = (m.group(1) or m.group(2)).lower()
        field = (m.group(3) or m.group(4) or "").lower()
        if field != INERT_FIELD[kind]:
            reads.add(f"github.event.{kind}.*")
    if LINE_WHOLE_EVENT.search(text):
        reads.add("github.event (whole object)")
    if LINE_WHOLE_GITHUB.search(text):
        reads.add("github context (whole object)")
    if LINE_COMPUTED_INDEX.search(text):
        reads.add("github access the lint cannot classify (computed index)")
    if LINE_WILDCARD.search(text):
        reads.add("github wildcard")
    return reads


# The lint reads a strict subset of YAML by line. Every form outside that
# subset is an ERROR (exit 2), never a silent PASS (XREVIEW 6209908015: a
# flow-mapping job body, an escaped key and an explicit `? key` each hid a
# write-all grant). The subset: one document; top-level and job property
# keys plain or quoted with no escape; permission values with no escape,
# tag, explicit key, anchor, alias or merge key; no hex escape anywhere a
# secret reference could be spelled.
PLAIN_OR_QUOTED_KEY = r"""(?:"([^"\\]+)"|'([^'\\]+)'|([A-Za-z_][A-Za-z0-9_-]*))\s*:(?:\s|$)"""
TOP_KEY_LINE = re.compile("^" + PLAIN_OR_QUOTED_KEY)
DOC_MARKER = re.compile(r"^(?:---|\.\.\.)(?:\s|$)")
UNINSPECTABLE_VALUE = re.compile(r"[\\?!&*]|<<")
HEX_ESCAPE = re.compile(r"\\[uUx]")


def strip_comments(text):
    return "\n".join(re.sub(r"(?:^|\s)#.*$", "", line) for line in text.split("\n"))


def structure_errors(lines):
    """Top-level lines the lint cannot read as one plain YAML mapping."""
    errors = []
    seen = set()
    content_seen = False
    for i, line in enumerate(lines):
        if not line.strip() or line.startswith("#") or line[0].isspace():
            if line.strip() and not line.lstrip().startswith("#"):
                content_seen = True
            continue
        if DOC_MARKER.match(line):
            if content_seen:
                errors.append(f"{i + 1}: a second YAML document; cannot inspect")
            continue
        content_seen = True
        m = TOP_KEY_LINE.match(line)
        if not m:
            errors.append(f"{i + 1}: top-level form the lint cannot inspect: {line.strip()[:60]}")
            continue
        key = m.group(1) or m.group(2) or m.group(3)
        if key in seen:
            errors.append(f"{i + 1}: duplicate top-level key '{key}'; cannot inspect")
        seen.add(key)
    return errors


def top_level_spans(lines):
    """Map top-level key -> (start, end) line span of its block."""
    spans = {}
    for i, line in enumerate(lines):
        if not line or line[0].isspace() or line.startswith("#"):
            continue
        m = TOP_KEY.match(line)
        if m:
            spans.setdefault(m.group(1) or m.group(2) or m.group(3), []).append(i)
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


def analyze_lines(path):
    """Layer 2: the strict-subset line reader. Return (findings, errors)."""
    findings = []
    errors = []
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        return [], [f"{path}: cannot read: {exc}"]

    lines = text.splitlines()
    structural = structure_errors(lines)
    if structural:
        return [], [f"{path}:{e}" for e in structural]
    spans = top_level_spans(lines)
    untrusted_triggers = set(LINE_UNTRUSTED_TRIGGER.findall(" ".join(on_trigger_names(lines, spans))))

    top_perms = ""
    if "permissions" in spans:
        s, e = spans["permissions"]
        top_perms = block_value(lines, s, 0)
        if UNINSPECTABLE_VALUE.search(strip_comments(top_perms)):
            return [], [f"{path}: top-level permissions use an escape, tag, explicit key, anchor or alias; cannot inspect"]

    # Secrets in the top-level env block are inherited by every job.
    # Workflow env and defaults reach every job's steps (XREVIEW 6211162308),
    # so a read there is a read in every job.
    inherited_text = "\n".join(
        block_value(lines, spans[k][0], 0) for k in ("env", "defaults") if k in spans
    )
    top_env_secrets = set()
    if "env" in spans:
        s, e = spans["env"]
        env_text = block_value(lines, s, 0)
        if HEX_ESCAPE.search(env_text):
            return [], [f"{path}: top-level env uses a hex escape; cannot inspect"]
        top_env_secrets = line_secret_creds(env_text)

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
        prop_re = re.compile(r"^ {%d}" % prop_indent + PLAIN_OR_QUOTED_KEY)
        bad_prop = None
        for j, line in enumerate(job_lines[1:], start=start + 2):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            line_indent = len(line) - len(line.lstrip())
            if line_indent < prop_indent or (line_indent == prop_indent and not prop_re.match(line)):
                bad_prop = f"{path}:{j}: job '{name}' property form the lint cannot inspect: {line.strip()[:60]}"
                break
        if bad_prop:
            errors.append(bad_prop)
            continue
        if HEX_ESCAPE.search(job_text):
            errors.append(f"{path}: job '{name}' uses a hex escape; cannot inspect")
            continue
        job_perms = top_perms
        job_has_perms = False
        perm_re = re.compile(r"""^ {%d}["']?permissions["']?\s*:(.*)$""" % prop_indent)
        for j, line in enumerate(job_lines):
            if perm_re.match(line):
                job_perms = block_value(job_lines, j, prop_indent)
                job_has_perms = True
                break

        read_text = job_text + "\n" + inherited_text
        reads = sorted(line_issue_reads(read_text))
        for label, pattern in READ_PATTERNS:
            if pattern.search(read_text):
                reads.append(label)

        if YAML_ALIAS.search(job_perms) or UNINSPECTABLE_VALUE.search(strip_comments(job_perms)):
            errors.append(
                f"{path}: job '{name}' permissions use an escape, tag, explicit key, anchor, alias or merge key; cannot inspect"
            )
            continue
        creds = []
        if ID_TOKEN_WRITE.search(job_perms):
            creds.append("id-token: write")
        if WRITE_ALL.search(job_perms):
            creds.append("permissions: write-all")
        if SECRETS_INHERIT.search(job_text):
            creds.append("secrets: inherit")
        # A reusable workflow job with no permissions of its own and none at
        # the top runs with its caller's grants, id-token included, which no
        # file-local reader can see (XREVIEW 6212763969). Unknown is held.
        if "workflow_call" in untrusted_triggers and not job_has_perms and "permissions" not in spans:
            creds.append("caller grants (inherits: no explicit permissions in a workflow_call workflow)")
        creds.extend(sorted(line_secret_creds(job_text) | top_env_secrets))

        if reads and creds:
            findings.append(
                f"{path}: job '{name}' reads issue/comment text "
                f"({', '.join(reads)}) while holding {', '.join(sorted(set(creds)))}. "
                "Split the job so no job holds both untrusted text and a credential (#4747)."
            )
        if untrusted_triggers and creds:
            findings.append(
                f"{path}: job '{name}' holds {', '.join(sorted(set(creds)))} in a workflow "
                f"triggered by {', '.join(sorted(untrusted_triggers))}, which carries untrusted text. "
                "Inside this trust boundary no job may hold a credential, however the text is read (#4747)."
            )
    return findings, errors


# Layer 1: a real YAML safe loader (PyYAML) on the parsed mapping. A file
# must pass BOTH layers, so a parser differential has to fool two different
# readers at once (conductor189 ruling on XREVIEW 6209908015, round 6).
SECRETS_WORD = re.compile(r"\bsecrets\b", re.IGNORECASE)
SECRET_NAMED = re.compile(
    r"""\bsecrets\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])""",
    re.IGNORECASE,
)
GITHUB_TOKEN_REF = re.compile(
    r"""\bsecrets\s*(?:\.\s*github_token\b|\[\s*['"]github_token['"]\s*\])""", re.IGNORECASE
)


def _load_yaml_module():
    try:
        import yaml  # noqa: PLC0415 (optional import, refused below when absent)
    except ImportError:
        return None
    return yaml


def _strict_loader(yaml):
    class StrictLoader(yaml.SafeLoader):
        """SafeLoader that refuses a duplicate key in any mapping."""

    def construct_mapping(loader, node, deep=False):
        loader.flatten_mapping(node)
        seen = set()
        for key_node, _value in node.value:
            key = loader.construct_object(key_node, deep=deep)
            if key in seen:
                raise yaml.constructor.ConstructorError(
                    None, None, f"duplicate key {key!r}", key_node.start_mark
                )
            seen.add(key)
        return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)

    StrictLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping
    )
    return StrictLoader


def _strings(value):
    """Every string key and value inside a parsed YAML value."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            if isinstance(k, str):
                yield k
            yield from _strings(v)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _secret_creds(value):
    """Secret references in any parsed string, with or without `${{ }}`
    (an `if:` reads an expression without the braces).

    The whole string is read, not the text between `${{` and the first
    `}}`: the runner tracks quoted strings, so a quoted `}}` does not end
    an expression, and context names match in any letter case
    (XREVIEW 6210628528). GITHUB_TOKEN alone, in any case, is inert.
    """
    creds = set()
    for text in _strings(value):
        rest = GITHUB_TOKEN_REF.sub("", text)
        if not SECRETS_WORD.search(rest):
            continue
        names = [a or b for a, b in SECRET_NAMED.findall(rest)]
        creds.update(f"secrets.{n}" for n in names)
        if not names or SECRETS_WORD.search(SECRET_NAMED.sub("", rest)):
            creds.add("secrets (whole object or computed name)")
    return creds


def _perm_creds(perms):
    creds = set()
    if isinstance(perms, str) and perms.strip() == "write-all":
        creds.add("permissions: write-all")
    elif isinstance(perms, dict) and perms.get("id-token") == "write":
        creds.add("id-token: write")
    return creds


def _normalize_context(text):
    """Layer 1 github context read: rewrite index access as property access,
    lower the case and drop spaces around dots, then match plain paths."""
    text = text.lower()
    text = re.sub(r"""\[\s*['"]([a-z_][a-z0-9_-]*)['"]\s*\]""", r".\1", text)
    return re.sub(r"\s*\.\s*", ".", text)


_PARSED_INERT = {"issue": "number", "comment": "id"}
_IDENT = re.compile(r"\.([a-z_][a-z0-9_-]*)")
_EXPR_CHARS = set("[)],|&=!<>}?")


def _classify_github(after):
    """Classify the normalized text right after one `github` word.

    Returns a read label, or None when the access is provably harmless.
    Allowlist logic: only a plain property path that does not reach the
    issue or comment body is harmless; anything this cannot classify
    (computed index, operator, the whole object) is a read.
    """
    rest = after.lstrip()
    if not rest.startswith("."):
        if rest[:1] in _EXPR_CHARS:
            return "github context (whole object or unclassified)"
        return None  # prose: github.com handled below, actions/github-script, a word
    path = []
    pos = 0
    while True:
        m = _IDENT.match(rest, pos)
        if not m:
            if rest[pos:pos + 1] == "." or (not path and rest[:1] == "."):
                return "github wildcard or unclassified path"
            break
        path.append(m.group(1))
        pos = m.end()
        if len(path) == 3:
            break
    nxt = rest[pos:pos + 1]
    if not path or path[0] != "event":
        return None
    if len(path) == 1:
        return "github.event (whole object or unclassified)"
    if path[1] not in _PARSED_INERT:
        return None
    if len(path) == 3 and path[2] == _PARSED_INERT[path[1]] and nxt not in (".", "["):
        return None
    return f"github.event.{path[1]}.*"


def _parsed_issue_reads(values):
    reads = set()
    for value in values:
        for text in _strings(value):
            norm = _normalize_context(text)
            for m in re.finditer(r"\bgithub\b", norm):
                label = _classify_github(norm[m.end():])
                if label:
                    reads.add(label)
    return reads


def analyze_parsed(path):
    """Layer 1: lint the mapping a YAML safe loader builds. Return (findings, errors)."""
    yaml = _load_yaml_module()
    if yaml is None:
        return [], [f"{path}: PyYAML is not installed; the parsed layer cannot run"]
    try:
        with open(path, encoding="utf-8") as fh:
            docs = list(yaml.load_all(fh, Loader=_strict_loader(yaml)))
    except OSError as exc:
        return [], [f"{path}: cannot read: {exc}"]
    except yaml.YAMLError as exc:
        return [], [f"{path}: YAML loader refused the file: {str(exc).splitlines()[0]}"]
    docs = [d for d in docs if d is not None]
    if len(docs) != 1:
        return [], [f"{path}: {len(docs)} YAML documents; the lint reads exactly one"]
    doc = docs[0]
    if not isinstance(doc, dict) or not isinstance(doc.get("jobs"), dict) or not doc["jobs"]:
        return [], [f"{path}: no jobs mapping after parsing"]

    top_perms = doc.get("permissions")
    on = doc.get("on", doc.get(True))  # YAML 1.1 loads a bare on key as True
    if isinstance(on, str):
        trig = {on}
    elif isinstance(on, (list, dict)):
        trig = {t for t in on if isinstance(t, str)}
    else:
        trig = set()
    untrusted_triggers = trig & set(UNTRUSTED_TRIGGERS)
    top_secrets = _secret_creds(doc.get("env"))
    inherited = [doc.get("env"), doc.get("defaults")]
    findings = []
    errors = []
    for name, job in doc["jobs"].items():
        if not isinstance(job, dict):
            errors.append(f"{path}: job '{name}' is not a mapping after parsing")
            continue
        perms = job["permissions"] if "permissions" in job else top_perms
        creds = _perm_creds(perms) | _secret_creds(job) | top_secrets
        if "workflow_call" in untrusted_triggers and "permissions" not in job and "permissions" not in doc:
            creds.add("caller grants (inherits: no explicit permissions in a workflow_call workflow)")
        if job.get("secrets") == "inherit":
            creds.add("secrets: inherit")
        read_text = "\n".join(_strings([job] + inherited))
        reads = sorted(_parsed_issue_reads([job] + inherited))
        reads += [label for label, pattern in READ_PATTERNS if pattern.search(read_text)]
        if reads and creds:
            findings.append(
                f"{path}: job '{name}' reads issue/comment text "
                f"({', '.join(reads)}) while holding {', '.join(sorted(creds))}. "
                "Split the job so no job holds both untrusted text and a credential (#4747)."
            )
        if untrusted_triggers and creds:
            findings.append(
                f"{path}: job '{name}' holds {', '.join(sorted(set(creds)))} in a workflow "
                f"triggered by {', '.join(sorted(untrusted_triggers))}, which carries untrusted text. "
                "Inside this trust boundary no job may hold a credential, however the text is read (#4747)."
            )
    return findings, errors


def analyze_file(path):
    """Both layers; a file is clean only when BOTH report nothing."""
    f1, e1 = analyze_parsed(path)
    f2, e2 = analyze_lines(path)
    findings = list(dict.fromkeys(f1 + [f for f in f2 if f not in f1]))
    errors = [f"[parsed] {e}" for e in e1] + [f"[lines] {e}" for e in e2]
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
