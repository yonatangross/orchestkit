# Safe deletes and index rotation

Two recovery mechanisms for STEP 5. Both exist because of the same fact stated in
STEP 2d: **memory files are not in git, so a wrong delete is silent and
unrecoverable.** Every guard upstream of STEP 5 reduces how often a wrong delete
happens. Neither of these reduces that; they make the wrong delete survivable.

## 1. Delete to a trash directory, never `rm`

The Live Mode block deletes with `rm` in three places (fully-stale, duplicate,
contradicted). Replace each with a move into a dated trash directory under the
memory dir.

```python
from datetime import date
trash = f"{memory_dir}/.trash/{date.today().isoformat()}"
Bash(command=f"mkdir -p '{trash}'")

# Was: Bash(command=f"rm '{path}'")
Bash(command=f"mv '{path}' '{trash}/'")
```

Rules:

- **One directory per run date**, so a bad run is one directory to inspect and
  the blast radius of any single dream is legible.
- **Never `mv` over an existing name.** Two runs on the same day can select the
  same filename; `mv -n` refuses silently, which is the failure mode this whole
  file exists to prevent. Test first and suffix on collision:
  `[ -e "$dest" ] && dest="${dest%.md}.2.md"`.
- **Sweep on the NEXT run, not this one.** Deleting a 7-day-old trash directory
  at the start of a run means a session that dreams twice in one day still has
  yesterday's safety net. Sweeping at the end means a crash mid-run leaves the
  net in place, which is the correct bias.
- `.trash/` must be excluded from the file walk in STEP 1, or the next run will
  re-triage everything it just deleted and conclude the memory dir is full of
  duplicates. This is the single most likely way to get this wrong.

Sweep, at the START of a run:

```python
Bash(command=f"find '{memory_dir}/.trash' -maxdepth 1 -type d -mtime +7 -exec rm -rf {{}} +")
```

## 2. Rotate MEMORY.md before overwriting it

The rebuild ends in a single-shot `Write(path=".../MEMORY.md", ...)`. That write
is the one irreversible step in the whole skill: it replaces the pointer table for
every surviving memory in one operation, and a truncated or mis-generated index
silently degrades every later session rather than failing loudly.

```python
# BEFORE the Write, keep exactly one generation back.
Bash(command=f"[ -f '{memory_dir}/MEMORY.md' ] && cp '{memory_dir}/MEMORY.md' '{memory_dir}/.MEMORY.md.prev'")
Write(path=f"{memory_dir}/MEMORY.md", content=rebuilt_index)
```

One generation is deliberate, not a compromise:

- The failure this catches is **"the rebuild I just ran was wrong"**, which is
  noticed within the same session or the next one. A deeper history answers a
  question nobody asks.
- `MEMORY.md` is loaded every session, so a `.MEMORY.md.*` family in the same
  directory risks the walker picking up a rotation as a memory file. One
  dot-prefixed fixed name has no such ambiguity.

### Verify the rotation is a rotation, not a copy of the damage

Rotating **after** a bad write preserves the bad write. Order matters, so assert
it: the copy must happen while the old bytes are still on disk. A cheap check
that catches the inverted order is that `.MEMORY.md.prev` and `MEMORY.md` must
differ whenever the entry count changed.

```python
prev = int(Bash(command=f"grep -c '^- \\[' '{memory_dir}/.MEMORY.md.prev' 2>/dev/null || echo 0"))
now  = int(Bash(command=f"grep -c '^- \\[' '{memory_dir}/MEMORY.md'"))
```

Note the `|| echo 0` there is safe **only** because a missing prev file on a
first-ever run is genuinely zero. Do not copy that idiom to the `now` read: a
`grep -c` failure there would report an empty index as a successful one, which is
exactly the silent-degradation class this section is guarding against.

## What neither of these fixes

Both are recovery, not prevention. They do nothing about a memory that was
correctly deleted but should not have been written in the first place, and
nothing about an index that is well-formed but wrong. The STEP 2d staleness
guards remain the primary control; this file is the seatbelt, not the brakes.
