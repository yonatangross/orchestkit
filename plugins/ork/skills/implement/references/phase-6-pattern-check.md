# Phase 6 pattern check (fork-safe)

The fork cannot run `pattern-consistency-enforcer` on each Write/Edit (#4683), so run it once over every changed file; a `"continue":false` result names a violation to fix before Phase 7:

```bash
{ git -c core.quotePath=false diff --name-only <start-sha>; git -c core.quotePath=false ls-files --others --exclude-standard; } | sort -u | while read -r f; do [ -f "$f" ] || continue; jq -n --arg p "$PWD/$f" --rawfile c "$f" '{tool_name:"Write",tool_input:{file_path:$p,content:$c}}' | node "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs" skill/pattern-consistency-enforcer; done
```

If the start sha is `none` (no repository, or no commit yet when the skill opened), there is nothing to diff against: feed the enforcer the files this run wrote, from your own task log, one `printf '%s\n' <file>...` line in place of the `{ ...; }` group above.

