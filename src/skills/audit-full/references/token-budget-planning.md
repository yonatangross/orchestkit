# Token Budget Planning

## Run Token Estimation

```bash
# Use the estimation script
bash ${CLAUDE_SKILL_DIR}/scripts/estimate-tokens.sh /path/to/project
```

## Manual Estimation Rules

| File Type | Tokens per Line (approx) |
|-----------|-------------------------|
| TypeScript/JavaScript | ~8 tokens/line |
| Python | ~7 tokens/line |
| JSON/YAML config | ~5 tokens/line |
| Markdown docs | ~6 tokens/line |
| CSS/SCSS | ~6 tokens/line |

## Budget Allocation

| Context Size | Available for Code | Fits LOC (approx) |
|-------------|-------------------|-------------------|
| 200K | ~150K tokens | ~20K LOC |
| 1M (standard) | ~950K tokens | ~125K LOC |

## Auto-Exclusion List

Always exclude from loading:
- `node_modules/`, `vendor/`, `.venv/`, `__pycache__/`
- `dist/`, `build/`, `.next/`, `out/`
- `*.min.js`, `*.map`, `*.lock` (read lock files separately for deps audit)
- Binary files, images, fonts
- Test fixtures and snapshots (unless auditing tests)
- Generated files (protobuf, graphql codegen)

## If Codebase Exceeds Budget

audit-full owns this case now — it does **not** punt. The map-reduce tier
(`workflows/audit-full-mapreduce.mjs`, run via the Workflow tool) shards the repo,
audits each shard in its own context, then recovers cross-shard edges in a synthesis
pass. Prefer it over narrowing scope (which silently drops coverage).

1. **Map-reduce tier (recommended)**: run the workflow with shards derived from the estimate — full coverage, cross-shard boundary pass, same STEP 3.5 refutation.
2. **Directory scoping**: narrow to specific directories — fast but **drops coverage** outside the scope; say so.
3. **Priority loading**: entry points + critical paths only — triage, not a full audit.
4. **`/ork:verify`**: only if you actually want multi-agent *graded* verification rather than an audit.

```python
# Over-budget routing
AskUserQuestion(
  questions=[{
    "question": "Codebase exceeds the single-context budget. How to proceed?",
    "header": "Too large",
    "options": [
      {"label": "Map-reduce audit (full coverage)", "description": "Shard → per-shard audit → cross-shard synthesis → refute (workflows/audit-full-mapreduce.mjs)"},
      {"label": "Narrow scope", "description": "Audit specific directories only — drops coverage elsewhere"},
      {"label": "Priority loading", "description": "Entry points + critical paths only (triage)"}
    ],
    "multiSelect": false
  }]
)
```
