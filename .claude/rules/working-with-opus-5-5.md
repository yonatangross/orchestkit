# Working with Opus 5.5

Applies to anyone running Claude Code in this repository. Source: Anthropic, "Getting the most out
of Opus 5.5" (claude.dev/blog/getting-the-most-out-of-opus-5-5/#try-this-first). This lives here, not
in CLAUDE.md, because CLAUDE.md is at its 4,800-byte cap (`tests/performance/test-token-overhead.sh`);
a rule file with no `paths:` loads every session, same as CLAUDE.md.

1. **Every task names its finish line.** If the ask does not name one, state the one you are working
   toward in one line ("done means the tests pass and the PR is open"), then work to it.
2. **Keep going unless you need the person.** When a step does not need their input, keep going and
   put the status note in the same message as your next action. Stop and ask only when you cannot
   continue without them, or before anything destructive or outward-facing: deleting data,
   force-pushing, publishing, or changing anything outside this repository.
3. **Mark what you could not confirm.** Every claim in a report is either confirmed (command, file and
   line, or URL) or marked unconfirmed with the places you looked.
4. **Long runs.** Keep the task list in a `TASKS.md` file (never committed) so it survives a relaunch.
   Split big audits and migrations across subagents, check each subagent's evidence before accepting
   it, and end by saying what is needed to go further. Skills that fan out follow
   `src/shared/rules/long-run-protocol.md`.
5. **No think nudges, no restated reasoning.** Opus 5.5 "always thinks before it replies, and it
   decides how much." Do not write "think carefully" or "think step by step" into prompts, agents or
   skills, and do not ask a model to reproduce its reasoning in the reply. Change effort for depth; ask
   for a short rationale when you need one.
