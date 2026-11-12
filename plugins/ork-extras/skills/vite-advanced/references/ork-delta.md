# Vite: the OrchestKit delta

Vite's own documentation is the source of truth for API surface, config keys, and
migration mechanics. This file holds only the house rules that vendor docs do not
state, plus the ones we hold harder than upstream does.

Vendor topics and where to fetch them live in the "Upstream coverage" table in
`SKILL.md`. The enforceable house subset for chunks, environments, library mode,
and plugin hooks lives in `rules/*.md` and is not repeated here.

## Default new Vite projects to 8; route existing production apps through rolldown-vite first

Vite 8's Rolldown pipeline changes bundler internals, not just config names, so a
large existing app can pass `vite build` and still ship different chunk graphs and
different tree-shaking outcomes. `rolldown-vite` is a one-line import swap that runs
the new bundler under the old package boundary, which makes it the cheap way to find
plugin incompatibilities before committing the upgrade. Greenfield work skips the
staging step and goes straight to `vite@8`.

Why: house decision, distilled from the retired references/vite8-rolldown.md; no traced incident.
Upstream: https://vite.dev/guide/rolldown

## Treat every VITE_-prefixed variable as public bundle content

Vite inlines `VITE_*` variables into the client bundle at build time. Anything put
there is readable by any visitor with devtools, so it is not a secret, not a
"private" API key, and not a soft-launch flag. Secrets belong on the server side of
whatever renders the app. Check `.env.production` against this rule before deploy,
not after.

Why: house security posture, distilled from the retired checklists/production-build.md; no traced incident.
Upstream: https://vite.dev/guide/env-and-mode

## Ship production sourcemaps as false or 'hidden', never true or inline

`sourcemap: true` publishes readable source next to the bundle; `'inline'` also
inflates every JS file. `'hidden'` emits the maps for an error reporter to upload
without referencing them from the shipped bundle, which is the only setting that
gives usable stack traces without publishing the source.

Why: house decision, distilled from the retired checklists/production-build.md; no traced incident.
Upstream: https://vite.dev/config/build-options

## Hold the house production build budget before deploying

These are the numbers a build is measured against, not Vite defaults:

| Metric | Budget |
|--------|--------|
| Initial JS | < 200 kb gzipped |
| Main chunk | < 150 kb |
| Vendor chunk | < 100 kb |
| CSS | < 50 kb |
| LCP | < 2.5 s |
| TTI | < 3.5 s |

A build over budget is a blocked deploy, not a warning. Vite's own
`chunkSizeWarningLimit` only prints a message and exits 0, so it cannot be the gate.

Why: house budget, distilled from the retired checklists/production-build.md; no traced incident.
Upstream: https://vite.dev/config/build-options

## Prove a build with vite preview, not with a green vite build

`vite build` exiting 0 says the bundler finished, not that the app runs. Base-path
mistakes, missing `public/` assets, and env vars that were only defined in dev all
survive a successful build and fail on first load. Serve the built output with
`vite preview`, walk the routes, and confirm the console is clean before calling a
build shippable.

Why: house verification gate, distilled from the retired checklists/production-build.md; no traced incident.
Upstream: https://vite.dev/guide/static-deploy

## Keep chunk names stable when migrating manualChunks to advancedChunks

Renaming a chunk group changes its output filename, which invalidates that chunk for
every returning visitor even when its contents did not change. Carry the existing
`name` values across the migration and make the old implicit ordering explicit with
`priority` instead of reshuffling groups.

Why: house decision, distilled from the retired references/chunk-optimization.md; no traced incident.
Upstream: https://vite.dev/guide/rolldown

## Diff bundle-visualizer output before and after any chunk-config change

Chunk config is guesswork until the graph is inspected. Capture a visualizer run
before the change and one after, then compare chunk count, per-chunk size, and
duplicate packages. A change that only moves bytes between chunks without shrinking
the initial payload is not an improvement.

Run it with `npx vite-bundle-visualizer`.

Why: house verification gate, distilled from the retired references/chunk-optimization.md; no traced incident.
Upstream: https://github.com/btd/rollup-plugin-visualizer (the tool itself; Vite's build guide does not document it)

## Clear node_modules/.vite before blaming a plugin for an unresolved import

Vite caches pre-bundled dependencies under `node_modules/.vite`. After a dependency
swap, a lockfile change, or a worktree switch, that cache can serve a stale module
graph and produce "cannot find module" for modules that plainly exist. Delete the
cache directory or rerun with `--force` and reproduce before editing plugin code.

Why: house debugging order, distilled from the retired checklists/production-build.md; no traced incident.
Upstream: https://vite.dev/guide/dep-pre-bundling
