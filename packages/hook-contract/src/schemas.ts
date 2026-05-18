/**
 * Hook event JSON Schemas (draft-07) — stable public re-export of codegen
 * output. Actual schemas live in `schemas.generated.ts`, written by
 * `scripts/codegen.mjs` from `spec/hook-events.spec.yml`.
 *
 * To change a schema, edit the spec — never edit either file directly.
 * CI runs `codegen --check` and fails on drift.
 */

export * from './schemas.generated.js';
