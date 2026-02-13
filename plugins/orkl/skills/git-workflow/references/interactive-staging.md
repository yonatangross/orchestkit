# Interactive Staging with git add -p

Master `git add -p` (patch mode) for precise, atomic commits.

## Basic Usage

```bash
git add -p              # Stage all modified files interactively
git add -p file.ts      # Stage specific file interactively
```

## Prompt Options

When Git shows each hunk, you can respond with:

| Key | Action |
|-----|--------|
| `y` | Stage this hunk |
| `n` | Don't stage this hunk |
| `s` | Split into smaller hunks |
| `e` | Manually edit the hunk |
| `q` | Quit (keeps already staged) |
| `a` | Stage this and all remaining hunks in file |
| `d` | Don't stage this or any remaining hunks in file |
| `?` | Help |

## Example Session

```bash
$ git add -p

diff --git a/src/auth.ts b/src/auth.ts
@@ -10,6 +10,10 @@ export function login(user: string) {
+  // Validate input
+  if (!user) throw new Error('User required');
+
   const token = generateToken(user);
+  logAudit('login', user);  // Added for audit
   return token;
 }

Stage this hunk [y,n,q,a,d,s,e,?]? s  # Split it!

# Now shows smaller hunks...
@@ -10,6 +10,8 @@
+  // Validate input
+  if (!user) throw new Error('User required');

Stage this hunk? y  # Stage validation

@@ -14,6 +16,7 @@
+  logAudit('login', user);  # Added for audit

Stage this hunk? n  # Skip audit (different commit)
```

## Editing Hunks

Use `e` to manually edit when Git can't split small enough:

```bash
Stage this hunk? e

# Opens editor with:
# -context line
# +added line
# +another added line

# Delete lines you DON'T want staged
# Keep lines you DO want staged
# Save and exit
```

## Viewing What's Staged

```bash
# What will be committed
git diff --staged

# What won't be committed
git diff

# Summary
git status
```

## Tips

1. **Commit after staging**: Don't stage more until you commit
2. **Review before commit**: Always `git diff --staged`
3. **Use `s` liberally**: Split whenever possible
4. **Use `e` for precision**: Edit when split isn't enough
5. **Stage by file**: `git add -p file.ts` for focused work
