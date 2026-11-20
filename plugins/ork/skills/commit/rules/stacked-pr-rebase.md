---
title: Rebase a stacked PR with the onto form after its parent is squash-merged
impact: HIGH
impactDescription: "A plain rebase after a squash merge replays commits the trunk already contains and conflicts on every one; the onto form drops them"
tags: stacked-prs, rebase, force-with-lease, git, merge-conflicts, squash
---

## Stacked PR Rebase Management

Keep stacked branches synchronized after feedback, after the parent moves, and after the
parent lands.

### Resolve the trunk, never type it

The trunk is whatever `origin/HEAD` points at. It is `dev` in some repos and `develop` in
others, and `main` can exist as a release branch in both.

```bash
TRUNK=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
TRUNK=${TRUNK:-$(git config --get init.defaultBranch)}   # symref unset? set it:
# git remote set-head origin -a
```

**Incorrect, merging the trunk into a layer:**
```bash
git checkout feature/auth-service
git merge "$TRUNK"   # a merge commit inside a layer breaks stack linearity
```

### While the parent is still open

The parent's tip only moves forward here, so a plain rebase is correct and cheap.

```bash
git fetch origin
git checkout feature/auth-service
git rebase origin/feature/auth-base
git push --force-with-lease=feature/auth-service:"$(git rev-parse origin/feature/auth-service)" \
  origin feature/auth-service
```

`--force-with-lease` with no value checks the local remote-tracking ref, which a background
fetch can update behind you; naming the branch and the sha you actually expect is what makes
the check mean something.

### After the parent is SQUASH-merged

Record the parent tip **before** the merge. Once the branch is deleted that sha survives only
as the merged PR's `headRefOid` (`gh pr view <N> --json headRefOid`).

```bash
OLD_PARENT=$(git rev-parse origin/feature/auth-base)   # BEFORE the parent merges
```

A squash puts the whole parent on the trunk as **one new commit**. The layer above still
carries the parent's original commits, so `git rebase "$TRUNK"` replays every one of them
against content the trunk already has and conflicts on each. Drop them instead:

```bash
git fetch origin
OLD_TIP=$(git rev-parse origin/feature/auth-service)   # the lease, read before rewriting
git rebase --onto "origin/$TRUNK" "$OLD_PARENT" feature/auth-service
git push --force-with-lease=feature/auth-service:"$OLD_TIP" origin feature/auth-service
gh pr edit 102 --base "$TRUNK"   # only if GitHub did not retarget it already
```

The `<upstream>` argument is always the parent tip the branch actually contains, so a deeper
layer re-parents onto layer 2's NEW tip first, then repeats this after layer 2 lands.

### What the retarget looks like from the outside

On a native GitHub stack, when the parent merges the layer above receives
`automatic_base_change_succeeded` and `head_ref_force_pushed` together as a pair, about two
seconds after the merge. It never receives `edited`. Never key automation on `edited`, and
never wait for a second event after seeing the first: both arrive together.

**Key rules:**
- Read the trunk from `origin/HEAD`; never hardcode `main`
- Rebase, never merge the trunk into a layer: a merge commit makes the stack unmergeable
- After a squash, use `git rebase --onto <trunk> <old-parent-tip> <branch>`
- Always `--force-with-lease=<branch>:<expected-sha>`, never bare `--force`
- Rebase in dependency order: the layer closest to the trunk first
