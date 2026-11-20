# Stacked PRs

Loaded on demand from the "Stacked on another open PR" section of SKILL.md.

A stack is a chain of small PRs: the bottom one targets the trunk, each layer above targets the
branch below it. It exists so a 1,500 line feature can be reviewed as four readable pieces. The
cost is paid at landing time, and that is where every recipe below applies.

## Resolve the trunk, never type it

```bash
TRUNK=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
# empty? the symref is unset: git remote set-head origin -a
```

`main` is a guess. Repos run on `dev` and `develop`, and `main` often still exists beside them
as a release branch, so a hardcoded name silently targets the wrong one.

## Opening a layer

```bash
PARENT=50
PARENT_BRANCH=$(gh pr view "$PARENT" --json headRefName -q .headRefName)
PARENT_TIP=$(git rev-parse "origin/$PARENT_BRANCH")   # record it, you need it later

git fetch origin
git rebase "origin/$PARENT_BRANCH"
git push -u origin "$(git branch --show-current)"
gh pr create --base "$PARENT_BRANCH" \
  --title "feat(#$ISSUE): <layer> [2/3]" \
  --body "Stacked on #$PARENT (parent tip $PARENT_TIP). Do not merge into the parent branch."
```

Number the titles `[1/3]`, `[2/3]`, `[3/3]` so review order is visible. Keep each layer under
400 lines. Do not go deeper than 4 layers: CI runs multiply per layer, and a measured 3 layer
stack cost 24 runs.

## After the parent is squash-merged

The parent lands on the trunk as ONE new commit. The layer above still carries the parent's
original commits, so `git rebase "$TRUNK"` replays content the trunk already has and conflicts
on every commit. Use the onto form, which drops them:

```bash
git fetch origin
OLD_TIP=$(git rev-parse "origin/$BRANCH")   # the lease, read before rewriting
git rebase --onto "origin/$TRUNK" "$PARENT_TIP" "$BRANCH"
git push --force-with-lease="$BRANCH:$OLD_TIP" origin "$BRANCH"
```

If the parent tip was not recorded, it is still on the merged PR:
`gh pr view "$PARENT" --json headRefOid -q .headRefOid`. That field survives the branch delete.

The upstream argument is always the parent tip the branch actually contains. A third layer
re-parents onto layer 2's NEW tip first, then repeats this once layer 2 lands.

`--force-with-lease` with no value checks the local remote-tracking ref, which a background
fetch can update behind you. Name the branch and the sha.

## Traps, all four measured on a real 3 layer stack

1. **No ordinary auto-merge on a native stack layer.** GitHub refuses it; a layer lands through
   the stack merge API (`gh stack merge`), or the stack is hand chained and each layer lands
   normally once its base is the trunk.
2. **`gh stack submit --auto` opens every layer as a DRAFT.** A stack with a draft in it cannot
   merge, and nothing says so. Use `--auto --open`, or flip layers ready top down before
   landing.
3. **`gh stack init` reads the LOCAL `origin/HEAD`, which goes stale.** Pass the trunk
   explicitly: `gh stack init -b "$TRUNK"`. A stale symref silently builds the stack on the
   wrong branch.
4. **When the parent merges, the layer above never receives `edited`.** It receives
   `automatic_base_change_succeeded` and `head_ref_force_pushed` together as a pair, about two
   seconds after the merge. Automation keyed on `edited` never fires, and automation that waits
   for a second event after seeing the first is waiting for something that already arrived.

## Landing

Bottom up, always. Merging a layer into its parent branch instead of the trunk puts unreviewed
lines on the trunk when the parent lands, and a feature branch has no protection to stop it.
Never merge the trunk into a layer either: a merge commit inside a layer breaks the linear
history a stack needs to merge at all.
