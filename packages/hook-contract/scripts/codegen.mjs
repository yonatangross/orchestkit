#!/usr/bin/env node
/**
 * M141-2 codegen entrypoint (#1864).
 *
 * Reads spec/hook-events.spec.yml (single source of truth) and emits:
 *   - packages/hook-contract/src/events.generated.ts
 *   - packages/hook-contract/src/schemas.generated.ts
 *
 * Run via `npm run -w @orchestkit/hook-contract codegen` from repo root,
 * or `npm run codegen` from inside the package.
 *
 * The check mode (`--check`) re-emits in memory and exits non-zero if the
 * committed .generated.ts files differ — this is the parity gate that CI
 * runs to catch someone editing generated files directly.
 *
 * History:
 *   M141-2 step 1 (#1864): scaffold — events.ts + schemas.ts emit only.
 *   M141-2 step 3 (#1864): per-event payload schemas; spec/codegen now
 *     understands optional `payload.{required,optional}` blocks per event.
 *     Switched from inline parser to js-yaml since nested objects are now
 *     load-bearing.
 *
 * TODO (M141-2 step 2): emit PyPI sibling at
 *   packages/hook-contract-py/orchestkit_hook_contract/events.py
 * TODO (M141-2 step 4): wire --check mode + a cross-language parity test
 *   into CI as a true parity gate (currently --check only enforces npm
 *   side; step 4 enforces npm-vs-PyPI parity).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_DIR = join(__dirname, '..');
const REPO_ROOT = join(PKG_DIR, '..', '..');
const SPEC_PATH = join(REPO_ROOT, 'spec', 'hook-events.spec.yml');

const checkMode = process.argv.includes('--check');

/**
 * Parse the spec file via js-yaml. Validates the shape we care about:
 *   { spec_version, events: [{ name, since_cc?, description?, payload? }] }
 *
 * Payload (M141-2 step 3) is optional. When absent, the event keeps
 * `payload: unknown` typing — same shape as step 1. When present, it
 * must be { required?: [Field], optional?: [Field] } where each Field
 * is { name, type, description? }.
 */
function parseSpec(raw) {
  const spec = yaml.load(raw);
  if (!spec || typeof spec !== 'object') {
    throw new Error('spec did not parse as an object');
  }
  if (!Array.isArray(spec.events)) {
    throw new Error('spec.events must be a list');
  }
  // Validate per-event shape and normalize payload to a stable structure.
  spec.events = spec.events.map((e, i) => {
    if (!e.name || typeof e.name !== 'string') {
      throw new Error(`spec.events[${i}] missing required 'name'`);
    }
    if (e.payload !== undefined) {
      if (typeof e.payload !== 'object' || e.payload === null) {
        throw new Error(`spec.events[${i}].payload must be an object (got ${typeof e.payload})`);
      }
      const req = e.payload.required ?? [];
      const opt = e.payload.optional ?? [];
      for (const field of [...req, ...opt]) {
        if (!field || typeof field !== 'object' || !field.name || !field.type) {
          throw new Error(`spec.events[${i}].payload.* field missing required 'name'/'type'`);
        }
      }
      e.payload = { required: req, optional: opt };
    }
    return e;
  });
  return spec;
}

/** TypeScript type expression for a spec field type. */
function tsTypeFor(specType) {
  switch (specType) {
    case 'string':
    case 'number':
    case 'boolean':
      return specType;
    case 'object':
      return 'Record<string, unknown>';
    case 'string[]':
    case 'array<string>':
      return 'string[]';
    case 'unknown':
      return 'unknown';
    default:
      // Allow union-literal types like "'a' | 'b'" verbatim.
      return specType;
  }
}

/** JSON Schema type fragment for a spec field type. */
function schemaTypeFor(specType) {
  switch (specType) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: specType };
    case 'object':
      return { type: 'object', additionalProperties: true };
    case 'string[]':
    case 'array<string>':
      return { type: 'array', items: { type: 'string' } };
    case 'unknown':
      return {};
    default:
      // Fallback for union-literal types: emit empty (accepts anything).
      // Step 4 can refine this when union-literals get first-class spec support.
      return {};
  }
}

function payloadInterfaceName(eventName) {
  return `${eventName}Payload`;
}

function emitEventsTs(spec) {
  const names = spec.events.map((e) => e.name);
  const header = [
    '/**',
    ' * Hook event registry — codegen output (M141-2, #1864).',
    ' *',
    ' * DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.',
    ' * Regenerate via `npm run -w @orchestkit/hook-contract codegen`.',
    ' *',
    ' * CI parity gate: scripts/codegen.mjs --check fails if this file drifts',
    ' * from the spec.',
    ' */',
    '',
  ].join('\n');

  const namesLiteral = names.map((n) => `  '${n}',`).join('\n');

  // Step 3: per-event payload interfaces — emitted only for events with
  // a `payload` block in the spec. Events without payload definitions
  // continue to use `unknown` (backwards-compatible with step 1).
  const payloadInterfaces = spec.events
    .filter((e) => e.payload)
    .map((e) => {
      const lines = [];
      lines.push(`/**`);
      lines.push(` * Payload for the ${e.name} event.`);
      if (e.description) lines.push(` * ${e.description}`);
      lines.push(` */`);
      lines.push(`export interface ${payloadInterfaceName(e.name)} {`);
      for (const f of e.payload.required) {
        if (f.description) lines.push(`  /** ${f.description} */`);
        lines.push(`  ${f.name}: ${tsTypeFor(f.type)};`);
      }
      for (const f of e.payload.optional) {
        if (f.description) lines.push(`  /** ${f.description} */`);
        lines.push(`  ${f.name}?: ${tsTypeFor(f.type)};`);
      }
      lines.push(`}`);
      return lines.join('\n');
    })
    .join('\n\n');

  // Build the per-event payload-map type so consumers can write
  // `PayloadFor<'PreToolUse'>` and get PreToolUsePayload back.
  const payloadMapEntries = spec.events
    .map((e) => `  ${e.name}: ${e.payload ? payloadInterfaceName(e.name) : 'unknown'};`)
    .join('\n');

  const interfacesBlock = payloadInterfaces ? `\n${payloadInterfaces}\n` : '';

  return `${header}
export const HOOK_EVENT_NAMES = [
${namesLiteral}
] as const;

export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

export interface HookEventEnvelope {
  event: HookEventName;
  timestamp?: string;
  session_id?: string;
  cwd?: string;
  payload?: unknown;
}

export type HookEvent = HookEventEnvelope & { event: HookEventName };

export function isHookEventName(value: unknown): value is HookEventName {
  return typeof value === 'string' && (HOOK_EVENT_NAMES as readonly string[]).includes(value);
}

export const HOOK_EVENT_NAME_SET: ReadonlySet<HookEventName> = new Set(HOOK_EVENT_NAMES);
${interfacesBlock}
/**
 * Map from event name to its payload type. Events without a payload
 * block in the spec map to \`unknown\` for backwards compatibility.
 * Consumers can index into this for typed payload access:
 *
 *   function handle(p: PayloadFor<'PreToolUse'>) { p.tool_name; }
 */
export interface PayloadMap {
${payloadMapEntries}
}

export type PayloadFor<E extends HookEventName> = PayloadMap[E];
`;
}

function emitSchemasTs(spec) {
  const header = [
    '/**',
    ' * Hook event JSON Schemas (draft-07) — codegen output (M141-2, #1864).',
    ' *',
    ' * DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.',
    ' * Regenerate via `npm run -w @orchestkit/hook-contract codegen`.',
    ' */',
    '',
  ].join('\n');

  // Build a payload-schemas object literal that the schema function can
  // index into. Keeping it as data (vs hardcoding per-event) keeps the
  // emit deterministic and small.
  const payloadSchemasLiteral = spec.events
    .filter((e) => e.payload)
    .map((e) => {
      const required = e.payload.required.map((f) => f.name);
      const properties = {};
      for (const f of [...e.payload.required, ...e.payload.optional]) {
        const fragment = schemaTypeFor(f.type);
        if (f.description) fragment.description = f.description;
        properties[f.name] = fragment;
      }
      const schema = {
        type: 'object',
        properties,
        additionalProperties: true,
      };
      if (required.length > 0) schema.required = required;
      return `  ${JSON.stringify(e.name)}: ${JSON.stringify(schema, null, 2).replace(/\n/g, '\n  ')},`;
    })
    .join('\n');

  return `${header}
import { HOOK_EVENT_NAMES, type HookEventName } from './events.js';

export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  type?: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'null';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  const?: string;
  enum?: readonly string[];
  description?: string;
  [key: string]: unknown;
}

const SCHEMA_DRAFT = 'https://json-schema.org/draft-07/schema#';

/**
 * Per-event payload schemas (M141-2 step 3, #1864). Events without a
 * payload block in the spec are absent here — their schema falls back
 * to an open \`payload: object\` (envelope-level, M141-1 behavior).
 */
const PAYLOAD_SCHEMAS: Partial<Record<HookEventName, JsonSchema>> = {
${payloadSchemasLiteral}
};

function envelopeSchema(event: HookEventName): JsonSchema {
  const payloadSchema: JsonSchema = PAYLOAD_SCHEMAS[event] ?? { type: 'object', additionalProperties: true };
  return {
    $schema: SCHEMA_DRAFT,
    $id: \`https://orchestkit.dev/schemas/hook-contract/\${event}.json\`,
    title: \`\${event} hook event\`,
    type: 'object',
    properties: {
      event: { type: 'string', const: event },
      timestamp: { type: 'string', description: 'ISO-8601 UTC timestamp' },
      session_id: { type: 'string' },
      cwd: { type: 'string' },
      payload: payloadSchema,
    },
    required: ['event'],
    additionalProperties: true,
  };
}

export const HOOK_EVENT_SCHEMAS: Readonly<Record<HookEventName, JsonSchema>> = Object.freeze(
  Object.fromEntries(HOOK_EVENT_NAMES.map((name) => [name, envelopeSchema(name)])) as Record<
    HookEventName,
    JsonSchema
  >
);

export const HOOK_EVENT_SCHEMA: JsonSchema = {
  $schema: SCHEMA_DRAFT,
  $id: 'https://orchestkit.dev/schemas/hook-contract/HookEvent.json',
  title: 'HookEvent',
  oneOf: HOOK_EVENT_NAMES.map((name) => HOOK_EVENT_SCHEMAS[name]),
};
`;
}

async function main() {
  if (!existsSync(SPEC_PATH)) {
    console.error(`[codegen] spec not found: ${SPEC_PATH}`);
    process.exit(1);
  }

  const raw = await readFile(SPEC_PATH, 'utf8');
  const spec = parseSpec(raw);

  if (spec.events.length !== 19) {
    console.error(`[codegen] expected 19 events in spec, got ${spec.events.length}`);
    process.exit(1);
  }

  const eventsTs = emitEventsTs(spec);
  const schemasTs = emitSchemasTs(spec);

  const eventsPath = join(PKG_DIR, 'src', 'events.generated.ts');
  const schemasPath = join(PKG_DIR, 'src', 'schemas.generated.ts');

  if (checkMode) {
    const existingEvents = existsSync(eventsPath) ? await readFile(eventsPath, 'utf8') : '';
    const existingSchemas = existsSync(schemasPath) ? await readFile(schemasPath, 'utf8') : '';
    if (existingEvents !== eventsTs || existingSchemas !== schemasTs) {
      console.error(
        '[codegen --check] FAILED: generated files drift from spec. Run `npm run codegen` and commit.',
      );
      process.exit(1);
    }
    console.log(`[codegen --check] OK: events.generated.ts + schemas.generated.ts match spec.`);
    return;
  }

  await writeFile(eventsPath, eventsTs, 'utf8');
  await writeFile(schemasPath, schemasTs, 'utf8');
  console.log(`[codegen] wrote ${eventsPath}`);
  console.log(`[codegen] wrote ${schemasPath}`);
}

main().catch((err) => {
  console.error('[codegen] failed:', err);
  process.exit(1);
});
