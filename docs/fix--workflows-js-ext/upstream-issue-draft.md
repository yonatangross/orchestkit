# Upstream issue draft — NOT POSTED

Target: `anthropics/claude-code`. Drafted 2026-08-12 at the operator's instruction
("draft it, do not post"). Nothing has been filed. Post it yourself if you want it filed.

---

**Title:** Plugin workflow loader silently drops `.mjs`/`.cjs`/`.ts` while the user/project loader counts them as near-misses

**Body:**

### Summary

`workflows/` scripts shipped inside a plugin are filtered on `name.endsWith(".js")`. Anything
else is discarded with a bare `return null` — no warning, no debug log, no telemetry counter. The
sibling user/project loader performs the *same* check but explicitly recognises the common
authoring mistake and records it as `nearMissExt` / `near_miss_ext` in the `workflow_discover`
event.

The asymmetry means a plugin author who names a script `.mjs` gets a workflow that is packaged
correctly, installs correctly, and executes correctly by `scriptPath` — but does not exist by
name, with nothing anywhere explaining why.

### What we observed

Claude Code 2.1.228, plugin `ork` shipping three scripts via the documented plugin `workflows/`
directory, with `"workflows": "./workflows/"` in `plugin.json` and valid `export const meta`
blocks in every file.

```
Workflow({name: "ork:skill-fitness"})
→ Workflow "ork:skill-fitness" not found. Available: deep-research, code-review
```

Only the two bundled workflows were listed. The same scripts ran perfectly via
`Workflow({scriptPath: "<abs path>"})`, which is what made the cause so hard to see: packaging,
`meta`, namespacing and execution were all fine.

### Root cause

The plugin directory scanner:

```js
if(!(l.isFile()||l.isSymbolicLink())) return null;
if(!l.name.endsWith(".js")) return null;      // silent drop
return <loadSingleFile>(join(e,l.name), ...)
```

The user/project scanner, for comparison:

```js
if(!a.name.endsWith(".js")){
  if(/\.(mjs|cjs|ts)$/.test(a.name)) r.nearMissExt++;   // recognised and counted
  return null
}
```

Since `nearMissExt` is surfaced in `workflow_discover` telemetry, `.mjs` is already understood
upstream as a frequent authoring error. The plugin path just doesn't participate in that.

### Reproduction

1. In any plugin, place a valid workflow script at `<pluginRoot>/workflows/foo.mjs` with
   `export const meta = { name: 'foo', description: '...' }`.
2. Install the plugin, reload plugins.
3. `Workflow({name: "<plugin>:foo"})` → `not found`. No diagnostic is emitted anywhere.
4. Rename the file to `foo.js`, reload. It resolves immediately. Nothing else changes.

We confirmed step 4 against a live install: renaming one shipped file and reloading made the
workflow appear in the registry and execute.

### Requested change

A `warn`-level line in the plugin scanner when a near-miss extension is skipped, matching the
behaviour the user/project loader already has:

```
Skipping <path>: plugin workflows must use the .js extension
```

Counting it as `nearMissExt` for the plugin source too would be a bonus, but the log line alone
would have turned a multi-hour investigation into a single visible message.

### Why it is worth a log line rather than "just document it"

The failure is indistinguishable from every other reason a workflow might not appear, and every
adjacent signal reports success: the file is present in the installed cache, `plugin.json` is
valid, `meta.name` is correct, and the script executes on demand by path. There is no observable
difference between "dropped for the extension" and "loaded fine" until you invoke by name and get
a generic `not found` that lists only the bundled workflows.

### Environment

- Claude Code 2.1.228, macOS arm64
- Plugin installed from a marketplace, `workflows/` at the plugin root
- Docs referenced: `code.claude.com/docs/en/workflows` (plugin distribution + namespacing)
