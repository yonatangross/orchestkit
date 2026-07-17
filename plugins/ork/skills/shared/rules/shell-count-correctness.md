---
title: "Shell Count Correctness"
impact: HIGH
impactDescription: "Counting lines or files in shell is the most common thing our audit and telemetry scripts do, and every recipe below has already shipped a wrong number in this repo. A count that is silently low reads as a passing gate."
tags: [shell, bash, counting, wc, grep, xargs, audit, correctness]
---

# Shell Count Correctness

> **Load when:** writing or reviewing a shell pipeline that counts lines, files, or
> occurrences — especially one that feeds a gate, a budget, or a report.

A wrong count does not crash. It returns a plausible smaller number, the gate goes
green, and nobody looks again. Every rule here is falsifiable in one command, and
each one fixed a real defect in this repo.

---

## `wc -l` counts newlines, not lines

A file whose last line has no trailing newline reports one line fewer than it has.

```bash
printf 'a\nb\nc' > f.txt   # three lines, no trailing newline

wc -l < f.txt              # 2   <- WRONG
grep -c '' f.txt           # 3   <- right
```

**Incorrect** — a 501-line file passes a 500-line gate:
```bash
LINE_COUNT=$(wc -l < "$SKILL_MD" | tr -d ' ')
(( LINE_COUNT > 500 )) && fail
```

**Correct:**
```bash
LINE_COUNT=$(grep -c '' "$SKILL_MD")
(( LINE_COUNT > 500 )) && fail
```

Shipped here: 132 `.md` files in this repo lack a trailing newline, and the
`audit-skills` 500-line gate under-reported each of them by exactly one line.

---

## `xargs wc -l | tail -1` drops every batch but the last

`xargs` splits a long argument list into batches. `wc` prints a `total` line **per
batch**, so `tail -1` keeps only the final one.

```bash
# 6000 files x 10 lines = 60000
find . -name '*.txt' -print | xargs wc -l | tail -1   # 10000  <- WRONG (-83%)
```

**Incorrect:**
```bash
lines=$(find "$DIR" -name "*.$ext" -print | xargs wc -l | tail -1 | awk '{print $1}')
```

**Correct** — one count per file, summed:
```bash
lines=$(find "$DIR" -name "*.$ext" -exec grep -ch '' {} + | awk '{s+=$1} END{print s+0}')
```

This one recipe fixes three traps at once: it sums every batch, `grep -c ''` counts
lines rather than newlines, and nothing parses a filename (so newlines in filenames
cannot inflate it). It also prints `0` on an empty file list instead of hanging.

Shipped here: `audit-full`'s token estimator under-reported `.md` by **94.7%**
(40,267 vs 756,671 real lines) on this repo.

---

## `cat a b` glues the boundary when a file lacks a trailing newline

```bash
printf 'error' > f1        # no trailing newline
printf 'error\n' > f2

cat f1 f2 | grep -c error  # 1   <- WRONG, produced the literal "errorerror"
grep -hc error f1 f2 | awk '{s+=$1} END{print s}'   # 2  <- right
```

Process files separately whenever a boundary can carry meaning. This is why the
estimator fix above uses `grep -ch` rather than `xargs -0 cat | wc -l`.

---

## `sort` before `uniq`

`uniq` only collapses **adjacent** duplicates.

```bash
printf 'b\na\nb\n' | uniq | wc -l        # 3  <- WRONG
printf 'b\na\nb\n' | sort | uniq | wc -l # 2  <- right
```

---

## Never parse a count out of decorated output

Taking "the first integer you can find" reads whatever happens to appear first —
including a digit inside a filename.

**Incorrect:**
```python
num = re.findall(r"-?\d+", out)[0]
#   "access2.log:7"      -> 2    (the digit came from the FILENAME)
#   "a.log:3\nb.log:99"  -> 3    (every later file silently dropped)
```

**Correct** — compare whole output, or parse a known shape:
```python
int(out.strip())            # typed, fails loudly on surprise
```
```bash
grep -c pattern file | tr -d ' '     # exact, one value by construction
```

---

## Quick reference

| Goal | Don't | Do |
|---|---|---|
| Lines in one file | `wc -l < f` | `grep -c '' f` |
| Lines across many files | `xargs wc -l \| tail -1` | `find … -exec grep -ch '' {} + \| awk '{s+=$1} END{print s+0}'` |
| Count across file boundaries | `cat a b \| grep -c x` | `grep -hc x a b \| awk '{s+=$1} END{print s}'` |
| Unique values | `uniq` | `sort \| uniq` |
| Read a count from output | first-integer regex | exact compare / typed parse |
