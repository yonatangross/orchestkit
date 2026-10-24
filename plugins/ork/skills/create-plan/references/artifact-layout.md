# ork task artifact layout (schema 1)

The contract for the artifact pairs (`create-plan`, `iterate-plan`, `create-research`,
`iterate-research`, `review-artifact-comments`). Anything that reads artifacts, such as the L2
auto-advance table that treats an approved artifact as "phase done", cites this file. One writer owns
the format: `scripts/artifact.mjs` in each of the five skills (canonical copy
`scripts/_shared/artifact.mjs`, kept in sync by `scripts/sync-shared-scripts.sh`). Never hand-write
the front matter; hand-typed comments are fine (see Comments).

Tested by `tests/skills/test-artifact-pairs.sh`. Changing any rule below is a schema change: bump
`ork_artifact` and say so in the PR.

## Path

```
<repo root>/.ork/tasks/<task>/<NN>-<kind>-<slug>.md
```

| Part | Rule |
|---|---|
| `<repo root>` | `git rev-parse --show-toplevel`, else the current directory. `--tasks-dir` overrides `.ork/tasks` |
| `<task>` | kebab-case, one directory per task (a branch, an issue, a lane) |
| `<NN>` | two digits, chronological: the highest `NN-` prefix in the directory plus 1, starting at `01` |
| `<kind>` | `research` or `plan` (schema 1). New kinds are added to `KINDS` in the script and to this table |
| `<slug>` | kebab-case, what the artifact is about |

Example: `.ork/tasks/l6-artifact-pairs/01-plan-artifact-pairs.md`.

The NN order is the reading order. A plan written after its research has a higher NN. A second plan
for the same task is a new file with a new NN, not an overwrite.

## Front matter

Plain `key: value` lines between `---` fences, in this order:

| Key | Values | Set by |
|---|---|---|
| `ork_artifact` | `1` | create |
| `task` | the task directory name | create |
| `kind` | `research` or `plan` | create |
| `slug` | the slug in the file name | create |
| `title` | a JSON string | create |
| `author` | the seat that wrote the artifact (`--author`, default `claude`) | create |
| `revision` | integer, `1` on create, plus 1 on every iterate | create, iterate |
| `status` | `draft`, `in-review` or `approved` | see Status |
| `created` | ISO 8601 UTC, never changes | create |
| `updated` | ISO 8601 UTC of the last change to the artifact itself | create, iterate, approve (comment, reply and resolve leave it alone) |
| `repo`, `branch`, `sha` | git state when the artifact was created; `sha` is refreshed on iterate | create, iterate |
| `approved_by`, `approved_at`, `approved_ref` | the approving seat, when, and the LAND message or comment id it acted on; present only once approved | approve |

## Body

Everything between the front matter and the comment block. `create` and `iterate` take the body
from a file (`--body`) and refuse a body that carries its own comment block, so the comments can
never be duplicated or dropped by a rewrite.

## Comments

The last part of the file, between two marker lines:

```
<!-- ork:comments -->
<comment id="c1" author="Reviewer" status="open" at="2026-10-24T06:20:00.000Z">
> the line the comment is about
Say which file step A touches.
  Author: Will do.
</comment>
<!-- /ork:comments -->
```

| Line | Meaning |
|---|---|
| `<comment id="cN" author="..." status="open\|resolved" at="...">` | one comment; ids are `c1`, `c2`, ... in order of creation; `at` is optional |
| `> ...` | the quoted text the comment is about (optional) |
| plain line | the comment text |
| two spaces, `Name: text` | a reply, in order |
| `</comment>` | end of the comment |

A reviewer may type a comment into the block by hand in this shape; the script reads it like any
other. Resolving keeps the comment (status `resolved` plus a reply saying how). Nothing deletes a
comment.

**Iterate keeps every comment byte for byte.** `iterate` rewrites the front matter and the body and
writes the comment block back exactly as it read it.

## Status and the "phase done" signal

| Event | Status |
|---|---|
| create | `draft` |
| first comment added | `draft` becomes `in-review` |
| iterate of an `approved` artifact | back to `in-review` (a changed artifact needs a new approval) |
| approve | `approved`; needs `--by <seat>` and `--ref <LAND or comment id>` (exit 2 without them); refused (exit 1) while any comment is open or when `--by` is the `author` |

An artifact is **done** when `status: approved`, it has no open comment, and `approved_by` is set and is not its `author`. A lane never approves its own artifact: L2 must not advance on self-approval. Read it with:

```bash
node scripts/artifact.mjs status --task-dir .ork/tasks/<task> --json
# [{"file":"01-plan-x.md","kind":"plan","slug":"x","revision":2,"status":"approved","open_comments":0,"done":true}]
```

A phase is done when its kind has at least one `done` artifact. L2 should read `done` and not
re-derive it from the fields.

## Exit codes

`0` done, `1` refused by artifact state (approve with open comments), `2` bad usage or invalid input
(nothing written), `3` unexpected error. Every write goes to a temp file and is renamed into place, so
a reader never sees half a file.

## Provenance

Ported from humanlayer's riptide plugin (`apps/riptide-rpi-claude-plugin/skills`: create/iterate
pairs plus `review-artifact-comments`, Apache-2.0). The difference: humanlayer keeps comments in a
cloud service behind an MCP server; ork keeps them in the artifact file, so the file is the whole
review record and no service is needed.
