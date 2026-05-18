/**
 * Hook event registry — stable public re-export of codegen output.
 *
 * The actual registry lives in `events.generated.ts`, written by
 * `scripts/codegen.mjs` from `spec/hook-events.spec.yml`. This wrapper
 * exists so external consumers keep the path stable
 * (`@orchestkit/hook-contract/events`) even as codegen evolves.
 *
 * To change the event set, edit the spec — never edit either file
 * directly. CI runs `codegen --check` and fails on drift.
 */

export * from './events.generated.js';
