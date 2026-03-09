# Phase 1: Scan Details

Run ALL scan commands in **one parallel batch** for speed:

```python
# PARALLEL — launch all in ONE message
Glob(pattern="**/package.json")
Glob(pattern="**/pyproject.toml")
Glob(pattern="**/go.mod")
Glob(pattern="**/Cargo.toml")
Glob(pattern="**/pom.xml")
Glob(pattern="**/*.csproj")
Glob(pattern="**/Gemfile")
Glob(pattern="**/composer.json")
Glob(pattern="**/.claude/settings.json")
Glob(pattern="**/.mcp.json")
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/Dockerfile*")
Glob(pattern="**/.github/workflows/*.yml")
Glob(pattern="**/terraform/**/*.tf")
Glob(pattern="**/k8s/**/*.yaml")
Glob(pattern="**/CONTRIBUTING.md")
Glob(pattern="**/tsconfig.json")
Glob(pattern="**/next.config.*")
Glob(pattern="**/vite.config.*")
Glob(pattern="**/alembic.ini")
```

Then read key dependency files found:

```python
# PARALLEL — read detected package manifests
Read(file_path="package.json")       # if found
Read(file_path="pyproject.toml")     # if found
Read(file_path="requirements.txt")   # if found
Read(file_path=".mcp.json")          # if found
Read(file_path=".claude/settings.json")  # if found
```

## Pattern Detection (for custom skill suggestions)

```python
# PARALLEL — count repeated patterns
Grep(pattern="@app\\.(route|get|post|put|delete|patch)", glob="**/*.py", output_mode="count")
Grep(pattern="@router\\.(get|post|put|delete|patch)", glob="**/*.py", output_mode="count")
Grep(pattern="export (default |)function", glob="**/*.tsx", output_mode="count")
Grep(pattern="export (default |)function", glob="**/*.jsx", output_mode="count")
Grep(pattern="class.*Model\\)", glob="**/*.py", output_mode="count")
Grep(pattern="def test_", glob="**/*.py", output_mode="count")
Grep(pattern="(describe|it|test)\\(", glob="**/*.{ts,tsx,js}", output_mode="count")
```
