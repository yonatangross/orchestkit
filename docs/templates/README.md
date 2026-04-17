# Documentation Templates

Reusable starting points for recurring PR/docs artifacts. Copy-paste, fill in `[[TODO]]` placeholders, ship.

## `pr-playground.html`

Minimum viable PR playground that satisfies the PR Playground CI check (~2 KB baseline — previous PRs have run from 2 KB to 21 KB; bigger isn't better).

**Usage:**

1. Copy to `docs/{prefix}--{branch-slug}/{short-name}.html`
   The prefix must match the branch type — `feat/foo-bar` → `docs/feat--foo-bar/`,
   `chore/baz` → `docs/chore--baz/`, `fix/qux` → `docs/fix--qux/`, etc.
   The CI check derives the expected dir name from the branch, so this has to match.
2. Fill in the four `[[TODO]]` sections: title, badges, at-a-glance stats, issue/file rows
3. Force-add (the `docs/{prefix}--*/` dirs are gitignored): `git add -f docs/{prefix}--{branch-slug}/`
4. Reference from the PR body:
   ```
   ## Interactive Playground

   **[Open Playground](https://htmlpreview.github.io/?https://github.com/yonatangross/orchestkit/blob/{branch}/docs/{prefix}--{branch-slug}/{short-name}.html)**
   ```

**When to extend beyond the template:**
- PR introduces a new interactive dimension worth exploring (e.g., effort-level slider, filter-by-kind, before/after toggle)
- PR's story is hard to tell in just an issue list — add a diagram section

**When NOT to extend:**
- Single-feature PR where the title + issue list + diff already explains it
- Internal refactor / bugfix PRs — reviewers spend ~30 seconds on the playground
- When the interactive bits would just restate what's in the PR body
