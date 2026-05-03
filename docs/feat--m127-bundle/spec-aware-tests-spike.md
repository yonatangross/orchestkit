# Spike: spec-aware test assertions (#1564)

**Branch:** `feat/m127-bundle` · **Date:** 2026-05-03 · **Status:** spike output, decision made

## TL;DR

**Decision: extend `/ork:expect` with a `captureSpec()` step + `expect.spec.<path>` assertion type.** Do **not** build a separate `/ork:test-spec` skill.

## Goal of the spike

Validate the test abstraction proposed in #1564:

> Drive a UI via agent-browser, capture the rendered spec at any moment via
> json-render devtools observer, and assert on the spec's *shape* instead of
> CSS classes or aria attributes.

Output: enough certainty to either commit to building it or kill the issue.

## Inputs verified

| Capability | Source | Status |
|---|---|---|
| agent-browser stable tab IDs + `--label` | `src/skills/browser-tools/SKILL.md` (0.26 line) | ✓ exists |
| json-render devtools 0.18 with action observer infrastructure | `src/skills/json-render-catalog/SKILL.md` ("action observer infrastructure exposed for adapters to mirror events into the panel") | ✓ exists |
| Six-tab inspector (Spec / State / Actions / Stream / Catalog / Pick) | same | ✓ exists |
| `evaluate()` execution surface in agent-browser | browser-tools SKILL.md (`agent-browser exec`, `--script` modes) | ✓ exists |

**Open question (not blocking decision but blocking implementation):** is the observer accessible from a global like `window.__JSON_RENDER_DEVTOOLS_OBSERVER__` (or similar) or only via the framework adapter's React context? Need to read the 0.18 release commit/source before scoping the implementation. This is the main uncertainty in the implementation effort, not in the design.

## Why extend `/ork:expect`, not build `/ork:test-spec`

| Dimension | Extend `/ork:expect` | New `/ork:test-spec` |
|---|---|---|
| Drives agent-browser session | Already does | Would re-implement |
| Test plan format | Already exists (`.expect/flows/*.yaml`) | New format |
| Failure logs reference scenario names | Already does (via tab labels) | Would re-implement |
| Cognitive overhead for users | "one more assertion type" | "which skill do I use for which test?" |
| Maintenance | One skill | Two skills with overlapping concerns |
| Effort | ~1 day (assertion + capture step) | ~3 days (skill scaffold + plan format + execution) |

The proposal in #1564 has both options listed. Extension wins on every axis; rejecting the new-skill option.

## Prototype: how a spec-aware test would look

```typescript
// .expect/flows/checkout-happy-path.yaml — extended schema
flow: checkout-happy-path
label: checkout-happy-path
steps:
  - action: navigate
    target: /cart
  - action: click
    target: 'role=button[name="Pay"]'
  - action: wait
    timeout: 500
  - action: captureSpec   # ← new in this proposal
    as: $afterPay
  - assert:
      - kind: spec.path   # ← new assertion kind
        from: $afterPay
        path: elements.receiptStatus.props.status
        expected: success
      - kind: spec.path
        from: $afterPay
        path: elements.receipt.props.amount
        expected: $49.99
```

Failure log shape:

```
test-id checkout-happy-path FAIL
  on  spec.elements.receiptStatus.props.status
  expected  "success"
  got       "error"
  capture   $afterPay (ms 1247 after click)
  evidence  rrweb recording at .expect/runs/.../checkout-happy-path.rrweb.json
```

## Implementation sketch (when this is greenlit)

1. **`agent-browser eval` script** — runs in the page context. Reads the observer snapshot from whatever the 0.18 surface turns out to be. Returns the spec as JSON.
2. **`/ork:expect` plan parser** — accepts `captureSpec` action and `spec.path` assertion kind. Existing aria/text/screenshot assertions unchanged.
3. **Spec-path resolver** — `lodash.get`-shape over the captured JSON. Errors clearly: "spec.elements.receiptStatus.props.status not found at $afterPay capture".
4. **Test fixtures** — start from an existing `/ork:expect` flow that hits a json-render-catalog page in the demo app (need a target app — the M125 #2 demo flow is a candidate).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Observer API not browser-globally accessible | Have to inject capture helper into the user's app | Document the snippet; tree-shakes to null in prod |
| Spec key changes still break tests on UI redesigns | Lower brittleness than CSS, not zero | Encourage stable spec keys; offer a `keyAliases` map |
| Capturing full spec is slow for large catalogs | Per-assertion latency | Cache capture per `as: $name`; only re-capture on next `captureSpec` |
| Missing observer in user's build | Tests silently see no spec | Fail loud if `evaluate()` returns null/undefined; "Did you import @json-render/devtools-{adapter}?" |

## Effort estimate (revised from #1564)

Issue had effort=3, impact=5 (priority 1.7). Spike does not move impact, but does shift effort:
- **Was:** effort=3 because "build new skill OR extend /ork:expect"
- **Now:** effort=2 because "extend /ork:expect" only, with the observer-API uncertainty as the main risk.
- New priority: ~2.5 (matches the M127 quick-win tier).

## Recommendation

1. **Close #1564 spike** with this note as the artifact.
2. **Open a follow-up issue** "feat(m127-followup): /ork:expect — spec-path assertions" scoped to:
   - Verify observer access surface (read 0.18 source/release commit)
   - Add `captureSpec` action + `spec.path` assertion kind
   - One end-to-end test against the M125 demo flow
3. **Keep priority high** — this is the most strategically valuable change in M127, on par with #1560/#1561.

## Out of scope for this spike

- Catalog change-detection (separate concern)
- Visual regression on top of spec assertions
- Cross-framework support (decide once React path works)
