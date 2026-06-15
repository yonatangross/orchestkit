---
title: Mark deliberate simplifications with a deferred-debt marker so they resurface when the trigger fires
impact: MEDIUM
impactDescription: "Deliberate shortcuts chosen to fit the current tier evaporate the moment they are made — six months on, nobody can tell which cuts were intentional vs accidental, so scaling work starts from a blind audit instead of a tracked ledger"
tags: [yagni, scope, technical-debt, deferred-debt, tier, under-engineering]
---

# Mark Deliberate Simplifications (Deferred-Debt Marker)

## Why

The YAGNI gate and the Tier + 2 rule PREVENT over-engineering — they stop you
building OAuth2+PKCE for a take-home or CQRS for a todo app. But once that
correct, tier-appropriate decision is made, it disappears: the code shows the
simple thing with no record that it was *chosen*, nor what should make you
revisit it.

A deferred-debt marker is the counterpart. It records the deliberate
*under*-engineering at the moment you choose it, together with the condition
that should trigger the upgrade. It is NOT a `TODO` — the `when <trigger>`
clause is what turns a forgettable note into a ledger entry that can tell you
*when* to act.

## Rule

When you deliberately pick a simpler implementation to fit the current tier,
drop an inline marker on the line where the shortcut lives:

```
// ork-debt: <choice>, upgrade to <path>, when <trigger>
```

- `<choice>` — the deliberate simplification you made
- `upgrade to <path>` — what to switch to later (optional but recommended)
- `when <trigger>` — the condition that should make you revisit (optional, but
  without it the marker degrades to a plain `TODO`)

The comment leader may be `//`, `#`, `--`, `;`, or a block-comment leader, so
the convention works across languages.

## Correct — record the cut and its trigger

```ts
// ork-debt: session cookies, upgrade to JWT + refresh tokens, when a 2nd service is added
const session = signCookie(userId);

# ork-debt: SQLite single-file, upgrade to Postgres, when concurrent writers > 1
db = sqlite3.connect("./app.db")
```

## Incorrect — the cut with no trace, or a bare TODO

```ts
// TODO: maybe use a real DB later
const session = signCookie(userId);
```

**Problems:**
- No record that the simple choice was *deliberate* (vs an oversight)
- No upgrade path — the next engineer re-derives it from scratch
- No trigger — nothing tells you *when* the cut stops being appropriate

## How it surfaces (automatic, no manual command)

Two hooks maintain the ledger for you in the background:

- `posttool/write/debt-marker-tracker` confirms capture the moment you write a
  marker.
- `instructions-loaded/debt-surfacer` greps the repo and injects a compact
  ledger summary into context at session start.

Opt out per hook with `ORK_DISABLE_DEBT_TRACKER=1` / `ORK_DISABLE_DEBT_SURFACER=1`.

## Relationship to other rules

- `over-engineering-flag.md` — flags building too much for the tier (prevent)
- `tier-detection-evidence.md` — establishes the tier this cut is scoped to
- **this rule** — records the deliberate too-little, so it is revisitable (record)
