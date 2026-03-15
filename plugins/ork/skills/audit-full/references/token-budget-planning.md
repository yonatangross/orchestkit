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

1. **Priority loading**: Entry points first, then imported modules
2. **Directory scoping**: Ask user to narrow to specific directories
3. **Fallback**: Recommend `/ork:verify` for multi-agent approach (only needed for codebases > 125K LOC)

```python
# Fallback suggestion
AskUserQuestion(
  questions=[{
    "question": "Codebase exceeds context window. How to proceed?",
    "header": "Too large",
    "options": [
      {"label": "Narrow scope", "description": "Audit specific directories only"},
      {"label": "Use /ork:verify instead", "description": "Chunked multi-agent approach (works with any context size)"},
      {"label": "Priority loading", "description": "Load entry points + critical paths only"}
    ],
    "multiSelect": false
  }]
)
```
