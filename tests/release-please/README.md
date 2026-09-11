# Release exclusion regression (#4066)

The pinned release-please-action v5.0.0 bundles release-please **17.6.0**.
This focused unit test uses that package's actual commit filter, conventional
commit parser and changelog writer. It needs no GitHub token or API calls and
does not create a release or PR. Install the test dependency outside the repo:

```sh
proof_dir=$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")
pnpm --dir "$proof_dir" add --save-exact release-please@17.6.0 --ignore-scripts
RELEASE_PLEASE_ROOT="$proof_dir" node --test --test-concurrency=1 tests/release-please/exclude-paths.test.cjs
```

This is an explicit, standalone test; the ordinary local suites do not install
release tooling or run it. Rerun it when changing exclusions or the pinned action.
The fixture records the actual #4057 squash commit, which touched only `docs/`
(including one playground source outside `docs/site/`). A second case isolates
`docs/site/vitest.site.config.ts` to prove site-only inclusion independently.

The config excludes the prose collections `docs/adr`, `docs/audits`, and
`docs/catalog-currency-audit`. Shipped `docs/site/**`, including MDX, remains
eligible. Standalone Markdown directly under `docs/` and other docs directories
are eligible too: release-please 17.6.0 matches **directory prefixes only**, not
globs or individual files. `docs/**/*.md`, `!docs/site`, and a list of Markdown
file names would silently fail to exclude prose. See upstream
[commit-exclude.ts](https://github.com/googleapis/release-please/blob/v17.6.0/src/util/commit-exclude.ts).

Mutation proof: temporarily restore `["docs"]` in the root config and run the
same command. The real #4057, isolated site file and mixed-file cases fail.
Set exclusions to `[]` and all three prose cases fail. Restore the config and
rerun the command; all seven tests must pass.
