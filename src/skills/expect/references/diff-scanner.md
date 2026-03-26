# Diff Scanner

Parse git diff output and classify changed files into 3 levels for test targeting.

## 3-Level Classification

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| 1 | **Direct** | The file itself changed | `src/components/Button.tsx` |
| 2 | **Imported** | Files that import the changed file | `src/components/Header.tsx` (imports Button) |
| 3 | **Routed** | Pages/routes that render level 1 or 2 files | `/dashboard` (renders Header → Button) |

## Diff Parsing

```bash
# Get changed files based on target
git diff --name-only                    # unstaged
git diff main...HEAD --name-only        # branch
git diff HEAD~1 --name-only             # last commit

# Get detailed diff for context
git diff --stat                         # summary
git diff -- src/components/Button.tsx   # single file diff
```

## Import Graph Traversal

To find Level 2 (imported-by) files:

```bash
# Find all files that import the changed file
grep -rl "from.*['\"].*Button['\"]" src/ --include="*.tsx" --include="*.ts"
```

## Change Classification

```python
def classify_changes(changed_files: list[str]) -> dict:
    direct = changed_files  # Level 1

    imported = []  # Level 2
    for f in direct:
        module = extract_module_name(f)
        importers = grep(f"from.*{module}", "src/", include="*.tsx,*.ts")
        imported.extend(importers)

    routed = []  # Level 3
    for f in direct + imported:
        routes = route_map.get(f, [])
        routed.extend(routes)

    return {
        "direct": dedupe(direct),
        "imported": dedupe(imported),
        "routed": dedupe(routed),
    }
```

## Test Depth by Level

| Level | Test Depth |
|-------|------------|
| Direct (L1) | Full interaction tests — the component itself changed |
| Imported (L2) | Render check + basic interaction — verify it still works with updated dependency |
| Routed (L3) | Page load + smoke test — verify the page renders without errors |
