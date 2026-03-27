# Diff Scanner

Parse git diff output into 3 concurrent data levels for test targeting.

## Target Modes (ChangesFor)

| Mode | Git Command | Use Case |
|------|-------------|----------|
| `changes` (default) | `git diff $(merge-base)` | All changes — committed + uncommitted |
| `unstaged` | `git diff` | Only uncommitted working tree changes |
| `branch` | `git diff main...HEAD` | Full branch diff vs main |
| `commit [hash]` | `git diff {hash}^..{hash}` | Single commit |

## 3 Data Levels (Gathered Concurrently)

### Level 1: Changed Files
```bash
git diff --name-only --diff-filter=AMDRC
```
Returns file paths with status: Added, Modified, Deleted, Renamed, Copied.

Each file is typed: `component`, `logic`, `style`, `docs`, `config`, `test`, `script`, `python`, `other`.

### Level 2: File Stats
```bash
git diff --numstat
```
Returns lines added/removed per file + computed `magnitude` (added + removed) for prioritization.

### Level 3: Diff Preview
Full unified diff, truncated to 12K chars. Files are prioritized by magnitude (most changed first), limited to 12 files max.

## Usage

```bash
bash scripts/diff-scan.sh                    # Default: changes mode
bash scripts/diff-scan.sh unstaged           # Uncommitted only
bash scripts/diff-scan.sh branch             # Branch vs main
bash scripts/diff-scan.sh commit abc123f     # Specific commit
```

## Output Format

```json
{
  "target": "branch",
  "files": [
    {"path": "src/components/Button.tsx", "status": "modified", "type": "component"},
    {"path": "src/app/login/page.tsx", "status": "added", "type": "component"}
  ],
  "stats": [
    {"path": "src/components/Button.tsx", "added": 15, "removed": 3, "magnitude": 18},
    {"path": "src/app/login/page.tsx", "added": 45, "removed": 0, "magnitude": 45}
  ],
  "preview": "--- src/app/login/page.tsx ---\n+export default function Login()...",
  "context": [
    "abc123f feat: add login page",
    "def456a fix: button hover state"
  ],
  "summary": {
    "total": 2,
    "top_files_in_preview": 12,
    "preview_chars": 1234,
    "max_preview_chars": 12000
  }
}
```

## 3-Level Classification (Import Graph)

After the diff scan, the expect pipeline classifies each changed file:

| Level | Name | How to Find | Test Depth |
|-------|------|-------------|------------|
| 1 | **Direct** | `git diff --name-only` output | Full interaction tests |
| 2 | **Imported** | `grep -rl "from.*{module}" src/` | Render check + basic interaction |
| 3 | **Routed** | Route map lookup (config or inference) | Page load + smoke test |

## Filtering

Non-source files are automatically skipped:
- Lock files (`.lock`, `.log`, `.map`)
- `node_modules/`, `.git/`, `dist/`, `build/`
- Configure additional patterns in `.expect/config.yaml` `ignore_patterns`

## Magnitude Prioritization

When more than 12 files changed, the preview includes only the top 12 by magnitude (lines added + removed). This ensures the AI test plan focuses on the most impactful changes.
