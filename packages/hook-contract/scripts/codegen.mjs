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
 * will run to catch someone editing generated files directly.
 *
 * TODO (M141-2 step 2): emit PyPI sibling at
 *   packages/hook-contract-py/orchestkit_hook_contract/events.py
 * TODO (M141-2 step 3): refine payload field schemas per-event.
 * TODO (M141-2 step 4): wire the --check mode into CI as a parity gate.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_DIR = join(__dirname, '..');
const REPO_ROOT = join(PKG_DIR, '..', '..');
const SPEC_PATH = join(REPO_ROOT, 'spec', 'hook-events.spec.yml');

const checkMode = process.argv.includes('--check');

// Minimal YAML parser for our spec shape — flat top-level keys + a single
// list-of-objects `events`. Avoids pulling in the `js-yaml` dep just for
// this. If the spec grows complex shapes (anchors/refs), swap in js-yaml.
function parseSpec(raw) {
  const lines = raw.split('\n');
  const events = [];
  let current = null;
  let inEvents = false;
  let metadata = {};
  let specVersion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (line.startsWith('spec_version:')) {
      specVersion = Number(line.split(':')[1].trim());
      continue;
    }

    if (line.startsWith('events:')) {
      inEvents = true;
      continue;
    }

    if (!inEvents) continue;

    // List item: "  - name: SessionStart"
    if (line.startsWith('  - ')) {
      if (current) events.push(current);
      current = {};
      const inline = line.slice(4); // skip "  - "
      const colonIdx = inline.indexOf(':');
      if (colonIdx > -1) {
        const key = inline.slice(0, colonIdx).trim();
        const val = inline.slice(colonIdx + 1).trim();
        current[key] = stripQuotes(val);
      }
    } else if (line.startsWith('    ') && current) {
      // continuation key under current event
      const inline = line.slice(4);
      const colonIdx = inline.indexOf(':');
      if (colonIdx > -1) {
        const key = inline.slice(0, colonIdx).trim();
        const val = inline.slice(colonIdx + 1).trim();
        current[key] = stripQuotes(val);
      }
    } else if (current && trimmed === '') {
      // blank within block — skip
    } else if (!line.startsWith(' ') && inEvents) {
      // Left the events block
      if (current) {
        events.push(current);
        current = null;
      }
      inEvents = false;
    }
  }
  if (current) events.push(current);

  return { specVersion, metadata, events };
}

function stripQuotes(v) {
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
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
`;
}

function emitSchemasTs(_spec) {
  const header = [
    '/**',
    ' * Hook event JSON Schemas (draft-07) — codegen output (M141-2, #1864).',
    ' *',
    ' * DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.',
    ' * Regenerate via `npm run -w @orchestkit/hook-contract codegen`.',
    ' */',
    '',
  ].join('\n');

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

function envelopeSchema(event: HookEventName): JsonSchema {
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
      payload: { type: 'object', additionalProperties: true },
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
        '[codegen --check] FAILED: generated files drift from spec. Run `npm run codegen` and commit.'
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
