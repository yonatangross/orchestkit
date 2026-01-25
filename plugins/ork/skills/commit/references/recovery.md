# Git Recovery

## Committed to Wrong Branch

```bash
# Save work to new branch
git checkout -b issue/<number>-<description>

# Reset original branch
git checkout dev
git reset --hard origin/dev

# Return to feature branch
git checkout issue/<number>-<description>
```

## Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1
```

## Undo Last Commit (Discard Changes)

```bash
git reset --hard HEAD~1
```

## Amend Last Commit

```bash
# Fix message only
git commit --amend -m "new message"

# Add forgotten files
git add forgotten-file.txt
git commit --amend --no-edit
```

## Revert Published Commit

```bash
git revert <commit-hash>
git push
```

## Unstage Files

```bash
git restore --staged <file>
```

## Discard Local Changes

```bash
# Single file
git restore <file>

# All files
git restore .
```