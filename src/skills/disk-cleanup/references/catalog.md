# disk-cleanup catalog and gates

Paths are relative to the home directory. A path that does not exist produces no row.
The list lives in `CATALOG` in `scripts/disk_cleanup.py`; add a row there and one test.

## Caches and stores

| id | tier | macOS | Linux | note |
|---|---|---|---|---|
| npm-cache | safe | `~/.npm/_cacache` | same | npm refills it |
| yarn-cache | safe | `~/Library/Caches/Yarn` | `~/.cache/yarn` | |
| pip-cache | safe | `~/Library/Caches/pip` | `~/.cache/pip` | |
| uv-cache | safe | `~/.cache/uv` | same | |
| cargo-registry | safe | `~/.cargo/registry/cache` | same | crates re-download |
| go-build | safe | `~/Library/Caches/go-build` | `~/.cache/go-build` | |
| homebrew | safe | `~/Library/Caches/Homebrew` | `~/.cache/Homebrew` | |
| xcode-derived-data | safe | `~/Library/Developer/Xcode/DerivedData` | none | next build is slower |
| browser-caches | safe | `~/Library/Caches/Google/Chrome`, `.../Chromium` | `~/.cache/google-chrome`, `~/.cache/chromium` | |
| agent-debug-logs | safe | `~/.claude/debug` | same | only files older than 14 days |
| agent-shell-snapshots | safe | `~/.claude/shell-snapshots` | same | only files older than 7 days |
| pnpm-store | regenerable | `~/Library/pnpm/store` | `~/.local/share/pnpm/store` | reinstall re-downloads |
| gradle-caches | regenerable | `~/.gradle/caches` | same | slow rebuild |
| playwright | regenerable | `~/Library/Caches/ms-playwright` | `~/.cache/ms-playwright` | browsers re-download |
| puppeteer | regenerable | `~/.cache/puppeteer` | same | |
| xcode-device-support | regenerable | `~/Library/Developer/Xcode/iOS DeviceSupport` | none | |
| agent-transcripts | ask | `~/.claude/projects` | same | session history, prints a `find ... -mtime +30 -delete` |
| codex-sessions | ask | `~/.codex/sessions` | same | same |
| downloads | ask | `~/Downloads` | same | prints a size listing, never a delete |
| trash | ask | `~/.Trash` | `~/.local/share/Trash` | |

Emptying a cache removes its contents and keeps the directory. A path that is a symlink is
reported as KEEP and never followed. A path that resolves outside the home directory, or
sits fewer than two levels below it, is refused.

## Docker

Read with `docker system df` and `docker images -f dangling=true`. Skipped quietly when the
`docker` binary is absent, with a caveat when the daemon is down.

| id | tier | action |
|---|---|---|
| docker-build-cache | safe | `docker builder prune -f` |
| docker-dangling-images | safe | `docker image prune -f` |
| docker-unused-images | regenerable | `docker image prune -a -f` |
| docker-volumes | ask | prints `docker volume prune`, never runs it |

## Worktrees

Found from the current repo or `--root DIR` (repos up to three levels deep). For each linked
worktree, in this order, the first match decides:

1. outside the home directory: KEEP
2. locked: KEEP
3. default branch unknown (`origin/HEAD`, then `origin/main`, `origin/master`): KEEP
4. process list unreadable: KEEP. A process whose working directory is inside: KEEP
5. any line in `git status --porcelain` (dirty or untracked): KEEP
6. changed within `--idle-minutes` (default 60): KEEP
7. tip is an ancestor of the default branch: REGENERABLE "merged"
8. `gh pr list --state merged` has the branch with a head sha equal to the local tip: REGENERABLE "merged PR"
9. otherwise ASK FIRST, "unmerged" or "detached", with the commit count ahead

Squash merges defeat git ancestry, which is why step 8 asks GitHub. Without `gh` those trees
stay ASK FIRST and a caveat says so. A tree whose directory is gone is a SAFE `git worktree prune`.

Why the gates exist: a merged-looking, clean tree can still hold unique work (about one in
four in an early measurement), an idle shell can hold a tree's directory, and a dirty tree in
a shared checkout can be another agent's live work. Classify first, delete only what the
content proves.

## Processes

Report only. A process with parent 1, owned by the current user, older than 24 hours, whose
command matches headless browsers, agent-browser, mcp, `http.server` or portless is listed
ASK FIRST with a `kill PID` line. The script never kills anything.

## Exit codes

0 clean, or every applied action succeeded. 2 could not look or refused (bad home, unsupported
platform, foreign report file). 3 findings in a dry run, or at least one action failed.
