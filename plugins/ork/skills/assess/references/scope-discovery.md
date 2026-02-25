# Phase 1.5: Scope Discovery (CRITICAL -- prevents context exhaustion)

**Before spawning any agents**, build a bounded file list. Agents that receive unbounded targets will exhaust their context windows reading the entire codebase.

```python
# 1. Discover target files
if is_file(target):
    scope_files = [target]
elif is_directory(target):
    scope_files = Glob(f"{target}/**/*.{{py,ts,tsx,js,jsx,go,rs,java}}")
else:
    # Concept/topic -- search for relevant files
    scope_files = Grep(pattern=target, output_mode="files_with_matches", head_limit=50)

# 2. Apply limits -- MAX 30 files for agent assessment
MAX_FILES = 30
if len(scope_files) > MAX_FILES:
    # Prioritize: entry points, configs, security-critical, then sample rest
    # Skip: test files (except for testability agent), generated files, vendor/
    prioritized = prioritize_files(scope_files)  # entry points first
    scope_files = prioritized[:MAX_FILES]
    # Tell user about sampling
    print(f"Target has {len(scope_files)} files. Sampling {MAX_FILES} representative files.")

# 3. Format as file list string for agent prompts
file_list = "\n".join(f"- {f}" for f in scope_files)
```

## Sampling Priorities (when >30 files)

1. Entry points (main, index, app, server)
2. Config files (settings, env, config)
3. Security-sensitive (auth, middleware, api routes)
4. Core business logic (services, models, domain)
5. Representative samples from remaining directories
