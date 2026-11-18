---
description: "Shows where your attention went from your own Claude Code and Codex prompts over 20 weeks, as a local counts-only report. Use when asking where your focus goes."
argument-hint: "[scan|report|daily|demo]"
disable-model-invocation: true
effort: low
user-invocable: true
name: prompt-focus
allowed-tools: "Bash Read"
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run plugin scripts only from the installed plugin directory, never by a relative `skills/...` or `hooks/...` path.

Find the installed plugin directory first:

```bash
(
  ork_ws="$(pwd -P)"
  ork_home="$(cd "$HOME" 2>/dev/null && pwd -P)"
  ork_base="$(cd "$HOME/.cursor/plugins" 2>/dev/null && pwd -P)"
  ork_above=""
  case "$ork_home/" in ("$ork_ws"/*) ork_above=1 ;; esac
  ork_pick() {
    ork_best=""
    ork_best_pj=""
    while IFS= read -r ork_pj; do
      ork_r="$(cd "${ork_pj%/.cursor-plugin/plugin.json}" && pwd -P)" || continue
      case "$ork_r/" in ("$ork_base"/*) ;; (*) continue ;; esac
      if [ -z "$ork_above" ]; then
        case "$ork_r/" in ("$ork_ws"/*) continue ;; esac
      fi
      case "$ork_ws/" in ("$ork_r"/*) continue ;; esac
      grep -Eq '^  "name"[[:space:]]*:[[:space:]]*"ork"' "$ork_pj" || continue
      [ -d "$ork_r/skills/prompt-focus" ] || continue
      if [ -z "$ork_best" ] || [ "$ork_pj" -nt "$ork_best_pj" ]; then
        ork_best="$ork_r"
        ork_best_pj="$ork_pj"
      fi
    done
    [ -n "$ork_best" ] && printf '%s\n' "$ork_best"
  }
  ork_real=""
  if [ -n "$ork_base" ]; then
    ork_real="$(find "$ork_base" -maxdepth 6 -type f -path '*/.cursor-plugin/plugin.json' 2>/dev/null | ork_pick)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/prompt-focus/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


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

Output dir: `$PROMPT_FOCUS_DIR`, default `~/.claude/prompt-focus`. The exact call shape for Claude Code is in [skills/prompt-focus/references/claude-code.md](skills/prompt-focus/references/claude-code.md).

## Quick Start Example

```bash
python3 "<ORK_PLUGIN_DIR>/skills/prompt-focus/scripts/prompt_focus.py" report     # writes ~/.claude/prompt-focus/report.html
python3 "<ORK_PLUGIN_DIR>/skills/prompt-focus/scripts/prompt_focus.py" demo /tmp/prompt-focus-demo.html   # synthetic data, safe to share
```

Optional `~/.claude/prompt-focus/config.json`:

```json
{"areas": {"billing": ["invoice", "stripe"]}, "brief_patterns": ["^\\s*TASK-\\d+:"], "weeks": 20}
```

## Workflow

1. Run `report`, then open `report.html` for the user.
2. Lead with the verdict line from the page: the top area, prompts per week, and the nudge and words-per-prompt trend.
3. Point at the re-typed asks. Each one has its first-4 vs last-4 weeks trend and a proposed default; the page's copy-as-prompt turns the ticked ones into one request.
4. If the user runs several agents that paste briefs into the terminal, check 20 random rows before trusting the split, and add their brief markers to `brief_patterns`. See [skills/prompt-focus/references/how-it-works.md](skills/prompt-focus/references/how-it-works.md).

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
