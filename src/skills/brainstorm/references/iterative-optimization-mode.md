# Iterative Optimization Mode (autoresearch-style)

Selected when the user picks **"Iterative optimization"** in STEP 0a. Skips Phases 2-6 of the standard brainstorm flow and enters a metric-driven optimization loop that runs until the user interrupts.

**Required:** one command that produces a metric, plus an extraction rule for that metric.

## 1. Ask for metric definition

```python
AskUserQuestion(questions=[
  {"question": "What command produces the metric?",
   "header": "Metric command",
   "options": [
     {"label": "npm run benchmark", "description": "Node.js benchmark suite"},
     {"label": "pytest --tb=short", "description": "Python test suite"},
     {"label": "lighthouse --output=json", "description": "Web performance score"},
     {"label": "I'll type my own", "description": "Custom command"}
   ]},
  {"question": "How to extract the metric number?",
   "header": "Metric extraction",
   "options": [
     {"label": "grep from stdout", "description": "e.g. grep 'score:' output.log"},
     {"label": "JSON field", "description": "e.g. jq '.score' result.json"},
     {"label": "Exit code", "description": "0 = pass, non-zero = fail"},
     {"label": "I'll specify", "description": "Custom extraction"}
   ]},
  {"question": "Direction?",
   "header": "Optimization direction",
   "options": [
     {"label": "Lower is better", "description": "Latency, bundle size, error rate"},
     {"label": "Higher is better", "description": "Score, throughput, coverage"}
   ]}
])
```

## 2. Establish baseline

```python
Bash(command="{metric_command} > .claude/experiments/baseline.log 2>&1")
baseline = extract_metric(".claude/experiments/baseline.log")
append_to_journal(baseline, "keep", "-", current_commit, "baseline")
```

## 3. Optimization loop

See `${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/experiment-journal.md` for journal format.

```python
# LOOP (until user interrupts or trajectory == "stuck" for 5+ iterations):
#   a. Generate ONE idea (quick ideation, single agent)
#   b. Implement in worktree: Agent(isolation="worktree", ...)
#   c. Run metric command in worktree
#   d. Compare to previous best
#   e. If improved: merge worktree back, log "keep"
#   f. If not: discard worktree, log "discard"
#   g. Check trajectory — if "stuck" for 5+, try radical changes
#   h. NEVER STOP — continue until user interrupts
```
