/**
 * Hook event JSON Schemas (draft-07) — codegen output (M141-2, #1864).
 *
 * DO NOT EDIT BY HAND. Source: spec/hook-events.spec.yml.
 * Regenerate via `npm run -w @orchestkit/hook-contract codegen`.
 */

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
 * to an open `payload: object` (envelope-level, M141-1 behavior).
 */
const PAYLOAD_SCHEMAS: Partial<Record<HookEventName, JsonSchema>> = {

};

function envelopeSchema(event: HookEventName): JsonSchema {
  const payloadSchema: JsonSchema = PAYLOAD_SCHEMAS[event] ?? { type: 'object', additionalProperties: true };
  return {
    $schema: SCHEMA_DRAFT,
    $id: `https://orchestkit.dev/schemas/hook-contract/${event}.json`,
    title: `${event} hook event`,
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
