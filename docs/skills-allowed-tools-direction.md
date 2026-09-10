# `allowed-tools` direction table (#4008)

The per-skill call for every skill whose prose instructs a tool its
`allowed-tools` omits. **This file is the brief for the mechanical edits.** The
judgment is recorded here; the typing is separable.

## What the field actually is, because it changes the fix

Per the Claude Code docs (https://code.claude.com/docs/en/skills.md), verbatim:

> The `allowed-tools` field grants permission for the listed tools during the
> turn that invokes the skill, so Claude can use them without prompting you for
> approval. It does not restrict which tools are available: every tool remains
> callable, and your permission settings still govern tools that are not listed.

So for Claude Code it is a **pre-grant, not a ceiling**. An agent's `tools`
frontmatter is a ceiling; a skill's `allowed-tools` is not.

That refutes #4008's framing. These skills are **not** "unable to carry out
their own instructions" under Claude Code, and they do not silently report work
they never did. Three real consequences remain:

1. A missing pre-grant puts an approval prompt in the middle of the skill's own
   procedure. Avoiding that is the field's entire purpose.
2. The **Cursor** host reads `allowed-tools` off the generated command files and
   treats it as a hard ceiling. Same text, stricter reading, real breakage.
3. Prose honesty: a skill that reads as if it performs work it was never
   equipped to perform misleads the next author regardless of runtime.

## The two directions

- **WIDEN** when the skill genuinely performs the work. List the tool. That is
  what removes the prompt, which is the point of the field.
- **NARROW** when the skill only teaches. Keep the read-only list and reword the
  step as guidance rather than an action the skill performs.

A strong NARROW signal: `context: fork` plus an `agent:` field. The agent owns
the doing and carries its own tools; the skill is the briefing.

## The table

| Skill | Declares | Instructs | Call | Why |
|---|---|---|---|---|
| `configure` | Bash Read Grep Glob AskUserQuestion | `Edit .mcp.json` | **WIDEN** ✅ done | An interactive settings wizard. Changing config is the job, not an aside. Added `Edit`, `Write`. |
| `testing-e2e` | read-only | `Run agent-browser`, `Create tests/seed.spec.ts` | **NARROW** ✅ done | `context: fork`, `agent: test-generator`. The agent writes tests; the skill teaches Playwright patterns. Both steps reworded as guidance. |
| `doctor` | Bash Read Grep Glob AskUserQuestion | `Create .claude/hooks/debug.json` | **WIDEN** | Diagnoses and repairs plugin health, and already carries `Bash`. A skill trusted to run commands should not prompt to drop a debug file. Add `Write`. |
| `glyph` | Read Grep Glob | `Run scripts/validate-tokens.sh`, `Update primitives.json` | **NARROW** | Both hits are in `CONTRIBUTING.md`, addressed to a human contributing to the skill, not steps the skill performs. Reword as contributor instructions. |
| `chain-patterns` | Read ToolSearch | `Update state.json` | **NARROW** | A patterns skill describing checkpoint mechanics. It documents what a chain does, it does not keep the state file. |
| `agent-orchestration` | read-only | `Create /backend/app/.../run_scenario.py` | **NARROW** | A reference on orchestration patterns. The path is an illustrative example from a worked scenario, not a file this skill writes. |
| `ai-ui-generation` | read-only | `Run tsc --noEmit` | **NARROW** | The hit is in `rules/ai-ci-gate.md`, describing what a CI gate should do. Reword as a gate requirement, not a step. |
| `browser-tools` | read-only | `Run agent-browser skills list` | **NARROW** | The hit is in `references/upstream.md`, documenting the upstream CLI surface. Reword as a description of the command. |
| `design-system-tokens` | read-only | `Run style-dictionary build` | **NARROW** | A token-architecture reference. It explains the build step; it does not run it. |
| `devops-deployment` | read-only | `Run npm ci` | **NARROW** | The hit is inside `rules/docker-multistage.md`, describing a Dockerfile stage. Reword to describe the layer. |
| `storybook-testing` | read-only | `Run vitest` | **NARROW** | An integration-patterns reference. Reword as what the integration does. |

**Nine NARROW, two WIDEN.** That ratio is itself the finding: nearly all of
these are reference and pattern skills whose prose drifted into the imperative,
not skills that were under-equipped.

## Scope, honestly

This table covers what `scripts/allowed-tools-check.mjs` detects, which is
**narrower than #4008's sweep** and deliberately so. The checker counts only
imperative instruction lines and strips fenced code blocks, because a pattern
skill quoting a command is teaching, not instructing, and that distinction is the
whole judgment call. The issue's 33 came from a looser detector that counted
fenced examples; a gate that flags most of the corpus gets ignored.

Separately, 49 skills share the read-only list `[Glob, Grep, Read, WebFetch,
WebSearch]`. Sharing a list is not a defect, and most of those 49 have prose that
already matches it.

Related: `scripts/allowed-tools-baseline.json` (the shrink-only ratchet).
