# Cross-Model Adversarial Refuter (provenance + cost gate)

Operational doc for the optional **cross-model** lane of the adversarial-refutation engine, used by `review-pr` (Phase 4.5) and `assess` (Phase 2.5). Loads on top of the engine (`${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/adversarial-refutation.md`) and the skill's bindings adapter — this file only adds the alternate-model wiring.

> Pseudocode below is **illustrative prompt-doc**, not a real API — function names (`build_neutral_claim()`, `run()`, etc.) name the steps Claude performs, not symbols to import.

## Why a different model at all

Same-model refuters (engine §1–§10) buy **variance reduction**, not independent bias correction — N Claude agents share blind spots ("Known residual bias"). A refuter on a *different* model family (Codex / GPT) has a **different failure surface**: it misses different things, so a finding that survives both a Claude producer AND a non-Claude refuter is structurally harder to fake. This lane changes *who* judges, not *how*.

It is **off by default**. Diversity costs money, latency, and an egress hop; the homogeneous lane is correct for the overwhelming majority of reviews.

## Default-OFF precondition gate (ALL must hold)

```
cross_model_enabled =
      effort in {high, xhigh}                       # never on low/medium
  AND alt_model_cmd_present()                        # a configured non-Claude CLI
  AND finding.tier in {request-changes-blocker, CRITICAL, HIGH}   # decision-bearing only
  AND ORK_CROSS_MODEL != "0"                         # explicit kill switch, checked first
  AND under_cross_model_budget()                     # see Cost gate
```

If any clause is false → run the **same-model** lane exactly as today (engine §4 quorum). Cross-model NEVER replaces the same-model pass — it is an *additional* blind refuter slot, so a misconfigured or down alternate model degrades to today's behavior, never to "no refutation".

### `alt_model_cmd_present()` — transport (no credentials in-process)

```
ORK_ALT_MODEL_CMD set  → a shell command that takes a prompt on stdin and emits refuter
                         JSON on stdout (e.g. `codex exec --json`, `llm -m gpt-...`).
                         This is the ONLY transport. The skill never reads a provider key
                         from the environment and never opens a socket itself — routing is
                         delegated to a CLI the user already trusts and configured.
else                   → cross-model UNAVAILABLE. Skip silently with one WARN:
                         "cross-model refuter: no ORK_ALT_MODEL_CMD — same-model lane only".
```

House posture (mirrors the network-egress guard #2533): the skill must not own credentials or open egress. It shells out to a user-configured command, exactly like `gh`/`glab`; that command's egress is the user's explicit choice, surfaced once.

## Provenance — labeled, but **not** a trust boundary

Every cross-model artifact is stamped so a wrong call is traceable:

- each refuted finding gains `refuter_model` (e.g. `"gpt-5-codex"`) + `refuter_lane: "cross-model"` (same-model gets `"same-model"`); the report renders a `🔀 cross-model` tag and a footer (`Refuters: 4 same-model, 2 cross-model (gpt-5-codex)`); the engine §10 ledger carries `refuter_model`/`refuter_lane` per vote.

**Honesty:** `refuter_model` is **best-effort attribution derived from the CLI's output, NOT a verified trust boundary** — a wrapper can emit any banner it likes. Do not treat the label as proof of which model ran. The actual gaming protection is the citation-verify gate + zero-weight-on-agreement + no-auto-flip (see Anti-gaming), which hold *regardless* of the label.

A cross-model refuter is bound by the same blindness contract (engine §1): neutral claim + raw diff slice + rubric excerpt only — never the producer's score, identity, or prose. The transport difference grants no relaxation.

## Quorum interaction (a slot, not a veto)

Cross-model adds ONE diverse refuter into the engine §4 quorum — it **substitutes** one same-model slot, never inflates the count or the §8 spawn ceiling (24/run).

| Finding tier | Same-model | + Cross-model | Rule |
|---|---|---|---|
| request-changes blocker | 2 (was 3) | 1 | majority of 3; cross-model counts once, like any refuter |
| CRITICAL / HIGH | 1 (was 2) | 1 | majority of 2 → tie = UPHELD (engine §4: no lone kill flips a verdict) |
| advisory | 1 | 0 | cross-model never spawned for advisory findings |

A 1-of-N cross-model dissent follows engine §4: records a caveat, drops the finding's confidence to "low", never revises alone. The no-auto-flip gate (engine §7) is untouched: a cross-model KILL of a `request-changes` blocker still requires explicit user confirmation before the verdict moves.

## Cost gate

Cross-model is the only lane that can bill an external provider, so it is hard-capped:

```
under_cross_model_budget() =
      cross_model_spawns_this_run < ORK_CROSS_MODEL_MAX        # default 4
  AND finding ranked top-K by (severity-weight x distance-from-decision-boundary)
```

- Default cap **4** cross-model spawns/run (inside the engine §8 ceiling). `ORK_CROSS_MODEL_MAX=0` disables; `ORK_CROSS_MODEL=0` is the master kill switch (checked first).
- Over the cap → refute the top-K cross-model, the rest **same-model only**, flagged `cross_model: "skipped — budget"` in the report (never silently truncated, engine §8).
- One-line cost disclosure before the first spawn (shown, not prompted — the gate already required a key + high effort): `🔀 Cross-model refutation: up to N calls to <model> via ORK_ALT_MODEL_CMD (external, billed by your provider). Set ORK_CROSS_MODEL=0 to skip.`

## Run loop (per qualifying finding — illustrative)

```
for finding in qualifying_findings_ranked:            # engine §8 dedup + rank first
    same  = spawn_same_model_refuters(finding)         # engine §4 quorum, minus 1 slot if X-model on
    cross = None
    if cross_model_enabled and under_cross_model_budget():
        claim = build_neutral_claim(finding)           # engine §1 blindness — no producer value
        diff  = changed_files_slice(finding.file, finding.line)
        out   = run(ORK_ALT_MODEL_CMD, stdin=render_refuter_prompt(claim, diff, rubric_excerpt))
        cross = parse_refuter_json(out)                # {verdict, independent_band, citation}
        cross.refuter_model = detect_model_label(out) or "alt-model"   # best-effort, not trusted
        cross.refuter_lane  = "cross-model"
    votes = same + ([cross] if cross else [])
    for v in votes:
        if v.verdict in {KILL, OVERTURN, DOWNGRADE} and not reopen_and_verify_citation(v.citation):
            v.verdict = UPHELD                          # engine §3: unverifiable cite → UPHELD
    outcome = engine_quorum_decision(finding, votes)    # engine §4; no-auto-flip §7
    ledger_append(finding, votes, outcome)              # engine §10 + refuter_model/lane
```

A cross-model vote that fails to parse, times out, or returns no citation → treated as **UPHELD** (engine §3). A flaky alternate model can never *weaken* a finding.

## Decision / reset rules

- **Disagreement** (Claude UPHELD, cross-model KILL or vice-versa): never auto-resolve toward the kill. Surface BOTH bands + citations; outcome = `survived`, `cross_model_dissent: true`, confidence "low". A Claude/Codex split is exactly the diversity you paid for — show it to the human.
- **Reset** (CLI fails mid-run — rate limit, auth expiry): stop spawning cross-model, log `cross_model: degraded — same-model only from finding #k`, finish on the same-model lane. Never block a review on an external dependency.
- **Until blocking findings clear:** cross-model only re-runs on findings still tagged `request-changes-blocker` / `CRITICAL` / `HIGH` after producer fixes; a finding that drops below HIGH or a verdict that reaches `approve` falls out of scope automatically (the precondition gate re-evaluates `finding.tier` each pass).

## Scope (v1)

The engine names three consumers: `assess`, `review-pr`, `audit-full`. v1 wires the cross-model lane into **review-pr** (Phase 4.5) and **assess** (Phase 2.5). `audit-full` inherits the engine §11 *principle* but gets **no Phase pointer in v1** (out of scope) — wire it in a follow-up if its single-pass audit grows a refutation phase.

## Anti-gaming guardrail

**The one way it gets gamed:** route the "cross-model" refuter to a weak/sycophantic model (or a same-Claude command mislabeled as "gpt") so cross-model findings rubber-stamp the producer — diversity theater.

**Why it can't work** — net, not by the label: (1) a cross-model refuter can only KILL/DOWNGRADE through the engine §3 citation-verify gate, which the **orchestrator (Claude, not the alt model)** runs — it re-opens the cited `file:line` and confirms support; an unverifiable cite → UPHELD, so a sycophantic "looks fine, KILL it" does nothing. (2) A cross-model *agreement* with the producer carries **zero** extra weight — it cannot raise a score or clear a blocker (engine §7 no-auto-flip). (3) `refuter_model` is best-effort attribution, **not** a trust check — but it doesn't need to be, because (1) and (2) bound a captured alt-model to discardable noise regardless of its self-reported label.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Read a provider key from env and POST to the API | skill owns credentials + opens egress (violates #2533) | shell `ORK_ALT_MODEL_CMD` only; key stays in the user's CLI |
| Cross-model on by default when a key exists | cost/latency/egress on every review | gate on effort high/xhigh AND decision-bearing tier AND kill switch |
| Let a cross-model KILL flip request-changes→approve | external model silently clears a real bug | engine §7 no-auto-flip; explicit user confirm |
| Trust the alt model's self-reported name as a check | "gpt" label on a Claude command = fake diversity | label is best-effort only; rely on citation-verify + zero-weight-agreement |
| Cross-model *adds* a refuter on top of the quorum | inflates spawn count + cost | it SUBSTITUTES one same-model slot; total unchanged |
| Skip same-model when cross-model is on | one external model becomes a lone judge | cross-model is always additive to ≥1 same-model refuter |
| Hard-fail the review when the CLI is down | external dependency blocks merge | degrade to same-model, log `degraded`, finish |
| Forward the producer's score to the alt model "for context" | breaks blindness (engine §1) | neutral claim + raw diff slice only |
