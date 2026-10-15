---
name: prompt-focus
license: MIT
compatibility: "Claude Code 2.1.277+. Python 3.9+ (stdlib only)."
description: "Shows where your attention went from your own Claude Code and Codex prompts: projects, hours and re-typed asks over 20 weeks, as a local counts-only HTML report. Use when asking where your focus goes."
argument-hint: "[scan|report|daily|demo]"
user-invocable: false
allowed-tools: "Bash Read"
effort: low
metadata:
  category: document-asset-creation
  version: "1.0.0"
  author: "OrchestKit"
  complexity: "low"
  tags: "analytics, prompts, focus, attention, self-coaching, defaults, data-visualization, daily, privacy"
---

# prompt-focus

Where did your attention go, and what do you keep telling your agents again and again? This skill answers from your own input history, on your machine.

## Quick Reference

| Command | What it does | Output |
|---|---|---|
| `scan` | read history, attribute, aggregate | `agg.json` (counts only) |
| `report` | scan, then build the page | `report.html` |
| `daily [YYYY-MM-DD] [--force]` | append one finished day (yesterday by default), once; today needs `--force` and is written as a partial row that a later run replaces | `daily.jsonl` |
| `demo [path]` | the same page from synthetic data | a shareable demo page |
| `selftest` | synthetic run with privacy asserts | exit 0 or an assert |

Output dir: `$PROMPT_FOCUS_DIR`, default `~/.claude/prompt-focus`. The exact call shape for Claude Code is in [references/claude-code.md](references/claude-code.md).

## Quick Start Example

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" report     # writes ~/.claude/prompt-focus/report.html
python3 "${CLAUDE_SKILL_DIR}/scripts/prompt_focus.py" demo /tmp/prompt-focus-demo.html   # synthetic data, safe to share
```

Optional `~/.claude/prompt-focus/config.json`:

```json
{"areas": {"billing": ["invoice", "stripe"]}, "brief_patterns": ["^\\s*TASK-\\d+:"], "weeks": 20}
```

## Workflow

1. Run `report`, then open `report.html` for the user.
2. Lead with the verdict line from the page: the top area, prompts per week, and the nudge and words-per-prompt trend.
3. Point at the re-typed asks. Each one has its first-4 vs last-4 weeks trend and a proposed default; the page's copy-as-prompt turns the ticked ones into one request.
4. If the user runs several agents that paste briefs into the terminal, check 20 random rows before trusting the split, and add their brief markers to `brief_patterns`. See [references/how-it-works.md](references/how-it-works.md).

## Key Decisions

- **Your words only.** A paste counts as one event, not as words; a slash command or shell line counts apart; text matching `brief_patterns` is an agent's, not yours.
- **Counts only.** `agg.json`, `daily.jsonl` and the page hold numbers and category names. Prompt text is read in memory and never written.
- **Rolling window.** Always the last 20 weeks ending today (`weeks` in config).
- **Areas.** Your project folder by default; add `areas` regexes in `config.json` to group by topic instead.

## Common Mistakes

- Sharing your real `report.html` publicly: it names your projects. Use `demo` for anything public.
- Reading the split as exact without a control: brief patterns are text rules, and they miss some agent text.
- Expecting other tools: only Claude Code and Codex input history are read.

## Rules

- Read only. Never write to `~/.claude/history.jsonl`, `~/.claude/paste-cache/` or `~/.codex/`.
- Never quote prompt text back in chat beyond the user's own short asks they asked to see.
