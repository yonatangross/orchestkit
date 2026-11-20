# How prompt-focus counts

## Sources (read only)

| Source | Field | Notes |
|---|---|---|
| `~/.claude/history.jsonl` | `display`, `pastedContents`, `timestamp`, `project` | what you entered at the Claude Code prompt |
| `~/.claude/paste-cache/<hash>.txt` | paste bodies | used only to tell an agent brief from your own paste |
| `~/.codex/history.jsonl` | `text`, `ts` | what you entered at the Codex prompt |

Transcripts are not read: they hold tool results and agent turns, and they are pruned over time. The input history covers the full window.

## Who wrote it

In order: an empty entry with a paste is a **paste** event (or a **brief** if the paste matches `brief_patterns`); `/x` is a **command**; `!x` is a **shell** line; text matching `brief_patterns` is a **brief**; everything else is **typed**, your words.

Multi-agent setups often paste one agent's brief into another agent's terminal, where it looks typed. The default patterns catch a sign-off like `(worker-one, Claude via Claude Code)` and a brief that opens with `You are <name>.`. Add your own markers:

```json
{"brief_patterns": ["^\\s*TASK-\\d+:", "^\\s*orchestrator:"]}
```

Control: read 20 random typed rows and 20 random briefs; count the wrong ones. Errors usually run one way (agent text counted as yours).

## Areas

Default: the project folder of each prompt (a `.worktrees/<x>` path maps to its repo). The top `max_areas` (8) are kept, the rest go to `other`. To group by topic:

```json
{"areas": {"billing": ["invoice", "stripe"], "docs": ["\\breadme\\b", "docs?/"]}}
```

`markers` draws a dashed line on the stream graph: `{"markers": [{"date": "2026-08-12", "label": "new setup"}]}`.

## Re-typed asks

Seven fixed families (keep going, status, what's next, show it visually, verify, merge, open it). Each shows its share of your prompts in the first 4 vs the last 4 weeks. A family that stays flat after you wrote a rule for it is a sign the rule did not stick; a default in the harness (a hook, an output style) usually works better.
