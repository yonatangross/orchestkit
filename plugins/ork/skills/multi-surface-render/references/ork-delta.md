# ork delta: multi-surface-render

What this skill knows that the vendor docs do not say. Everything else was retired in favour of a
pointer; see "Upstream coverage (do not restate)" in `SKILL.md`.

## Read json-render render options off the vendored upstream file, never a hand-copied API table

Why: distilled from the retired `references/renderer-api.md`; no traced incident. That file claimed
`catalog` was a required option on every renderer and that `renderToBuffer` accepted `pageSize`,
`orientation` and `margins`. `references/upstream-pdf.md` ("Render APIs") documents the 0.19 second
argument as `{ registry?, state?, handlers? }`, and page size, orientation and margins are props of
the `Page` component, not render options. `SKILL.md` and `rules/react-renderer.md` already carried
the corrected shape, so the skill shipped two contradicting answers to the same question.

Upstream: `references/upstream-pdf.md` and `references/upstream-email.md` in this directory, vendored
verbatim by `scripts/sync-vercel-skills.sh`; re-sync before trusting any API claim.

## Treat the vendored upstream export tables as authoritative when a snippet disagrees

Why: distilled from the retired `references/renderer-api.md`; no traced incident. This rule earned
itself the same day it was written. The retired file and every hand-written Remotion snippet in this
skill used `<JsonRenderComposition fps durationInFrames width height>`, while
`references/upstream-remotion.md` listed `Renderer` under Key Exports. The vendored file was right:
`check-import-symbols.mjs` later confirmed against `@json-render/remotion@0.19.0` that
`JsonRenderComposition` has never been exported at all. The snippets were corrected to
`Renderer({ spec, components })` on 2026-07-31, with fps and durationInFrames moved onto Remotion's
own `Composition` where they belong. When a hand-written snippet disagrees with the synced file, the
synced file breaks the tie and the snippet is the thing that gets corrected.

Upstream: `references/upstream-remotion.md` ("Key Exports") in this directory.

## Never render a Remotion video inside a request handler

Why: distilled from the retired `references/target-comparison.md`; no traced incident. Its budget put
a full Remotion render at 10 to 60 seconds with high CPU and memory, against 50 to 500ms for every
other target in the same table. Video is the one surface that cannot sit behind a synchronous HTTP
response: queue it, or push it to cloud rendering.

Upstream: https://www.remotion.dev/docs/lambda

## Pick the PDF output mode by document size, not by convenience

Why: distilled from the retired `references/target-comparison.md`; no traced incident. Its budget put
`renderToBuffer` at 200 to 500ms with the whole document held in memory, against 100 to 300ms to
first byte for `renderToStream`. Those numbers are the reason `rules/pdf-email-renderer.md` routes
large documents through the stream path instead of buffering, and they are what makes the choice
decidable instead of a coin flip.

Upstream: `references/upstream-pdf.md` ("Render APIs") in this directory.

## Build PDF and React Native registries flexbox-only, with no className

Why: distilled from the retired `references/target-comparison.md`; no traced incident. Both surfaces
run a layout engine that is a strict subset of CSS: no grid, no `className`, no `div` or `span`. PDF
needs `View` and `Text` with `StyleSheet.create()`, React Native the same.
`rules/registry-mapping.md` shows the primitives but not the layout ceiling, and the ceiling is what
makes a copied web registry fail at render time rather than at type-check.

Upstream: https://react-pdf.org/styling and https://reactnative.dev/docs/flexbox

## Per-target latency budgets, the full table

Why: distilled from the retired `references/target-comparison.md`. Only the Remotion and
PDF figures survived elsewhere, and a partial table invites the assumption that the
missing targets are free. The house budgets are React under 50ms, Email 50 to 100ms,
Image SVG 100 to 200ms, Image PNG 200 to 400ms, Codegen 50 to 100ms, PDF buffer 200 to
500ms (100 to 300ms to first byte when streaming), Remotion 10 to 60s. These are the
numbers that decide whether a target belongs in a request path or behind a job queue,
and no vendor page publishes a cross-target comparison.
Upstream: none; this is a house measurement across the json-render packages

## Combine targets deliberately, from the house pairings

Why: distilled from the retired `references/target-comparison.md`; pure house guidance
with no vendor equivalent. The pairings we actually ship are React plus PDF for a
download button, React plus Email for a weekly digest, React plus Image for an OG
preview, React plus Remotion for a landing-page demo, and all of them together for a
full marketing suite. The point of the list is that one catalog serves each pair, so the
second target is close to free once the first exists.
Upstream: none; house composition guidance

## Register custom fonts explicitly before rendering PDF

Why: distilled from the retired `references/target-comparison.md`; PDF is the one target
where a custom font must be embedded rather than referenced, and neither
`references/upstream-pdf.md` nor `rules/pdf-email-renderer.md` documents a
font-registration API. A spec that renders correctly on web silently falls back to a
default face in the PDF, which is a visual regression nobody catches in review because
the web preview is fine.
Upstream: https://react-pdf.org/fonts
