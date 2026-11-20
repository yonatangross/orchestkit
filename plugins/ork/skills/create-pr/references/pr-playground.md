# Phase 4b: Generate PR Playground (REQUIRED — CI blocks without it)

Generate an interactive HTML playground visualizing the PR's changes. CI validates `docs/{branch-name}/*.html` exists.

> **Requires** the `playground` plugin (external): `/plugin marketplace add anthropics/claude-plugins-official && /plugin install playground`

**First classify the archetype** — a feature PR must not ship as a flat dashboard.
`Read("${CLAUDE_PLUGIN_ROOT}/shared/rules/playground-visual-standard.md")` and apply its §0 routing rule:

- **Visual PR** (adds/changes a user-facing feature, flow, or a prioritization/decision surface) →
  **USER-STORY PLAYER** or **DECISION BOARD**. Build to the standard: adapt the matching exemplar at
  `${CLAUDE_PLUGIN_ROOT}/shared/assets/playground-exemplars/` (`user-story-player.template.html`
  or `decision-board.template.html`), and bring full design firepower (the `frontend-design` skill /
  the `ork:frontend-ui-developer` agent). When delegating to `playground:playground`, brief it with the
  **archetype + persona + tokens** — never hand it a pre-built HTML blob.
- **Non-visual PR** (infra/CI/refactor/config/docs) → **DASHBOARD** — the default summary below is fine.

```python
BRANCH=$(git branch --show-current)
BRANCH_DIR = BRANCH.replace("/", "--")  # feat/foo → feat--foo

# Invoke the playground skill with a summary of the PR changes.
# For a VISUAL PR, set archetype/persona/exemplar per playground-visual-standard.md instead of this default.
Skill("playground:playground", args=f"""
  {PR_TITLE} — visualize the key changes in this PR.
  Archetype: <user-story-player | decision-board | dashboard> per playground-visual-standard.md §0.
  For visual archetypes: follow that standard's tokens/glass/motion and adapt the matching exemplar.
  Show: architecture/data flow, before/after, key components changed; presets for the main change areas.
  Dark glass theme, OrchestKit brand accents.
""")

# The playground skill writes to a temp path — move it to the correct location
# Ensure file lands at: docs/{branch-dir}/<name>.html
Bash(f"mkdir -p docs/{BRANCH_DIR}")
Bash(f"mv /tmp/*.html docs/{BRANCH_DIR}/playground.html 2>/dev/null || true")

# Force-add (docs/feat--*/ is gitignored by design)
Bash(f"git add -f docs/{BRANCH_DIR}/")
Bash(f'git commit -m "docs: add PR playground for {BRANCH}"')
Bash(f"git push origin {BRANCH}")
```

Resolve the head SHA first, and pin the link to it:

```bash
Bash("git rev-parse HEAD")   # -> {HEAD_SHA}
```

Add a "Live Preview" section to the PR body:

```markdown
## Live Preview

**[Open Interactive Playground](https://github.com/{OWNER}/{REPO}/blob/{HEAD_SHA}/docs/{BRANCH_DIR}/playground.html)**
```

> **First-party link only.** Do not wrap the URL in `htmlpreview.github.io` or any
> other render proxy. A proxy serves the repo's HTML from an origin the project does
> not control, with none of its CSP applied. The plain blob link shows source rather
> than a rendered page; that is the accepted trade-off for not handing a third party
> the content. To get a *rendered* first-party page, publish the playground to the
> Lab instead: add `docs/site/lab-manifest/<slug>.json` (one fragment per entry) and
> run `npm run build`, which serves it under the site's own `/lab` CSP. The
> `lab-data.ts` aggregate is generated at build, dev and test time and is not
> committed, so there is no conflict to resolve on it: publish a playground with
> one fragment under `docs/site/lab-manifest/` and rebuild.

> **Pin the SHA, never the branch.** GitHub deletes the head branch on merge, so a
> `blob/{BRANCH}/` URL returns 404 the moment the PR lands. That silently broke the
> playground link on every merged PR through #3147. A commit SHA stays reachable
> indefinitely because GitHub retains `refs/pull/<N>/head`, so the same URL works
> during review and after merge. Verified: branch form 404, SHA form 200, on a PR
> whose branch was already deleted.

> **Why required:** CI Stage 1d (`playground-check`) blocks merge if `docs/{branch-dir}/*.html` is missing. Bot PRs (dependabot, release-please) are exempt.
