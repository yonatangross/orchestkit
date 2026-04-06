# Experiment Journal Pattern

Append-only TSV log for tracking try/measure/keep-or-discard cycles across sessions. Inspired by [autoresearch](https://github.com/karpathy/autoresearch)'s `results.tsv`.

## When to Use

Any skill that produces scored/rated output and may run multiple times on similar topics:
- `brainstorm` — log evaluated ideas with composite scores and keep/discard status
- `verify` / `cover` — log optimization attempts with metric deltas
- `implement` — log iterative optimization attempts (performance, bundle size, prompts)
- `fix-issue` — log attempted fixes with pass/fail

## File Location

```
.claude/experiments/{skill}-{topic-slug}.tsv
```

Examples:
- `.claude/experiments/brainstorm-caching-strategy.tsv`
- `.claude/experiments/optimize-bundle-size.tsv`
- `.claude/experiments/fix-issue-1234.tsv`

## TSV Format

Tab-separated, 6 columns. Header row required.

```
timestamp	score	status	reason	commit	description
2026-04-06T08:00	7.55	keep	-	a1b2c3d	Session-only with signed cookies
2026-04-06T08:01	3.15	discard	complexity	-	Custom token protocol
2026-04-06T08:05	0.00	crash	untestable	-	Blockchain auth (can't assess)
2026-04-06T09:00	0.982	keep	-	c3d4e5f	Increase LR to 0.04
2026-04-06T09:05	1.005	discard	regression	c3d4e5f	Switch to GeLU activation
```

### Column Reference

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | ISO-8601 | When the experiment was logged |
| `score` | float | Composite score (brainstorm) or metric value (optimization). `0.00` for crashes |
| `status` | enum | `keep`, `discard`, or `crash` |
| `reason` | string | Why discarded: `overkill`, `infeasible`, `duplicate`, `regression`, `complexity`, `untestable`. `-` for keeps |
| `commit` | string | Git short SHA if code was committed, `-` otherwise |
| `description` | string | Short text describing what was tried. No tabs (breaks TSV) |

## Reading the Journal

### Before Phase 1 (Memory + Context)

```python
journal_path = f".claude/experiments/{skill}-{topic_slug}.tsv"
try:
    journal = Read(journal_path)
    # Parse and surface to user
    keeps = [row for row in journal if row.status == "keep"]
    discards = [row for row in journal if row.status == "discard"]
    print(f"Prior session: {len(keeps)} kept, {len(discards)} discarded")
    # Pre-filter: skip ideas similar to discard entries
    # Highlight: surface keep entries as starting points
except:
    pass  # No prior journal — first run
```

### Trajectory Detection

Count experiments in rolling windows to detect progress state:

```python
recent = last_10_experiments()
keep_rate = count(status == "keep") / len(recent)

if keep_rate > 0.3:
    trajectory = "improving"     # Still finding wins
elif keep_rate > 0.1:
    trajectory = "plateauing"    # Diminishing returns
else:
    trajectory = "stuck"         # Consider switching strategy
```

When `trajectory == "stuck"`:
- Brainstorm: try more radical ideas, revisit discarded approaches with modifications
- Optimize: increase change magnitude, try orthogonal dimensions
- Fix-issue: escalate to user, try different root cause hypothesis

## Writing to the Journal

### After Each Experiment

```python
# Append one line (never overwrite)
line = f"{timestamp}\t{score}\t{status}\t{reason}\t{commit}\t{description}\n"
# Use Bash to append:
Bash(command=f'echo "{line}" >> {journal_path}')
```

### After Brainstorm Phase 4

```python
# Log all evaluated ideas
for idea in evaluated_ideas:
    status = "keep" if idea in top_approaches else "discard"
    reason = "-" if status == "keep" else idea.discard_reason
    append_to_journal(idea.score, status, reason, "-", idea.description)
```

### After Iterative Optimization Loop

```python
# Log each iteration
if metric_improved:
    append_to_journal(new_metric, "keep", "-", commit_sha, change_description)
else:
    append_to_journal(new_metric, "discard", "regression", "-", change_description)
```

## Git Policy

**Do NOT commit experiment journals.** Add to `.gitignore`:
```
.claude/experiments/
```

Journals are local working memory, not source code. They survive across sessions via the filesystem but don't pollute git history. If a journal contains important decisions, persist them to the memory graph instead.
