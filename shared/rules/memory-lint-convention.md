# Memory-driven lint convention (#1901)

Bridges lessons that live in CC-native user memory (`feedback_*.md`) into the
runtime tool-invocation linter (#1883) **without a PR per lesson**. A
`feedback_*.md` file can declare lint rules in a fenced JSON block; the
PreToolUse linter (`pretool/tool-invocation-linter`) loads them, merges them
with the static TypeScript registry, and emits a non-blocking advisory when a
tool call matches.

## Why a fenced JSON block (not YAML frontmatter)

OrchestKit hooks ship **zero production dependencies** (no `js-yaml`). Rather
than hand-roll a fragile partial-YAML parser over nested predicate objects, the
convention is a fenced ` ```ork-lint ` block containing a JSON array —
`JSON.parse` is zero-dep, robust, and safe. The block may sit anywhere in the
file (it does not have to be in the `---` frontmatter).

````markdown
```ork-lint
[
  {
    "id": "agent-isolation-worktree",
    "tool_name": "Agent",
    "predicate": { "field": "isolation", "op": "eq", "value": "worktree" },
    "severity": "warn",
    "message": "Agent(isolation:'worktree') was broken on CC <= 2.1.153",
    "see": "docs/parallel-primitives.md + #1883"
  }
]
```
````

## Rule fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | kebab-case, unique. Static registry **wins on collision**. |
| `tool_name` | yes | exact `tool_name` from HookInput (`Agent`, `Bash`, `Read`, …). |
| `predicate` | yes | the safe DSL below. |
| `severity` | no (default `warn`) | **`warn` or `info` only** — memory rules may NOT `block`. |
| `message` | yes | ≤ 240 chars, surfaced as `additionalContext`. |
| `see` | yes | pointer to docs/issue. |

## Safe predicate DSL

Predicates are a **restricted structured form**, never JS. The loader compiles
them with a pure `switch` — there is **no `eval` / `new Function`** anywhere, so
a `value` like `"process.exit(1)"` is just a literal string compared with `===`.

| `op` | `value` | Matches when the field… |
|------|---------|--------------------------|
| `eq` | string | equals the value |
| `neq` | string | is present and ≠ value |
| `in` | string[] | equals one of the values |
| `prefix` | string | starts with the value |
| `contains` | string | contains the value |
| `exists` | — | is present |
| `absent` | — | is missing |

`field` is a dot-path into the tool input (e.g. `command`, `options.foo`).
Prototype keys (`__proto__`, `prototype`, `constructor`) never resolve.

## Security model

1. **No code execution** — predicates are data, compiled by a pure switch.
2. **No blocking** — memory rules are advisory (`warn`/`info`); they cannot halt
   a tool call. `severity: "block"` is rejected at load time.
3. **Prototype-pollution guarded** field resolution.
4. **Fail-soft** — an invalid entry is skipped with a collected error (a single
   stderr line at first use); a malformed memory file never crashes the linter.
5. **Canonical wins** — the static TS registry overrides any memory rule with
   the same `id`. Memory advisories are tagged `[memory:<file>]` so operators
   know the source.

## Loading & opt-out

- Memory dir resolves to `~/.claude/projects/<cwd-slug>/memory/` (or
  `$ORK_MEMORY_DIR`). Loaded once per hook process and memoized.
- Disable entirely with `ORK_NO_MEMORY_LINT=1`.

## Promotion path

A memory rule that proves its worth should be **promoted** to the static
registry (`src/hooks/src/lib/tool-invocation-rules.ts`) with unit tests — the
memory block is the fast path; the TS registry is canonical.
