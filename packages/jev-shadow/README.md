# Jev shadow foundation

`@orchestkit/jev-shadow` is an offline-only v1 contract, JSONL emitter, and
replay reader for passive Jev observations. It has no network client, no model
client, no queue, and no default state directory. `emitJevShadow()` does
nothing until its caller explicitly supplies an absolute `JEV_SHADOW_ROOT`.

The generated Codex plugin copies one dependency-free runtime module and pins
its SHA-256 in `manifests/codex/ork-codex.json`; its hook verifies that same
hash before importing it. Other adapters must pin this runtime artifact, not
reimplement the schema or sink.

The tracked runtime is deliberately available to CI builds that do not install
TypeScript. After changing `src/runtime.ts`, regenerate it with
`npm run --workspace=@orchestkit/jev-shadow build && cp packages/jev-shadow/dist/esm/runtime.js src/codex/ork-codex/runtime/jev-shadow-runtime.mjs`,
then update the manifest SHA-256. The package test rejects any source/runtime
drift.

Journals are stored as `<root>/<namespace>/<harness>/session-<sha256>/journal.jsonl`.
Namespace and harness segments are validated, session values are hashed for the
path, symlinks are rejected, and an exclusive lock serializes appends. Exact
canonical replay duplicates are skipped. A lock is never stolen automatically:
after a crash, stop all writers and remove the known lock as an explicit offline
operator recovery step.

The shipped Codex `hooks/hooks.json` is a manual fragment with an intentionally
invalid path placeholder. It changes no settings and is not activated by
installing the plugin. The adapter writes a fresh observation ID, never makes a
prompt ID from opaque input, and records pre/post tool observations as an
unobserved incumbent. It only accepts `session_id` on `SessionStart`, never
stores raw prompt text, tool input, tool output, or model payloads, and writes
no hook stdout.

The schema fixture is synthetic test data. Manifest sources can mark
`fixture_only: true`; the collector preserves those rows while excluding them
from paired and confident-wrong totals.
