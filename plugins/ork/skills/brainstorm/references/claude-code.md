# Claude Code adapter: brainstorm

Slash invoke: `/ork:brainstorm`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`brainstorm`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
> **PostCompact recovery:** Long brainstorm sessions may trigger context compaction. The PostCompact hook re-injects branch and task state. If compaction occurs mid-brainstorm, check `.claude/chain/state.json` for the last completed phase and resume from the next handoff file (see Phase Handoffs table). Reactive compaction (CC 2.1.142+) now sizes the first summarize to the actual overflow, so mid-turn stalls are rare — no need to expect a second pass.
```


## Session notes moved from SKILL.md (quality loop round 1)

These version-tagged notes used to sit in the body of SKILL.md, which pushed it over the 500-line cap. Nothing was changed except the location.

> **Partial results (CC 2.1.76, extended 2.1.246):** Background agents that are killed (timeout, context limit) return responses tagged with `[PARTIAL RESULT]`. Since CC 2.1.246 an agent that stops at its `maxTurns` limit is ALSO reported as partial: its summary reads "stopped at its N-turn limit (partial result; continue it with SendMessage to the task-id)" and its output is marked partial instead of appearing finished. When collecting Phase 2 divergent ideas, check each agent's output for either shape. If present, include the partial ideas but note them as incomplete in Phase 3 feasibility. For the turn-limit shape, `SendMessage` to that agent's id with "continue from where you stopped" reuses its context; a re-spawn starts from zero and pays the prompt again. Never treat a turn-limited agent as finished.

> **Cross-session replies land in the parent (CC 2.1.248):** when a subagent sends `SendMessage` to another session, the reply is delivered to the parent session's conversation, never to the subagent; a subagent sends and moves on, the parent reads the answer. Cross-session `SendMessage` / `ListAgents` also work on Bedrock, Vertex and Foundry and with telemetry disabled (CC 2.1.248).

> **PostCompact recovery:** Long brainstorm sessions may trigger context compaction. The PostCompact hook re-injects branch and task state. If compaction occurs mid-brainstorm, check `.claude/chain/state.json` for the last completed phase and resume from the next handoff file (see Phase Handoffs table). Reactive compaction (CC 2.1.142+) now sizes the first summarize to the actual overflow, so mid-turn stalls are rare — no need to expect a second pass.

> **When context fills (CC 2.1.141+):** Instead of ending the session, use the rewind menu's "Summarize up to here" to compress earlier turns while keeping recent context intact — a deliberate compaction point that pairs with the improved reactive compaction above.

> **Session recap (CC 2.1.108+):** After idle periods, use `/recap` to restore conversational context alongside checkpoint-resume. Enabled by default since CC 2.1.110 (even with telemetry disabled).

> **Push notifications (CC 2.1.110+):** For long brainstorm sessions, use `PushNotification` to alert when synthesis is complete (requires Remote Control with "Push when Claude decides").
>
> **Lighter alternative (CC 2.1.141+):** Hooks can emit desktop notifications, window titles, and bells natively via the `terminalSequence` field in hook JSON output — no Remote Control required, no Anthropic round-trip. Ork's notification hooks (`notification/desktop`, `notification/sound`) already emit via `terminalSequence` (#1847, shipped).

> **Manual cleanup:** To stop lingering background teammates, press `Ctrl+F` twice (foreground/Stop). Note: `/clear` (CC 2.1.72+) preserves background agents — only foreground tasks are cleared.

> **Teammate background tasks survive turn-end (CC 2.1.183):** A background task started *by a teammate* is no longer killed when that teammate finishes its turn. Phase-2 teammates may safely kick off a long `run_in_background` task (e.g. a feasibility build) and let it outlive their own turn — the result is still collectable at synthesis. Pre-2.1.183 this required the lead to own the background task.

> **That claim does not cover auto-backgrounded work (#3448):** a foreground Bash call the harness backgrounds on timeout is a different path. Its completion notice goes to the agent that spawned it, and if that agent already ended its turn on "I'll wait", the notice lands nowhere and the output is lost with zero logged errors. Two rules follow. The lead owns any research call whose documented runtime can approach the Bash timeout (`tavily-research` advertises 30-120s and real queries pass 180s). And no teammate ends a turn on "I'll wait for X" without either collecting X or handing ownership of X to the lead.
