# Planted vulnerable fixture for the scheduled npm audit

`package-lock.json.fixture` pins lodash 4.17.20 on purpose, so a dispatched run of
`.github/workflows/npm-audit-scheduled.yml` with `plant_fixture` on has a known red to find.

The files carry a `.fixture` suffix so that no tool treats them as a real lockfile: `git ls-files '*package-lock.json'`
(the whole-tree discovery), Dependabot and the dependency graph never see them.
`.github/scripts/audit-whole-tree.sh --with-fixture` copies them into a temp directory under their real names and audits
that copy in addition to the real tree, never instead of it.
